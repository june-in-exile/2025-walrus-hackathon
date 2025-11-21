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
 * Encrypts data using Seal with whitelist-based access control.
 * This function is designed for client-side use.
 *
 * @param suiClient - The SuiClient instance (from @mysten/dapp-kit's useSuiClient hook)
 * @param data - The raw data to be encrypted (ArrayBuffer or Uint8Array).
 * @param whitelistObjectId - The Sui object ID of the whitelist that controls decryption access.
 * @param packageId - The Sui package ID where the whitelist module is deployed.
 * @returns A Promise that resolves to the encrypted data as a Uint8Array.
 */
export async function encryptData(
  suiClient: SuiClient,
  data: ArrayBuffer | Uint8Array,
  whitelistObjectId: string,
  packageId: string
): Promise<Uint8Array> {
  console.log("Encrypting data with Seal...");
  const sealClient = createSealClient(suiClient);

  // The Seal SDK expects the `id` as a hex string without the '0x' prefix.
  const id = whitelistObjectId.startsWith('0x')
    ? whitelistObjectId.slice(2)
    : whitelistObjectId;

  const dataToEncrypt = data instanceof Uint8Array ? data : new Uint8Array(data);

  try {
    // The `id` parameter is the access control policy identifier (the whitelist object ID).
    // Seal prepends the packageId to create the full key-id for encryption.
    const { encryptedObject } = await sealClient.encrypt({
      threshold: 2, // Requires 2 key servers to successfully generate keys.
      packageId: packageId,
      id,
      data: dataToEncrypt,
    });

    console.log("Data encryption complete.");
    return encryptedObject;
  } catch (error) {
    console.error('Seal encryption failed:', error);
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts data using Seal with whitelist-based access control.
 * This function is designed for client-side use and requires user wallet interaction.
 *
 * @param suiClient - The SuiClient instance (from @mysten/dapp-kit's useSuiClient hook)
 * @param encryptedData - The encrypted data to be decrypted (ArrayBuffer or Uint8Array).
 * @param whitelistObjectId - The Sui object ID of the whitelist used for encryption.
 * @param packageId - The Sui package ID where the whitelist module is deployed.
 * @param userAddress - The Sui address of the current user attempting to decrypt.
 * @param signPersonalMessage - The signing function from the user's wallet (e.g., from @mysten/dapp-kit's useSignPersonalMessage).
 * @returns A Promise that resolves to the decrypted raw data as a Uint8Array.
 */
export async function decryptData(
  suiClient: SuiClient,
  encryptedData: ArrayBuffer | Uint8Array,
  whitelistObjectId: string,
  packageId: string,
  userAddress: string,
  signPersonalMessage: (input: { message: Uint8Array }) => Promise<{ signature: string; bytes: string; }>
): Promise<Uint8Array> {
  console.log("Decrypting data with Seal...");
  const sealClient = createSealClient(suiClient);

  const dataToDecrypt = encryptedData instanceof Uint8Array ? encryptedData : new Uint8Array(encryptedData);

  try {
    // Parse the encrypted blob to extract the key-id used for encryption.
    const parsedEncryptedBlob = EncryptedObject.parse(dataToDecrypt);
    const encryptedKeyId = parsedEncryptedBlob.id;

    // Create a short-lived session key for this decryption operation.
    // The signer parameter is optional - we'll manually sign the personal message below
    const sessionKey = await SessionKey.create({
      address: userAddress,
      packageId: packageId,
      ttlMin: 10, // Session is valid for 10 minutes.
      suiClient: suiClient,
    });

    // Get the personal message that needs to be signed
    const personalMessage = sessionKey.getPersonalMessage();

    // Sign the personal message using the wallet
    const { signature } = await signPersonalMessage({ message: personalMessage });

    // Set the signature on the session key
    await sessionKey.setPersonalMessageSignature(signature);

    // Build an approval transaction that calls the `seal_approve` function in the whitelist contract.
    // This transaction is not executed on-chain; it's sent to the key servers for verification.
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::whitelist::seal_approve`,
      arguments: [
        // The key-id bytes (without the package prefix).
        tx.pure.vector('u8', Array.from(fromHex(encryptedKeyId))),
        // A reference to the Whitelist object.
        tx.object(whitelistObjectId),
      ],
    });

    // Build the transaction bytes without signing.
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    // Fetch the decryption keys from the Seal Key Servers.
    // The servers will simulate the txBytes to verify that the user (via the sessionKey) is on the whitelist.
    await sealClient.fetchKeys({
      ids: [encryptedKeyId],
      txBytes,
      sessionKey,
      threshold: 2, // Must match the encryption threshold.
    });

    // Decrypt the data using the fetched keys.
    const plaintext = await sealClient.decrypt({
      data: dataToDecrypt,
      sessionKey,
      txBytes,
    });

    console.log("Data decryption complete.");
    return plaintext;
  } catch (error) {
    console.error('Seal decryption failed:', error);
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}