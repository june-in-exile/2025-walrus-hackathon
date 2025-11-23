/**
 * useTEESettlement Hook
 *
 * React hook for handling the complete TEE-based settlement flow:
 * 1. Download and decrypt all financial documents from Walrus
 * 2. Compute KPI using Nautilus TEE
 * 3. Submit KPI result with attestation to Sui blockchain
 */

import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { createTEEService } from '@/src/frontend/services/tee-service';
import type { KPIResultWithAttestation } from '@/src/frontend/services/tee-service';

interface Deal {
  id: string;
  subperiods: Subperiod[];
  kpi_threshold: number;
  max_payout: number;
}

interface Subperiod {
  id: string;
  walrus_blobs: WalrusBlobRef[];
}

interface WalrusBlobRef {
  blob_id: string;
  data_type: string;
}

interface UseTEESettlementResult {
  isLoading: boolean;
  error: string | null;
  teeResult: KPIResultWithAttestation | null;
  downloadAndDecryptDocuments: (deal: Deal) => Promise<any[]>;
  computeKPIWithTEE: (documents: any[]) => Promise<KPIResultWithAttestation>;
  submitSettlement: (
    dealId: string,
    teeResult: KPIResultWithAttestation,
    paymentCoinId: string
  ) => Promise<void>;
  executeFullSettlement: (
    deal: Deal,
    paymentCoinId: string
  ) => Promise<void>;
}

export function useTEESettlement(): UseTEESettlementResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teeResult, setTeeResult] = useState<KPIResultWithAttestation | null>(
    null
  );

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const teeService = createTEEService();

  /**
   * Step 1: Download and decrypt all financial documents
   */
  const downloadAndDecryptDocuments = async (deal: Deal): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const allDocuments: any[] = [];

      for (const subperiod of deal.subperiods) {
        for (const blob of subperiod.walrus_blobs) {
          // Download encrypted blob from Walrus via backend API
          const response = await fetch(
            `/api/v1/walrus/download/${blob.blob_id}?dealId=${deal.id}`
          );

          if (!response.ok) {
            throw new Error(
              `Failed to download blob ${blob.blob_id}: ${response.statusText}`
            );
          }

          const ciphertext = await response.arrayBuffer();

          // Decrypt using Seal (client-side)
          // Note: Seal SDK should be used here for actual decryption
          // For now, we assume the API returns decrypted data for testing
          const plaintext = await response.json();

          allDocuments.push(plaintext);
        }
      }

      console.log(
        `✅ Downloaded and decrypted ${allDocuments.length} documents`
      );
      return allDocuments;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to download documents';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 2: Compute KPI using Nautilus TEE
   */
  const computeKPIWithTEE = async (
    documents: any[]
  ): Promise<KPIResultWithAttestation> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔒 Computing KPI in TEE for ${documents.length} documents`);

      const result = await teeService.computeKPIWithAttestation(documents);

      console.log('✅ TEE computation complete:', {
        kpi: result.kpi_result.kpi,
        attestation_bytes_length: result.attestation_bytes.length,
      });

      setTeeResult(result);
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'TEE computation failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 3: Submit KPI result with attestation to Sui blockchain
   */
  const submitSettlement = async (
    dealId: string,
    teeResult: KPIResultWithAttestation,
    paymentCoinId: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const EARNOUT_PACKAGE_ID = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;
      if (!EARNOUT_PACKAGE_ID) {
        throw new Error('EARNOUT_PACKAGE_ID not configured');
      }

      // Build transaction
      const tx = new Transaction();

      // Convert KPI to u64 (multiply by 1000 to preserve 3 decimals)
      const kpiValueU64 = Math.round(teeResult.kpi_result.kpi * 1000);

      console.log('📝 Building settlement transaction:', {
        dealId,
        kpiValue: teeResult.kpi_result.kpi,
        kpiValueU64,
        attestationBytes: teeResult.attestation_bytes.length,
      });

      // Call submit_kpi_and_settle
      tx.moveCall({
        target: `${EARNOUT_PACKAGE_ID}::earnout::submit_kpi_and_settle`,
        arguments: [
          tx.object(dealId),
          tx.pure.string('net_profit'), // kpi_type
          tx.pure.u64(kpiValueU64), // kpi_value
          tx.pure.vector('u8', teeResult.attestation_bytes), // attestation
          tx.object(paymentCoinId), // payment coin
          tx.object('0x6'), // clock
        ],
      });

      console.log('🔐 Requesting user signature...');

      // Execute transaction
      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('✅ Settlement transaction executed:', {
        digest: result.digest,
        effects: result.effects,
      });

      // Wait for transaction confirmation
      await suiClient.waitForTransaction({
        digest: result.digest,
      });

      console.log('✅ Settlement confirmed on-chain');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Settlement submission failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Execute full settlement flow (all 3 steps)
   */
  const executeFullSettlement = async (
    deal: Deal,
    paymentCoinId: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🚀 Starting full TEE settlement flow...');

      // Step 1: Download and decrypt documents
      console.log('Step 1/3: Downloading and decrypting documents...');
      const documents = await downloadAndDecryptDocuments(deal);

      // Step 2: Compute KPI with TEE
      console.log('Step 2/3: Computing KPI in TEE...');
      const result = await computeKPIWithTEE(documents);

      // Step 3: Submit to blockchain
      console.log('Step 3/3: Submitting settlement to blockchain...');
      await submitSettlement(deal.id, result, paymentCoinId);

      console.log('🎉 Full settlement flow completed successfully!');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Settlement flow failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    teeResult,
    downloadAndDecryptDocuments,
    computeKPIWithTEE,
    submitSettlement,
    executeFullSettlement,
  };
}
