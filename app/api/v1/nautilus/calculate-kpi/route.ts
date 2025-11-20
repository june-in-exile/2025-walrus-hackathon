/**
 * Nautilus KPI Calculation API
 *
 * POST /api/v1/nautilus/calculate-kpi
 *
 * Triggers KPI calculation (mock or via Nautilus TEE) and returns
 * transaction bytes for submitting the result on-chain.
 */

import { NextRequest } from 'next/server';
import { walrusController } from '@/src/backend/controllers/controller';

/**
 * POST /api/v1/nautilus/calculate-kpi
 *
 * Request body:
 * {
 *   "dealId": "0x...",
 *   "periodIndex": 0,
 *   "kpiType": "revenue" (optional, defaults to "revenue")
 * }
 *
 * Headers required:
 * - X-Sui-Address: User's Sui wallet address
 * - X-Sui-Signature: Base64-encoded signature
 * - X-Sui-Signature-Message: ISO timestamp that was signed
 *
 * Response:
 * {
 *   "kpiValue": 1000000,
 *   "kpiType": "revenue",
 *   "attestation": "base64_encoded_attestation",
 *   "computedAt": 1234567890,
 *   "nextStep": {
 *     "action": "submit_kpi_result",
 *     "description": "Sign and execute transaction to submit KPI result on-chain",
 *     "transaction": {
 *       "txBytes": "base64_encoded_transaction",
 *       "digest": "transaction_digest",
 *       "description": "Submit revenue KPI result: 1000000"
 *     }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  return walrusController.handleCalculateKPI(req);
}
