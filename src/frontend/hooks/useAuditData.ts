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
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
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
        // 1. Build audit message (must match contract's expected format)
        // Contract builds: "AUDIT:" + audit_record.data_id
        const message = `AUDIT:${blobId}`;
        const messageBytes = new TextEncoder().encode(message);

        console.log('=== AUDIT MESSAGE DEBUG ===');
        console.log('Blob ID:', blobId);
        console.log('Audit Record ID:', auditRecordId);
        console.log('Deal ID:', dealId);
        console.log('Period ID:', periodId);
        console.log('Message to sign:', message);
        console.log('Message bytes:', Array.from(messageBytes));

        // 2. Sign message with wallet using Ed25519
        toast.info('Please sign the audit message in your wallet');

        const { signature } = await signPersonalMessage({
          message: messageBytes,
        });

        console.log('Raw signature (base64):', signature);

        // 3. Decode signature from base64
        // Sui wallet signature format: [scheme_flag (1 byte)][signature (64 bytes)][public_key (32 bytes)]
        const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));

        console.log('=== SIGNATURE DEBUG ===');
        console.log('Signature bytes length:', signatureBytes.length);
        console.log('Scheme flag:', signatureBytes[0]);
        console.log('Full signature bytes:', Array.from(signatureBytes));

        // Check signature scheme
        const schemeFlag = signatureBytes[0];
        if (schemeFlag !== 0) {
          const schemeNames = ['Ed25519', 'Secp256k1', 'Secp256r1'];
          const schemeName = schemeNames[schemeFlag] || `Unknown (${schemeFlag})`;
          throw new Error(
            `Wallet signature scheme mismatch: Contract requires Ed25519, but your wallet uses ${schemeName}. ` +
            `Please switch to an Ed25519 wallet (scheme flag should be 0, got ${schemeFlag}).`
          );
        }

        // Extract Ed25519 signature (skip scheme flag byte, take next 64 bytes)
        const ed25519Signature = signatureBytes.slice(1, 65);
        // Extract public key (last 32 bytes)
        const publicKey = signatureBytes.slice(65, 97);

        console.log('Ed25519 signature length:', ed25519Signature.length);
        console.log('Public key length:', publicKey.length);
        console.log('Ed25519 signature (first 10 bytes):', Array.from(ed25519Signature.slice(0, 10)));
        console.log('Public key (first 10 bytes):', Array.from(publicKey.slice(0, 10)));

        // Output full public key in hex for verification
        const publicKeyHex = Array.from(publicKey)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        console.log('Full public key (hex):', publicKeyHex);
        console.log('Current wallet address:', currentAccount.address);
        console.log('');
        console.log('To verify public key, run:');
        console.log(`npx tsx scripts/verify-public-key.ts ${publicKeyHex} ${currentAccount.address}`);

        // Verify message hash to debug
        const intentMessage = new Uint8Array([3, 0, 0, ...messageBytes]);
        console.log('Intent message (first 20 bytes):', Array.from(intentMessage.slice(0, 20)));

        // Client-side verification using noble/ed25519 (compatible with Sui)
        try {
          const { blake2b } = await import('@noble/hashes/blake2b');
          const { ed25519 } = await import('@noble/curves/ed25519');

          const messageHash = blake2b(intentMessage, { dkLen: 32 });
          console.log('Message hash (first 10 bytes):', Array.from(messageHash.slice(0, 10)));

          // Try different message formats to find what the wallet actually signed
          console.log('');
          console.log('🔬 TESTING DIFFERENT MESSAGE FORMATS:');

          // Test 1: Intent message (what we expected)
          const test1 = ed25519.verify(ed25519Signature, messageHash, publicKey);
          console.log('1. Intent message [3,0,0] + message:', test1 ? '✅' : '❌');

          // Test 2: Just the raw message bytes (no intent)
          const rawHash = blake2b(messageBytes, { dkLen: 32 });
          const test2 = ed25519.verify(ed25519Signature, rawHash, publicKey);
          console.log('2. Raw message (no intent):', test2 ? '✅' : '❌');

          // Test 3: Message without hashing (wallet might have done the hashing)
          let test3 = false;
          try {
            test3 = ed25519.verify(ed25519Signature, intentMessage, publicKey);
            console.log('3. Intent message (no hash):', test3 ? '✅' : '❌');
          } catch {
            console.log('3. Intent message (no hash): ❌ (error)');
          }

          // Test 4: Raw message without hashing
          let test4 = false;
          try {
            test4 = ed25519.verify(ed25519Signature, messageBytes, publicKey);
            console.log('4. Raw message (no hash):', test4 ? '✅' : '❌');
          } catch {
            console.log('4. Raw message (no hash): ❌ (error)');
          }

          // Test 5: Different intent format
          const altIntent = new Uint8Array([0, 3, 0, ...messageBytes]); // Try different order
          const altHash = blake2b(altIntent, { dkLen: 32 });
          const test5 = ed25519.verify(ed25519Signature, altHash, publicKey);
          console.log('5. Alternative intent [0,3,0]:', test5 ? '✅' : '❌');

          console.log('');
          const isValidLocal = test1 || test2 || test3 || test4 || test5;

          if (!isValidLocal) {
            console.error('❌ NONE OF THE MESSAGE FORMATS MATCHED!');
            console.error('');

            // Try using Sui SDK's own verification
            console.log('🔍 TRYING SUI SDK VERIFICATION:');
            try {
              const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');

              // The signature returned by signPersonalMessage should be verifiable directly
              const verifiedPublicKey = await verifyPersonalMessageSignature(
                messageBytes,
                signature
              );

              console.log('✅ Sui SDK verification SUCCEEDED!');
              console.log('Verified public key type:', verifiedPublicKey.flag());
              console.log('Verified public key bytes:', Array.from(verifiedPublicKey.toRawBytes()).slice(0, 10));

              // Convert to bytes for comparison
              const verifiedPkBytes = verifiedPublicKey.toRawBytes();

              // Check if the public key from verification matches what we extracted
              if (JSON.stringify(Array.from(verifiedPkBytes)) === JSON.stringify(Array.from(publicKey))) {
                console.log('✅ Public key from Sui verification matches extracted public key!');
              } else {
                console.error('❌ Public key mismatch!');
                console.error('Extracted from signature:', Array.from(publicKey).slice(0, 10));
                console.error('Verified by Sui SDK:', Array.from(verifiedPkBytes).slice(0, 10));
              }
            } catch (suiVerifyError) {
              console.error('❌ Sui SDK verification FAILED:', suiVerifyError);
            }
            console.log('');

            console.error('This suggests the wallet is using a completely different signing scheme.');
            console.error('');
            console.error('Debug info:');
            console.error('  Message:', message);
            console.error('  Message length:', messageBytes.length);
            console.error('  Intent message length:', intentMessage.length);
            console.error('  Signature length:', ed25519Signature.length);
            console.error('  Public key length:', publicKey.length);
          } else {
            console.log('✅ Found valid message format!');
            if (test1) console.log('   → Wallet signed: Intent message with hash');
            if (test2) console.log('   → Wallet signed: Raw message with hash');
            if (test3) console.log('   → Wallet signed: Intent message without hash');
            if (test4) console.log('   → Wallet signed: Raw message without hash');
            if (test5) console.log('   → Wallet signed: Alternative intent format');
          }
          console.log('');
        } catch (verifyError) {
          console.warn('Could not perform client-side verification:', verifyError);
          console.warn('Proceeding with transaction anyway...');
        }

        console.log('');
        console.log('⚠️  NOTE: Client-side verification uses different libraries than Sui contracts.');
        console.log('Even if client-side verification fails, the contract might still accept the signature.');
        console.log('Proceeding with transaction...');
        console.log('');

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
    [currentAccount, signPersonalMessage, signAndExecuteTransaction, queryClient]
  );

  return {
    auditData,
    isAuditing,
    error,
  };
}
