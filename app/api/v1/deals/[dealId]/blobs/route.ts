import { NextRequest, NextResponse } from 'next/server';
import { suiService } from '@/src/backend/services/sui-service';
import { walrusService } from '@/src/backend/services/walrus-service';
import type { BlobReference, DataType } from '@/src/shared/types/walrus';

/**
 * GET /api/v1/deals/{dealId}/blobs
 *
 * Get all Walrus blob references for a specific deal.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;

  try {
    // Get all on-chain blob references
    const onChainBlobRefs = await suiService.getDealBlobReferences(dealId);

    // Get all audit records for this deal (parallel query)
    const auditRecordsPromise = suiService.getDealAuditRecords(dealId);

    // Fetch metadata from Walrus for each blob
    const blobRefsWithMetadata = await Promise.all(
      onChainBlobRefs.map(async (ref) => {
        try {
          // This is inefficient as it downloads the whole blob.
          // A future optimization would be to have a method in WalrusService
          // that only fetches the metadata header.
          const walrusBlob = await walrusService.download(ref.blobId);

          return {
            ...ref,
            metadata: {
              ...(ref as any).metadata, // Keep on-chain metadata
              ...walrusBlob.metadata, // Add off-chain metadata from Walrus
            },
          };
        } catch (error) {
          console.error(`Failed to fetch metadata for blob ${ref.blobId}:`, error);
          // Return the on-chain ref as a fallback
          return {
            ...ref,
            metadata: {
              ...(ref as any).metadata,
              filename: 'Error reading filename' // Indicate that filename could not be read
            }
          };
        }
      })
    );

    // Wait for audit records query to complete
    const auditRecords = await auditRecordsPromise;

    // Create a map for efficient lookup: blobId -> auditRecord
    const auditMap = new Map(
      auditRecords.map(record => [record.dataId, record])
    );

    // Return blob references with combined metadata and audit status
    const blobRefs: BlobReference[] = blobRefsWithMetadata.map((ref) => {
      const auditRecord = auditMap.get(ref.blobId);

      return {
        blobId: ref.blobId,
        dataType: ref.dataType as DataType,
        uploadedAt: ref.uploadedAt,
        uploaderAddress: ref.uploaderAddress,
        metadata: ref.metadata, // Use on-chain metadata if available
        auditStatus: auditRecord ? {
          audited: auditRecord.audited,
          auditor: auditRecord.auditor,
          auditTimestamp: auditRecord.auditTimestamp,
          auditRecordId: auditRecord.id,
        } : {
          audited: false,
        },
      };
    });

    return NextResponse.json(blobRefs);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching blobs for deal ${dealId}:`, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}