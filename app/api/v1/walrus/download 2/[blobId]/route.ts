/**
 * Walrus Download API Route
 *
 * GET /api/v1/walrus/download/{blobId}?mode=client_encrypted|server_encrypted&dealId=...
 *
 * Handles file downloads from Walrus with hybrid decryption support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { walrusController } from '@/src/backend/controllers/walrus-controller';
import { config } from '@/src/shared/config/env';
import type { EncryptionMode } from '@/src/shared/types/walrus';

/**
 * GET /api/v1/walrus/download/{blobId}
 *
 * Download file from Walrus with optional server-side decryption
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blobId: string }> }
) {
  try {
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
    const modeParam = searchParams.get('mode') || config.app.defaultUploadMode;
    const dealId = searchParams.get('dealId');

    // Validate mode parameter
    const validModes: EncryptionMode[] = ['client_encrypted', 'server_encrypted'];
    if (!validModes.includes(modeParam as EncryptionMode)) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: `Invalid decryption mode. Must be one of: ${validModes.join(', ')}`,
          statusCode: 400,
          details: {
            providedMode: modeParam,
            validModes,
          },
        },
        { status: 400 }
      );
    }

    const mode = modeParam as EncryptionMode;

    // Check if server decryption is enabled
    if (mode === 'server_encrypted' && !config.app.enableServerEncryption) {
      return NextResponse.json(
        {
          error: 'ForbiddenError',
          message: 'Server-side decryption is disabled',
          statusCode: 403,
          details: {
            reason: 'ENABLE_SERVER_ENCRYPTION is set to false',
            suggestion: 'Use mode=client_encrypted or enable server encryption in configuration',
          },
        },
        { status: 403 }
      );
    }

    // Validate dealId is provided
    if (!dealId) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'dealId query parameter is required for authorization',
          statusCode: 400,
          details: {
            example: `/api/v1/walrus/download/${blobId}?dealId=0x1234...&mode=${mode}`,
          },
        },
        { status: 400 }
      );
    }

    // Delegate to controller
    return await walrusController.handleDownload(request, blobId, mode, dealId);
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
