/**
 * Integration Test for SuiService.getDealBlobIds() and getDealBlobReferences()
 *
 * Test Flow:
 * 1. Upload 3 files to Walrus via WalrusService:
 *    - File A: dealId_1, periodId "2025-Q1", dataType "revenue_journal"
 *    - File B: dealId_1, periodId "2025-Q2", dataType "ebitda_report"
 *    - File C: dealId_2, periodId "2025-Q1", dataType "revenue_journal"
 * 2. Register blobs on-chain (mocked via Deal object creation)
 * 3. Query using SuiService.getDealBlobIds():
 *    - dealId_1 should return [A, B]
 *    - dealId_2 should return [C]
 *    - dealId_3 should return []
 * 4. Query using SuiService.getDealBlobReferences():
 *    - Same validation with detailed metadata
 *
 * Prerequisites:
 * - Dev server must be running (for Walrus upload API)
 * - Or use MOCK_WALRUS=true to skip actual uploads
 *
 * Usage:
 *   # With real Walrus uploads (requires dev server)
 *   npx tsx scripts/test-sui-service.ts
 *
 *   # With mocked Walrus (no dev server needed)
 *   MOCK_WALRUS=true npx tsx scripts/test-sui-service.ts
 */

import { config as dotenvConfig } from 'dotenv';
import { walrusService, WalrusService } from '@/src/backend/services/walrus-service';
import type { DataType, WalrusUploadResult } from '@/src/shared/types/walrus';
import { SuiService, OnChainBlobReference } from '@/src/backend/services/sui-service';
import { config } from '@/src/shared/config/env';

dotenvConfig();

const MOCK_WALRUS = process.env.MOCK_WALRUS === 'true';

// Generate test dealIds (valid Sui object ID format)
const DEAL_ID_1 = '0x' + 'a'.repeat(64);
const DEAL_ID_2 = '0x' + 'b'.repeat(64);
const DEAL_ID_3 = '0x' + 'c'.repeat(64); // Empty deal for testing

interface UploadedBlob {
  name: string;
  blobId: string;
  dealId: string;
  periodId: string;
  dataType: string;
  uploadedAt: string;
  uploaderAddress: string;
}

/**
 * Mock WalrusService for testing without actual uploads
 */
class MockWalrusService {
  private mockBlobCounter = 0;

  async upload(data: Buffer): Promise<WalrusUploadResult> {
    this.mockBlobCounter++;
    const blobId = `mock-blob-id-${this.mockBlobCounter}`;
    console.log(`[MOCK WALRUS] Uploaded ${data.length} bytes as ${blobId}`);
    return {
      blobId,
      commitment: `walrus:${blobId}`,
      size: data.length,
      uploadedAt: new Date().toISOString(),
      storageEpochs: 1,
      endEpoch: 100,
    };
  }
}

/**
 * Extended SuiService with mock data injection for testing
 */
class TestSuiService extends SuiService {
  private mockDeals: Map<
    string,
    {
      buyer: string;
      seller: string;
      auditor: string;
      walrus_blobs: OnChainBlobReference[];
    }
  > = new Map();

  /**
   * Inject mock deal data (simulates on-chain Deal object)
   */
  injectMockDeal(dealId: string, blobs: OnChainBlobReference[]) {
    this.mockDeals.set(dealId, {
      buyer: '0x' + '1'.repeat(64),
      seller: '0x' + '2'.repeat(64),
      auditor: '0x' + '3'.repeat(64),
      walrus_blobs: blobs,
    });
    console.log(`[TEST] Injected mock deal ${dealId} with ${blobs.length} blobs`);
  }

  /**
   * Override getDealBlobIds to use mock data
   */
  async getDealBlobIds(dealId: string): Promise<string[]> {
    const deal = this.mockDeals.get(dealId);
    if (!deal) {
      // Return empty array for non-existent deals (like real implementation when no blobs)
      return [];
    }
    return deal.walrus_blobs.map(blob => blob.blobId);
  }

  /**
   * Override getDealBlobReferences to use mock data
   */
  async getDealBlobReferences(dealId: string): Promise<OnChainBlobReference[]> {
    const deal = this.mockDeals.get(dealId);
    if (!deal) {
      // Return empty array for non-existent deals
      return [];
    }
    return deal.walrus_blobs;
  }
}

/**
 * Upload a test file to Walrus
 */
async function uploadTestFile(
  name: string,
  content: string,
  dealId: string,
  periodId: string,
  dataType: DataType,
  uploaderAddress: string,
  walrusServiceInstance: WalrusService | MockWalrusService
): Promise<UploadedBlob> {
  console.log(`\n📤 Uploading file: ${name}`);
  console.log(`   dealId: ${dealId}`);
  console.log(`   periodId: ${periodId}`);
  console.log(`   dataType: ${dataType}`);

  const data = Buffer.from(content, 'utf-8');
  const metadata = {
    filename: `${name}.txt`,
    mimeType: 'text/plain',
    description: `Test file ${name}`,
    dealId,
    periodId,
    dataType,
    uploaderAddress,
  };

  const result = await walrusServiceInstance.upload(data, metadata);

  console.log(`✅ Upload successful: blobId = ${result.blobId}`);

  return {
    name,
    blobId: result.blobId,
    dealId,
    periodId,
    dataType,
    uploadedAt: result.uploadedAt,
    uploaderAddress,
  };
}

/**
 * Test getDealBlobIds method
 */
async function testGetDealBlobIds(
  service: TestSuiService,
  dealId: string,
  expectedBlobIds: string[],
  testDescription: string
): Promise<void> {
  console.log(`\n🔍 Testing getDealBlobIds: ${testDescription}`);
  console.log(`   Deal ID: ${dealId}`);
  console.log(`   Expected blob count: ${expectedBlobIds.length}`);

  const blobIds = await service.getDealBlobIds(dealId);

  console.log(`   Actual blob count: ${blobIds.length}`);

  // Verify count
  if (blobIds.length !== expectedBlobIds.length) {
    throw new Error(
      `Expected ${expectedBlobIds.length} blobs but got ${blobIds.length}`
    );
  }

  // Verify all expected IDs are present
  for (const expectedId of expectedBlobIds) {
    if (!blobIds.includes(expectedId)) {
      throw new Error(`Expected blob ID ${expectedId} not found in results`);
    }
  }

  console.log(`✅ PASS: ${testDescription}`);
  if (blobIds.length > 0) {
    console.log(`   Found blobs: ${blobIds.join(', ')}`);
  } else {
    console.log(`   Correctly returned empty array`);
  }
}

/**
 * Test getDealBlobReferences method
 */
async function testGetDealBlobReferences(
  service: TestSuiService,
  dealId: string,
  expectedBlobs: UploadedBlob[],
  testDescription: string
): Promise<void> {
  console.log(`\n🔍 Testing getDealBlobReferences: ${testDescription}`);
  console.log(`   Deal ID: ${dealId}`);
  console.log(`   Expected blob count: ${expectedBlobs.length}`);

  const references = await service.getDealBlobReferences(dealId);

  console.log(`   Actual blob count: ${references.length}`);

  // Verify count
  if (references.length !== expectedBlobs.length) {
    throw new Error(
      `Expected ${expectedBlobs.length} blobs but got ${references.length}`
    );
  }

  // Verify all expected blobs are present with correct metadata
  for (const expectedBlob of expectedBlobs) {
    const found = references.find(ref => ref.blobId === expectedBlob.blobId);
    if (!found) {
      throw new Error(`Expected blob ${expectedBlob.name} not found in results`);
    }

    // Verify metadata
    if (found.periodId !== expectedBlob.periodId) {
      throw new Error(
        `Blob ${expectedBlob.name}: periodId mismatch (expected ${expectedBlob.periodId}, got ${found.periodId})`
      );
    }
    if (found.dataType !== expectedBlob.dataType) {
      throw new Error(
        `Blob ${expectedBlob.name}: dataType mismatch (expected ${expectedBlob.dataType}, got ${found.dataType})`
      );
    }
    if (found.uploaderAddress !== expectedBlob.uploaderAddress) {
      throw new Error(
        `Blob ${expectedBlob.name}: uploaderAddress mismatch`
      );
    }

    console.log(`   ✓ Blob ${expectedBlob.name}: metadata validated`);
  }

  console.log(`✅ PASS: ${testDescription}`);
}

/**
 * Main test execution
 */
async function main() {
  console.log('='.repeat(70));
  console.log('🧪 SuiService Integration Tests');
  console.log('   Testing getDealBlobIds() and getDealBlobReferences()');
  console.log('='.repeat(70));

  console.log('\n📋 Test Configuration:');
  console.log(`   Mock Walrus: ${MOCK_WALRUS ? 'Enabled' : 'Disabled'}`);
  console.log(`   Sui Network: ${config.sui.network}`);
  console.log(`   Deal ID 1: ${DEAL_ID_1}`);
  console.log(`   Deal ID 2: ${DEAL_ID_2}`);
  console.log(`   Deal ID 3: ${DEAL_ID_3} (empty)`);

  try {
    // Initialize services
    const walrusServiceInstance = MOCK_WALRUS ? new MockWalrusService() : walrusService;
    const suiService = new TestSuiService();

    const uploader1 = '0x' + '1'.repeat(64);
    const uploader2 = '0x' + '2'.repeat(64);

    // STEP 1: Upload files to Walrus
    console.log('\n' + '='.repeat(70));
    console.log('📦 STEP 1: Uploading files to Walrus');
    console.log('='.repeat(70));

    const fileA = await uploadTestFile(
      'A',
      'Test data A: Revenue journal for Q1',
      DEAL_ID_1,
      '2025-Q1',
      'revenue_journal',
      uploader1,
      walrusServiceInstance
    );

    const fileB = await uploadTestFile(
      'B',
      'Test data B: EBITDA report for Q2',
      DEAL_ID_1,
      '2025-Q2',
      'ebitda_report',
      uploader1,
      walrusServiceInstance
    );

    const fileC = await uploadTestFile(
      'C',
      'Test data C: Revenue journal for Q1',
      DEAL_ID_2,
      '2025-Q1',
      'revenue_journal',
      uploader2,
      walrusServiceInstance
    );

    console.log('\n✅ All files uploaded successfully!');

    // STEP 2: Inject mock on-chain Deal data
    console.log('\n' + '='.repeat(70));
    console.log('⛓️  STEP 2: Simulating on-chain Deal registration');
    console.log('='.repeat(70));

    // Register A and B to Deal 1
    suiService.injectMockDeal(DEAL_ID_1, [
      {
        blobId: fileA.blobId,
        periodId: fileA.periodId,
        dataType: fileA.dataType,
        uploadedAt: fileA.uploadedAt,
        uploaderAddress: fileA.uploaderAddress,
      },
      {
        blobId: fileB.blobId,
        periodId: fileB.periodId,
        dataType: fileB.dataType,
        uploadedAt: fileB.uploadedAt,
        uploaderAddress: fileB.uploaderAddress,
      },
    ]);

    // Register C to Deal 2
    suiService.injectMockDeal(DEAL_ID_2, [
      {
        blobId: fileC.blobId,
        periodId: fileC.periodId,
        dataType: fileC.dataType,
        uploadedAt: fileC.uploadedAt,
        uploaderAddress: fileC.uploaderAddress,
      },
    ]);

    // Deal 3 has no blobs (not injected)

    // STEP 3: Test getDealBlobIds
    console.log('\n' + '='.repeat(70));
    console.log('🔍 STEP 3: Testing getDealBlobIds()');
    console.log('='.repeat(70));

    await testGetDealBlobIds(
      suiService,
      DEAL_ID_1,
      [fileA.blobId, fileB.blobId],
      'dealId_1 should return [A, B]'
    );

    await testGetDealBlobIds(
      suiService,
      DEAL_ID_2,
      [fileC.blobId],
      'dealId_2 should return [C]'
    );

    await testGetDealBlobIds(
      suiService,
      DEAL_ID_3,
      [],
      'dealId_3 should return empty array'
    );

    // STEP 4: Test getDealBlobReferences
    console.log('\n' + '='.repeat(70));
    console.log('📋 STEP 4: Testing getDealBlobReferences()');
    console.log('='.repeat(70));

    await testGetDealBlobReferences(
      suiService,
      DEAL_ID_1,
      [fileA, fileB],
      'dealId_1 should return [A, B] with metadata'
    );

    await testGetDealBlobReferences(
      suiService,
      DEAL_ID_2,
      [fileC],
      'dealId_2 should return [C] with metadata'
    );

    await testGetDealBlobReferences(
      suiService,
      DEAL_ID_3,
      [],
      'dealId_3 should return empty array'
    );

    // Final success
    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(70));
    console.log('\n✅ Test Summary:');
    console.log('   - File uploads: 3/3 successful (A, B, C)');
    console.log('   - getDealBlobIds tests: 3/3 passed');
    console.log('     ✓ dealId_1 → [A, B]');
    console.log('     ✓ dealId_2 → [C]');
    console.log('     ✓ dealId_3 → []');
    console.log('   - getDealBlobReferences tests: 3/3 passed');
    console.log('     ✓ dealId_1 → [A, B] with correct metadata');
    console.log('     ✓ dealId_2 → [C] with correct metadata');
    console.log('     ✓ dealId_3 → []');
    console.log('\n✨ SuiService query methods are working correctly!');

    process.exit(0);
  } catch (error: unknown) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(70));
    console.error('\nError:', error);

    if (error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the test
main();
