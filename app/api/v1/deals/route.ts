import { NextRequest, NextResponse } from 'next/server';
import { mockDeals, mockDealSummaries, MOCK_ADDRESSES } from '@/src/backend/data/mock-deals';
import type { DealListResponse, DealSummary, CreateDealResponse, Deal } from '@/src/frontend/lib/api-client';

/**
 * GET /api/v1/deals
 * List all deals for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role') as 'buyer' | 'seller' | 'auditor' | null;
    const status = searchParams.get('status') as 'draft' | 'active' | 'completed' | 'cancelled' | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Filter deals
    let filteredDeals = [...mockDealSummaries];

    if (role) {
      filteredDeals = filteredDeals.filter((deal) => deal.userRole === role);
    }

    if (status) {
      filteredDeals = filteredDeals.filter((deal) => deal.status === status);
    }

    // Apply pagination
    const paginatedDeals = filteredDeals.slice(offset, offset + limit);

    const response: DealListResponse = {
      items: paginatedDeals,
      total: filteredDeals.length,
      hasMore: offset + limit < filteredDeals.length,
      limit,
      offset,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/deals
 * Create a new deal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Create new deal with mock data
    const newDeal: Deal = {
      dealId: `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}`,
      name: body.name,
      agreementDate: new Date(body.agreementDate),
      currency: body.currency,
      buyer: body.buyerAddress,
      seller: body.sellerAddress,
      auditor: body.auditorAddress,
      status: 'draft',
      periods: [],
      metadata: body.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In a real implementation, this would be saved to database
    // For now, just return the response
    mockDeals.push(newDeal as any);

    const dealSummary: DealSummary = {
      dealId: newDeal.dealId,
      name: newDeal.name,
      agreementDate: newDeal.agreementDate as any,
      currency: newDeal.currency,
      status: newDeal.status,
      userRole: 'buyer',
      periodCount: 0,
      settledPeriods: 0,
      lastActivity: newDeal.createdAt as any,
    };

    mockDealSummaries.push(dealSummary);

    const response: CreateDealResponse = {
      deal: newDeal,
      transaction: {
        txBytes: 'mock_tx_bytes_base64_encoded',
        description: `Create earn-out deal: ${newDeal.name}`,
        estimatedGas: 1000000,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
