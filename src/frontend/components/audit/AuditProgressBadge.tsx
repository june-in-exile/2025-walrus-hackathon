'use client';

import { Shield, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuditRecords } from '@/src/frontend/hooks/useAuditRecords';

interface AuditProgressBadgeProps {
  dealId: string;
  periodId: string;
}

export function AuditProgressBadge({ dealId, periodId }: AuditProgressBadgeProps) {
  const { totalRecords, auditedRecords, auditProgress, isLoading } = useAuditRecords({
    dealId,
    periodId,
    enabled: true,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </Badge>
    );
  }

  if (totalRecords === 0) {
    return (
      <Badge variant="outline" className="gap-1">
        <Shield className="h-3 w-3" />
        No documents
      </Badge>
    );
  }

  const isFullyAudited = auditedRecords === totalRecords;

  return (
    <Badge
      variant={isFullyAudited ? 'default' : 'outline'}
      className={`gap-1 ${
        isFullyAudited
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
          : ''
      }`}
    >
      {isFullyAudited ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Shield className="h-3 w-3" />
      )}
      Audit: {auditedRecords}/{totalRecords} ({auditProgress.toFixed(0)}%)
    </Badge>
  );
}
