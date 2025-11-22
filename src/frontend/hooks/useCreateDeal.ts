/**
 * Hook for creating new deals
 *
 * Flow:
 * 1. Sign a timestamp message for authentication
 * 2. Call POST /api/v1/deals with the signature
 * 3. Get back unsigned transaction bytes
 * 4. Execute the transaction with wallet
 */

import { useState, useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import {
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { fromHex } from '@mysten/sui/utils';
import { toast } from 'sonner';

// Shared signature cache (same as useDeals and useDashboard)
interface SignatureCache {
  signature: string;
  message: string;
  timestamp: number;
  address: string;
}

const SIGNATURE_CACHE_DURATION = 4 * 60 * 1000;
const SIGNATURE_CACHE_KEY = 'sui-signature-cache';

function getPersistedSignatureCache(): SignatureCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(SIGNATURE_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as SignatureCache;
  } catch {
    return null;
  }
}

function setPersistedSignatureCache(cache: SignatureCache): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SIGNATURE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

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
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

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
        // 1. Get or create auth signature (reuse cached signature if available)
        let signature: string;
        let timestamp: string;

        const cache = getPersistedSignatureCache();
        const now = Date.now();

        if (cache && cache.address === currentAccount.address && now - cache.timestamp < SIGNATURE_CACHE_DURATION) {
          // Reuse cached signature
          signature = cache.signature;
          timestamp = cache.message;
        } else {
          // Sign new timestamp for authentication
          timestamp = new Date().toISOString();
          const messageBytes = new TextEncoder().encode(timestamp);

          toast.info('Please sign the authentication message in your wallet');

          const result = await signPersonalMessage({
            message: messageBytes,
          });
          signature = result.signature;

          // Cache the signature
          setPersistedSignatureCache({
            signature,
            message: timestamp,
            timestamp: now,
            address: currentAccount.address,
          });
        }

        // 2. Call API to build transaction
        toast.loading('Creating deal transaction...', { id: 'create-deal' });

        const response = await fetch('/api/v1/deals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sui-Address': currentAccount.address,
            'X-Sui-Signature': signature,
            'X-Sui-Signature-Message': timestamp,
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

        // 3. Check if we got transaction bytes
        if (!data.transaction?.txBytes) {
          throw new Error('No transaction bytes received from API');
        }

        toast.dismiss('create-deal');
        toast.info('Please approve the transaction in your wallet');

        // 4. Execute the transaction
        // Convert hex txBytes to Uint8Array and deserialize
        const txBytes = fromHex(data.transaction.txBytes);
        const tx = Transaction.from(txBytes);

        // 4. Execute the transaction with a cleaner async/await pattern
        const result = await signAndExecuteTransaction({
          transaction: tx,
        });

        // Handle success case
        toast.success('Deal created successfully!', {
          description: `Transaction: ${result.digest.slice(0, 16)}...`,
        });
        onSuccess?.(result.digest);
      } catch (err) {
        // This catch block now handles errors from the entire process,
        // including signing and transaction execution.
        toast.dismiss('create-deal');
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Create deal failed:', error);

        // Handle user rejection from either signing or transaction
        if (error.message.includes('rejected') || error.message.includes('cancelled')) {
          toast.error('Operation cancelled', {
            description: 'You cancelled the request in your wallet',
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
    [currentAccount, signPersonalMessage, signAndExecuteTransaction]
  );

  return {
    createDeal,
    isCreating,
    error,
  };
}
