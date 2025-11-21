import { NextRequest, NextResponse } from 'next/server';
import { suiService } from '@/src/backend/services/sui-service';
import { walrusService } from '@/src/backend/services/walrus-service';
import { config } from '@/src/shared/config/env';
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

    // Augment with Walrus metadata (like filename, description)
    const fullBlobRefs: BlobReference[] = await Promise.all(
      onChainBlobRefs.map(async (ref) => {
        // Use download to get the metadata envelope
        const { metadata: walrusMetadata } = await walrusService.download(ref.blobId);
        
        return {
          blobId: ref.blobId,
          dataType: ref.dataType as DataType, // Assert type to fix mismatch
          uploadedAt: ref.uploadedAt,
          uploaderAddress: ref.uploaderAddress,
          // size is not stored on-chain, omit or get from Walrus metadata if needed
          metadata: walrusMetadata,
        };
      })
    );

    // The simplified API now returns just the array of blob references.
    // The sealPolicy can be fetched separately if needed by the client.
    return NextResponse.json(fullBlobRefs);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}