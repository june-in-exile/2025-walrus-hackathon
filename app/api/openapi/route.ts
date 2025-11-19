import { NextResponse } from 'next/server';
import { openAPIService } from '@/src/backend/services/openapi-service';

/**
 * GET /api/openapi
 * Returns the complete OpenAPI specification
 */
export async function GET() {
  const spec = openAPIService.generateSpec();
  return NextResponse.json(spec);
}
