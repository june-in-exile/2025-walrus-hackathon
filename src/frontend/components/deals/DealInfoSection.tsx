import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Users, FileText } from 'lucide-react';
import type { DashboardResponseDealInfo } from '@/src/frontend/lib/api-client';

interface DealInfoSectionProps {
  dealInfo: DashboardResponseDealInfo;
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
              <div className="text-sm font-medium">Closing Date</div>
              <div className="text-sm text-muted-foreground">
                {formatDate(dealInfo.closingDate)}
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
            <div className="text-sm font-medium mb-1">Buyer (Acquirer)</div>
            <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {formatAddress(dealInfo.roles.buyer)}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Seller</div>
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
    </div>
  );
}
