// src/frontend/hooks/useAuditPeriod.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@mysten/sui/transactions';
import {
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useCurrentAccount,
} from '@mysten/dapp-kit';

interface AuditPeriodArgs {
  dealObjectId: string;
  auditRecordObjectId: string;
  dataId: string; // The data_id from DataAuditRecord, needed for signing message
}

const EARNOUT_PACKAGE_ID = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;

if (!EARNOUT_PACKAGE_ID) {
  throw new Error('NEXT_PUBLIC_EARNOUT_PACKAGE_ID is not set');
}

export function useAuditPeriod() {
  const queryClient = useQueryClient();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  return useMutation({
    mutationFn: async ({ dealObjectId, auditRecordObjectId, dataId }: AuditPeriodArgs) => {
      if (!currentAccount?.address) {
        throw new Error('Wallet not connected');
      }

      // 1. Construct the message to be signed: "AUDIT:{data_id}"
      const message = `AUDIT:${dataId}`;
      const messageBytes = new TextEncoder().encode(message);

      // 2. Sign the message with wallet using Ed25519
      const { signature } = await signPersonalMessage({
        message: messageBytes,
      });

      // 3. Decode signature from base64
      // Sui wallet signature format: [scheme_flag (1 byte)][signature (64 bytes)][public_key (32 bytes)]
      const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));

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

      // 4. Build transaction
      const tx = new Transaction();

      tx.moveCall({
        target: `${EARNOUT_PACKAGE_ID}::earnout::audit_data`,
        arguments: [
          tx.object(dealObjectId),
          tx.object(auditRecordObjectId),
          tx.pure.vector('u8', Array.from(ed25519Signature)),
          tx.pure.vector('u8', Array.from(publicKey)),
          tx.object('0x6'), // Sui Clock object
        ],
      });

      // 5. Execute transaction
      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      return result;
    },
    onSuccess: () => {
      // Invalidate queries that fetch deal or audit record data to refetch and update UI
      queryClient.invalidateQueries({ queryKey: ['dealDetails'] }); // Example query key
      queryClient.invalidateQueries({ queryKey: ['auditRecords'] }); // Example query key
    },
    onError: (error) => {
      console.error('Failed to audit period:', error);
      // You might want to show a toast notification here
    },
  });
}
