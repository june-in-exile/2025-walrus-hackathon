/**
 * useDealRole Hook
 *
 * Automatically determines user's role in a specific deal based on wallet address
 * This replaces the manual RoleContext with blockchain-based role detection
 */

import { useMemo } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useDashboard } from './useDashboard';

export type UserRole = 'buyer' | 'seller' | 'auditor' | null;

/**
 * Determine user's role in a deal based on their wallet address
 *
 * @param dealId - The deal ID to check role for
 * @returns User's role in the deal, or null if not a participant
 */
export function useDealRole(dealId: string): UserRole {
  const currentAccount = useCurrentAccount();
  const { data: dashboard } = useDashboard(dealId);

  const role = useMemo(() => {
    // No wallet connected
    if (!currentAccount?.address) {
      return null;
    }

    // No deal data loaded
    if (!dashboard?.dealInfo) {
      return null;
    }

    const { roles } = dashboard.dealInfo;
    const userAddress = currentAccount.address.toLowerCase();

    // Check if user is buyer
    if (roles.buyer && userAddress === roles.buyer.toLowerCase()) {
      return 'buyer';
    }

    // Check if user is seller
    if (roles.seller && userAddress === roles.seller.toLowerCase()) {
      return 'seller';
    }

    // Check if user is auditor
    if (roles.auditor && userAddress === roles.auditor.toLowerCase()) {
      return 'auditor';
    }

    // User is not a participant in this deal
    return null;
  }, [currentAccount?.address, dashboard?.dealInfo]);

  return role;
}

/**
 * Get a display-friendly role label
 */
export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'buyer':
      return 'Buyer';
    case 'seller':
      return 'Seller';
    case 'auditor':
      return 'Auditor';
    default:
      return 'Guest';
  }
}

/**
 * Check if user has a specific role
 */
export function useHasRole(dealId: string, requiredRole: 'buyer' | 'seller' | 'auditor'): boolean {
  const userRole = useDealRole(dealId);
  return userRole === requiredRole;
}
