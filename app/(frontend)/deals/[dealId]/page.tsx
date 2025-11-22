'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useDashboard, usePendingActions } from '@/src/frontend/hooks/useDashboard';
import { DealInfoSection } from '@/src/frontend/components/features/deals/DealInfoSection';
import { PeriodCard } from '@/src/frontend/components/features/deals/PeriodCard';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, ArrowLeft, AlertCircle, FileText, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function DealDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const dealId = params.dealId as string;

  const { data: dashboard, isLoading, error } = useDashboard(dealId);
  const pendingActions = usePendingActions(dealId);
  const [copiedDealId, setCopiedDealId] = useState(false);

  const handleCopyDealId = async () => {
    try {
      await navigator.clipboard.writeText(dealId);
      setCopiedDealId(true);
      setTimeout(() => setCopiedDealId(false), 2000);
    } catch (error) {
      console.error('Failed to copy deal ID:', error);
    }
  };

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
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">
                    Deal ID: {dealInfo.dealId.slice(0, 8)}...{dealInfo.dealId.slice(-6)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyDealId}
                    className="h-5 w-5 p-0"
                    title="Copy full Deal ID"
                  >
                    {copiedDealId ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* View All Documents Button */}
            <div className="flex items-center">
              <Button
                variant="outline"
                onClick={() => router.push(`/deals/${dealId}/blobs`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                View All Documents
              </Button>
            </div>
          </div>
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
              <h2 className="text-2xl font-semibold mb-2">Sub Periods</h2>
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
                    <h3 className="text-lg font-semibold mb-2">No Periods Available Yet</h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                      The earn-out periods will appear automatically once the deal start date has passed.
                      Each period represents one calendar month from the start date.
                    </p>
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
