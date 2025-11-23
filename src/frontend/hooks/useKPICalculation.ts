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
import { useCurrentAccount, useSuiClient, useSignPersonalMessage } from '@mysten/dapp-kit';
import { walrusBlobService, type DownloadProgress } from '@/src/frontend/services/walrus-blob-service';
import { decryptData } from '@/src/frontend/lib/seal';
import type { KPIResultWithAttestation } from '@/src/frontend/services/tee-service';

export interface KPICalculationProgress {
  phase: 'idle' | 'downloading' | 'decrypting' | 'calculating' | 'completed' | 'error';
  message: string;
  downloadProgress?: DownloadProgress;
  decryptProgress?: { current: number; total: number };
  documentsFound?: number;
}

export interface KPICalculationResult extends KPIResultWithAttestation {
  documentsProcessed: number;
  calculationTime: number; // ms
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

      setProgress({
        phase: 'downloading',
        message: `Found ${allBlobs.length} blobs. Downloading and processing...`,
        downloadProgress: {
          total: allBlobs.length,
          downloaded: 0,
          processed: 0,
        },
      });

      // Download encrypted blobs
      const encryptedBlobs = await walrusBlobService.downloadAndProcessBlobs(
        dealId,
        allBlobs,
        userAddress,
        (downloadProgress) => {
          setProgress({
            phase: 'downloading',
            message: `Downloading: ${downloadProgress.downloaded}/${downloadProgress.total}`,
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

      for (let i = 0; i < encryptedBlobs.length; i++) {
        const blob = encryptedBlobs[i];

        setProgress({
          phase: 'decrypting',
          message: `Decrypting blob ${i + 1}/${encryptedBlobs.length}...`,
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

          console.log(`✅ Blob ${blob.blobId} decrypted and parsed`);
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
        message: `Decrypted ${documents.length} documents`,
        documentsFound: documents.length,
      });

      // Phase 3: Calculate KPI using TEE API
      setProgress({
        phase: 'calculating',
        message: `Calculating KPI from ${documents.length} documents...`,
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
      };

      // Phase 4: Completed
      setProgress({
        phase: 'completed',
        message: `KPI calculated successfully`,
        documentsFound: documents.length,
      });

      setResult(calculationResult);
      setIsCalculating(false);

      console.log('✅ KPI Calculation Complete:', {
        kpi: calculationResult.kpi_result.kpi,
        documents: calculationResult.documentsProcessed,
        time: calculationResult.calculationTime,
      });

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
  }, [currentAccount, suiClient, signPersonalMessage]);

  return {
    isCalculating,
    progress,
    result,
    error,
    calculateKPI,
    reset,
  };
}
