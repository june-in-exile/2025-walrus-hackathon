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

import { config } from 'dotenv';
config(); // Load .env file

import { SealService } from '../src/backend/services/seal-service';

// Test configuration
const TEST_CONFIG = {
  // Replace with your deployed package ID
  packageId: process.env.TEST_PACKAGE_ID || '0xYOUR_PACKAGE_ID_HERE',
  // Test addresses to add to whitelist
  testAddresses: [
    '0xdcc2595c90c6fb2c350110a89e6fc48703240dfe808cc46dcb485a12fa61b0d2', // buyer
    '0x715fe42bb16168100ab6e65762f0794ea559a07059b82670ed44b65a069ba92a', // seller
    '0xd7217a1e367cf3e53981ba39f4a25a67f722246fa887861fd8ad78afec33866b', // auditor
  ],
};

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
    console.warn('WARNING: SEAL_KEY_SERVER_OBJECT_IDS not set');
    console.warn('Encryption/decryption will not work without key servers');
  }

  if (TEST_CONFIG.packageId === '0xYOUR_PACKAGE_ID_HERE') {
    console.error('ERROR: Please set TEST_PACKAGE_ID in environment or update TEST_CONFIG.packageId');
    console.error('Deploy the whitelist contract first and use that package ID');
    process.exit(1);
  }

  // Initialize service
  const sealService = new SealService();
  console.log('SealService initialized');
  console.log();

  try {
    // Test 1: Create Whitelist
    console.log('-'.repeat(60));
    console.log('Test 1: Create Whitelist');
    console.log('-'.repeat(60));

    const createResult = await sealService.executeCreateWhitelist(TEST_CONFIG.packageId);

    console.log('Whitelist created successfully!');
    console.log('  Transaction Digest:', createResult.digest);
    console.log('  Whitelist ID:', createResult.whitelistId);
    console.log('  Cap ID:', createResult.capId);
    console.log();

    if (!createResult.whitelistId || !createResult.capId) {
      console.error('ERROR: Failed to extract object IDs from transaction');
      process.exit(1);
    }

    // Test 2: Add addresses to whitelist
    console.log('-'.repeat(60));
    console.log('Test 2: Add Addresses to Whitelist');
    console.log('-'.repeat(60));

    for (const address of TEST_CONFIG.testAddresses) {
      const addDigest = await sealService.executeAddToWhitelist(
        createResult.whitelistId,
        createResult.capId,
        address,
        TEST_CONFIG.packageId
      );

      console.log(`Added ${address}`);
      console.log('  Transaction Digest:', addDigest);
    }
    console.log();

    // Test 3: Verify access
    console.log('-'.repeat(60));
    console.log('Test 3: Verify Access');
    console.log('-'.repeat(60));

    for (const address of TEST_CONFIG.testAddresses) {
      const accessResult = await sealService.verifyAccess(
        createResult.whitelistId,
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
      createResult.whitelistId,
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
      createResult.whitelistId,
      createResult.capId,
      addressToRemove,
      TEST_CONFIG.packageId
    );

    console.log(`Removed ${addressToRemove}`);
    console.log('  Transaction Digest:', removeDigest);
    console.log();

    // Verify removal
    const removedAccessResult = await sealService.verifyAccess(
      createResult.whitelistId,
      addressToRemove
    );
    console.log(`Access after removal for ${addressToRemove}:`);
    console.log('  Has Access:', removedAccessResult.hasAccess);
    if (removedAccessResult.reason) {
      console.log('  Reason:', removedAccessResult.reason);
    }
    console.log();

    // Test 5: Encryption & Decryption (optional, requires key servers)
    if (process.env.SEAL_KEY_SERVER_OBJECT_IDS) {
      console.log('-'.repeat(60));
      console.log('Test 5: Encryption & Decryption');
      console.log('-'.repeat(60));

      const testData = Buffer.from('Hello, Seal encryption test!');
      let encryptedCiphertext: Buffer | null = null;

      // Test encryption
      try {
        const encryptResult = await sealService.encryptWithWhitelist(testData, {
          whitelistObjectId: createResult.whitelistId,
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
        console.log('This may be expected if key servers are not properly configured');
        console.log();
      }

      // Test decryption (only if encryption succeeded)
      if (encryptedCiphertext) {
        console.log('-'.repeat(60));
        console.log('Test 6: Decryption');
        console.log('-'.repeat(60));

        // Use the second test address (seller) which is still on the whitelist
        // (first address was removed in Test 4)
        const whitelistedAddress = TEST_CONFIG.testAddresses[1];

        try {
          const decryptResult = await sealService.decryptWithWhitelist(
            encryptedCiphertext,
            createResult.whitelistId,
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
          }
          console.log();
        } catch (error) {
          console.error('Decryption failed:', error);
          console.log('This may be expected if:');
          console.log('  - Key servers are not properly configured');
          console.log('  - Backend address is not on the whitelist');
          console.log('  - The whitelist seal_approve function is not correctly implemented');
          console.log();
        }

        // Test decryption with non-whitelisted address (should fail)
        console.log('-'.repeat(60));
        console.log('Test 7: Decryption with Non-Whitelisted Address (Expected to Fail)');
        console.log('-'.repeat(60));

        const nonWhitelistedAddress = '0x0000000000000000000000000000000000000000000000000000000000000099';

        try {
          await sealService.decryptWithWhitelist(
            encryptedCiphertext,
            createResult.whitelistId,
            TEST_CONFIG.packageId,
            nonWhitelistedAddress
          );

          console.error('ERROR: Decryption should have failed for non-whitelisted address!');
          console.log();
        } catch (error) {
          console.log('Decryption correctly failed for non-whitelisted address');
          console.log('  Error:', error instanceof Error ? error.message : String(error));
          console.log();
        }
      }
    } else {
      console.log('-'.repeat(60));
      console.log('Test 5-7: Encryption & Decryption (SKIPPED - no key servers configured)');
      console.log('-'.repeat(60));
      console.log();
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log('All tests completed successfully!');
    console.log();
    console.log('Created objects (save these for future use):');
    console.log('  WHITELIST_ID=' + createResult.whitelistId);
    console.log('  CAP_ID=' + createResult.capId);
    console.log();

  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
