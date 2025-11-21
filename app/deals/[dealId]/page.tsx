'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { useDashboard, usePendingActions } from '@/src/frontend/hooks/useDashboard';
import { DealInfoSection } from '@/src/frontend/components/deals/DealInfoSection';
import { PeriodCard } from '@/src/frontend/components/deals/PeriodCard';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DealDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const { currentRole } = useRole();
  const dealId = params.dealId as string;

  const { data: dashboard, isLoading, error } = useDashboard(dealId);
  const pendingActions = usePendingActions(dealId);

  // If wallet not connected, show connect wallet prompt
  if (!currentAccount) {
    return (
      <div className="w-full">
        <section className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/deals')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Deals
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Deal Dashboard</h1>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 max-w-7xl">
          <div className="flex items-center justify-center">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6 pb-6">
                <div className="text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="p-4 rounded-full bg-primary/10">
                      <Wallet className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">Connect Your Wallet</h2>
                    <p className="text-muted-foreground">
                      To view deal details, please connect your Sui wallet first.
                    </p>
                  </div>
                  <div className="pt-2">
                    <WalletButton />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[80vh] px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-7xl">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Failed to load dashboard</h2>
          <p className="text-muted-foreground mb-6">
            Unable to retrieve deal information. Please try again later.
          </p>
          <Button asChild>
            <Link href="/deals">Back to Deals</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { dealInfo, periodsSummary } = dashboard;

  return (
    <div className="w-full">
      {/* Header Section */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/deals')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deals
          </Button>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight mb-2">{dealInfo.name}</h1>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize">
                  {dealInfo.userRole}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Deal ID: {dealInfo.dealId.slice(0, 8)}...{dealInfo.dealId.slice(-6)}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Actions Alert */}
          {pendingActions.length > 0 && (
            <div className="mt-6">
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">Pending Actions</h3>
                      <ul className="space-y-1 text-sm">
                        {pendingActions.map((action, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{action.periodName}:</span>{' '}
                            {action.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Deal Info */}
          <div className="lg:col-span-1">
            <DealInfoSection dealInfo={dealInfo} />
          </div>

          {/* Right Column: Periods */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">Earn-out Periods</h2>
              <p className="text-muted-foreground text-sm">
                Track performance metrics and settlements for each period
              </p>
            </div>

            {periodsSummary.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-6">
                  <div className="text-center py-8">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 rounded-full bg-muted">
                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Periods Configured</h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                      {dealInfo.status === 'draft' ? (
                        dealInfo.userRole === 'buyer' ? (
                          'This deal needs earn-out parameters to be configured. Set up the periods, KPI thresholds, and payout formulas to activate this deal.'
                        ) : (
                          'This deal is pending configuration by the buyer. You will be notified once earn-out parameters are set.'
                        )
                      ) : (
                        'No earn-out periods have been configured for this deal yet.'
                      )}
                    </p>
                    {dealInfo.userRole === 'buyer' && dealInfo.status === 'draft' && (
                      <Button asChild>
                        <Link href={`/deals/${dealId}/setup`}>
                          Configure Earn-out Parameters
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {periodsSummary.map((period) => (
                  <PeriodCard
                    key={period.periodId}
                    period={period}
                    dealId={dealId}
                    userRole={dealInfo.userRole as 'buyer' | 'seller' | 'auditor'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
