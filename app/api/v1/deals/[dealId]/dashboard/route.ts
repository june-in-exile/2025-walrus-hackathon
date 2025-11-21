/**
 * Dashboard API Route
 *
 * GET /api/v1/deals/{dealId}/dashboard - Get dashboard data for a specific deal
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { dashboardService } from '@/src/backend/services/dashboard-service';

// Maximum age for signature timestamp (5 minutes)
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Verify Sui personal message signature
 */
async function verifySignature(
  address: string,
  signature: string,
  signedMessage: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Parse timestamp from signed message
    const timestamp = Date.parse(signedMessage);
    if (isNaN(timestamp)) {
      return {
        valid: false,
        error: 'Invalid signature message format: expected ISO timestamp',
      };
    }

    // Check timestamp freshness (prevent replay attacks)
    const now = Date.now();
    const age = now - timestamp;

    if (age > SIGNATURE_MAX_AGE_MS) {
      return {
        valid: false,
        error: `Signature expired: message is ${Math.round(age / 1000)} seconds old (max: ${SIGNATURE_MAX_AGE_MS / 1000}s)`,
      };
    }

    // Reject signatures from the future (clock skew tolerance: 30 seconds)
    if (age < -30000) {
      return {
        valid: false,
        error: 'Invalid signature: message timestamp is in the future',
      };
    }

    // Convert message to bytes for verification
    const messageBytes = new TextEncoder().encode(signedMessage);

    // Verify the signature using Sui SDK
    const publicKey = await verifyPersonalMessageSignature(messageBytes, signature);

    // Check if the public key matches the claimed address
    const recoveredAddress = publicKey.toSuiAddress();
    if (recoveredAddress !== address) {
      return {
        valid: false,
        error: `Address mismatch: signature from ${recoveredAddress}, expected ${address}`,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Signature verification failed:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Signature verification failed',
    };
  }
}

/**
 * GET /api/v1/deals/{dealId}/dashboard
 *
 * Get dashboard data for a specific deal including:
 * - Deal info (name, status, roles)
 * - Periods summary with KPI and settlement status
 * - Recent events
 * - Health metrics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    // Extract authentication headers
    const userAddress = request.headers.get('X-Sui-Address');
    const signature = request.headers.get('X-Sui-Signature');
    const signedMessage = request.headers.get('X-Sui-Signature-Message');

    if (!userAddress || !signature || !signedMessage) {
      return NextResponse.json(
        {
          error: 'UnauthorizedError',
          message: 'Missing authentication headers',
          statusCode: 401,
        },
        { status: 401 }
      );
    }

    // Verify signature
    const verificationResult = await verifySignature(userAddress, signature, signedMessage);
    if (!verificationResult.valid) {
      return NextResponse.json(
        {
          error: 'UnauthorizedError',
          message: verificationResult.error || 'Invalid signature',
          statusCode: 401,
        },
        { status: 401 }
      );
    }

    // Validate dealId format
    if (!dealId || !dealId.startsWith('0x')) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Invalid deal ID format',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Get dashboard data from service
    const dashboardData = await dashboardService.getDashboard(dealId, userAddress);

    if (!dashboardData) {
      return NextResponse.json(
        {
          error: 'NotFoundError',
          message: 'Deal not found or user is not a participant',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(dashboardData, { status: 200 });
  } catch (error) {
    console.error('Get dashboard failed:', error);
    return NextResponse.json(
      {
        error: 'ServerError',
        message: 'Failed to get dashboard data',
        statusCode: 500,
        details: {
          reason: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
