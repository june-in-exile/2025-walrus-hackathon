/**
 * Seal Encryption Service
 *
 * Handles server-side encryption and decryption using @mysten/seal SDK.
 * Integrates with the earnout.move contract for Deal-based access control.
 *
 * Key-ID Format: [packageId][dealId]
 * - packageId: 32 bytes (Sui package ID where earnout module is deployed)
 * - dealId: 32 bytes (Sui object ID of the Deal)
 *
 * Access Control: Only the buyer, seller, or auditor of a Deal can decrypt
 * data encrypted with that Deal's ID. This is enforced by the seal_approve
 * function in earnout.move (line 529).
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
 * Configuration for Deal-based encryption
 */
export interface DealEncryptionConfig {
  /** Deal object ID on Sui (controls who can decrypt via buyer/seller/auditor roles) */
  dealId: string;
  /** Package ID where earnout module is deployed */
  packageId: string;
}

/**
 * Seal Service for server-side encryption/decryption
 *
 * Integrates with contracts::earnout Move contract for access control.
 * Only the buyer, seller, or auditor of a Deal can decrypt data encrypted with that Deal's ID.
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
      console.log('Backend address:', this.backendKeypair?.toSuiAddress() || 'not configured');
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
   * Encrypt file data using Seal with Deal-based access control
   *
   * @param plaintext - File data to encrypt
   * @param encryptionConfig - Deal encryption configuration
   * @returns Encrypted data with metadata
   */
  async encrypt(
    plaintext: Buffer,
    encryptionConfig: DealEncryptionConfig
  ): Promise<SealEncryptionResult> {
    if (!config.app.enableServerEncryption) {
      throw new Error('Server-side encryption is disabled');
    }

    try {
      // The Seal SDK expects id as a hex string (with or without 0x prefix)
      // Remove 0x prefix for consistency with Seal's fromHex which handles both
      const id = encryptionConfig.dealId.startsWith('0x')
        ? encryptionConfig.dealId.slice(2)
        : encryptionConfig.dealId;

      if (debugConfig.seal) {
        console.log('Encrypting data with Seal (Deal-based access control)');
        console.log('Deal ID:', encryptionConfig.dealId);
        console.log('Package ID:', encryptionConfig.packageId);
        console.log('ID (hex):', id);
        console.log('Data size:', plaintext.length, 'bytes');
      }

      // Convert Buffer to Uint8Array
      const data = new Uint8Array(plaintext);

      // Encrypt using Seal
      // The id parameter is the Deal object ID (as hex string)
      // Seal will automatically prepend the package ID to create the full key-id: [packageId][dealId]
      const { encryptedObject } = await this.sealClient.encrypt({
        threshold: 2, // Require 2 out of N key servers
        packageId: encryptionConfig.packageId,
        id, // Deal object ID as hex string
        data,
      });

      // Generate commitment (hash of encrypted object)
      const commitment = await this.generateCommitment(new Uint8Array(encryptedObject));

      const result: SealEncryptionResult = {
        ciphertext: Buffer.from(encryptedObject),
        commitment,
        policyObjectId: encryptionConfig.dealId, // Store Deal ID for reference
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
   * Decrypt file data using Seal with Deal-based access control
   *
   * @param ciphertext - Encrypted file data
   * @param dealId - Deal object ID for access control
   * @param packageId - Package ID where earnout module is deployed
   * @param userAddress - User's Sui address (must be buyer/seller/auditor of Deal)
   * @returns Decrypted data with metadata
   */
  async decrypt(
    ciphertext: Buffer,
    dealId: string,
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
        console.log('Decrypting data with Seal (Deal-based access control)');
        console.log('Deal ID:', dealId);
        console.log('Package ID:', packageId);
        console.log('User Address:', userAddress);
        console.log('Ciphertext size:', ciphertext.length, 'bytes');
      }

      // Verify user has access before decrypting
      // In server-side mode, backend acts as trusted intermediary but must check user authorization
      const accessResult = await this.verifyAccess(dealId, userAddress);
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

      // Build approval transaction that calls seal_approve from earnout module
      // This transaction is NOT executed, just used for verification by Seal Key Servers
      const tx = new Transaction();

      // Call contracts::earnout::seal_approve
      // Arguments: (id: vector<u8>, deal: &Deal, ctx: &TxContext)
      // The key-id format from Seal SDK is: [packageId (32 bytes)][dealId (32 bytes)]
      tx.moveCall({
        target: `${packageId}::earnout::seal_approve`,
        arguments: [
          // First argument: the full key-id as bytes (packageId + dealId)
          tx.pure.vector('u8', Array.from(fromHex(encryptedKeyId))),
          // Second argument: reference to the Deal object
          tx.object(dealId),
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
          policyObjectId: dealId,
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
   * Verify if user has access to decrypt (is a Deal participant)
   *
   * @param dealId - Deal object ID
   * @param userAddress - User's Sui address
   * @param requiredRole - Required role (optional, for role-based access)
   * @returns Access verification result
   */
  async verifyAccess(
    dealId: string,
    userAddress: string,
    requiredRole?: UserRole
  ): Promise<AccessVerificationResult> {
    try {
      if (debugConfig.seal) {
        console.log('Verifying Deal access for user:', userAddress);
        console.log('Deal ID:', dealId);
        console.log('Required role:', requiredRole || 'any');
      }

      // Query the Deal object to check membership
      const dealObject = await this.suiClient.getObject({
        id: dealId,
        options: {
          showContent: true,
        },
      });

      if (!dealObject.data) {
        return {
          hasAccess: false,
          reason: 'Deal object not found',
        };
      }

      // Parse Deal content
      const content = dealObject.data.content;
      if (content?.dataType !== 'moveObject') {
        return {
          hasAccess: false,
          reason: 'Invalid Deal object type',
        };
      }

      // Check if user is a Deal participant (buyer/seller/auditor)
      const { hasAccess, role } = await this.checkDealMembership(
        dealId,
        userAddress
      );

      if (!hasAccess) {
        return {
          hasAccess: false,
          reason: 'User is not a participant in this Deal',
        };
      }

      // If a specific role is required, verify it matches
      if (requiredRole && role !== requiredRole) {
        return {
          hasAccess: false,
          reason: `User role '${role}' does not match required role '${requiredRole}'`,
        };
      }

      return {
        hasAccess: true,
        role,
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
   * Check if an address is a participant in a Deal
   *
   * @param dealId - Deal object ID
   * @param userAddress - Address to check
   * @returns Object with hasAccess boolean and role if participant
   */
  private async checkDealMembership(
    dealId: string,
    userAddress: string
  ): Promise<{ hasAccess: boolean; role?: UserRole }> {
    try {
      // Get the Deal object to check if user is buyer/seller/auditor
      const dealObj = await this.suiClient.getObject({
        id: dealId,
        options: {
          showContent: true,
        },
      });

      if (!dealObj.data?.content || dealObj.data.content.dataType !== 'moveObject') {
        if (debugConfig.seal) {
          console.log('Failed to get Deal object content');
        }
        return { hasAccess: false };
      }

      // Extract buyer, seller, auditor from Deal fields
      const fields = dealObj.data.content.fields as Record<string, unknown>;

      const buyer = fields.buyer as string;
      const seller = fields.seller as string;
      const auditor = fields.auditor as string;

      if (debugConfig.seal) {
        console.log('Deal participants:');
        console.log('  buyer:', buyer);
        console.log('  seller:', seller);
        console.log('  auditor:', auditor);
        console.log('  checking user:', userAddress);
      }

      // Check if user is one of the three roles and return the role
      if (userAddress === buyer) {
        return { hasAccess: true, role: 'buyer' };
      } else if (userAddress === seller) {
        return { hasAccess: true, role: 'seller' };
      } else if (userAddress === auditor) {
        return { hasAccess: true, role: 'auditor' };
      }

      if (debugConfig.seal) {
        console.log('User not found in Deal participants:', userAddress);
      }

      return { hasAccess: false };
    } catch (error) {
      // Error means user is not authorized
      if (debugConfig.seal) {
        console.log('User not found in Deal participants:', userAddress, error);
      }
      return { hasAccess: false };
    }
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
