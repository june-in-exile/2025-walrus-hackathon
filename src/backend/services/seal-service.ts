/**
 * Seal Encryption Service
 *
 * Handles server-side encryption and decryption using @mysten/seal SDK.
 * Integrates with the whitelist.move contract for access control.
 *
 * Key-ID Format: [whitelist object id][nonce]
 * - whitelist object id: 32 bytes (Sui object ID)
 * - nonce: arbitrary bytes (e.g., deal ID + timestamp)
 */

import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { config, debugConfig } from '@/src/shared/config/env';
import type {
  SealEncryptionResult,
  SealDecryptionResult,
  AccessVerificationResult,
  UserRole,
} from '@/src/shared/types/walrus';

/**
 * Configuration for whitelist-based encryption
 */
export interface WhitelistEncryptionConfig {
  /** Whitelist object ID on Sui (controls who can decrypt) */
  whitelistObjectId: string;
  /** Package ID where whitelist module is deployed */
  packageId: string;
}

/**
 * Seal Service for server-side encryption/decryption
 *
 * Integrates with earnout_agreement::whitelist Move contract for access control.
 * Only addresses added to a Whitelist can decrypt data encrypted with that whitelist's key-id.
 */
export class SealService {
  private sealClient: SealClient;
  private suiClient: SuiClient;
  private backendKeypair: Ed25519Keypair | null = null;

  constructor() {
    // Initialize Sui client
    this.suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

    // Initialize Seal client with Key Server configurations
    this.sealClient = new SealClient({
      suiClient: this.suiClient,
      serverConfigs: this.getKeyServerConfigs(),
      verifyKeyServers: false, // Set to true in production after verifying key servers
      timeout: config.app.apiTimeout,
    });

    // Initialize backend keypair if private key is provided
    if (config.sui.backendPrivateKey) {
      try {
        // Decode base64 private key
        let privateKeyBytes = Buffer.from(config.sui.backendPrivateKey, 'base64');

        // Handle different key formats:
        // - 32 bytes: raw Ed25519 secret key
        // - 33 bytes: scheme flag (0x00 for Ed25519) + 32 byte secret key
        // - 64 bytes: full keypair (secret + public)
        if (privateKeyBytes.length === 33) {
          // Remove the scheme flag prefix (first byte)
          privateKeyBytes = privateKeyBytes.subarray(1);
        } else if (privateKeyBytes.length === 64) {
          // Take only the first 32 bytes (secret key)
          privateKeyBytes = privateKeyBytes.subarray(0, 32);
        }

        this.backendKeypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.error('Failed to initialize backend keypair:', error);
      }
    }

    if (debugConfig.seal) {
      console.log('SealService initialized');
      console.log('Key Server Config:', this.getKeyServerConfigs());
      console.log('Policy Object ID:', config.seal.policyObjectId);
    }
  }

  /**
   * Get Key Server configurations
   *
   * Format based on Seal SDK requirements:
   * Each server config needs objectId (Sui object ID of key server) and weight
   *
   * Example testnet key servers:
   * - 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75
   * - 0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8
   */
  private getKeyServerConfigs() {
    // Get key server object IDs from environment
    // Format: SEAL_KEY_SERVER_OBJECT_IDS=0x123...,0x456...
    const keyServerObjectIds = process.env.SEAL_KEY_SERVER_OBJECT_IDS?.split(',') || [];

    if (keyServerObjectIds.length === 0) {
      console.warn('WARNING: No Seal Key Server object IDs configured');
      console.warn('Set SEAL_KEY_SERVER_OBJECT_IDS in environment variables');
      console.warn('Example: SEAL_KEY_SERVER_OBJECT_IDS=0x73d05d62...,0xf5d14a81...');
    }

    return keyServerObjectIds.map((objectId) => ({
      objectId: objectId.trim(),
      weight: 1, // Equal weight for all servers
    }));
  }

  /**
   * Encrypt file data using Seal with whitelist-based access control
   *
   * @param plaintext - File data to encrypt
   * @param encryptionConfig - Whitelist encryption configuration
   * @returns Encrypted data with metadata
   */
  async encrypt(
    plaintext: Buffer,
    encryptionConfig: WhitelistEncryptionConfig
  ): Promise<SealEncryptionResult> {
    if (!config.app.enableServerEncryption) {
      throw new Error('Server-side encryption is disabled');
    }

    try {
      // The Seal SDK expects id as a hex string (with or without 0x prefix)
      // Remove 0x prefix for consistency with Seal's fromHex which handles both
      const id = encryptionConfig.whitelistObjectId.startsWith('0x')
        ? encryptionConfig.whitelistObjectId.slice(2)
        : encryptionConfig.whitelistObjectId;

      if (debugConfig.seal) {
        console.log('Encrypting data with Seal (whitelist mode)');
        console.log('Whitelist Object ID:', encryptionConfig.whitelistObjectId);
        console.log('Package ID:', encryptionConfig.packageId);
        console.log('ID (hex):', id);
        console.log('Data size:', plaintext.length, 'bytes');
      }

      // Convert Buffer to Uint8Array
      const data = new Uint8Array(plaintext);

      // Encrypt using Seal
      // The id parameter is the access control policy identifier (whitelist object ID as hex string)
      // Seal will automatically prepend the package ID to create the full key-id
      const { encryptedObject } = await this.sealClient.encrypt({
        threshold: 2, // Require 2 out of N key servers
        packageId: encryptionConfig.packageId,
        id, // whitelist object ID as hex string
        data,
      });

      // Generate commitment (hash of encrypted object)
      const commitment = await this.generateCommitment(new Uint8Array(encryptedObject));

      const result: SealEncryptionResult = {
        ciphertext: Buffer.from(encryptedObject),
        commitment,
        policyObjectId: encryptionConfig.whitelistObjectId,
        encryptedAt: new Date().toISOString(),
      };

      if (debugConfig.seal) {
        console.log('Encryption successful');
        console.log('Ciphertext size:', result.ciphertext.length, 'bytes');
        console.log('Commitment:', commitment);
      }

      return result;
    } catch (error) {
      console.error('Seal encryption failed:', error);
      throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt file data using Seal with whitelist-based access control
   *
   * @param ciphertext - Encrypted file data
   * @param whitelistObjectId - Whitelist object ID for access control
   * @param packageId - Package ID where whitelist module is deployed
   * @param userAddress - User's Sui address (must be on whitelist)
   * @returns Decrypted data with metadata
   */
  async decrypt(
    ciphertext: Buffer,
    whitelistObjectId: string,
    packageId: string,
    userAddress: string
  ): Promise<SealDecryptionResult> {
    if (!config.app.enableServerEncryption) {
      throw new Error('Server-side decryption is disabled');
    }

    if (!this.backendKeypair) {
      throw new Error('Backend keypair is not configured for decryption');
    }

    try {
      if (debugConfig.seal) {
        console.log('Decrypting data with Seal (whitelist mode)');
        console.log('Whitelist Object ID:', whitelistObjectId);
        console.log('Package ID:', packageId);
        console.log('User Address:', userAddress);
        console.log('Ciphertext size:', ciphertext.length, 'bytes');
      }

      // Verify user has access before decrypting
      // In server-side mode, backend acts as trusted intermediary but must check user authorization
      const accessResult = await this.verifyAccess(whitelistObjectId, userAddress);
      if (!accessResult.hasAccess) {
        throw new Error(`User ${userAddress} is not authorized to decrypt: ${accessResult.reason}`);
      }

      if (debugConfig.seal) {
        console.log('User access verified:', userAddress);
      }

      // Convert Buffer to Uint8Array
      const data = new Uint8Array(ciphertext);

      // Parse encrypted object to get the key-id
      // Note: encryptedKeyId is a hex string (BCS transform applies toHex)
      const parsedEncryptedBlob = EncryptedObject.parse(data);
      const encryptedKeyId = parsedEncryptedBlob.id;

      if (debugConfig.seal) {
        console.log('Encrypted Key-ID (hex):', encryptedKeyId);
      }

      // Create session key for decryption
      // In server-side mode, we use backend keypair as trusted intermediary
      // Note: SessionKey expects packageId as a hex string (with 0x prefix)
      const sessionKey = await SessionKey.create({
        address: this.backendKeypair.toSuiAddress(),
        packageId: packageId,
        ttlMin: 10, // 10 minute session
        signer: this.backendKeypair,
        suiClient: this.suiClient,
      });

      // Build approval transaction that calls seal_approve from whitelist module
      // This transaction is NOT executed, just used for verification
      const tx = new Transaction();

      // Call earnout_agreement::whitelist::seal_approve
      // Arguments: (id: vector<u8>, wl: &Whitelist, ctx: &TxContext)
      // Note: id should be the key-id bytes (without package prefix)
      tx.moveCall({
        target: `${packageId}::whitelist::seal_approve`,
        arguments: [
          // First argument: the key-id as bytes (convert from hex string)
          tx.pure.vector('u8', Array.from(fromHex(encryptedKeyId))),
          // Second argument: reference to the Whitelist object
          tx.object(whitelistObjectId),
        ],
      });

      // Build transaction bytes (only the transaction kind, not executable)
      const txBytes = await tx.build({
        client: this.suiClient,
        onlyTransactionKind: true,
      });

      if (debugConfig.seal) {
        console.log('Built seal_approve transaction');
        console.log('Transaction bytes length:', txBytes.length);
      }

      // Fetch decryption keys from Seal Key Servers
      // The key servers will simulate the transaction to verify access
      await this.sealClient.fetchKeys({
        ids: [encryptedKeyId],
        txBytes,
        sessionKey,
        threshold: 2, // Must match encryption threshold
      });

      // Decrypt using Seal
      const plaintext = await this.sealClient.decrypt({
        data,
        sessionKey,
        txBytes,
      });

      const result: SealDecryptionResult = {
        plaintext: Buffer.from(plaintext),
        metadata: {
          policyObjectId: whitelistObjectId,
          encryptedAt: new Date().toISOString(), // Should be retrieved from blob metadata
        },
      };

      if (debugConfig.seal) {
        console.log('Decryption successful');
        console.log('Plaintext size:', result.plaintext.length, 'bytes');
      }

      return result;
    } catch (error) {
      console.error('Seal decryption failed:', error);
      throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify if user has access to decrypt (is on whitelist)
   *
   * @param whitelistObjectId - Whitelist object ID
   * @param userAddress - User's Sui address
   * @param requiredRole - Required role (optional, for future role-based access)
   * @returns Access verification result
   */
  async verifyAccess(
    whitelistObjectId: string,
    userAddress: string,
    requiredRole?: UserRole
  ): Promise<AccessVerificationResult> {
    try {
      if (debugConfig.seal) {
        console.log('Verifying whitelist access for user:', userAddress);
        console.log('Whitelist Object ID:', whitelistObjectId);
        console.log('Required role:', requiredRole || 'any');
      }

      // Query the Whitelist object to check membership
      const whitelistObject = await this.suiClient.getObject({
        id: whitelistObjectId,
        options: {
          showContent: true,
        },
      });

      if (!whitelistObject.data) {
        return {
          hasAccess: false,
          reason: 'Whitelist object not found',
        };
      }

      // Parse whitelist content
      const content = whitelistObject.data.content;
      if (content?.dataType !== 'moveObject') {
        return {
          hasAccess: false,
          reason: 'Invalid whitelist object type',
        };
      }

      // Check if user is in the whitelist
      // The whitelist stores addresses in a Table<address, bool>
      // We need to use dynamic field query to check membership
      const isWhitelisted = await this.checkWhitelistMembership(
        whitelistObjectId,
        userAddress
      );

      if (!isWhitelisted) {
        return {
          hasAccess: false,
          reason: 'User is not on the whitelist',
        };
      }

      // For now, we don't have role information in whitelist
      // In production, you might want to store roles alongside addresses
      return {
        hasAccess: true,
        role: requiredRole || 'buyer', // Default role
      };
    } catch (error) {
      console.error('Access verification failed:', error);
      return {
        hasAccess: false,
        reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if an address is in the whitelist using dynamic field query
   *
   * @param whitelistObjectId - Whitelist object ID
   * @param userAddress - Address to check
   * @returns true if address is whitelisted
   */
  private async checkWhitelistMembership(
    whitelistObjectId: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      // First, get the Whitelist object to find the Table's object ID
      const whitelistObj = await this.suiClient.getObject({
        id: whitelistObjectId,
        options: {
          showContent: true,
        },
      });

      if (!whitelistObj.data?.content || whitelistObj.data.content.dataType !== 'moveObject') {
        if (debugConfig.seal) {
          console.log('Failed to get whitelist object content');
        }
        return false;
      }

      // Extract the Table's object ID from the 'addresses' field
      const fields = whitelistObj.data.content.fields as Record<string, unknown>;
      const addressesTable = fields.addresses as { fields: { id: { id: string } } };
      const tableId = addressesTable?.fields?.id?.id;

      if (!tableId) {
        if (debugConfig.seal) {
          console.log('Failed to extract table ID from whitelist');
        }
        return false;
      }

      // Query the Table's dynamic field for the user address
      const dynamicField = await this.suiClient.getDynamicFieldObject({
        parentId: tableId,
        name: {
          type: 'address',
          value: userAddress,
        },
      });

      // If the field exists and has data, the user is whitelisted
      if (!dynamicField.data) {
        if (debugConfig.seal) {
          console.log('User not found in whitelist:', userAddress);
        }
        return false;
      }

      return true;
    } catch (error) {
      // Field not found means user is not whitelisted
      if (debugConfig.seal) {
        console.log('User not found in whitelist:', userAddress, error);
      }
      return false;
    }
  }

  /**
   * Add an address to the whitelist
   *
   * This builds a transaction but does NOT execute it.
   * The frontend must sign and execute with a valid Cap holder.
   *
   * @param whitelistObjectId - Whitelist object ID
   * @param capObjectId - Admin Cap object ID
   * @param addressToAdd - Address to add to whitelist
   * @param packageId - Package ID
   * @returns Transaction bytes (unsigned)
   */
  async buildAddToWhitelistTx(
    whitelistObjectId: string,
    capObjectId: string,
    addressToAdd: string,
    packageId: string
  ): Promise<Uint8Array> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::whitelist::add`,
      arguments: [
        tx.object(whitelistObjectId),
        tx.object(capObjectId),
        tx.pure.address(addressToAdd),
      ],
    });

    return tx.build({ client: this.suiClient });
  }

  /**
   * Remove an address from the whitelist
   *
   * This builds a transaction but does NOT execute it.
   *
   * @param whitelistObjectId - Whitelist object ID
   * @param capObjectId - Admin Cap object ID
   * @param addressToRemove - Address to remove
   * @param packageId - Package ID
   * @returns Transaction bytes (unsigned)
   */
  async buildRemoveFromWhitelistTx(
    whitelistObjectId: string,
    capObjectId: string,
    addressToRemove: string,
    packageId: string
  ): Promise<Uint8Array> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::whitelist::remove`,
      arguments: [
        tx.object(whitelistObjectId),
        tx.object(capObjectId),
        tx.pure.address(addressToRemove),
      ],
    });

    return tx.build({ client: this.suiClient });
  }

  /**
   * Create a new whitelist
   *
   * This builds a transaction but does NOT execute it.
   *
   * @param packageId - Package ID
   * @returns Transaction bytes (unsigned)
   */
  async buildCreateWhitelistTx(packageId: string): Promise<Uint8Array> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::whitelist::create_whitelist_entry`,
    });

    return tx.build({ client: this.suiClient });
  }

  // =============================================================================
  // Execute Methods (for backend testing - uses backend keypair to sign)
  // =============================================================================

  /**
   * Execute create whitelist transaction using backend keypair
   *
   * @param packageId - Package ID
   * @returns Transaction result with created object IDs
   */
  async executeCreateWhitelist(packageId: string): Promise<{
    digest: string;
    whitelistId: string;
    capId: string;
  }> {
    if (!this.backendKeypair) {
      throw new Error('Backend keypair not configured. Set SUI_BACKEND_PRIVATE_KEY in environment.');
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::whitelist::create_whitelist_entry`,
    });

    const result = await this.suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: this.backendKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // Extract created object IDs
    const createdObjects = result.objectChanges?.filter(
      (change) => change.type === 'created'
    ) || [];

    // Find Whitelist and Cap objects
    let whitelistId = '';
    let capId = '';

    for (const obj of createdObjects) {
      if (obj.type === 'created') {
        const objectType = obj.objectType;
        if (objectType.includes('::whitelist::Whitelist')) {
          whitelistId = obj.objectId;
        } else if (objectType.includes('::whitelist::Cap')) {
          capId = obj.objectId;
        }
      }
    }

    if (debugConfig.seal) {
      console.log('Created whitelist:', whitelistId);
      console.log('Created cap:', capId);
      console.log('Transaction digest:', result.digest);
    }

    return {
      digest: result.digest,
      whitelistId,
      capId,
    };
  }

  /**
   * Execute add to whitelist transaction using backend keypair
   *
   * @param whitelistObjectId - Whitelist object ID
   * @param capObjectId - Admin Cap object ID
   * @param addressToAdd - Address to add
   * @param packageId - Package ID
   * @returns Transaction digest
   */
  async executeAddToWhitelist(
    whitelistObjectId: string,
    capObjectId: string,
    addressToAdd: string,
    packageId: string
  ): Promise<string> {
    if (!this.backendKeypair) {
      throw new Error('Backend keypair not configured. Set SUI_BACKEND_PRIVATE_KEY in environment.');
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::whitelist::add`,
      arguments: [
        tx.object(whitelistObjectId),
        tx.object(capObjectId),
        tx.pure.address(addressToAdd),
      ],
    });

    const result = await this.suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: this.backendKeypair,
      options: {
        showEffects: true,
      },
    });

    if (debugConfig.seal) {
      console.log('Added to whitelist:', addressToAdd);
      console.log('Transaction digest:', result.digest);
    }

    return result.digest;
  }

  /**
   * Execute remove from whitelist transaction using backend keypair
   *
   * @param whitelistObjectId - Whitelist object ID
   * @param capObjectId - Admin Cap object ID
   * @param addressToRemove - Address to remove
   * @param packageId - Package ID
   * @returns Transaction digest
   */
  async executeRemoveFromWhitelist(
    whitelistObjectId: string,
    capObjectId: string,
    addressToRemove: string,
    packageId: string
  ): Promise<string> {
    if (!this.backendKeypair) {
      throw new Error('Backend keypair not configured. Set SUI_BACKEND_PRIVATE_KEY in environment.');
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::whitelist::remove`,
      arguments: [
        tx.object(whitelistObjectId),
        tx.object(capObjectId),
        tx.pure.address(addressToRemove),
      ],
    });

    const result = await this.suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: this.backendKeypair,
      options: {
        showEffects: true,
      },
    });

    if (debugConfig.seal) {
      console.log('Removed from whitelist:', addressToRemove);
      console.log('Transaction digest:', result.digest);
    }

    return result.digest;
  }

  /**
   * Generate cryptographic commitment for encrypted data
   *
   * @param data - Data to generate commitment for
   * @returns Hex-encoded commitment
   */
  private async generateCommitment(data: Uint8Array): Promise<string> {
    // Use SHA-256 to generate commitment
    // Convert Uint8Array to Buffer to ensure compatibility
    const buffer = Buffer.from(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }
}

/**
 * Singleton instance of SealService
 */
export const sealService = new SealService();
