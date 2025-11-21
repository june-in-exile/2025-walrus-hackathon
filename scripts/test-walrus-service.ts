/**
 * Test script for WalrusService operations
 *
 * Usage:
 *   npx tsx scripts/test-walrus-service.ts
 *
 * Environment variables required:
 *   - WALRUS_AGGREGATOR_URL: Walrus aggregator URL (optional, defaults to testnet)
 *   - WALRUS_PUBLISHER_URL: Walrus publisher URL (optional, defaults to testnet)
 *
 * Optional:
 *   - DEBUG_WALRUS: Set to 'true' for verbose logging
 *   - WALRUS_STORAGE_EPOCHS: Number of epochs to store (default: 1)
 */

// IMPORTANT: Load dotenv BEFORE any other imports
import { config as dotenvConfig } from 'dotenv';
dotenvConfig(); // Load .env file first

// Override environment variables to ensure correct URLs are used
process.env.WALRUS_AGGREGATOR_URL = 'https://walrus-testnet.blockscope.net';
process.env.WALRUS_PUBLISHER_URL = 'https://walrus-testnet.blockscope.net:11444';

import type { UploadMetadata } from '../src/shared/types/walrus';

// Test configuration
const TEST_CONFIG = {
  // Test file content
  smallFileContent: 'Hello, Walrus! This is a test file.',
  // Larger test content (for size testing)
  largerFileContent: 'A'.repeat(10000), // 10KB of data
  // Test metadata
  testMetadata: {
    dataType: 'revenue_journal',
    periodId: 'test-period-2025-q1',
    dealId: '0xtest_deal_123',
    uploaderAddress: '0xdcc2595c90c6fb2c350110a89e6fc48703240dfe808cc46dcb485a12fa61b0d2',
    filename: 'test-data.txt',
    mimeType: 'text/plain',
    description: 'Test upload for WalrusService validation',
  } satisfies UploadMetadata,
};

// Helper function to wait
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('WalrusService Test Script');
  console.log('='.repeat(60));
  console.log();

  // Dynamic import WalrusService AFTER dotenv has loaded
  const { WalrusService } = await import('../src/backend/services/walrus-service');

  // Initialize service
  const walrusService = new WalrusService();
  console.log('WalrusService initialized');
  console.log();

  // Track uploaded blob IDs for cleanup reference
  const uploadedBlobs: string[] = [];

  try {
    // Test 1: Upload Small File
    console.log('-'.repeat(60));
    console.log('Test 1: Upload Small File');
    console.log('-'.repeat(60));

    const smallFileData = Buffer.from(TEST_CONFIG.smallFileContent);
    console.log('File content:', TEST_CONFIG.smallFileContent);
    console.log('Data size:', smallFileData.length, 'bytes');

    const uploadResult1 = await walrusService.upload(smallFileData, TEST_CONFIG.testMetadata);

    console.log('Upload successful!');
    console.log('  Blob ID:', uploadResult1.blobId);
    console.log('  Commitment:', uploadResult1.commitment);
    console.log('  Size:', uploadResult1.size, 'bytes');
    console.log('  Uploaded At:', uploadResult1.uploadedAt);
    console.log('  End Epoch:', uploadResult1.endEpoch);
    console.log();

    uploadedBlobs.push(uploadResult1.blobId);

    // Wait for blob to be available
    console.log('Waiting for blob availability (2 seconds)...');
    await sleep(2000);
    console.log();

    // Test 2: Download and Verify Data
    console.log('-'.repeat(60));
    console.log('Test 2: Download and Verify Data');
    console.log('-'.repeat(60));

    const downloadResult = await walrusService.download(uploadResult1.blobId);

    console.log('Download successful!');
    console.log('  Data size:', downloadResult.data.length, 'bytes');
    console.log('  Data type:', downloadResult.metadata.dataType);
    console.log('  Period ID:', downloadResult.metadata.periodId);
    console.log('  Filename:', downloadResult.metadata.filename);

    // Verify data integrity
    const downloadedContent = downloadResult.data.toString();
    const dataMatch = downloadedContent === TEST_CONFIG.smallFileContent;
    console.log('  Downloaded content:', downloadedContent);
    console.log('  Data integrity check:', dataMatch ? 'PASSED' : 'FAILED');

    if (!dataMatch) {
      console.error('ERROR: Downloaded data does not match original!');
      console.error('Expected:', TEST_CONFIG.smallFileContent);
      console.error('Got:', downloadedContent);
      process.exit(1);
    }

    // Verify metadata integrity
    const metadataMatch =
      downloadResult.metadata.dataType === TEST_CONFIG.testMetadata.dataType &&
      downloadResult.metadata.periodId === TEST_CONFIG.testMetadata.periodId &&
      downloadResult.metadata.filename === TEST_CONFIG.testMetadata.filename;
    console.log('  Metadata integrity check:', metadataMatch ? 'PASSED' : 'FAILED');

    if (!metadataMatch) {
      console.error('ERROR: Metadata does not match!');
      process.exit(1);
    }
    console.log();

    // Test 3: Get Blob Info
    console.log('-'.repeat(60));
    console.log('Test 3: Get Blob Info');
    console.log('-'.repeat(60));

    const blobInfo = await walrusService.getBlobInfo(uploadResult1.blobId);

    console.log('Blob info retrieved!');
    console.log('  Blob ID:', blobInfo.blobId);
    console.log('  Size:', blobInfo.size, 'bytes');
    console.log('  Commitment:', blobInfo.commitment);
    console.log();

    // Test 4: Upload Larger File
    console.log('-'.repeat(60));
    console.log('Test 4: Upload Larger File (10KB)');
    console.log('-'.repeat(60));

    const largerFileData = Buffer.from(TEST_CONFIG.largerFileContent);
    const largerMetadata: UploadMetadata = {
      ...TEST_CONFIG.testMetadata,
      filename: 'larger-test-data.txt',
      description: 'Larger test file (10KB)',
    };

    console.log('Data size:', largerFileData.length, 'bytes');

    const uploadResult2 = await walrusService.upload(largerFileData, largerMetadata);

    console.log('Upload successful!');
    console.log('  Blob ID:', uploadResult2.blobId);
    console.log('  Size:', uploadResult2.size, 'bytes');
    console.log('  End Epoch:', uploadResult2.endEpoch);
    console.log();

    uploadedBlobs.push(uploadResult2.blobId);

    // Wait for blob to be available
    console.log('Waiting for blob availability (2 seconds)...');
    await sleep(2000);
    console.log();

    // Verify larger file
    const downloadResult2 = await walrusService.download(uploadResult2.blobId);
    const largerDataMatch = downloadResult2.data.toString() === TEST_CONFIG.largerFileContent;
    console.log('  Download and verify:', largerDataMatch ? 'PASSED' : 'FAILED');

    if (!largerDataMatch) {
      console.error('ERROR: Larger file data does not match!');
      process.exit(1);
    }
    console.log();

    // Test 6: Error Handling - Non-existent Blob
    console.log('-'.repeat(60));
    console.log('Test 6: Error Handling - Non-existent Blob');
    console.log('-'.repeat(60));

    const fakeBlobId = 'nonexistent_blob_id_12345';
    try {
      await walrusService.download(fakeBlobId);
      console.error('ERROR: Should have thrown error for non-existent blob!');
      process.exit(1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isExpectedError = errorMessage.includes('not found') ||
        errorMessage.includes('404') ||
        errorMessage.includes('failed');
      console.log('Error correctly thrown for non-existent blob');
      console.log('  Error:', errorMessage.substring(0, 100));
      console.log('  Expected error type:', isExpectedError ? 'PASSED' : 'FAILED');

      if (!isExpectedError) {
        console.warn('Warning: Error message format may have changed');
      }
    }
    console.log();

    // Test 7: Binary Data Upload
    console.log('-'.repeat(60));
    console.log('Test 7: Binary Data Upload');
    console.log('-'.repeat(60));

    // Create binary data (simulating encrypted content)
    const binaryData = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) {
      binaryData[i] = i;
    }

    const binaryMetadata: UploadMetadata = {
      ...TEST_CONFIG.testMetadata,
      filename: 'binary-data.bin',
      mimeType: 'application/octet-stream',
      description: 'Binary test data (0-255 bytes)',
    };

    console.log('Binary data size:', binaryData.length, 'bytes');

    const uploadResult3 = await walrusService.upload(binaryData, binaryMetadata);
    uploadedBlobs.push(uploadResult3.blobId);

    console.log('Upload successful!');
    console.log('  Blob ID:', uploadResult3.blobId);

    // Wait and verify
    await sleep(2000);
    const downloadResult3 = await walrusService.download(uploadResult3.blobId);

    // Compare binary data
    const binaryMatch = binaryData.equals(downloadResult3.data);
    console.log('  Binary data integrity check:', binaryMatch ? 'PASSED' : 'FAILED');

    if (!binaryMatch) {
      console.error('ERROR: Binary data does not match!');
      process.exit(1);
    }
    console.log();

    // Summary
    console.log('='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log('All tests completed successfully!');
    console.log();
    console.log('Uploaded blobs (for reference):');
    uploadedBlobs.forEach((blobId, index) => {
      console.log(`  ${index + 1}. ${blobId}`);
    });
    console.log();
    console.log('Note: Blobs will expire based on storage epochs setting.');
    console.log('Current setting: WALRUS_STORAGE_EPOCHS =', process.env.WALRUS_STORAGE_EPOCHS || '1');
    console.log();

  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
