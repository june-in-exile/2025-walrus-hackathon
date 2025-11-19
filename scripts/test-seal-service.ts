/**
 * Test script for SealService whitelist operations
 *
 * Usage:
 *   npx ts-node scripts/test-seal-service.ts
 *
 * Or with tsx:
 *   npx tsx scripts/test-seal-service.ts
 *
 * Environment variables required:
 *   - SUI_BACKEND_PRIVATE_KEY: Base64 encoded private key
 *   - SEAL_KEY_SERVER_OBJECT_IDS: Comma-separated key server object IDs
 *
 * Optional:
 *   - TEST_PACKAGE_ID: Package ID where whitelist module is deployed
 *   - DEBUG_SEAL: Set to 'true' for verbose logging
 */

// IMPORTANT: Load dotenv BEFORE any other imports
import { config as dotenvConfig } from 'dotenv';
dotenvConfig(); // Load .env file first

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Test configuration
const TEST_CONFIG = {
  // Replace with your deployed package ID
  packageId: process.env.TEST_PACKAGE_ID || '0x8a211625ef08ef197cc058fc2d6d307530489ab3d99050000cd93d09732941f6',
  // Test addresses to add to whitelist
  testAddresses: [
    '0xdcc2595c90c6fb2c350110a89e6fc48703240dfe808cc46dcb485a12fa61b0d2', // buyer
    '0x715fe42bb16168100ab6e65762f0794ea559a07059b82670ed44b65a069ba92a', // seller
    '0xd7217a1e367cf3e53981ba39f4a25a67f722246fa887861fd8ad78afec33866b', // auditor
  ],
  // Use existing whitelist (skip creation if set)
  existingWhitelistId: process.env.TEST_WHITELIST_ID || '0x572960a36a9ba724afe86b19c70d8c365ba2f9eb96c6bfc8cf22c6b31ee99382',
  existingCapId: process.env.TEST_CAP_ID || '0x299098c9286ec9dd7c4e9f23be0db321c90ee656abd5c7ee11b5e9f962f5a141',
};

// Helper function to wait for transaction confirmation
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('SealService Whitelist Test Script');
  console.log('='.repeat(60));
  console.log();

  // Validate environment
  if (!process.env.SUI_BACKEND_PRIVATE_KEY) {
    console.error('ERROR: SUI_BACKEND_PRIVATE_KEY not set in environment');
    console.error('Please set it in .env file');
    process.exit(1);
  }

  if (!process.env.SEAL_KEY_SERVER_OBJECT_IDS) {
    console.error('ERROR: SEAL_KEY_SERVER_OBJECT_IDS not set in environment');
    console.error('Please set it in .env file (required for encryption/decryption tests)');
    process.exit(1);
  }

  if (TEST_CONFIG.packageId === '0xYOUR_PACKAGE_ID_HERE') {
    console.error('ERROR: Please set TEST_PACKAGE_ID in environment or update TEST_CONFIG.packageId');
    console.error('Deploy the whitelist contract first and use that package ID');
    process.exit(1);
  }

  // Dynamic import SealService AFTER dotenv has loaded
  const { SealService } = await import('../src/backend/services/seal-service');

  // Initialize services
  const sealService = new SealService();
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  console.log('SealService initialized');

  // Get backend keypair address (needed for server-side decryption)
  let backendAddress = '';
  if (process.env.SUI_BACKEND_PRIVATE_KEY) {
    let privateKeyBytes = Buffer.from(process.env.SUI_BACKEND_PRIVATE_KEY, 'base64');
    if (privateKeyBytes.length === 33) {
      privateKeyBytes = privateKeyBytes.subarray(1);
    } else if (privateKeyBytes.length === 64) {
      privateKeyBytes = privateKeyBytes.subarray(0, 32);
    }
    const backendKeypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    backendAddress = backendKeypair.toSuiAddress();
    console.log('Backend address:', backendAddress);
  }
  console.log();

  try {
    let whitelistId: string;
    let capId: string;

    // Test 1: Create Whitelist (or use existing)
    if (TEST_CONFIG.existingWhitelistId && TEST_CONFIG.existingCapId) {
      console.log('-'.repeat(60));
      console.log('Test 1: Using Existing Whitelist');
      console.log('-'.repeat(60));

      whitelistId = TEST_CONFIG.existingWhitelistId;
      capId = TEST_CONFIG.existingCapId;

      console.log('Using existing whitelist:');
      console.log('  Whitelist ID:', whitelistId);
      console.log('  Cap ID:', capId);
      console.log();
    } else {
      console.log('-'.repeat(60));
      console.log('Test 1: Create Whitelist');
      console.log('-'.repeat(60));

      const createResult = await sealService.executeCreateWhitelist(TEST_CONFIG.packageId);

      whitelistId = createResult.whitelistId;
      capId = createResult.capId;

      console.log('Whitelist created successfully!');
      console.log('  Transaction Digest:', createResult.digest);
      console.log('  Whitelist ID:', whitelistId);
      console.log('  Cap ID:', capId);
      console.log();

      if (!whitelistId || !capId) {
        console.error('ERROR: Failed to extract object IDs from transaction');
        process.exit(1);
      }

      // Wait for transaction to be confirmed on chain
      console.log('Waiting for transaction confirmation (3 seconds)...');
      await sleep(3000);
      console.log();
    }

    // Test 2: Add addresses to whitelist
    console.log('-'.repeat(60));
    console.log('Test 2: Add Addresses to Whitelist');
    console.log('-'.repeat(60));

    // Include backend address for server-side decryption
    const addressesToAdd = backendAddress
      ? [...TEST_CONFIG.testAddresses, backendAddress]
      : TEST_CONFIG.testAddresses;

    for (const address of addressesToAdd) {
      try {
        const addDigest = await sealService.executeAddToWhitelist(
          whitelistId,
          capId,
          address,
          TEST_CONFIG.packageId
        );

        console.log(`Added ${address}`);
        console.log('  Transaction Digest:', addDigest);

        // Wait for transaction to be confirmed (object version update)
        await suiClient.waitForTransaction({ digest: addDigest });
      } catch (error) {
        // Check if error is EDuplicate (code 3) - address already in whitelist
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('sub status 3') || errorMessage.includes('MoveAbort') && errorMessage.includes(', 3)')) {
          console.log(`Skipped ${address} (already in whitelist)`);
        } else {
          throw error; // Re-throw other errors
        }
      }
    }
    console.log();

    // Test 3: Verify access
    console.log('-'.repeat(60));
    console.log('Test 3: Verify Access');
    console.log('-'.repeat(60));

    for (const address of TEST_CONFIG.testAddresses) {
      const accessResult = await sealService.verifyAccess(
        whitelistId,
        address
      );

      console.log(`Access for ${address}:`);
      console.log('  Has Access:', accessResult.hasAccess);
      if (accessResult.reason) {
        console.log('  Reason:', accessResult.reason);
      }
    }

    // Test with non-whitelisted address
    const nonWhitelistedAddress = '0x0000000000000000000000000000000000000000000000000000000000000099';
    const nonWhitelistedResult = await sealService.verifyAccess(
      whitelistId,
      nonWhitelistedAddress
    );
    console.log(`Access for ${nonWhitelistedAddress} (not whitelisted):`);
    console.log('  Has Access:', nonWhitelistedResult.hasAccess);
    if (nonWhitelistedResult.reason) {
      console.log('  Reason:', nonWhitelistedResult.reason);
    }
    console.log();

    // Test 4: Remove address from whitelist
    console.log('-'.repeat(60));
    console.log('Test 4: Remove Address from Whitelist');
    console.log('-'.repeat(60));

    const addressToRemove = TEST_CONFIG.testAddresses[0];
    const removeDigest = await sealService.executeRemoveFromWhitelist(
      whitelistId,
      capId,
      addressToRemove,
      TEST_CONFIG.packageId
    );

    console.log(`Removed ${addressToRemove}`);
    console.log('  Transaction Digest:', removeDigest);

    // Wait for transaction to be confirmed
    await suiClient.waitForTransaction({ digest: removeDigest });
    console.log();

    // Verify removal
    const removedAccessResult = await sealService.verifyAccess(
      whitelistId,
      addressToRemove
    );
    console.log(`Access after removal for ${addressToRemove}:`);
    console.log('  Has Access:', removedAccessResult.hasAccess);
    if (removedAccessResult.reason) {
      console.log('  Reason:', removedAccessResult.reason);
    }
    console.log();

    // Test 5: Encryption & Decryption (required)
    console.log('-'.repeat(60));
    console.log('Test 5: Encryption & Decryption');
    console.log('-'.repeat(60));

    const testData = Buffer.from('Hello, Seal encryption test!');
    let encryptedCiphertext: Buffer;

    // Test encryption
    try {
      const encryptResult = await sealService.encryptWithWhitelist(testData, {
        whitelistObjectId: whitelistId,
        packageId: TEST_CONFIG.packageId,
      });

      console.log('Encryption successful!');
      console.log('  Original data:', testData.toString());
      console.log('  Ciphertext size:', encryptResult.ciphertext.length, 'bytes');
      console.log('  Commitment:', encryptResult.commitment);
      console.log('  Policy Object ID:', encryptResult.policyObjectId);
      console.log();

      encryptedCiphertext = encryptResult.ciphertext;
    } catch (error) {
      console.error('Encryption failed:', error);
      process.exit(1);
    }

    // Test 6: Decryption
    console.log('-'.repeat(60));
    console.log('Test 6: Decryption');
    console.log('-'.repeat(60));

    // Use the second test address (seller) which is still on the whitelist
    // (first address was removed in Test 4)
    const whitelistedAddress = TEST_CONFIG.testAddresses[1];

    try {
      const decryptResult = await sealService.decryptWithWhitelist(
        encryptedCiphertext,
        whitelistId,
        TEST_CONFIG.packageId,
        whitelistedAddress
      );

      console.log('Decryption successful!');
      console.log('  Decrypted data:', decryptResult.plaintext.toString());
      console.log('  Plaintext size:', decryptResult.plaintext.length, 'bytes');
      console.log('  Policy Object ID:', decryptResult.metadata.policyObjectId);

      // Verify data integrity
      const isMatch = testData.equals(decryptResult.plaintext);
      console.log('  Data integrity check:', isMatch ? 'PASSED' : 'FAILED');

      if (!isMatch) {
        console.error('ERROR: Decrypted data does not match original!');
        process.exit(1);
      }
      console.log();
    } catch (error) {
      console.error('Decryption failed:', error);
      process.exit(1);
    }

    // Test 7: Decryption with non-whitelisted address (should fail)
    console.log('-'.repeat(60));
    console.log('Test 7: Decryption with Non-Whitelisted Address (Expected to Fail)');
    console.log('-'.repeat(60));

    const nonWhitelistedAddressForDecrypt = '0x0000000000000000000000000000000000000000000000000000000000000099';

    try {
      await sealService.decryptWithWhitelist(
        encryptedCiphertext,
        whitelistId,
        TEST_CONFIG.packageId,
        nonWhitelistedAddressForDecrypt
      );

      console.error('ERROR: Decryption should have failed for non-whitelisted address!');
      process.exit(1);
    } catch (error) {
      console.log('Decryption correctly failed for non-whitelisted address');
      console.log('  Error:', error instanceof Error ? error.message : String(error));
      console.log();
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log('All tests completed successfully!');
    console.log();
    console.log('Created objects (save these for future use):');
    console.log('  WHITELIST_ID=' + whitelistId);
    console.log('  CAP_ID=' + capId);
    console.log();

  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
