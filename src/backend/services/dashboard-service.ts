/**
 * Dashboard Service
 *
 * Provides business logic for aggregating dashboard data from blockchain.
 */

import { suiService } from './sui-service';

export interface DashboardDealInfo {
  dealId: string;
  name: string;
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

    // Determine deal status
    let status: 'draft' | 'active' | 'completed' | 'cancelled' = 'draft';
    if (deal.parametersLocked) {
      status = 'active';
    }

    // Build deal info
    const dealInfo: DashboardDealInfo = {
      dealId: deal.id,
      name: deal.name,
      status,
      roles: {
        buyer: deal.buyer,
        seller: deal.seller,
        auditor: deal.auditor,
      },
      userRole,
    };

    // Parse periods from blockchain data
    const periodsSummary = this.parsePeriods(deal.periods, userRole);

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
   * Parse periods from blockchain data into summary format
   */
  private parsePeriods(periods: unknown[], userRole: string): PeriodSummary[] {
    if (!Array.isArray(periods) || periods.length === 0) {
      return [];
    }

    return periods.map((period: unknown, index: number) => {
      const p = period as Record<string, unknown>;

      // Extract period data with safe defaults
      const periodId = (p.id as string) || `period_${index}`;
      const name = (p.name as string) || `Period ${index + 1}`;
      const startDate = (p.start_date as string) || '';
      const endDate = (p.end_date as string) || '';

      // Extract blob count
      const walrusBlobs = (p.walrus_blobs as unknown[]) || [];
      const blobCount = Array.isArray(walrusBlobs) ? walrusBlobs.length : 0;

      // Determine KPI status
      let kpiStatus: 'not_proposed' | 'proposed' | 'approved' | 'rejected' = 'not_proposed';
      const kpiProposal = p.kpi_proposal as Record<string, unknown> | undefined;
      const kpiAttestation = p.kpi_attestation as Record<string, unknown> | undefined;

      if (kpiAttestation?.approved) {
        kpiStatus = 'approved';
      } else if (kpiAttestation && !kpiAttestation.approved) {
        kpiStatus = 'rejected';
      } else if (kpiProposal) {
        kpiStatus = 'proposed';
      }

      // Determine settlement status
      let settlementStatus: 'not_settled' | 'pending' | 'settled' = 'not_settled';
      const settlement = p.settlement as Record<string, unknown> | undefined;
      if (settlement?.settled) {
        settlementStatus = 'settled';
      } else if (kpiStatus === 'approved') {
        settlementStatus = 'pending';
      }

      // Determine next action based on status and role
      const nextAction = this.determineNextAction(
        kpiStatus,
        settlementStatus,
        blobCount,
        userRole
      );

      return {
        periodId,
        name,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        dataUploadProgress: {
          blobCount,
          completeness: blobCount > 0 ? Math.min(blobCount * 25, 100) : 0,
        },
        kpiStatus,
        kpiValue: kpiProposal?.value as number | undefined,
        settlementStatus,
        settlementAmount: settlement?.payout_amount as number | undefined,
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
    userRole: string
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
        action: 'Propose KPI Value',
        actor: 'buyer',
      };
    }

    if (kpiStatus === 'proposed') {
      return {
        action: 'Attest KPI Value',
        actor: 'auditor',
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
  private async getRecentEvents(dealId: string): Promise<DealEvent[]> {
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
        pendingActions: 1,
        dataCompletenessScore: 0,
        risksDetected: [
          {
            severity: 'high',
            category: 'Configuration',
            description: 'No periods configured yet',
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
