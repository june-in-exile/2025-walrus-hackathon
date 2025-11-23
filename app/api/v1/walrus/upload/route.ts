/**
 * Walrus Upload API Route
 *
 * POST /api/v1/walrus/upload?mode=client_encrypted|server_encrypted
 *
 * Handles file uploads to Walrus with hybrid encryption support.
 *
 * Authentication: Tiered approach
 * - Pending uploads (dealId: 'pending'): Level 1 (Read) - Only requires address
 * - Real deal uploads: Level 2 (Write) - Returns unsigned transaction for on-chain registration
 */

import { NextRequest, NextResponse } from 'next/server';
import { walrusController } from '@/src/backend/controllers/controller';
import { config } from '@/src/shared/config/env';
import {
  authenticateReadOperation,
  authenticateWriteOperation,
  createAuthErrorResponse,
} from '@/src/backend/middleware/auth';
import type { EncryptionMode } from '@/src/shared/types/walrus';

/**
 * POST /api/v1/walrus/upload
 *
 * Upload file to Walrus with optional server-side encryption
 */
export async function POST(request: NextRequest) {
  try {
    // First, we need to peek at dealId to determine auth level
    // This is safe because we're just reading formData metadata
    const formData = await request.formData();
    const dealId = formData.get('dealId') as string;

    // Check if this is a pending deal upload
    const isPendingDeal = dealId === 'pending' || dealId === 'null' || !dealId;

    // Authenticate based on upload type
    let authResult;
    if (isPendingDeal) {
      // Level 1: Pending uploads (e.g., M&A agreement before deal creation)
      // Only requires wallet address, no transaction needed
      authResult = authenticateReadOperation(request);
    } else {
      // Level 2: Real deal uploads (financial documents)
      // Will return unsigned transaction for on-chain registration
      authResult = authenticateWriteOperation(request);
    }

    if (!authResult.authenticated) {
      return NextResponse.json(
        createAuthErrorResponse(authResult),
        { status: authResult.errorCode || 401 }
      );
    }

    const userAddress = authResult.address!;

    // Get encryption mode from query parameters
    const searchParams = request.nextUrl.searchParams;
    const modeParam = searchParams.get('mode') || config.app.defaultUploadMode;

    // Validate mode parameter
    const validModes: EncryptionMode[] = ['client_encrypted', 'server_encrypted'];
    if (!validModes.includes(modeParam as EncryptionMode)) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: `Invalid encryption mode. Must be one of: ${validModes.join(', ')}`,
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

    // Check if server encryption is enabled
    if (mode === 'server_encrypted' && !config.app.enableServerEncryption) {
      return NextResponse.json(
        {
          error: 'ForbiddenError',
          message: 'Server-side encryption is disabled',
          statusCode: 403,
          details: {
            reason: 'ENABLE_SERVER_ENCRYPTION is set to false',
            suggestion: 'Use mode=client_encrypted or enable server encryption in configuration',
          },
        },
        { status: 403 }
      );
    }

    // Delegate to controller with authenticated address and formData
    return await walrusController.handleUpload(formData, userAddress, mode, isPendingDeal);
  } catch (error) {
    console.error('Upload route error:', error);

    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'An unexpected error occurred during upload',
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
 * OPTIONS /api/v1/walrus/upload
 *
 * CORS preflight handler
 */
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Sui-Address, X-Sui-Signature',
      },
    }
  );
}
