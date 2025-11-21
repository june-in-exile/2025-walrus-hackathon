/**
 * Auth Controller
 *
 * Handles user authentication, including login via wallet signature
 * and JWT generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import jwt from 'jsonwebtoken';
import { config } from '@/src/shared/config/env';

// Maximum age for signature timestamp (5 minutes)
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Auth Controller for handling authentication logic
 */
export class AuthController {
  /**
   * Handle user login request.
   * Verifies wallet signature and issues a JWT upon success.
   *
   * @param request - NextRequest
   * @returns NextResponse with JWT or error
   */
  async login(request: NextRequest): Promise<NextResponse> {
    try {
      const userAddress = request.headers.get('X-Sui-Address');
      const signature = request.headers.get('X-Sui-Signature');
      const signedMessage = request.headers.get('X-Sui-Signature-Message');

      if (!userAddress || !signature || !signedMessage) {
        return NextResponse.json(
          { error: 'UnauthorizedError', message: 'Missing authentication headers' },
          { status: 401 }
        );
      }

      const verificationResult = await this.verifySignature(userAddress, signature, signedMessage);
      if (!verificationResult.valid) {
        return NextResponse.json(
          { error: 'UnauthorizedError', message: verificationResult.error || 'Invalid signature' },
          { status: 401 }
        );
      }

      // Ensure JWT secret is configured
      if (!config.app.jwtSecret) {
        console.error('JWT_SECRET is not configured in environment variables.');
        return NextResponse.json(
          { error: 'ConfigurationError', message: 'Server is not configured for authentication.' },
          { status: 500 }
        );
      }

      // Signature is valid, generate a JWT
      const token = jwt.sign(
        { sub: userAddress }, // 'sub' (subject) is a standard JWT claim for the user identifier
        config.app.jwtSecret,
        { expiresIn: '24h' } // Token expires in 24 hours
      );

      return NextResponse.json({ token, userAddress, expires_in: '24h' });
    } catch (error) {
      console.error('Login failed:', error);
      return NextResponse.json(
        { error: 'LoginError', message: 'An unexpected error occurred during login' },
        { status: 500 }
      );
    }
  }

  /**
   * Verify Sui personal message signature.
   * This can be used by other controllers to validate requests.
   */
  public async verifySignature(
    address: string,
    signature: string,
    signedMessage: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const timestamp = Date.parse(signedMessage);
      if (isNaN(timestamp)) {
        return { valid: false, error: 'Invalid signature message format: expected ISO timestamp' };
      }

      const now = Date.now();
      const age = now - timestamp;

      if (age > SIGNATURE_MAX_AGE_MS) {
        return {
          valid: false,
          error: `Signature expired: message is ${Math.round(age / 1000)}s old (max: ${
            SIGNATURE_MAX_AGE_MS / 1000
          }s)`,
        };
      }

      if (age < -30000) {
        return { valid: false, error: 'Invalid signature: message timestamp is in the future' };
      }

      const messageBytes = new TextEncoder().encode(signedMessage);
      const publicKey = await verifyPersonalMessageSignature(messageBytes, signature);
      const recoveredAddress = publicKey.toSuiAddress();

      if (recoveredAddress !== address) {
        return {
          valid: false,
          error: `Address mismatch: signature from ${recoveredAddress}, expected ${address}`,
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Signature verification failed:', error);
      return { valid: false, error: 'Signature verification failed' };
    }
  }
}

export const authController = new AuthController();