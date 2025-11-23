/**
 * React Query hooks for Dashboard
 * Fetches dashboard data from the real API with wallet authentication
 *
 * Authentication: Level 1 (Read) - Only requires wallet address, no signature needed
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import type { DashboardResponse } from '@/src/frontend/lib/api-client';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: (dealId: string) => [...dashboardKeys.all, dealId] as const,
};

/**
 * Hook to fetch dashboard data for a specific deal
 * Uses real API endpoint with wallet authentication
 *
 * No signature required - only the wallet address is needed.
 */
export function useDashboard(dealId: string) {
  const currentAccount = useCurrentAccount();

  return useQuery<DashboardResponse>({
    queryKey: dashboardKeys.detail(dealId),
    queryFn: async () => {
      if (!currentAccount?.address) {
        throw new Error('Wallet not connected');
      }

      const response = await fetch(`/api/v1/deals/${dealId}/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Sui-Address': currentAccount.address,
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
