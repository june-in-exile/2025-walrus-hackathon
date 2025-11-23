/**
 * Hook for auditing data blobs
 *
 * Features:
 * - Sign audit message with Sui wallet (Ed25519)
 * - Build and execute audit transaction
 * - Handle transaction status and errors
 *
 * Flow:
 * 1. Build message: "AUDIT:{blobId}"
 * 2. Sign message with wallet (Ed25519)
 * 3. Call contract audit_data() with signature + public_key
 * 4. Contract rebuilds message from audit_record.data_id and verifies signature
 */

import { useState, useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface AuditDataOptions {
  dealId: string;
  auditRecordId: string;
  blobId: string;
  periodId: string; // Added for more specific query invalidation
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseAuditDataReturn {
  auditData: (options: AuditDataOptions) => Promise<void>;
  isAuditing: boolean;
  error: Error | null;
}

export function useAuditData(): UseAuditDataReturn {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const auditData = useCallback(
    async (options: AuditDataOptions) => {
      const { dealId, auditRecordId, blobId, periodId, onSuccess, onError } = options;

      if (!currentAccount?.address) {
        const err = new Error('Wallet not connected');
        setError(err);
        toast.error('Wallet not connected');
        onError?.(err);
        return;
      }

      setIsAuditing(true);
      setError(null);

      try {
        // 1. Get contract package ID from environment
        const packageId = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;
        if (!packageId) {
          throw new Error('NEXT_PUBLIC_EARNOUT_PACKAGE_ID not configured. Please set it in .env');
        }

        // 2. Build transaction
        // Simplified audit_data: No off-chain signature needed
        // The wallet signature on the transaction itself proves the auditor's intent
        // Contract signature: audit_data(deal, audit_record, clock)
        const tx = new Transaction();

        tx.moveCall({
          target: `${packageId}::earnout::audit_data`,
          arguments: [
            tx.object(dealId),
            tx.object(auditRecordId),
            tx.object('0x6'), // Sui Clock object
          ],
        });

        console.log('📝 Audit Transaction:', {
          dealId,
          auditRecordId,
          blobId,
          auditor: currentAccount.address,
        });

        // 3. Execute transaction
        toast.info('Please approve the audit transaction in your wallet');

        await signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result) => {
              toast.success('Data audited successfully', {
                description: `Transaction: ${result.digest}`,
              });
              // Invalidate queries to refetch data
              queryClient.invalidateQueries({ queryKey: ['auditRecords', { dealId, periodId }] });
              queryClient.invalidateQueries({ queryKey: ['dealDetails', dealId] });
              onSuccess?.();
            },
            onError: (err) => {
              console.error('Audit transaction failed:', err);
              const error = err instanceof Error ? err : new Error('Transaction failed');
              setError(error);
              toast.error('Failed to audit data', {
                description: error.message,
              });
              onError?.(error);
            },
          }
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Audit failed:', error);

        // Handle user rejection
        if (error.message.includes('rejected') || error.message.includes('cancelled')) {
          toast.error('Signing cancelled', {
            description: 'You cancelled the signing request',
          });
        } else {
          toast.error('Failed to audit data', {
            description: error.message,
          });
        }
        onError?.(error);
      } finally {
        setIsAuditing(false);
      }
    },
    [currentAccount, signAndExecuteTransaction, queryClient]
  );

  return {
    auditData,
    isAuditing,
    error,
  };
}
