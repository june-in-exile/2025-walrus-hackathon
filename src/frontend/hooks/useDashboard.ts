/**
 * React Query hooks for Dashboard
 * Fetches dashboard data from the real API with wallet authentication
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useCallback, useRef } from 'react';
import type { DashboardResponse } from '@/src/frontend/lib/api-client';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: (dealId: string) => [...dashboardKeys.all, dealId] as const,
};

// Cache for signature to avoid re-signing on every query
interface SignatureCache {
  signature: string;
  message: string;
  timestamp: number;
}

// Signature is valid for 4 minutes (API allows 5 minutes)
const SIGNATURE_CACHE_DURATION = 4 * 60 * 1000;

/**
 * Hook to fetch dashboard data for a specific deal
 * Uses real API endpoint with wallet authentication
 */
export function useDashboard(dealId: string) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const signatureCacheRef = useRef<SignatureCache | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    if (!currentAccount?.address) return null;

    // Check if we have a valid cached signature
    const cache = signatureCacheRef.current;
    const now = Date.now();
    if (cache && now - cache.timestamp < SIGNATURE_CACHE_DURATION) {
      return {
        'X-Sui-Address': currentAccount.address,
        'X-Sui-Signature': cache.signature,
        'X-Sui-Signature-Message': cache.message,
      };
    }

    // Sign a new timestamp message
    const timestamp = new Date().toISOString();
    const messageBytes = new TextEncoder().encode(timestamp);

    try {
      const { signature } = await signPersonalMessage({
        message: messageBytes,
      });

      // Cache the signature
      signatureCacheRef.current = {
        signature,
        message: timestamp,
        timestamp: now,
      };

      return {
        'X-Sui-Address': currentAccount.address,
        'X-Sui-Signature': signature,
        'X-Sui-Signature-Message': timestamp,
      };
    } catch {
      // User rejected or error occurred
      return null;
    }
  }, [currentAccount?.address, signPersonalMessage]);

  return useQuery<DashboardResponse>({
    queryKey: dashboardKeys.detail(dealId),
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();

      if (!authHeaders) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/v1/deals/${dealId}/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch dashboard');
      }

      return response.json();
    },
    enabled: !!dealId && !!currentAccount?.address,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to get current period information
 */
export function useCurrentPeriod(dealId: string) {
  const { data: dashboard } = useDashboard(dealId);

  if (!dashboard) {
    return null;
  }

  // Find the first period that is not settled
  const currentPeriod = dashboard.periodsSummary.find(
    (period) => period.settlementStatus !== 'settled'
  );

  return currentPeriod || dashboard.periodsSummary[dashboard.periodsSummary.length - 1];
}

/**
 * Hook to get pending actions for the current user
 */
export function usePendingActions(dealId: string) {
  const { data: dashboard } = useDashboard(dealId);

  if (!dashboard) {
    return [];
  }

  // Extract all next actions from periods
  const pendingActions = dashboard.periodsSummary
    .filter((period) => period.nextAction)
    .map((period) => ({
      periodId: period.periodId,
      periodName: period.name,
      action: period.nextAction!.action,
      actor: period.nextAction!.actor,
      deadline: period.nextAction!.deadline,
    }))
    .filter((action) => action.actor === dashboard.dealInfo.userRole);

  return pendingActions;
}
