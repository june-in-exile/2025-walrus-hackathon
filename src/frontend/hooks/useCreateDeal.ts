/**
 * Hook for creating new deals
 *
 * Authentication: Level 2 (Write) - Only requires wallet address, transaction signed on-chain
 *
 * Flow:
 * 1. Call POST /api/v1/deals with wallet address
 * 2. Get back unsigned transaction bytes
 * 3. Execute the transaction with wallet (user signs here)
 */

import { useState, useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';
import { fromHex } from '@mysten/sui/utils';
import { toast } from 'sonner';
import { dealKeys } from './useDeals';

interface CreateDealOptions {
  agreementBlobId: string;
  name: string;
  sellerAddress: string;
  auditorAddress: string;
  startDateMs: number;
  periodMonths: number;
  kpiThreshold: number;
  maxPayout: number;
  headquarter: number;
  assetIds: string[];
  assetUsefulLives: number[];
  subperiodIds: string[];
  subperiodStartDates: number[];
  subperiodEndDates: number[];
  onSuccess?: (txDigest: string) => void;
  onError?: (error: Error) => void;
}

interface UseCreateDealReturn {
  createDeal: (options: CreateDealOptions) => Promise<void>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateDeal(): UseCreateDealReturn {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createDeal = useCallback(
    async (options: CreateDealOptions) => {
      const {
        agreementBlobId,
        name,
        sellerAddress,
        auditorAddress,
        startDateMs,
        periodMonths,
        kpiThreshold,
        maxPayout,
        headquarter,
        assetIds,
        assetUsefulLives,
        subperiodIds,
        subperiodStartDates,
        subperiodEndDates,
        onSuccess,
        onError,
      } = options;

      if (!currentAccount?.address) {
        const err = new Error('Wallet not connected');
        setError(err);
        toast.error('Wallet not connected');
        onError?.(err);
        return;
      }

      setIsCreating(true);
      setError(null);

      try {
        // 1. Call API to build transaction (no signature required)
        toast.loading('Creating deal transaction...', { id: 'create-deal' });

        console.log("kpiThreshold: ", kpiThreshold);

        const response = await fetch('/api/v1/deals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sui-Address': currentAccount.address,
          },
          body: JSON.stringify({
            agreementBlobId,
            name,
            sellerAddress,
            auditorAddress,
            startDateMs,
            periodMonths,
            kpiThreshold,
            maxPayout,
            headquarter,
            assetIds,
            assetUsefulLives,
            subperiodIds,
            subperiodStartDates,
            subperiodEndDates,
            buyerAddress: currentAccount.address,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create deal');
        }

        const data = await response.json();

        // 2. Check if we got transaction bytes
        if (!data.transaction?.txBytes) {
          throw new Error('No transaction bytes received from API');
        }

        toast.dismiss('create-deal');
        toast.info('Please approve the transaction in your wallet');

        // 3. Execute the transaction (user signs here)
        // Convert hex txBytes to Uint8Array and deserialize
        const txBytes = fromHex(data.transaction.txBytes);
        const tx = Transaction.from(txBytes);

        // Sign and execute on-chain
        const result = await signAndExecuteTransaction({
          transaction: tx,
        });

        // Handle success case
        toast.success('Deal created successfully!', {
          description: `Transaction: ${result.digest.slice(0, 16)}...`,
        });

        // Invalidate deals cache to force refetch when navigating to deals page
        await queryClient.invalidateQueries({ queryKey: dealKeys.lists() });

        onSuccess?.(result.digest);
      } catch (err) {
        // This catch block handles errors from the entire process,
        // including transaction building and execution.
        toast.dismiss('create-deal');
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Create deal failed:', error);

        // Handle user rejection of transaction
        if (error.message.includes('rejected') || error.message.includes('cancelled')) {
          toast.error('Operation cancelled', {
            description: 'You cancelled the transaction in your wallet',
          });
        } else {
          toast.error('Failed to create deal', {
            description: error.message,
          });
        }
        onError?.(error);
      } finally {
        setIsCreating(false);
      }
    },
    [currentAccount, signAndExecuteTransaction, queryClient]
  );

  return {
    createDeal,
    isCreating,
    error,
  };
}
