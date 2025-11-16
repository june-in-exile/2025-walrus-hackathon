import { NextResponse } from 'next/server';
import { openAPIService } from '@/src/backend/services/openapi-service';

/**
 * GET /api/openapi
 * Returns the complete OpenAPI specification
 */
export async function GET() {
  try {
    const openapiSpec = openAPIService.generateSpec();
    return NextResponse.json(openapiSpec);
  } catch (error) {
    console.error('Failed to generate OpenAPI spec:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to generate OpenAPI specification',
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}
