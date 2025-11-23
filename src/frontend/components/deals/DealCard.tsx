import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react';
import type { DealSummary } from '@/src/frontend/lib/api-client';

interface DealCardProps {
  deal: DealSummary;
}

export function DealCard({ deal }: DealCardProps) {
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
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{deal.name}</CardTitle>
            <Badge variant={getStatusColor(deal.status)}>
              {getStatusLabel(deal.status)}
            </Badge>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(deal.closingDate)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {deal.periodCount || 0}
              </div>
              <div className="text-xs text-muted-foreground">Periods</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {deal.settledPeriods || 0}
              </div>
              <div className="text-xs text-muted-foreground">Settled</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {deal.currency}
              </div>
              <div className="text-xs text-muted-foreground">Currency</div>
            </div>
          </div>

          {/* Role Badge */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Your Role:</span>
            <Badge variant="outline" className="capitalize">
              {deal.userRole}
            </Badge>
          </div>

          {/* Progress Indicator */}
          {(deal.periodCount || 0) > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {deal.settledPeriods} / {deal.periodCount} periods
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${((deal.settledPeriods || 0) / (deal.periodCount || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <Button asChild className="w-full" variant="outline">
              <Link href={`/deals/${deal.dealId}`}>
                View Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
