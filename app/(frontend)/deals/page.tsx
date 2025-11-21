'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { useDeals, useDealStats } from '@/src/frontend/hooks/useDeals';
import { DealCard } from '@/src/frontend/components/features/deals/DealCard';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Briefcase, TrendingUp, CheckCircle2, FileText, Wallet, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DealsPage() {
  const currentAccount = useCurrentAccount();
  const { currentRole } = useRole();
  const { data: dealsData, isLoading, error } = useDeals('buyer');
  const stats = useDealStats('buyer');

  // If wallet not connected, show connect wallet prompt
  if (!currentAccount) {
    return (
      <div className="w-full">
        {/* Header Section */}
        <section className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-12 max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">My Deals</h1>
                <p className="text-muted-foreground mt-2">
                  Manage your earn-out agreements and track settlements
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Connect Wallet Prompt */}
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
                      To view and manage your earn-out deals, please connect your Sui wallet first.
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

  return (
    <div className="w-full">
      {/* Header Section */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">My Deals</h1>
              <p className="text-muted-foreground mt-2">
                Manage your earn-out agreements and track settlements
              </p>
            </div>
            {currentRole === 'buyer' && (
              <Button asChild size="lg">
                <Link href="/deals/create">
                  <Plus className="mr-2 h-5 w-5" />
                  Create New Deal
                </Link>
              </Button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 mt-8">
            <StatsCard
              icon={<Briefcase className="h-5 w-5" />}
              label="Total Deals"
              value={stats.totalDeals}
              color="blue"
            />
            <StatsCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Active"
              value={stats.activeDeals}
              color="green"
            />
            <StatsCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Completed"
              value={stats.completedDeals}
              color="purple"
            />
            <StatsCard
              icon={<FileText className="h-5 w-5" />}
              label="Drafts"
              value={stats.draftDeals}
              color="gray"
            />
          </div>
        </div>
      </section>

      {/* Deals List Section */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-destructive">Failed to load deals. Please try again.</p>
          </div>
        )}

        {!isLoading && !error && dealsData && (
          <>
            {dealsData.items.length === 0 ? (
              <div className="text-center py-20">
                <div className="mx-auto max-w-md">
                  <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-2xl font-semibold mb-2">No deals yet</h3>
                  <p className="text-muted-foreground mb-6">
                    {currentRole === 'buyer'
                      ? 'Get started by creating your first earn-out deal'
                      : 'No deals available to view'}
                  </p>
                  {currentRole === 'buyer' && (
                    <Button asChild size="lg">
                      <Link href="/deals/create">
                        <Plus className="mr-2 h-5 w-5" />
                        Create Your First Deal
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold">
                    All Deals ({dealsData.total})
                  </h2>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {dealsData.items.map((deal) => (
                    <DealCard key={deal.dealId} deal={deal} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'gray';
}

function StatsCard({ icon, label, value, color }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
