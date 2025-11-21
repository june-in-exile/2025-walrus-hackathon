/**
 * Parameters API Route
 *
 * POST /api/v1/deals/{dealId}/parameters - Set earn-out parameters for a deal
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { Transaction } from '@mysten/sui/transactions';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { toBase64 } from '@mysten/sui/utils';
import { config } from '@/src/shared/config/env';

// Maximum age for signature timestamp (5 minutes)
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Verify Sui personal message signature
 */
async function verifySignature(
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
      return { valid: false, error: `Signature expired` };
    }

    if (age < -30000) {
      return { valid: false, error: 'Invalid signature: message timestamp is in the future' };
    }

    const messageBytes = new TextEncoder().encode(signedMessage);
    const publicKey = await verifyPersonalMessageSignature(messageBytes, signature);
    const recoveredAddress = publicKey.toSuiAddress();

    if (recoveredAddress !== address) {
      return { valid: false, error: `Address mismatch` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Signature verification failed' };
  }
}

interface PeriodInput {
  id: string;
  name: string;
  threshold: number;
  maxPayout: number;
}

interface SetParametersRequest {
  periods: PeriodInput[];
}

/**
 * POST /api/v1/deals/{dealId}/parameters
 *
 * Build transaction to set earn-out parameters.
 * Returns unsigned transaction bytes for frontend to sign.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    // Extract authentication headers
    const userAddress = request.headers.get('X-Sui-Address');
    const signature = request.headers.get('X-Sui-Signature');
    const signedMessage = request.headers.get('X-Sui-Signature-Message');

    if (!userAddress || !signature || !signedMessage) {
      return NextResponse.json(
        { error: 'UnauthorizedError', message: 'Missing authentication headers', statusCode: 401 },
        { status: 401 }
      );
    }

    // Verify signature
    const verificationResult = await verifySignature(userAddress, signature, signedMessage);
    if (!verificationResult.valid) {
      return NextResponse.json(
        { error: 'UnauthorizedError', message: verificationResult.error, statusCode: 401 },
        { status: 401 }
      );
    }

    // Parse request body
    const body: SetParametersRequest = await request.json();

    // Validate
    if (!body.periods || !Array.isArray(body.periods) || body.periods.length === 0) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'At least one period is required', statusCode: 400 },
        { status: 400 }
      );
    }

    // Validate each period
    for (const period of body.periods) {
      if (!period.id || typeof period.id !== 'string') {
        return NextResponse.json(
          { error: 'ValidationError', message: 'Each period must have an id', statusCode: 400 },
          { status: 400 }
        );
      }
      if (typeof period.threshold !== 'number' || period.threshold < 0) {
        return NextResponse.json(
          { error: 'ValidationError', message: 'Each period must have a valid threshold', statusCode: 400 },
          { status: 400 }
        );
      }
      if (typeof period.maxPayout !== 'number' || period.maxPayout < 0) {
        return NextResponse.json(
          { error: 'ValidationError', message: 'Each period must have a valid maxPayout', statusCode: 400 },
          { status: 400 }
        );
      }
    }

    // Check config
    if (!config.earnout.packageId) {
      return NextResponse.json(
        { error: 'ConfigurationError', message: 'EARNOUT_PACKAGE_ID not configured', statusCode: 500 },
        { status: 500 }
      );
    }

    // Build transaction
    const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
    const tx = new Transaction();

    // Prepare arrays for Move function
    const periodIds = body.periods.map(p => p.id);
    const thresholds = body.periods.map(p => p.threshold);
    const maxPayouts = body.periods.map(p => p.maxPayout);

    // Call set_parameters function
    tx.moveCall({
      target: `${config.earnout.packageId}::earnout::set_parameters`,
      arguments: [
        tx.object(dealId),
        tx.pure.vector('string', periodIds),
        tx.pure.vector('u64', thresholds),
        tx.pure.vector('u64', maxPayouts),
      ],
    });

    tx.setSender(userAddress);

    // Build transaction bytes
    const txBytes = await tx.build({ client: suiClient });

    // Estimate gas
    const dryRun = await suiClient.dryRunTransactionBlock({
      transactionBlock: toBase64(txBytes),
    });

    const estimatedGas = dryRun.effects.gasUsed
      ? Number(dryRun.effects.gasUsed.computationCost) +
        Number(dryRun.effects.gasUsed.storageCost) -
        Number(dryRun.effects.gasUsed.storageRebate)
      : 10000000;

    return NextResponse.json(
      {
        transaction: {
          txBytes: toBase64(txBytes),
          description: `Set earn-out parameters: ${body.periods.length} period(s)`,
          estimatedGas,
        },
        periods: body.periods.map(p => ({
          id: p.id,
          name: p.name,
          threshold: p.threshold,
          maxPayout: p.maxPayout,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Set parameters failed:', error);
    return NextResponse.json(
      {
        error: 'ServerError',
        message: 'Failed to build set parameters transaction',
        statusCode: 500,
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
