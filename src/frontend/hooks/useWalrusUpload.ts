/**
 * Hook for uploading files to Walrus with Seal encryption
 *
 * Flow:
 * 1. Optionally encrypt file using Seal SDK (client-side encryption)
 * 2. Sign a timestamp message for authentication
 * 3. Upload to Walrus via POST /api/v1/walrus/upload
 * 4. Execute the returned transaction to register blob on-chain
 */

import { useState, useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import {
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useCurrentAccount,
  useSuiClient,
} from '@mysten/dapp-kit';
import { fromHex } from '@mysten/sui/utils';
import { toast } from 'sonner';
import { encryptData } from '@/src/frontend/lib/seal';

// Shared signature cache (same as useDeals, useDashboard, useCreateDeal)
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

export type DataType = 'revenue_report' | 'expense_report';

export interface WalrusUploadOptions {
  file: File;
  dealId: string;
  periodId: string;
  dataType: DataType;
  customDataType?: string;
  description?: string;
  enableEncryption?: boolean;
  onSuccess?: (result: WalrusUploadResult) => void;
  onError?: (error: Error) => void;
}

export interface WalrusUploadResult {
  blobId: string;
  filename: string;
  size: number;
  uploadedAt: string;
  transactionDigest?: string;
}

interface UseWalrusUploadReturn {
  upload: (options: WalrusUploadOptions) => Promise<WalrusUploadResult | null>;
  isUploading: boolean;
  error: Error | null;
}

export function useWalrusUpload(): UseWalrusUploadReturn {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(
    async (options: WalrusUploadOptions): Promise<WalrusUploadResult | null> => {
      const {
        file,
        dealId,
        periodId,
        dataType,
        customDataType,
        description,
        enableEncryption = true,
        onSuccess,
        onError,
      } = options;

      if (!currentAccount?.address) {
        const err = new Error('Wallet not connected');
        setError(err);
        toast.error('Wallet not connected');
        onError?.(err);
        return null;
      }

      setIsUploading(true);
      setError(null);

      try {
        // 1. Prepare file data (optionally encrypt)
        let blobToUpload: Blob;
        const fileBuffer = await file.arrayBuffer();

        if (enableEncryption) {
          toast.loading('Encrypting file...', { id: 'walrus-upload' });

          const whitelistObjectId = process.env.NEXT_PUBLIC_SEAL_POLICY_OBJECT_ID;
          const packageId = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;

          if (!packageId || !whitelistObjectId) {
            throw new Error(
              'Seal encryption is not configured. Please set NEXT_PUBLIC_SEAL_PACKAGE_ID and NEXT_PUBLIC_SEAL_POLICY_OBJECT_ID.'
            );
          }

          // Encrypt data using Seal (client-side)
          const encryptedBuffer = await encryptData(
            suiClient,
            fileBuffer,
            whitelistObjectId,
            packageId
          );

          blobToUpload = new Blob([new Uint8Array(encryptedBuffer)], {
            type: 'application/octet-stream',
          });
        } else {
          blobToUpload = new Blob([fileBuffer], {
            type: file.type || 'application/octet-stream',
          });
        }

        // 2. Get or create auth signature (reuse cached signature if available)
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
          toast.loading('Please sign the authentication message...', { id: 'walrus-upload' });

          timestamp = new Date().toISOString();
          const messageBytes = new TextEncoder().encode(timestamp);

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

        // 3. Prepare FormData for upload
        const formData = new FormData();
        formData.append('file', blobToUpload, file.name);
        formData.append('dealId', dealId);
        formData.append('periodId', periodId);
        formData.append('dataType', dataType);
        formData.append('filename', file.name);
        if (customDataType) {
          formData.append('customDataType', customDataType);
        }
        if (description) {
          formData.append('description', description);
        }

        // 4. Upload to Walrus via API
        toast.loading('Uploading to Walrus...', { id: 'walrus-upload' });

        const uploadMode = enableEncryption ? 'client_encrypted' : 'server_encrypted';
        const response = await fetch(`/api/v1/walrus/upload?mode=${uploadMode}`, {
          method: 'POST',
          headers: {
            'X-Sui-Address': currentAccount.address,
            'X-Sui-Signature': signature,
            'X-Sui-Signature-Message': timestamp,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Upload failed');
        }

        const data = await response.json();

        // 5. Execute on-chain registration transaction (if provided)
        let transactionDigest: string | undefined;

        if (data.nextStep?.transaction?.txBytes) {
          toast.loading('Please approve the transaction...', { id: 'walrus-upload' });

          const txBytes = fromHex(data.nextStep.transaction.txBytes);
          const tx = Transaction.from(txBytes);

          const txResult = await signAndExecuteTransaction({
            transaction: tx,
          });

          transactionDigest = txResult.digest;
        }

        // Success!
        toast.dismiss('walrus-upload');
        toast.success('File uploaded successfully!', {
          description: `Blob ID: ${data.blobId.slice(0, 16)}...`,
        });

        const result: WalrusUploadResult = {
          blobId: data.blobId,
          filename: file.name,
          size: data.size,
          uploadedAt: data.uploadedAt,
          transactionDigest,
        };

        onSuccess?.(result);
        return result;
      } catch (err) {
        toast.dismiss('walrus-upload');
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Walrus upload failed:', error);

        // Handle user rejection
        if (error.message.includes('rejected') || error.message.includes('cancelled')) {
          toast.error('Operation cancelled', {
            description: 'You cancelled the request',
          });
        } else {
          toast.error('Failed to upload file', {
            description: error.message,
          });
        }
        onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [currentAccount?.address, suiClient, signPersonalMessage, signAndExecuteTransaction]
  );

  return {
    upload,
    isUploading,
    error,
  };
}
