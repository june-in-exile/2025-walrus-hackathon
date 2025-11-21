import { NextRequest, NextResponse } from 'next/server';
import { getDashboardByDealId, mockDeals } from '@/src/backend/data/mock-deals';
import type { DashboardResponse } from '@/src/frontend/lib/api-client';

/**
 * GET /api/v1/deals/{dealId}/dashboard
 * Get dashboard data for a specific deal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    // Check if deal exists
    const deal = mockDeals.find((d) => d.dealId === dealId);
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    // Get role from query params or default to 'buyer'
    const searchParams = request.nextUrl.searchParams;
    const role = (searchParams.get('role') as 'buyer' | 'seller' | 'auditor') || 'buyer';

    // Generate dashboard data
    const dashboardData = getDashboardByDealId(dealId, role);

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
