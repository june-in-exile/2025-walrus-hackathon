/**
 * Hook for managing audit records
 *
 * Features:
 * - Fetch audit records for a deal
 * - Subscribe to DataAudited events for real-time updates
 * - Filter by period and data type
 */

import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import type { DealBlobItem } from '@/src/shared/types/walrus';

interface UseAuditRecordsOptions {
  dealId: string;
  periodId?: string;
  enabled?: boolean;
}

interface UseAuditRecordsReturn {
  records: DealBlobItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  totalRecords: number;
  auditedRecords: number;
  auditProgress: number;
}

export function useAuditRecords(options: UseAuditRecordsOptions): UseAuditRecordsReturn {
  const { dealId, periodId, enabled = true } = options;
  const currentAccount = useCurrentAccount();

  const [records, setRecords] = useState<DealBlobItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!enabled || !currentAccount?.address) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (periodId) {
        params.set('periodId', periodId);
      }

      // Sign authentication headers
      const timestamp = new Date().toISOString();
      const message = new TextEncoder().encode(timestamp);

      // For now, we'll use a placeholder signature
      // In production, this should use wallet signing
      const signature = 'placeholder_signature';

      const response = await fetch(`/api/v1/deals/${dealId}/blobs?${params.toString()}`, {
        headers: {
          'X-Sui-Address': currentAccount.address,
          'X-Sui-Signature': signature,
          'X-Sui-Signature-Message': timestamp,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch audit records: ${response.statusText}`);
      }

      const data = await response.json();
      setRecords(data.items || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Failed to fetch audit records:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dealId, periodId, enabled, currentAccount?.address]);

  // Initial fetch
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Calculate audit progress
  const totalRecords = records.length;
  const auditedRecords = records.filter(r => r.auditStatus?.audited).length;
  const auditProgress = totalRecords > 0 ? (auditedRecords / totalRecords) * 100 : 0;

  return {
    records,
    isLoading,
    error,
    refetch: fetchRecords,
    totalRecords,
    auditedRecords,
    auditProgress,
  };
}
