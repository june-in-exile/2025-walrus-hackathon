/**
 * React Query hooks for Deals
 * Calls real API endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DealListResponse,
  DealSummary,
  Deal,
  CreateDealRequest,
  CreateDealResponse,
} from '@/src/frontend/lib/api-client';

// Query keys
export const dealKeys = {
  all: ['deals'] as const,
  lists: () => [...dealKeys.all, 'list'] as const,
  list: (filters: string) => [...dealKeys.lists(), { filters }] as const,
  details: () => [...dealKeys.all, 'detail'] as const,
  detail: (id: string) => [...dealKeys.details(), id] as const,
};

/**
 * Hook to fetch all deals for the current user
 */
export function useDeals(role?: 'buyer' | 'seller' | 'auditor') {
  return useQuery<DealListResponse>({
    queryKey: dealKeys.list(role || 'all'),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (role) params.set('role', role);

      const response = await fetch(`/api/v1/deals?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }

      return response.json();
    },
  });
}

/**
 * Hook to fetch a single deal by ID
 */
export function useDeal(dealId: string) {
  return useQuery<Deal | undefined>({
    queryKey: dealKeys.detail(dealId),
    queryFn: async () => {
      const response = await fetch(`/api/v1/deals/${dealId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return undefined;
        }
        throw new Error('Failed to fetch deal');
      }

      return response.json();
    },
    enabled: !!dealId,
  });
}

/**
 * Hook to create a new deal
 */
export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation<CreateDealResponse, Error, CreateDealRequest>({
    mutationFn: async (request: CreateDealRequest) => {
      const response = await fetch('/api/v1/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Failed to create deal');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch deals list
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() });
    },
  });
}

/**
 * Hook to get deal summary statistics
 */
export function useDealStats(role?: 'buyer' | 'seller' | 'auditor') {
  const { data } = useDeals(role);

  if (!data) {
    return {
      totalDeals: 0,
      activeDeals: 0,
      completedDeals: 0,
      draftDeals: 0,
    };
  }

  return {
    totalDeals: data.total,
    activeDeals: data.items.filter((d) => d.status === 'active').length,
    completedDeals: data.items.filter((d) => d.status === 'completed').length,
    draftDeals: data.items.filter((d) => d.status === 'draft').length,
  };
}
