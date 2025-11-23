/**
 * Helper functions to get period details including blobs
 * This bridges the gap between Period data and PeriodSummary
 */

import { mockDeals } from './mock-data';

/**
 * Get walrus blobs for a specific period
 */
export function getPeriodBlobs(dealId: string, periodId: string): any[] {
  const deal = mockDeals.find((d) => d.dealId === dealId);
  if (!deal) return [];

  const period = deal.periods?.find((p) => p.periodId === periodId);
  if (!period) return [];

  return (period.walrusBlobs || []) as any[];
}

/**
 * Get full period details
 */
export function getPeriodDetails(dealId: string, periodId: string) {
  const deal = mockDeals.find((d) => d.dealId === dealId);
  if (!deal) return null;

  const period = deal.periods?.find((p) => p.periodId === periodId);
  return period || null;
}
