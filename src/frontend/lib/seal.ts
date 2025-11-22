// src/frontend/lib/seal.ts

import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import type { SuiClient } from '@mysten/sui/client';

/**
 * Returns the configuration for the Seal Key Servers.
 * It reads the server object IDs from the environment variables.
 * @returns An array of key server configurations.
 */
function getKeyServerConfigs() {
  // In a Next.js app, process.env only contains server-side env vars by default.
  // For client-side access, they must be prefixed with NEXT_PUBLIC_.
  const keyServerObjectIds = process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_OBJECT_IDS?.split(',') || [];

  if (keyServerObjectIds.length === 0) {
    console.warn('WARNING: No Seal Key Server object IDs configured. Encryption/decryption will likely fail.');
    console.warn('Set NEXT_PUBLIC_SEAL_KEY_SERVER_OBJECT_IDS in your .env.local file.');
    console.warn('Example: NEXT_PUBLIC_SEAL_KEY_SERVER_OBJECT_IDS=0x73d05d62...,0xf5d14a81...');
  }

  return keyServerObjectIds.map((objectId) => ({
    objectId: objectId.trim(),
    weight: 1, // Equal weight for all servers
  }));
}

/**
 * Creates a new SealClient instance.
 * @param suiClient - The SuiClient instance to use (from @mysten/dapp-kit's useSuiClient hook)
 * @returns A new SealClient instance.
 */
function createSealClient(suiClient: SuiClient): SealClient {
  return new SealClient({
    suiClient: suiClient,
    serverConfigs: getKeyServerConfigs(),
    verifyKeyServers: process.env.NODE_ENV === 'production', // Verify in production
    timeout: 10000, // 10-second timeout
  });
}

/**
 * Encrypts data using Seal with Deal-based access control.
 * This function is designed for client-side use.
 *
 * @param suiClient - The SuiClient instance (from @mysten/dapp-kit's useSuiClient hook)
 * @param data - The raw data to be encrypted (ArrayBuffer or Uint8Array).
 * @param dealId - The Sui object ID of the Deal that controls decryption access.
 * @param packageId - The Sui package ID where the earnout module is deployed.
 * @returns A Promise that resolves to the encrypted data as a Uint8Array.
 */
export async function encryptData(
  suiClient: SuiClient,
  data: ArrayBuffer | Uint8Array,
  dealId: string,
  packageId: string
): Promise<Uint8Array> {
  const sealClient = createSealClient(suiClient);
  const dealIdHex = dealId.startsWith('0x') ? dealId.slice(2) : dealId;
  const dataToEncrypt = data instanceof Uint8Array ? data : new Uint8Array(data);

  try {
    const { encryptedObject } = await sealClient.encrypt({
      threshold: 2,
      packageId: packageId,
      id: dealIdHex,
      data: dataToEncrypt,
    });

    return encryptedObject;
  } catch (error) {
    console.error('Seal encryption failed:', error);
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts data using Seal with Deal-based access control.
 * This function is designed for client-side use and requires user wallet interaction.
 *
 * @param suiClient - The SuiClient instance (from @mysten/dapp-kit's useSuiClient hook)
 * @param encryptedData - The encrypted data to be decrypted (ArrayBuffer or Uint8Array).
 * @param dealId - The Sui object ID of the Deal used for encryption.
 * @param packageId - The Sui package ID where the earnout module is deployed.
 * @param userAddress - The Sui address of the current user attempting to decrypt.
 * @param signPersonalMessage - The signing function from the user's wallet (e.g., from @mysten/dapp-kit's useSignPersonalMessage).
 * @returns A Promise that resolves to the decrypted raw data as a Uint8Array.
 */
export async function decryptData(
  suiClient: SuiClient,
  encryptedData: ArrayBuffer | Uint8Array,
  dealId: string,
  packageId: string,
  userAddress: string,
  signPersonalMessage: (input: { message: Uint8Array }) => Promise<{ signature: string; bytes: string; }>
): Promise<Uint8Array> {
  const sealClient = createSealClient(suiClient);
  const dataToDecrypt = encryptedData instanceof Uint8Array ? encryptedData : new Uint8Array(encryptedData);

  try {
    // Parse encrypted blob and extract key-id (format: packageId + dealId = 128 hex chars)
    const parsedEncryptedBlob = EncryptedObject.parse(dataToDecrypt);
    const encryptedKeyId = parsedEncryptedBlob.id;

    // Create session key and sign
    const sessionKey = await SessionKey.create({
      address: userAddress,
      packageId,
      ttlMin: 10,
      suiClient,
    });

    const personalMessage = sessionKey.getPersonalMessage();
    const { signature } = await signPersonalMessage({ message: personalMessage });
    await sessionKey.setPersonalMessageSignature(signature);

    // Build seal_approve transaction with dealId from key-id
    const tx = new Transaction();

    tx.moveCall({
      target: `${packageId}::earnout::seal_approve`,
      arguments: [
        tx.pure.vector('u8', fromHex(encryptedKeyId)), // 32 bytes dealId
        tx.object(dealId),
      ],
    });

    // Build transaction kind (not executable PTB) for Seal Key Servers
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    // Fetch decryption keys from Seal Key Servers
    await sealClient.fetchKeys({
      ids: [encryptedKeyId],
      txBytes,
      sessionKey,
      threshold: 2,
    });

    // Decrypt the data
    const plaintext = await sealClient.decrypt({
      data: dataToDecrypt,
      sessionKey,
      txBytes,
    });

    return plaintext;
  } catch (error) {
    console.error('Seal decryption failed:', error);
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}