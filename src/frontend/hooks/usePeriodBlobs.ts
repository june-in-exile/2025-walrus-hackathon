/**
 * React Query hook for fetching period blobs
 * Fetches blob references from the blockchain via API
 */

import { useQuery } from '@tanstack/react-query';

export interface PeriodBlobReference {
  blobId: string;
  dataType: string;
  uploadedAt: string;
  uploaderAddress: string;
  metadata?: {
    filename?: string;
    description?: string;
    dataType?: string;
    customDataType?: string;
    periodId?: string;
    mimeType?: string;
  };
  auditStatus?: {
    auditRecordId: string;
    audited: boolean;
    auditTimestamp?: number;
    auditor?: string;
  };
}

export interface PeriodBlobsResponse {
  dealId: string;
  periodId: string;
  blobs: PeriodBlobReference[];
  total: number;
}

// Query keys
export const periodBlobsKeys = {
  all: ['period-blobs'] as const,
  lists: () => [...periodBlobsKeys.all, 'list'] as const,
  list: (dealId: string, periodId: string) => [...periodBlobsKeys.lists(), { dealId, periodId }] as const,
};

/**
 * Hook to fetch all blobs for a specific period from the blockchain
 *
 * This hook queries the real Sui blockchain data via the backend API
 * to get all Walrus blob references for a given period.
 */
export function usePeriodBlobs(dealId: string, periodId: string) {
  return useQuery({
    queryKey: periodBlobsKeys.list(dealId, periodId),
    queryFn: async (): Promise<PeriodBlobsResponse> => {
      const response = await fetch(`/api/v1/deals/${dealId}/periods/${periodId}/blobs`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch period blobs');
      }

      return response.json();
    },
    enabled: !!dealId && !!periodId,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
