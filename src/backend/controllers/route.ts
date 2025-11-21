import { NextRequest, NextResponse } from 'next/server';
import { authController } from '@/src/backend/controllers/auth-controller';

/**
 * POST /api/v1/auth/login
 *
 * Handles user login by verifying a wallet signature and issuing a JWT.
 *
 * @param request - NextRequest
 * @returns NextResponse with JWT or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return authController.login(request);
}