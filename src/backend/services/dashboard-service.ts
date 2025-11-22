/**
 * Dashboard Service
 *
 * Provides business logic for aggregating dashboard data from blockchain.
 * Automatically generates monthly sub-periods from the deal's start date.
 */

import { suiService } from './sui-service';
import { generateSubPeriods, type SubPeriod } from '@/src/shared/utils/period-calculator';

export interface DashboardDealInfo {
  dealId: string;
  name: string;
  startDate: string; // ISO date string
  closingDate?: string;
  currency?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  roles: {
    buyer: string;
    seller: string;
    auditor: string;
  };
  userRole: 'buyer' | 'seller' | 'auditor';
}

export interface PeriodSummary {
  periodId: string;
  name: string;
  periodIndex: number;
  dateRange: {
    start: string;
    end: string;
  };
  dataUploadProgress: {
    blobCount: number;
    lastUploadAt?: string;
    completeness: number;
  };
  kpiStatus: 'not_proposed' | 'proposed' | 'approved' | 'rejected';
  kpiValue?: number;
  settlementStatus: 'not_settled' | 'pending' | 'settled';
  settlementAmount?: number;
  nextAction?: {
    action: string;
    actor: string;
    deadline?: string;
  };
}

export interface DealEvent {
  type: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  description: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthMetrics {
  overallProgress: number;
  pendingActions: number;
  nextDeadline?: string;
  dataCompletenessScore: number;
  risksDetected: Array<{
    severity: 'low' | 'medium' | 'high';
    category: string;
    description: string;
    periodId?: string;
  }>;
}

export interface DashboardResponse {
  dealInfo: DashboardDealInfo;
  periodsSummary: PeriodSummary[];
  recentEvents: DealEvent[];
  healthMetrics: HealthMetrics;
}

class DashboardService {
  /**
   * Get dashboard data for a specific deal
   *
   * @param dealId - Deal object ID on Sui
   * @param userAddress - Current user's Sui address
   * @returns Dashboard data or null if not found/unauthorized
   */
  async getDashboard(dealId: string, userAddress: string): Promise<DashboardResponse | null> {
    // Fetch deal from blockchain
    const deal = await suiService.getDeal(dealId);

    if (!deal) {
      return null;
    }

    // Determine user's role
    let userRole: 'buyer' | 'seller' | 'auditor' | null = null;
    if (deal.buyer === userAddress) {
      userRole = 'buyer';
    } else if (deal.seller === userAddress) {
      userRole = 'seller';
    } else if (deal.auditor === userAddress) {
      userRole = 'auditor';
    }

    // User must be a participant
    if (!userRole) {
      return null;
    }

    // Deal is always active once created (no longer need parametersLocked)
    const status: 'draft' | 'active' | 'completed' | 'cancelled' = 'active';

    // Format start date
    const startDateStr = deal.startDate > 0
      ? new Date(deal.startDate).toISOString().split('T')[0]
      : '';

    // Build deal info
    const dealInfo: DashboardDealInfo = {
      dealId: deal.id,
      name: deal.name,
      startDate: startDateStr,
      status,
      roles: {
        buyer: deal.buyer,
        seller: deal.seller,
        auditor: deal.auditor,
      },
      userRole,
    };

    // Generate sub-periods automatically from start date and period_months
    // If period_months is 0 or not set, use a default of 12 months to show all future periods
    const periodMonths = deal.periodMonths && deal.periodMonths > 0 ? deal.periodMonths : 12;

    console.log(`[Dashboard] Generating periods for deal ${dealId}:`);
    console.log(`  - startDate: ${new Date(deal.startDate).toISOString()}`);
    console.log(`  - period_months from chain: ${deal.periodMonths}`);
    console.log(`  - using periodMonths: ${periodMonths}`);

    const generatedPeriods = generateSubPeriods(deal.startDate, periodMonths);

    // Parse and merge with on-chain period data
    const periodsSummary = this.buildPeriodsSummary(
      generatedPeriods,
      deal.subperiods,
      userRole
    );

    // Get recent events (from blockchain events)
    const recentEvents = await this.getRecentEvents(dealId);

    // Calculate health metrics
    const healthMetrics = this.calculateHealthMetrics(periodsSummary);

    return {
      dealInfo,
      periodsSummary,
      recentEvents,
      healthMetrics,
    };
  }

  /**
   * Build periods summary by merging generated periods with on-chain data
   */
  private buildPeriodsSummary(
    generatedPeriods: SubPeriod[],
    onChainPeriods: unknown[],
    userRole: string
  ): PeriodSummary[] {
    // Create a map of on-chain period data by ID
    const onChainMap = new Map<string, Record<string, unknown>>();
    if (Array.isArray(onChainPeriods)) {
      for (const p of onChainPeriods) {
        const period = p as Record<string, unknown>;
        const id = period.id as string;
        if (id) {
          onChainMap.set(id, period);
        }
      }
    }

    return generatedPeriods.map((subPeriod) => {
      // Try to find matching on-chain period data
      const onChainData = onChainMap.get(subPeriod.periodId);

      // Extract blob count from on-chain data
      let blobCount = 0;
      let lastUploadAt: string | undefined;

      if (onChainData) {
        const walrusBlobs = (onChainData.walrus_blobs as unknown[]) || [];
        blobCount = Array.isArray(walrusBlobs) ? walrusBlobs.length : 0;

        // Find last upload timestamp
        if (blobCount > 0) {
          const lastBlob = walrusBlobs[walrusBlobs.length - 1] as Record<string, unknown>;
          const uploadedAt = lastBlob?.uploaded_at as number;
          if (uploadedAt) {
            lastUploadAt = new Date(uploadedAt).toISOString();
          }
        }
      }

      // Determine KPI status from on-chain data
      let kpiStatus: 'not_proposed' | 'proposed' | 'approved' | 'rejected' = 'not_proposed';
      let kpiValue: number | undefined;
      let settlementStatus: 'not_settled' | 'pending' | 'settled' = 'not_settled';
      let settlementAmount: number | undefined;

      if (onChainData) {
        // Check KPI result (from Nautilus TEE)
        const kpiResult = onChainData.kpi_result as Record<string, unknown> | undefined;
        if (kpiResult) {
          kpiStatus = 'approved'; // KPI result submitted means it's attested by TEE
          kpiValue = kpiResult.value as number;
        }

        // Check settlement status
        const isSettled = onChainData.is_settled as boolean;
        if (isSettled) {
          settlementStatus = 'settled';
          settlementAmount = onChainData.settled_amount as number;
        } else if (kpiStatus === 'approved') {
          settlementStatus = 'pending';
        }
      }

      // Determine next action
      const nextAction = this.determineNextAction(
        kpiStatus,
        settlementStatus,
        blobCount,
        userRole
      );

      return {
        periodId: subPeriod.periodId,
        name: subPeriod.name,
        periodIndex: subPeriod.periodIndex,
        dateRange: {
          start: subPeriod.startDate,
          end: subPeriod.endDate,
        },
        dataUploadProgress: {
          blobCount,
          lastUploadAt,
          completeness: blobCount > 0 ? Math.min(blobCount * 25, 100) : 0,
        },
        kpiStatus,
        kpiValue,
        settlementStatus,
        settlementAmount,
        nextAction,
      };
    });
  }

  /**
   * Determine the next action for a period based on status
   */
  private determineNextAction(
    kpiStatus: string,
    settlementStatus: string,
    blobCount: number,
    _userRole: string
  ): { action: string; actor: string } | undefined {
    if (settlementStatus === 'settled') {
      return undefined; // No action needed
    }

    if (blobCount === 0) {
      return {
        action: 'Upload Financial Documents',
        actor: 'buyer',
      };
    }

    if (kpiStatus === 'not_proposed') {
      return {
        action: 'Submit KPI Result',
        actor: 'buyer',
      };
    }

    if (kpiStatus === 'approved' && settlementStatus === 'pending') {
      return {
        action: 'Execute Settlement',
        actor: 'buyer',
      };
    }

    return undefined;
  }

  /**
   * Get recent events for a deal from blockchain
   */
  private async getRecentEvents(_dealId: string): Promise<DealEvent[]> {
    // TODO: Query blockchain events for this deal
    // For now, return empty array
    return [];
  }

  /**
   * Calculate health metrics from periods data
   */
  private calculateHealthMetrics(periods: PeriodSummary[]): HealthMetrics {
    if (periods.length === 0) {
      return {
        overallProgress: 0,
        pendingActions: 0,
        dataCompletenessScore: 0,
        risksDetected: [
          {
            severity: 'medium',
            category: 'Configuration',
            description: 'Deal has not started yet - no periods available',
          },
        ],
      };
    }

    // Calculate progress
    const settledCount = periods.filter((p) => p.settlementStatus === 'settled').length;
    const overallProgress = (settledCount / periods.length) * 100;

    // Count pending actions
    const pendingActions = periods.filter((p) => p.nextAction).length;

    // Calculate data completeness
    const totalCompleteness = periods.reduce((sum, p) => sum + p.dataUploadProgress.completeness, 0);
    const dataCompletenessScore = totalCompleteness / periods.length;

    // Detect risks
    const risksDetected: HealthMetrics['risksDetected'] = [];

    for (const period of periods) {
      if (period.dataUploadProgress.blobCount === 0) {
        risksDetected.push({
          severity: 'medium',
          category: 'Missing Data',
          description: `${period.name} has no data uploads yet`,
          periodId: period.periodId,
        });
      }
    }

    return {
      overallProgress,
      pendingActions,
      dataCompletenessScore,
      risksDetected,
    };
  }
}

export const dashboardService = new DashboardService();
