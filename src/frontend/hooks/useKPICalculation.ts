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
import { walrusBlobService, type DownloadProgress } from '@/src/frontend/services/walrus-blob-service';
import type { KPIResultWithAttestation } from '@/src/frontend/services/tee-service';

export interface KPICalculationProgress {
  phase: 'idle' | 'downloading' | 'calculating' | 'completed' | 'error';
  message: string;
  downloadProgress?: DownloadProgress;
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

      // Download and process blobs (filters for JSON automatically)
      const jsonBlobs = await walrusBlobService.downloadAndProcessBlobs(
        dealId,
        allBlobs,
        (downloadProgress) => {
          setProgress({
            phase: 'downloading',
            message: `Downloading: ${downloadProgress.downloaded}/${downloadProgress.total}`,
            downloadProgress,
          });
        }
      );

      if (jsonBlobs.length === 0) {
        throw new Error('No valid JSON documents found in Walrus blobs');
      }

      setProgress({
        phase: 'downloading',
        message: `Found ${jsonBlobs.length} JSON documents`,
        documentsFound: jsonBlobs.length,
      });

      // Phase 2: Calculate KPI using TEE API
      setProgress({
        phase: 'calculating',
        message: `Calculating KPI from ${jsonBlobs.length} documents...`,
        documentsFound: jsonBlobs.length,
      });

      // Extract document data for KPI calculation
      const documents = jsonBlobs.map((blob) => blob.data);

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
        documentsProcessed: jsonBlobs.length,
        calculationTime: Date.now() - startTime,
      };

      // Phase 3: Completed
      setProgress({
        phase: 'completed',
        message: `KPI calculated successfully`,
        documentsFound: jsonBlobs.length,
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
  }, []);

  return {
    isCalculating,
    progress,
    result,
    error,
    calculateKPI,
    reset,
  };
}
