/**
 * Deals API Route
 *
 * POST /api/v1/deals - Create a new earn-out deal (Level 2: Write operation)
 * GET /api/v1/deals - List deals for current user (Level 1: Read operation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { suiService } from '@/src/backend/services/sui-service';
import {
  authenticateReadOperation,
  authenticateWriteOperation,
  createAuthErrorResponse,
} from '@/src/backend/middleware/auth';

/**
 * POST /api/v1/deals
 *
 * Create a new earn-out deal. Returns unsigned transaction bytes for
 * the frontend to sign with the user's wallet.
 *
 * Authentication: Level 2 (Write) - Validates address, transaction signed on-chain
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate: Level 2 (Write operation)
    const authResult = authenticateWriteOperation(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        createAuthErrorResponse(authResult),
        { status: authResult.errorCode || 401 }
      );
    }

    const userAddress = authResult.address!;

    // Parse request body
    const body = await request.json();
    const {
      agreementBlobId,
      name,
      sellerAddress,
      auditorAddress,
      startDateMs,
      buyerAddress,
      periodMonths,
      kpiThreshold,
      maxPayout,
      headquarter,
      assetIds,
      assetUsefulLives,
      subperiodIds,
      subperiodStartDates,
      subperiodEndDates,
    } = body;

    // Validate required fields
    if (!agreementBlobId || typeof agreementBlobId !== 'string' || agreementBlobId.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Agreement blob ID is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

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

    if (typeof periodMonths !== 'number' || periodMonths <= 0) {
      return NextResponse.json({ error: 'ValidationError', message: 'periodMonths is required' }, { status: 400 });
    }
    if (typeof kpiThreshold !== 'number') {
      return NextResponse.json({ error: 'ValidationError', message: 'kpiThreshold is required' }, { status: 400 });
    }
    if (typeof maxPayout !== 'number' || maxPayout <= 0) {
      return NextResponse.json({ error: 'ValidationError', message: 'maxPayout is required' }, { status: 400 });
    }
    if (typeof headquarter !== 'number' || headquarter < 1 || headquarter > 100) {
      return NextResponse.json({ error: 'ValidationError', message: 'headquarter must be between 1 and 100' }, { status: 400 });
    }
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json({ error: 'ValidationError', message: 'assetIds are required' }, { status: 400 });
    }
    if (!Array.isArray(assetUsefulLives) || assetUsefulLives.length !== assetIds.length) {
      return NextResponse.json({ error: 'ValidationError', message: 'assetUsefulLives must match assetIds length' }, { status: 400 });
    }
    if (!Array.isArray(subperiodIds)) {
      return NextResponse.json({ error: 'ValidationError', message: 'subperiodIds are required' }, { status: 400 });
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

    // Validate startDateMs (required, number)
    if (typeof startDateMs !== 'number' || isNaN(startDateMs) || startDateMs <= 0) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Start date in milliseconds (startDateMs) is required and must be a positive number',
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
      agreementBlobId.trim(),
      name.trim(),
      sellerAddress,
      auditorAddress,
      startDateMs,
      periodMonths,
      kpiThreshold,
      maxPayout,
      headquarter,
      assetIds,
      assetUsefulLives,
      subperiodIds,
      subperiodStartDates,
      subperiodEndDates,
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
 *
 * Authentication: Level 1 (Read) - Only requires wallet address, no signature
 */
export async function GET(request: NextRequest) {
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
