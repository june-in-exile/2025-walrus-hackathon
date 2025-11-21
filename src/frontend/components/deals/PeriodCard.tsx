import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  CheckCircle2,
  FileCheck,
  Target,
  FileText,
  FileWarning,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import type { PeriodSummary } from '@/src/frontend/lib/api-client';
import type { PeriodWithKPI, WalrusBlobWithAudit } from '@/src/frontend/lib/mock-data';
import { mockDeals } from '@/src/frontend/lib/mock-data';

interface PeriodCardProps {
  period: PeriodSummary;
  dealId: string;
  userRole: 'buyer' | 'seller' | 'auditor';
}

export function PeriodCard({ period, dealId, userRole }: PeriodCardProps) {
  // Get period data from mock deals
  const deal = mockDeals.find(d => d.dealId === dealId);
  const periodWithKPI = deal?.periods?.find(p => p.periodId === period.periodId) as PeriodWithKPI | undefined;

  const isKpiAchieved = periodWithKPI?.kpiAchieved || false;

  // Calculate audit status statistics
  const walrusBlobs = periodWithKPI?.walrusBlobs as WalrusBlobWithAudit[] | undefined;
  const auditStats = walrusBlobs?.reduce(
    (acc, blob) => {
      const status = blob.reviewStatus || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { approved: 0, pending: 0, changes_requested: 0 } as Record<string, number>
  ) || { approved: 0, pending: 0, changes_requested: 0 };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const getActionButton = () => {
    const hasDocuments = period.dataUploadProgress && period.dataUploadProgress.blobCount > 0;
    const isSettled = period.settlementStatus === 'settled';

    if (userRole === 'buyer') {
      return (
        <Button asChild size="sm" variant={isSettled ? 'outline' : 'default'} className="w-full">
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            {isSettled ? 'View Period Details' : 'Manage Documents'}
          </Link>
        </Button>
      );
    }

    if (userRole === 'seller') {
      return (
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            View Period Details
          </Link>
        </Button>
      );
    }

    if (userRole === 'auditor') {
      return (
        <Button asChild size="sm" variant={hasDocuments ? 'default' : 'outline'} className="w-full">
          <Link href={`/deals/${dealId}/periods/${period.periodId}/review`}>
            <FileCheck className="mr-2 h-4 w-4" />
            {hasDocuments ? 'Review Documents' : 'View Period Details'}
          </Link>
        </Button>
      );
    }

    return null;
  };

  return (
    <Card className={isKpiAchieved ? 'border-green-500 border-2' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{period.name}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">
                <Calendar className="mr-1 h-3 w-3" />
                {formatDate(period.dateRange.start)} - {formatDate(period.dateRange.end)}
              </Badge>
              {period.settlementStatus === 'settled' && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Settled
                </Badge>
              )}
              {isKpiAchieved && (
                <Badge variant="default" className="bg-green-600">
                  <Target className="mr-1 h-3 w-3" />
                  KPI Achieved
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Documents Upload Status */}
          {period.dataUploadProgress && period.dataUploadProgress.blobCount > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Documents Uploaded</span>
                </div>
                <span className="text-lg font-bold text-primary">
                  {period.dataUploadProgress.blobCount}
                </span>
              </div>
            </div>
          )}

          {/* Audit Status Statistics */}
          {walrusBlobs && walrusBlobs.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium mb-2">Audit Status</div>
              <div className="grid grid-cols-3 gap-2">
                {/* Approved */}
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">
                      Approved
                    </span>
                  </div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {auditStats.approved}
                  </div>
                </div>

                {/* Pending */}
                <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                      Pending
                    </span>
                  </div>
                  <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    {auditStats.pending}
                  </div>
                </div>

                {/* Changes Requested */}
                <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FileWarning className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                      Changes
                    </span>
                  </div>
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {auditStats.changes_requested}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settlement Information (for achieved KPI) */}
          {isKpiAchieved && periodWithKPI?.settlement && (
            <div className="border-2 border-green-500 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                <span>Settlement Completed</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payout Amount</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(periodWithKPI.settlement.payoutAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Settlement Date</span>
                <span>{formatDate(periodWithKPI.settlement.settledAt)}</span>
              </div>
              {periodWithKPI.settlement.txHash && (
                <div className="text-xs text-muted-foreground font-mono pt-2 border-t">
                  TX: {periodWithKPI.settlement.txHash.slice(0, 20)}...
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            {getActionButton()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
