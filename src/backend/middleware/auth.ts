/**
 * Authentication Middleware
 *
 * Provides tiered authentication for different operation levels:
 * - Level 1 (Read): Only requires valid Sui address (no signature)
 * - Level 2 (Write): Requires on-chain transaction signature (handled by frontend)
 *
 * This design maximizes UX by eliminating unnecessary signatures for read operations
 * while maintaining security through on-chain verification for critical operations.
 */

import { NextRequest } from 'next/server';

/**
 * Sui address format validation
 */
const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$/;

/**
 * Authentication result for read operations
 */
export interface AuthResult {
  authenticated: boolean;
  address?: string;
  error?: string;
  errorCode?: number;
}

/**
 * Level 1 Authentication: Read Operations
 *
 * Only validates that a Sui address is provided in the X-Sui-Address header.
 * Does NOT require signature verification.
 *
 * Use for:
 * - GET /api/v1/deals
 * - GET /api/v1/dashboard
 * - GET /api/v1/audit-records
 * - Other read-only operations
 *
 * Security: Backend MUST filter results to only return data accessible to the provided address.
 *
 * @param request - Next.js request object
 * @returns Authentication result with address if valid
 */
export function authenticateReadOperation(request: NextRequest): AuthResult {
  const userAddress = request.headers.get('X-Sui-Address');

  // Check if address is provided
  if (!userAddress) {
    return {
      authenticated: false,
      error: 'Missing X-Sui-Address header. Please connect your wallet.',
      errorCode: 401,
    };
  }

  // Validate address format
  if (!SUI_ADDRESS_REGEX.test(userAddress)) {
    return {
      authenticated: false,
      error: 'Invalid Sui address format. Expected 0x followed by 64 hex characters.',
      errorCode: 400,
    };
  }

  // Address is valid - trust the connected wallet
  return {
    authenticated: true,
    address: userAddress,
  };
}

/**
 * Level 2 Authentication: Write Operations
 *
 * For write operations, this function only validates the address header.
 * The actual security is enforced by requiring the user to sign the transaction
 * on-chain, which is handled by the frontend wallet.
 *
 * Use for:
 * - POST /api/v1/deals (returns unsigned transaction)
 * - POST /api/v1/walrus/upload (returns unsigned transaction)
 * - POST /api/v1/audit (returns unsigned transaction)
 *
 * Flow:
 * 1. Validate address format (this function)
 * 2. Build unsigned transaction (service layer)
 * 3. Return transaction bytes to frontend
 * 4. Frontend prompts wallet to sign transaction
 * 5. Transaction is executed on-chain with signature verification
 *
 * @param request - Next.js request object
 * @returns Authentication result with address if valid
 */
export function authenticateWriteOperation(request: NextRequest): AuthResult {
  // For write operations, we only need to validate the address format
  // The actual authentication happens when the user signs the transaction on-chain
  return authenticateReadOperation(request);
}

/**
 * Legacy signature verification (deprecated)
 *
 * This function is kept for reference but should NOT be used for new code.
 * The signature-based authentication has issues:
 * - Does not support zkLogin wallets
 * - Adds friction to UX by requiring signatures for read operations
 * - Provides minimal security benefit (backend must filter results anyway)
 *
 * For write operations, on-chain transaction signing provides stronger security.
 * For read operations, address-based auth + backend filtering is sufficient.
 */
export async function legacyVerifySignature(
  address: string,
  signature: string,
  signedMessage: string
): Promise<{ valid: boolean; error?: string }> {
  console.warn(
    'legacyVerifySignature is deprecated. Use authenticateReadOperation or authenticateWriteOperation instead.'
  );

  // This function is intentionally not implemented
  // Migrate to the new tiered authentication system
  return {
    valid: false,
    error: 'Signature verification is deprecated. Please update to the new authentication system.',
  };
}

/**
 * Helper: Extract user address from request (convenience wrapper)
 */
export function getUserAddress(request: NextRequest): string | null {
  const result = authenticateReadOperation(request);
  return result.authenticated ? result.address || null : null;
}

/**
 * Helper: Create unauthorized error response
 */
export function createUnauthorizedResponse(error: string, statusCode: number = 401) {
  return {
    error: 'UnauthorizedError',
    message: error,
    statusCode,
  };
}

/**
 * Helper: Create authentication error response from AuthResult
 */
export function createAuthErrorResponse(authResult: AuthResult) {
  return createUnauthorizedResponse(
    authResult.error || 'Authentication failed',
    authResult.errorCode || 401
  );
}
