import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/walrus/upload
 * Upload encrypted file to Walrus
 *
 * For now, returns mock response simulating successful upload
 * Real implementation will use @mysten/walrus SDK
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dealId = formData.get('dealId') as string;
    const periodId = formData.get('periodId') as string;
    const dataType = formData.get('dataType') as string;
    const filename = formData.get('filename') as string;
    const description = formData.get('description') as string;

    if (!file || !dealId || !periodId || !dataType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Mock Walrus upload response
    const blobId = `blob_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const commitment = `sha256:${Math.random().toString(16).substring(2)}`;
    const size = file.size;
    const uploadedAt = new Date().toISOString();

    const response = {
      blobId,
      commitment,
      size,
      uploadedAt,
      blobReference: {
        blobId,
        commitment,
        dataType,
        size,
        uploadedAt,
        uploaderAddress: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab', // Mock address
        metadata: {
          filename: filename || file.name,
          mimeType: file.type,
          description,
          periodId,
          encrypted: true,
        },
      },
      nextStep: {
        action: 'register_on_chain',
        description: `Call POST /api/v1/deals/${dealId}/periods/${periodId}/blobs to register this blob on-chain`,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error uploading to Walrus:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
