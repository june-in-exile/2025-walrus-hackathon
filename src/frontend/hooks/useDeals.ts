/**
 * React Query hooks for Deals
 * Fetches deals from the real API with wallet authentication
 *
 * Authentication: Level 1 (Read) - Only requires wallet address, no signature needed
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import type { DealListResponse, Deal } from '@/src/frontend/lib/api-client';
import { mockDeals } from '@/src/frontend/lib/mock-data';

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
 *
 * No signature required - only the wallet address is needed.
 * Backend filters results to only show deals where the user is buyer/seller/auditor.
 */
export function useDeals(role?: 'buyer' | 'seller' | 'auditor') {
  const currentAccount = useCurrentAccount();

  return useQuery<DealListResponse>({
    queryKey: dealKeys.list(role || 'all'),
    queryFn: async () => {
      if (!currentAccount?.address) {
        // Return empty list if wallet not connected
        return {
          items: [],
          total: 0,
          hasMore: false,
          limit: 20,
          offset: 0,
        };
      }

      const params = new URLSearchParams();
      if (role) params.set('role', role);

      const response = await fetch(`/api/v1/deals?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Sui-Address': currentAccount.address,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch deals');
      }

      return response.json();
    },
    enabled: !!currentAccount?.address,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch a single deal by ID
 */
export function useDeal(dealId: string) {
  return useQuery<Deal | undefined>({
    queryKey: dealKeys.detail(dealId),
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Find deal in mock data
      return mockDeals.find((deal) => deal.dealId === dealId);
    },
    enabled: !!dealId,
  });
}

// Note: The real useCreateDeal hook is in useCreateDeal.ts
// This file only exports query hooks for fetching deals

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
    };
  }

  return {
    totalDeals: data.total,
    activeDeals: data.items.filter((d) => d.status === 'active').length,
    completedDeals: data.items.filter((d) => d.status === 'completed').length,
  };
}
