/**
 * useKPICalculation Hook
 *
 * Handles the complete KPI calculation flow:
 * 1. Download all blobs from Walrus
 * 2. Filter for JSON documents
 * 3. Send to TEE API for calculation
 * 4. Return result with attestation
 */

import { useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient, useSignPersonalMessage, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { walrusBlobService, type DownloadProgress } from '@/src/frontend/services/walrus-blob-service';
import { decryptData } from '@/src/frontend/lib/seal';
import type { KPIResultWithAttestation } from '@/src/frontend/services/tee-service';

export interface KPICalculationProgress {
  phase: 'idle' | 'downloading' | 'decrypting' | 'calculating' | 'submitting' | 'checking_settlement' | 'completed' | 'error';
  message: string;
  downloadProgress?: DownloadProgress;
  decryptProgress?: { current: number; total: number };
  documentsFound?: number;
}

export interface SettlementStatus {
  isSettled: boolean;
  kpiValue: number;
  kpiThreshold: number;
  settledAmount: number;
  maxPayout: number;
  shortfall?: number; // How much KPI is short of threshold
  transactionDigest?: string;
}

export interface KPICalculationResult extends KPIResultWithAttestation {
  documentsProcessed: number;
  calculationTime: number; // ms
  auditedDocuments: {
    blobId: string;
    filename: string;
    auditor: string;
    auditTimestamp: number;
    dataType?: string;
  }[];
  settlement?: SettlementStatus;
}

export interface UseKPICalculationReturn {
  isCalculating: boolean;
  progress: KPICalculationProgress;
  result: KPICalculationResult | null;
  error: string | null;
  calculateKPI: (dealId: string) => Promise<KPICalculationResult | null>;
  reset: () => void;
}

export function useKPICalculation(): UseKPICalculationReturn {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<KPICalculationProgress>({
    phase: 'idle',
    message: 'Ready to calculate KPI',
  });
  const [result, setResult] = useState<KPICalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsCalculating(false);
    setProgress({
      phase: 'idle',
      message: 'Ready to calculate KPI',
    });
    setResult(null);
    setError(null);
  }, []);

  const calculateKPI = useCallback(async (dealId: string): Promise<KPICalculationResult | null> => {
    const startTime = Date.now();

    try {
      setIsCalculating(true);
      setError(null);
      setResult(null);

      // Check if wallet is connected
      if (!currentAccount?.address) {
        throw new Error('Please connect your wallet first');
      }

      const userAddress = currentAccount.address;

      // Phase 1: Download blobs from Walrus
      setProgress({
        phase: 'downloading',
        message: 'Fetching blobs from Walrus...',
      });

      // Get all blobs for the deal
      const allBlobs = await walrusBlobService.getDealBlobs(dealId);

      if (allBlobs.length === 0) {
        throw new Error('No blobs found for this deal');
      }

      // Filter only audited blobs
      const auditedBlobs = allBlobs.filter(blob => blob.auditStatus?.audited === true);

      if (auditedBlobs.length === 0) {
        throw new Error(`No audited blobs found for this deal. Total blobs: ${allBlobs.length}, but none have been audited yet.`);
      }

      console.log(`Found ${allBlobs.length} total blobs, ${auditedBlobs.length} audited blobs`);

      setProgress({
        phase: 'downloading',
        message: `Found ${auditedBlobs.length} audited blobs (${allBlobs.length} total). Downloading and processing...`,
        downloadProgress: {
          total: auditedBlobs.length,
          downloaded: 0,
          processed: 0,
        },
      });

      // Download encrypted blobs (only audited ones)
      const encryptedBlobs = await walrusBlobService.downloadAndProcessBlobs(
        dealId,
        auditedBlobs,
        userAddress,
        (downloadProgress) => {
          setProgress({
            phase: 'downloading',
            message: `Downloading audited blobs: ${downloadProgress.downloaded}/${downloadProgress.total}`,
            downloadProgress,
          });
        }
      );

      if (encryptedBlobs.length === 0) {
        throw new Error('No blobs downloaded from Walrus');
      }

      // Phase 2: Decrypt blobs using Seal
      setProgress({
        phase: 'decrypting',
        message: 'Decrypting blobs with Seal...',
        decryptProgress: { current: 0, total: encryptedBlobs.length },
      });

      const packageId = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;
      if (!packageId) {
        throw new Error('NEXT_PUBLIC_EARNOUT_PACKAGE_ID is not configured');
      }

      const documents: any[] = [];
      const processedAuditedDocs: {
        blobId: string;
        filename: string;
        auditor: string;
        auditTimestamp: number;
        dataType?: string;
      }[] = [];

      for (let i = 0; i < encryptedBlobs.length; i++) {
        const blob = encryptedBlobs[i];

        // Find the corresponding audited blob info
        const auditedBlobInfo = auditedBlobs.find(ab => ab.blobId === blob.blobId);

        setProgress({
          phase: 'decrypting',
          message: `Decrypting audited blob ${i + 1}/${encryptedBlobs.length}...`,
          decryptProgress: { current: i, total: encryptedBlobs.length },
        });

        try {
          // Decrypt using Seal
          const decryptedData = await decryptData(
            suiClient,
            blob.encryptedData,
            dealId,
            packageId,
            userAddress,
            signPersonalMessage
          );

          // Parse decrypted data as JSON
          const textDecoder = new TextDecoder();
          const jsonText = textDecoder.decode(decryptedData);
          const parsedDoc = JSON.parse(jsonText);

          documents.push(parsedDoc);

          // Record the audited document info
          if (auditedBlobInfo?.auditStatus?.audited) {
            processedAuditedDocs.push({
              blobId: blob.blobId,
              filename: auditedBlobInfo.metadata?.filename || 'Unknown',
              auditor: auditedBlobInfo.auditStatus.auditor || 'unknown',
              auditTimestamp: auditedBlobInfo.auditStatus.auditTimestamp || 0,
              dataType: auditedBlobInfo.dataType,
            });
          }

          console.log(`✅ Audited blob ${blob.blobId} decrypted and parsed`);
        } catch (error) {
          console.error(`Failed to decrypt/parse blob ${blob.blobId}:`, error);
          // Continue with other blobs
        }
      }

      if (documents.length === 0) {
        throw new Error('No valid JSON documents found after decryption');
      }

      setProgress({
        phase: 'decrypting',
        message: `Decrypted ${documents.length} audited documents`,
        documentsFound: documents.length,
      });

      // Phase 3: Calculate KPI using TEE API
      setProgress({
        phase: 'calculating',
        message: `Calculating KPI from ${documents.length} audited documents...`,
        documentsFound: documents.length,
      });

      // Call TEE API
      const response = await fetch('/api/v1/tee/compute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documents,
          operation: 'with_attestation',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `KPI calculation failed: ${response.statusText}`
        );
      }

      const responseData = await response.json();

      if (!responseData.success || !responseData.data) {
        throw new Error(responseData.error || 'KPI calculation failed');
      }

      // Parse TEE response
      const teeResult = responseData.data;

      // Convert hex strings to Uint8Array
      const hexToUint8Array = (hex: string): Uint8Array => {
        const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
        return new Uint8Array(bytes);
      };

      const calculationResult: KPICalculationResult = {
        kpi_result: teeResult.kpi_result,
        attestation: {
          kpi_value: teeResult.attestation.kpi_value,
          computation_hash: hexToUint8Array(teeResult.attestation.computation_hash),
          timestamp: teeResult.attestation.timestamp,
          tee_public_key: hexToUint8Array(teeResult.attestation.tee_public_key),
          signature: hexToUint8Array(teeResult.attestation.signature),
        },
        attestation_bytes: teeResult.attestation_bytes,
        documentsProcessed: documents.length,
        calculationTime: Date.now() - startTime,
        auditedDocuments: processedAuditedDocs,
      };

      console.log('✅ KPI Calculation Complete:', {
        kpi: calculationResult.kpi_result.kpi,
        documents: calculationResult.documentsProcessed,
        auditedDocuments: calculationResult.auditedDocuments.length,
        time: calculationResult.calculationTime,
      });

      console.log('📋 Audited documents used in calculation:',
        calculationResult.auditedDocuments.map(doc => ({
          filename: doc.filename,
          blobId: doc.blobId,
          dataType: doc.dataType,
          auditor: doc.auditor,
          auditedAt: new Date(doc.auditTimestamp).toISOString(),
        }))
      );

      // Phase 5: Submit KPI and Settlement to blockchain
      setProgress({
        phase: 'submitting',
        message: 'Submitting KPI result to blockchain...',
        documentsFound: documents.length,
      });

      const EARNOUT_PACKAGE_ID = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;
      if (!EARNOUT_PACKAGE_ID) {
        throw new Error('NEXT_PUBLIC_EARNOUT_PACKAGE_ID not configured');
      }

      try {
        // Build transaction
        const tx = new Transaction();

        // Get a payment coin (0 SUI since settlement doesn't actually transfer)
        const [coin] = tx.splitCoins(tx.gas, [0]);

        // Use kpi value directly from calculation result
        // On-chain values are stored as integers (e.g., 75000 = $75,000)
        // NOT multiplied by 1000
        const kpiValueU64 = Math.round(calculationResult.kpi_result.kpi);
        const kpiValue = calculationResult.kpi_result.kpi;

        console.log('📝 Building settlement transaction:', {
          dealId,
          kpiValue,
          kpiValueU64,
          attestationBytes: calculationResult.attestation_bytes.length,
        });

        // Call submit_kpi_and_settle
        tx.moveCall({
          target: `${EARNOUT_PACKAGE_ID}::earnout::submit_kpi_and_settle`,
          arguments: [
            tx.object(dealId),
            tx.pure.string('net_profit'), // kpi_type
            tx.pure.u64(kpiValueU64), // kpi_value (direct integer, e.g., 75000 = $75,000)
            tx.pure.vector('u8', calculationResult.attestation_bytes), // attestation
            coin, // payment coin
            tx.object('0x6'), // clock
          ],
        });

        console.log('🔐 Requesting user signature for settlement...');

        // Execute transaction
        const txResult = await signAndExecuteTransaction({
          transaction: tx,
        });

        console.log('✅ Settlement transaction executed:', {
          digest: txResult.digest,
        });

        // Wait for transaction confirmation
        await suiClient.waitForTransaction({
          digest: txResult.digest,
        });

        console.log('✅ Settlement confirmed on-chain');

        // Phase 6: Check settlement status
        setProgress({
          phase: 'checking_settlement',
          message: 'Checking settlement status...',
          documentsFound: documents.length,
        });

        // Query Deal object to get settlement status
        const dealObject = await suiClient.getObject({
          id: dealId,
          options: {
            showContent: true,
          },
        });

        if (!dealObject.data?.content || dealObject.data.content.dataType !== 'moveObject') {
          throw new Error('Failed to fetch deal settlement status');
        }

        const dealFields = dealObject.data.content.fields as any;
        const isSettled = dealFields.is_settled as boolean;
        const settledAmount = parseInt(dealFields.settled_amount as string);
        const kpiThreshold = parseInt(dealFields.kpi_threshold as string);
        const maxPayout = parseInt(dealFields.max_payout as string);

        // On-chain values are stored as integers (no conversion needed)
        // e.g., 900000 = $900,000
        const kpiThresholdActual = kpiThreshold;
        const shortfall = isSettled ? 0 : Math.max(0, kpiThresholdActual - kpiValue);

        const settlementStatus: SettlementStatus = {
          isSettled,
          kpiValue,
          kpiThreshold: kpiThresholdActual,
          settledAmount: settledAmount,
          maxPayout: maxPayout,
          shortfall,
          transactionDigest: txResult.digest,
        };

        calculationResult.settlement = settlementStatus;

        console.log('📊 Settlement Status:', settlementStatus);

      } catch (settlementError) {
        console.warn('Settlement submission failed, but KPI calculation succeeded:', settlementError);
        // Don't throw - KPI calculation was successful, just settlement failed
      }

      setProgress({
        phase: 'completed',
        message: 'KPI calculation and settlement complete',
        documentsFound: documents.length,
      });

      setResult(calculationResult);
      setIsCalculating(false);

      return calculationResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('KPI calculation failed:', err);

      setError(errorMessage);
      setProgress({
        phase: 'error',
        message: `Error: ${errorMessage}`,
      });
      setIsCalculating(false);

      return null;
    }
  }, [currentAccount, suiClient, signPersonalMessage, signAndExecuteTransaction]);

  return {
    isCalculating,
    progress,
    result,
    error,
    calculateKPI,
    reset,
  };
}
