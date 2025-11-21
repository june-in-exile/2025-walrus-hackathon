/**
 * React Query hooks for Deals
 * Fetches deals from the real API with wallet authentication
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useCallback } from 'react';
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

// Cache for signature to avoid re-signing on every query
interface SignatureCache {
  signature: string;
  message: string;
  timestamp: number;
  address: string;
}

// Signature is valid for 4 minutes (API allows 5 minutes)
const SIGNATURE_CACHE_DURATION = 4 * 60 * 1000;
const SIGNATURE_CACHE_KEY = 'sui-signature-cache';

// Helper functions for persistent signature cache
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

/**
 * Hook to fetch all deals for the current user
 */
export function useDeals(role?: 'buyer' | 'seller' | 'auditor') {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    if (!currentAccount?.address) return null;

    // Check if we have a valid cached signature in sessionStorage
    const cache = getPersistedSignatureCache();
    const now = Date.now();
    if (cache && cache.address === currentAccount.address && now - cache.timestamp < SIGNATURE_CACHE_DURATION) {
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

      // Cache the signature in sessionStorage
      setPersistedSignatureCache({
        signature,
        message: timestamp,
        timestamp: now,
        address: currentAccount.address,
      });

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

  return useQuery<DealListResponse>({
    queryKey: dealKeys.list(role || 'all'),
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();

      if (!authHeaders) {
        // Return empty list if not authenticated
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
          ...authHeaders,
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
