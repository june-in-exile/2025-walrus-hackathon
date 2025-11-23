/**
 * Dashboard API Route
 *
 * GET /api/v1/deals/{dealId}/dashboard - Get dashboard data for a specific deal
 *
 * Authentication: Level 1 (Read) - Only requires wallet address, no signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { dashboardService } from '@/src/backend/services/dashboard-service';
import {
  authenticateReadOperation,
  createAuthErrorResponse,
} from '@/src/backend/middleware/auth';

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
    // Authenticate: Level 1 (Read operation)
    const authResult = authenticateReadOperation(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        createAuthErrorResponse(authResult),
        { status: authResult.errorCode || 401 }
      );
    }

    const userAddress = authResult.address!;
    const { dealId } = await params;

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
