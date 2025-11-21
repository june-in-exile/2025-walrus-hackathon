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
  useSignPersonalMessage,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { toast } from 'sonner';

interface AuditDataOptions {
  dealId: string;
  auditRecordId: string;
  blobId: string;
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
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const auditData = useCallback(
    async (options: AuditDataOptions) => {
      const { dealId, auditRecordId, blobId, onSuccess, onError } = options;

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
        // 1. Build audit message (must match contract's expected format)
        // Contract builds: "AUDIT:" + audit_record.data_id
        const message = `AUDIT:${blobId}`;
        const messageBytes = new TextEncoder().encode(message);

        // 2. Sign message with wallet using Ed25519
        toast.info('Please sign the audit message in your wallet');

        const { signature } = await signPersonalMessage({
          message: messageBytes,
        });

        // 3. Decode signature from base64
        // Sui wallet signature format: [scheme_flag (1 byte)][signature (64 bytes)][public_key (32 bytes)]
        const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));

        // Extract Ed25519 signature (skip scheme flag byte, take next 64 bytes)
        const ed25519Signature = signatureBytes.slice(1, 65);
        // Extract public key (last 32 bytes)
        const publicKey = signatureBytes.slice(65, 97);

        // 4. Get contract package ID from environment
        const packageId = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;
        if (!packageId) {
          throw new Error('NEXT_PUBLIC_EARNOUT_PACKAGE_ID not configured. Please set it in .env');
        }

        // 5. Build transaction
        // Contract signature: audit_data(deal, audit_record, signature, public_key, clock)
        const tx = new Transaction();

        tx.moveCall({
          target: `${packageId}::earnout::audit_data`,
          arguments: [
            tx.object(dealId),
            tx.object(auditRecordId),
            tx.pure.vector('u8', Array.from(ed25519Signature)),
            tx.pure.vector('u8', Array.from(publicKey)),
            tx.object('0x6'), // Sui Clock object
          ],
        });

        // 6. Execute transaction
        toast.info('Please approve the transaction in your wallet');

        await signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result) => {
              toast.success('Data audited successfully', {
                description: `Transaction: ${result.digest}`,
              });
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
    [currentAccount?.address, signPersonalMessage, signAndExecuteTransaction]
  );

  return {
    auditData,
    isAuditing,
    error,
  };
}
