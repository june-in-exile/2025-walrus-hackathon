import { NextRequest, NextResponse } from 'next/server';
import { mockDeals } from '@/src/backend/data/mock-deals';
import type { Deal } from '@/src/frontend/lib/api-client';

/**
 * GET /api/v1/deals/{dealId}
 * Get a single deal by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    // Find deal in mock data
    const deal = mockDeals.find((d) => d.dealId === dealId);

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(deal);
  } catch (error) {
    console.error('Error fetching deal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
