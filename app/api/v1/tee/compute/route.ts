/**
 * TEE KPI Computation API
 *
 * POST /api/v1/tee/compute
 * Calculate KPI with mock TEE attestation for testing
 *
 * @module api/v1/tee/compute
 */

import { NextRequest, NextResponse } from 'next/server';
import { kpiCalculationService } from '@/src/backend/services/kpi-calculation-service';
import type {
  KPIResult,
} from '@/src/backend/services/kpi-calculation-service';

// --- Request/Response Types ---

interface ComputeKPIRequest {
  documents: any[];
  operation?: 'simple' | 'with_attestation';
  initial_kpi?: number;
}

interface ComputeKPIResponse {
  success: boolean;
  data?: {
    kpi_result: KPIResult;
    attestation?: {
      kpi_value: number;
      computation_hash: string; // hex string
      timestamp: number;
      tee_public_key: string; // hex string
      signature: string; // hex string
    };
    attestation_bytes?: number[];
  };
  error?: string;
  message?: string;
}

// --- API Handler ---

/**
 * POST /api/v1/tee/compute
 *
 * Compute KPI from financial documents with optional TEE attestation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body: ComputeKPIRequest = await request.json();

    // Validate request
    if (!body.documents || !Array.isArray(body.documents)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: documents must be an array',
        } as ComputeKPIResponse,
        { status: 400 }
      );
    }

    if (body.documents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: documents array is empty',
        } as ComputeKPIResponse,
        { status: 400 }
      );
    }

    const operation = body.operation || 'with_attestation';
    const initialKPI = body.initial_kpi || 0;

    // Execute computation
    if (operation === 'simple') {
      // Simple KPI calculation without attestation
      const result = kpiCalculationService.calculateSimple(
        body.documents,
        initialKPI
      );

      return NextResponse.json(
        {
          success: true,
          data: {
            kpi_result: result,
          },
          message: 'KPI calculated successfully (simple mode)',
        } as ComputeKPIResponse,
        { status: 200 }
      );
    } else {
      // KPI calculation with mock TEE attestation
      const result = kpiCalculationService.calculateWithAttestation(
        body.documents
      );

      // Convert buffers to hex strings for JSON serialization
      const response: ComputeKPIResponse = {
        success: true,
        data: {
          kpi_result: result.kpi_result,
          attestation: {
            kpi_value: result.attestation.kpi_value,
            computation_hash: result.attestation.computation_hash.toString('hex'),
            timestamp: result.attestation.timestamp,
            tee_public_key: result.attestation.tee_public_key.toString('hex'),
            signature: result.attestation.signature.toString('hex'),
          },
          attestation_bytes: result.attestation_bytes,
        },
        message: 'KPI calculated with mock TEE attestation',
      };

      return NextResponse.json(response, { status: 200 });
    }
  } catch (error) {
    console.error('TEE compute error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during KPI computation',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as ComputeKPIResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/tee/compute
 *
 * Get API information
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      endpoint: '/api/v1/tee/compute',
      methods: ['POST'],
      description: 'Compute KPI from financial documents with TEE attestation',
      usage: {
        method: 'POST',
        body: {
          documents: 'Array of financial document objects',
          operation: 'Optional: "simple" | "with_attestation" (default)',
          initial_kpi: 'Optional: Initial KPI value (default: 0)',
        },
        example: {
          documents: [
            {
              journalEntryId: 'JE-2025-001',
              credits: [{ account: 'Sales Revenue', amount: 50000 }],
            },
            {
              employeeDetails: {},
              grossPay: 20000,
            },
          ],
          operation: 'with_attestation',
        },
      },
      warning:
        'This endpoint uses MOCK TEE attestation for testing. NOT for production use.',
    },
    { status: 200 }
  );
}
