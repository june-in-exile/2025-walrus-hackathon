/**
 * React Query hooks for Dashboard
 * Calls real API endpoints
 */

import { useQuery } from '@tanstack/react-query';
import type { DashboardResponse } from '@/src/frontend/lib/api-client';
import { useRole } from '@/src/frontend/contexts/RoleContext';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: (dealId: string, role: string) => [...dashboardKeys.all, dealId, role] as const,
};

/**
 * Hook to fetch dashboard data for a specific deal
 * Automatically uses the current role from RoleContext
 */
export function useDashboard(dealId: string) {
  const { currentRole } = useRole();

  return useQuery<DashboardResponse>({
    queryKey: dashboardKeys.detail(dealId, currentRole),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentRole) params.set('role', currentRole);

      const response = await fetch(`/api/v1/deals/${dealId}/dashboard?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard');
      }

      return response.json();
    },
    enabled: !!dealId,
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
