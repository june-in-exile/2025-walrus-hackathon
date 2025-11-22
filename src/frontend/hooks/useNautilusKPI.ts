/**
 * Hook for Nautilus KPI calculation and submission
 *
 * Features:
 * - Trigger KPI calculation via Nautilus TEE (mock)
 * - Submit KPI result on-chain
 * - Handle transaction status
 */

import { useState, useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { toast } from 'sonner';

interface KPICalculationResult {
  kpiValue: number;
  kpiType: string;
  attestation: string;
  computedAt: number;
  nextStep: {
    action: string;
    description: string;
    transaction: {
      txBytes: string;
      digest: string;
      description: string;
    };
  };
}

interface CalculateKPIOptions {
  dealId: string;
  periodIndex: number;
  kpiType?: string;
  onSuccess?: (result: KPICalculationResult) => void;
  onError?: (error: Error) => void;
}

interface SubmitKPIOptions {
  txBytes: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseNautilusKPIReturn {
  calculateKPI: (options: CalculateKPIOptions) => Promise<KPICalculationResult | undefined>;
  submitKPI: (options: SubmitKPIOptions) => Promise<void>;
  isCalculating: boolean;
  isSubmitting: boolean;
  error: Error | null;
  kpiResult: KPICalculationResult | null;
}

export function useNautilusKPI(): UseNautilusKPIReturn {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [kpiResult, setKpiResult] = useState<KPICalculationResult | null>(null);

  const calculateKPI = useCallback(
    async (options: CalculateKPIOptions) => {
      const { dealId, periodIndex, kpiType = 'revenue', onSuccess, onError } = options;

      if (!currentAccount?.address) {
        const err = new Error('Wallet not connected');
        setError(err);
        toast.error('Wallet not connected');
        onError?.(err);
        return;
      }

      setIsCalculating(true);
      setError(null);

      try {
        // Sign authentication headers
        const timestamp = new Date().toISOString();
        const message = new TextEncoder().encode(timestamp);

        // For now, use placeholder signature
        // In production, this should use wallet signing
        const signature = 'placeholder_signature';

        // Call Nautilus calculation API
        const response = await fetch('/api/v1/nautilus/calculate-kpi', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sui-Address': currentAccount.address,
            'X-Sui-Signature': signature,
            'X-Sui-Signature-Message': timestamp,
          },
          body: JSON.stringify({
            dealId,
            periodIndex,
            kpiType,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to calculate KPI');
        }

        const result: KPICalculationResult = await response.json();
        setKpiResult(result);

        toast.success('KPI calculated successfully', {
          description: `${result.kpiType.toUpperCase()}: ${result.kpiValue.toLocaleString()}`,
        });

        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('KPI calculation failed:', error);
        toast.error('Failed to calculate KPI', {
          description: error.message,
        });
        onError?.(error);
      } finally {
        setIsCalculating(false);
      }
    },
    [currentAccount]
  );

  const submitKPI = useCallback(
    async (options: SubmitKPIOptions) => {
      const { txBytes, onSuccess, onError } = options;

      if (!currentAccount?.address) {
        const err = new Error('Wallet not connected');
        setError(err);
        toast.error('Wallet not connected');
        onError?.(err);
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // Decode transaction bytes
        const txBytesArray = Uint8Array.from(Buffer.from(txBytes, 'base64'));

        // Deserialize transaction
        const tx = Transaction.from(txBytesArray);

        // Execute transaction
        await signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result) => {
              toast.success('KPI result submitted on-chain', {
                description: `Transaction: ${result.digest}`,
              });
              onSuccess?.();
            },
            onError: (err) => {
              console.error('Submit KPI transaction failed:', err);
              const error = err instanceof Error ? err : new Error('Transaction failed');
              setError(error);
              toast.error('Failed to submit KPI result', {
                description: error.message,
              });
              onError?.(error);
            },
          }
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Submit KPI failed:', error);
        toast.error('Failed to submit KPI result', {
          description: error.message,
        });
        onError?.(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentAccount, signAndExecuteTransaction]
  );

  return {
    calculateKPI,
    submitKPI,
    isCalculating,
    isSubmitting,
    error,
    kpiResult,
  };
}
