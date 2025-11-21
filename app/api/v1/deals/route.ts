/**
 * Deals API Route
 *
 * POST /api/v1/deals - Create a new earn-out deal
 * GET /api/v1/deals - List deals for current user (TODO)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { suiService } from '@/src/backend/services/sui-service';

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
 * POST /api/v1/deals
 *
 * Create a new earn-out deal. Returns unsigned transaction bytes for
 * the frontend to sign with the user's wallet.
 */
export async function POST(request: NextRequest) {
  try {
    // Extract authentication headers
    const userAddress = request.headers.get('X-Sui-Address');
    const signature = request.headers.get('X-Sui-Signature');
    const signedMessage = request.headers.get('X-Sui-Signature-Message');

    if (!userAddress || !signature || !signedMessage) {
      return NextResponse.json(
        {
          error: 'UnauthorizedError',
          message: 'Missing authentication headers (X-Sui-Address, X-Sui-Signature, X-Sui-Signature-Message)',
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

    // Parse request body
    const body = await request.json();
    const { name, sellerAddress, auditorAddress, buyerAddress } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Deal name is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Validate Sui address format
    const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;

    if (!sellerAddress || !suiAddressRegex.test(sellerAddress)) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Valid seller address is required (0x + 64 hex characters)',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (!auditorAddress || !suiAddressRegex.test(auditorAddress)) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Valid auditor address is required (0x + 64 hex characters)',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Buyer address should match the authenticated user
    const effectiveBuyerAddress = buyerAddress || userAddress;
    if (effectiveBuyerAddress !== userAddress) {
      return NextResponse.json(
        {
          error: 'ForbiddenError',
          message: 'Buyer address must match authenticated user',
          statusCode: 403,
        },
        { status: 403 }
      );
    }

    // Build the create_deal transaction
    const { txBytes, estimatedGas } = await suiService.buildCreateDealTransaction(
      name.trim(),
      sellerAddress,
      auditorAddress,
      effectiveBuyerAddress
    );

    // Return transaction for frontend to sign
    return NextResponse.json(
      {
        deal: {
          name: name.trim(),
          buyer: effectiveBuyerAddress,
          seller: sellerAddress,
          auditor: auditorAddress,
          status: 'pending_signature',
        },
        transaction: {
          txBytes,
          description: `Create earn-out deal: ${name.trim()}`,
          estimatedGas,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create deal failed:', error);

    // Check for configuration errors
    if (error instanceof Error && error.message.includes('EARNOUT_PACKAGE_ID')) {
      return NextResponse.json(
        {
          error: 'ConfigurationError',
          message: 'Earnout contract not configured',
          statusCode: 500,
          details: {
            reason: 'EARNOUT_PACKAGE_ID environment variable is not set',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'ServerError',
        message: 'Failed to create deal',
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
 * GET /api/v1/deals
 *
 * List all deals for the authenticated user.
 * Queries DealCreated events and filters by user's role.
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role') as 'buyer' | 'seller' | 'auditor' | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Query deals from blockchain
    const allDeals = await suiService.getUserDeals(
      userAddress,
      roleFilter || undefined
    );

    // Apply pagination
    const total = allDeals.length;
    const paginatedDeals = allDeals.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Format response
    const items = paginatedDeals.map(deal => ({
      dealId: deal.dealId,
      name: deal.name,
      status: deal.status,
      userRole: deal.userRole,
      periodCount: deal.periodCount,
      settledPeriods: 0, // TODO: Calculate from periods data
      buyer: deal.buyer,
      seller: deal.seller,
      auditor: deal.auditor,
    }));

    return NextResponse.json(
      {
        items,
        total,
        hasMore,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('List deals failed:', error);
    return NextResponse.json(
      {
        error: 'ServerError',
        message: 'Failed to list deals',
        statusCode: 500,
        details: {
          reason: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
