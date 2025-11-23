import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  TrendingUp,
  CheckCircle2,
  Upload,
  FileCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { PeriodSummary } from '@/src/frontend/lib/api-client';

interface PeriodCardProps {
  period: PeriodSummary;
  dealId: string;
  userRole: 'buyer' | 'seller' | 'auditor';
}

export function PeriodCard({ period, dealId, userRole }: PeriodCardProps) {
  const getKpiStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'secondary';
      case 'pending':
        return 'default';
      case 'not_started':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getKpiStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      approved: 'KPI Approved',
      pending: 'KPI Pending',
      not_started: 'Not Started',
    };
    return labels[status] || status;
  };

  const getSettlementStatusColor = (status: string) => {
    switch (status) {
      case 'settled':
        return 'secondary';
      case 'pending_seller':
      case 'pending_auditor':
      case 'pending_buyer':
        return 'default';
      case 'not_started':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getSettlementStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      settled: 'Settled',
      pending_seller: 'Pending Seller Upload',
      pending_auditor: 'Pending Auditor Review',
      pending_buyer: 'Pending Buyer Approval',
      not_started: 'Not Started',
    };
    return labels[status] || status;
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
    // All roles can view period details (documents page)
    // Button variant and text changes based on role
    const hasDocuments = period.dataUploadProgress && period.dataUploadProgress.blobCount > 0;
    const isSettled = period.settlementStatus === 'settled';

    // Show the button for all roles
    if (userRole === 'buyer') {
      return (
        <Button asChild size="sm" variant={isSettled ? 'outline' : 'default'}>
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            {isSettled ? 'View Period Details' : 'Manage Documents'}
          </Link>
        </Button>
      );
    }

    if (userRole === 'seller') {
      return (
        <Button asChild size="sm" variant="outline">
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            View Period Details
          </Link>
        </Button>
      );
    }

    if (userRole === 'auditor') {
      return (
        <Button asChild size="sm" variant={hasDocuments ? 'default' : 'outline'}>
          <Link href={`/deals/${dealId}/periods/${period.periodId}/upload`}>
            <FileCheck className="mr-2 h-4 w-4" />
            {hasDocuments ? 'Review Documents' : 'View Period Details'}
          </Link>
        </Button>
      );
    }

    return null;
  };

  return (
    <Card className={period.nextAction?.actor === userRole ? 'border-primary' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{period.name}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getKpiStatusColor(period.kpiStatus)}>
                {getKpiStatusLabel(period.kpiStatus)}
              </Badge>
              <Badge variant={getSettlementStatusColor(period.settlementStatus)}>
                {getSettlementStatusLabel(period.settlementStatus)}
              </Badge>
            </div>
          </div>
          {period.settlementStatus === 'settled' && (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Date Range */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {formatDate(period.dateRange.start)} - {formatDate(period.dateRange.end)}
            </span>
          </div>

          {/* KPI Value */}
          {period.kpiValue !== undefined && (
            <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">KPI Value</span>
              </div>
              <span className="text-lg font-bold">
                ${period.kpiValue.toLocaleString()}
              </span>
            </div>
          )}

          {/* Data Upload Progress */}
          {period.dataUploadProgress && period.dataUploadProgress.blobCount > 0 && (
            <div className="text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground">Documents Uploaded</span>
                <span className="font-medium">{period.dataUploadProgress.blobCount} files</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${period.dataUploadProgress.completeness}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Settlement Amount */}
          {period.settlementAmount !== undefined && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium">Settlement Amount</span>
              <span className="text-lg font-bold text-green-600">
                ${period.settlementAmount.toLocaleString()}
              </span>
            </div>
          )}

          {/* Next Action */}
          {period.nextAction && (
            <div className="pt-2 border-t">
              <div className="flex items-start gap-2 mb-3">
                {period.nextAction.actor === userRole ? (
                  <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {period.nextAction.actor === userRole ? 'Action Required' : 'Next Action'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {period.nextAction.action}
                  </div>
                  {period.nextAction.deadline && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Deadline: {formatDate(period.nextAction.deadline)}
                    </div>
                  )}
                </div>
              </div>
              {getActionButton()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
