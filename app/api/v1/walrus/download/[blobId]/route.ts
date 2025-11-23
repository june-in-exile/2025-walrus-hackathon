/**
 * Walrus Download API Route
 *
 * GET /api/v1/walrus/download/{blobId}?dealId=...
 *
 * Downloads encrypted file from Walrus. Frontend is responsible for decryption using Seal SDK.
 *
 * Authentication: Level 1 (Read) - Only requires wallet address
 */

import { NextRequest, NextResponse } from 'next/server';
import { walrusController } from '@/src/backend/controllers/controller';
import {
  authenticateReadOperation,
  createAuthErrorResponse,
} from '@/src/backend/middleware/auth';

/**
 * GET /api/v1/walrus/download/{blobId}
 *
 * Download encrypted file from Walrus (frontend decrypts)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blobId: string }> }
) {
  try {
    // Authenticate: Level 1 (Read operation)
    const authResult = authenticateReadOperation(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        createAuthErrorResponse(authResult),
        { status: authResult.errorCode || 401 }
      );
    }

    const userAddress = authResult.address!;

    // Await params (Next.js 15 requirement)
    const { blobId } = await params;

    // Validate blob ID
    if (!blobId || blobId.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Blob ID is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const dealId = searchParams.get('dealId');

    // Validate dealId is provided
    if (!dealId) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'dealId query parameter is required for authorization',
          statusCode: 400,
          details: {
            example: `/api/v1/walrus/download/${blobId}?dealId=0x1234...`,
          },
        },
        { status: 400 }
      );
    }

    // Delegate to controller with authenticated address
    return await walrusController.handleDownload(blobId, dealId, userAddress);
  } catch (error) {
    console.error('Download route error:', error);

    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'An unexpected error occurred during download',
        statusCode: 500,
        details: {
          reason: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/v1/walrus/download/{blobId}
 *
 * CORS preflight handler
 */
export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ blobId: string }> }
) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Sui-Address, X-Sui-Signature',
      },
    }
  );
}
