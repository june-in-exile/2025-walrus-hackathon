import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Users, FileText, TrendingUp, Target, Percent, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { DashboardResponseDealInfo } from '@/src/frontend/lib/api-client';
import type { DealWithExtendedFields, PeriodWithKPI } from '@/src/frontend/lib/mock-data';
import { mockDeals } from '@/src/frontend/lib/mock-data';
import { calculateTotalMonthlyDepreciation } from '@/src/shared/types/asset';
import { useState } from 'react';

interface DealInfoSectionProps {
  dealInfo: DashboardResponseDealInfo & {
    buyerName?: string;
    sellerName?: string;
    earnoutPeriodYears?: number;
    kpiTargetAmount?: number;
    contingentConsiderationAmount?: number;
    headquarterExpenseAllocationPercentage?: number;
  };
}

export function DealInfoSection({ dealInfo }: DealInfoSectionProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatAddress = (address: string | undefined) => {
    if (!address) return 'Not set';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: dealInfo.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const [showExpenseDetails, setShowExpenseDetails] = useState(false);

  // Get KPI summary data from mock deals - calculate cumulative across ALL periods
  const deal = mockDeals.find(d => d.dealId === dealInfo.dealId);
  const periods = (deal?.periods as PeriodWithKPI[] | undefined) || [];

  // Calculate cumulative financial data across all periods
  const cumulativeData = periods.reduce(
    (acc, period) => {
      return {
        revenue: acc.revenue + (period.monthlyRevenue || 0),
        depreciation: acc.depreciation + (period.monthlyExpenses?.depreciation || 0),
        payroll: acc.payroll + (period.monthlyExpenses?.payroll || 0),
        overhead: acc.overhead + (period.monthlyExpenses?.overheadAllocation || 0),
        netProfit: acc.netProfit + (period.monthlyNetProfit || 0),
      };
    },
    { revenue: 0, depreciation: 0, payroll: 0, overhead: 0, netProfit: 0 }
  );

  const totalExpenses = cumulativeData.depreciation + cumulativeData.payroll + cumulativeData.overhead;

  // Get monthly depreciation from assets metadata
  const assets = (deal?.metadata as any)?.assets || [];
  const monthlyDepreciation = calculateTotalMonthlyDepreciation(assets);

  // KPI tracking
  const kpiTarget = deal?.kpiTargetAmount || 900000;
  const kpiAchieved = periods.some(p => p.kpiAchieved);
  const kpiProgress = cumulativeData.netProfit / kpiTarget;

  // Find the period where KPI was achieved (if any)
  const achievedPeriod = periods.find(p => p.kpiAchieved);
  const settlement = achievedPeriod?.settlement;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deal Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={getStatusColor(dealInfo.status)} className="text-sm">
            {getStatusLabel(dealInfo.status)}
          </Badge>
        </CardContent>
      </Card>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Agreement Date</div>
              <div className="text-sm text-muted-foreground">
                {formatDate(dealInfo.agreementDate)}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Currency</div>
              <div className="text-sm text-muted-foreground">{dealInfo.currency}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Participants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">
              Buyer (Acquirer)
              {dealInfo.buyerName && (
                <span className="ml-2 text-muted-foreground font-normal">
                  {dealInfo.buyerName}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {formatAddress(dealInfo.roles.buyer)}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">
              Seller
              {dealInfo.sellerName && (
                <span className="ml-2 text-muted-foreground font-normal">
                  {dealInfo.sellerName}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {formatAddress(dealInfo.roles.seller)}
            </div>
          </div>

          {dealInfo.roles.auditor && (
            <div>
              <div className="text-sm font-medium mb-1">Auditor</div>
              <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {formatAddress(dealInfo.roles.auditor)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Parameters Card */}
      {(dealInfo.earnoutPeriodYears || dealInfo.kpiTargetAmount || dealInfo.contingentConsiderationAmount) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dealInfo.earnoutPeriodYears && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Earn-out Period</div>
                  <div className="text-sm text-muted-foreground">
                    {dealInfo.earnoutPeriodYears} {dealInfo.earnoutPeriodYears === 1 ? 'year' : 'years'}
                  </div>
                </div>
              </div>
            )}

            {dealInfo.kpiTargetAmount && (
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">KPI Target Amount</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(dealInfo.kpiTargetAmount)} Net Profit
                  </div>
                </div>
              </div>
            )}

            {dealInfo.contingentConsiderationAmount && (
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Contingent Consideration</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(dealInfo.contingentConsiderationAmount)}
                  </div>
                </div>
              </div>
            )}

            {dealInfo.headquarterExpenseAllocationPercentage !== undefined && (
              <div className="flex items-start gap-3">
                <Percent className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Overhead Allocation</div>
                  <div className="text-sm text-muted-foreground">
                    {formatPercentage(dealInfo.headquarterExpenseAllocationPercentage)} of corporate pool
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cumulative Financial Summary Card */}
      <Card className={kpiAchieved ? 'border-green-500 border-2' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cumulative Financial Summary</CardTitle>
            {kpiAchieved && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                KPI Achieved
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Cumulative Revenue */}
          <div className="bg-blue-50 dark:bg-blue-950/20 px-4 py-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">Total Cumulative Revenue</span>
              </div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(cumulativeData.revenue)}
              </span>
            </div>
          </div>

          {/* Total Cumulative Expenses (Collapsible) */}
          <div className="border rounded-lg">
            <button
              onClick={() => setShowExpenseDetails(!showExpenseDetails)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium">Total Cumulative Expenses</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(totalExpenses)}
                </span>
                {showExpenseDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>
            {showExpenseDetails && (
              <div className="px-4 pb-3 space-y-2 text-sm border-t">
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Depreciation</span>
                  <span className="font-medium">
                    {formatCurrency(cumulativeData.depreciation)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Payroll</span>
                  <span className="font-medium">
                    {formatCurrency(cumulativeData.payroll)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">HQ Allocation</span>
                  <span className="font-medium">
                    {formatCurrency(cumulativeData.overhead)}
                  </span>
                </div>
                {monthlyDepreciation > 0 && (
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    Monthly Depreciation (from assets): {formatCurrency(monthlyDepreciation)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Total Cumulative Net Profit */}
          <div className="bg-purple-50 dark:bg-purple-950/20 px-4 py-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium">Total Cumulative Net Profit</span>
              </div>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(cumulativeData.netProfit)}
              </span>
            </div>
          </div>

          {/* KPI Target */}
          <div className="flex items-center justify-between px-2">
            <span className="text-sm text-muted-foreground">KPI Target</span>
            <span className="text-lg font-semibold">
              {formatCurrency(kpiTarget)}
            </span>
          </div>

          {/* Achievement Rate Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">KPI Achievement Rate</div>
              <span className={`text-lg font-bold ${kpiAchieved ? 'text-green-600' : ''}`}>
                {(kpiProgress * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  kpiAchieved ? 'bg-green-600' : 'bg-primary'
                }`}
                style={{
                  width: `${Math.min(kpiProgress * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Settlement Info (if achieved) */}
          {kpiAchieved && settlement && (
            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                <span>Settlement Completed</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount Paid to Seller</span>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(settlement.payoutAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Settlement Date</span>
                <span>{formatDate(settlement.settledAt)}</span>
              </div>
              {settlement.txHash && (
                <div className="text-xs text-muted-foreground font-mono pt-2 border-t">
                  Transaction Hash: {settlement.txHash}
                </div>
              )}
            </div>
          )}

          {/* Status Message */}
          {!kpiAchieved && (
            <div className="text-sm text-muted-foreground italic">
              KPI target not yet achieved. Continue uploading period documents.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
