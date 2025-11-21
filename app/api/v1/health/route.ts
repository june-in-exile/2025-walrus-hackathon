import { NextResponse } from 'next/server';
import type { HealthCheckResponse } from '@/src/shared/types/api.types';

/**
 * GET /api/v1/health
 * Health check endpoint to verify API availability
 */
export async function GET() {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}