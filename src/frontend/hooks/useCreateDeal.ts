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

interface CreateDealOptions {
  name: string;
  sellerAddress: string;
  auditorAddress: string;
  onSuccess?: (dealId: string) => void;
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
      const { name, sellerAddress, auditorAddress, onSuccess, onError } = options;

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
        // 1. Sign timestamp for authentication
        const timestamp = new Date().toISOString();
        const messageBytes = new TextEncoder().encode(timestamp);

        toast.info('Please sign the authentication message in your wallet');

        const { signature } = await signPersonalMessage({
          message: messageBytes,
        });

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
            name,
            sellerAddress,
            auditorAddress,
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

        await signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result) => {
              toast.success('Deal created successfully!', {
                description: `Transaction: ${result.digest.slice(0, 16)}...`,
              });
              // Extract deal ID from transaction effects (created objects)
              // For now, use the transaction digest as a reference
              onSuccess?.(result.digest);
            },
            onError: (err) => {
              console.error('Create deal transaction failed:', err);
              const error = err instanceof Error ? err : new Error('Transaction failed');
              setError(error);
              toast.error('Failed to create deal', {
                description: error.message,
              });
              onError?.(error);
            },
          }
        );
      } catch (err) {
        toast.dismiss('create-deal');
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Create deal failed:', error);

        // Handle user rejection
        if (error.message.includes('rejected') || error.message.includes('cancelled')) {
          toast.error('Operation cancelled', {
            description: 'You cancelled the request',
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
    [currentAccount?.address, signPersonalMessage, signAndExecuteTransaction]
  );

  return {
    createDeal,
    isCreating,
    error,
  };
}
