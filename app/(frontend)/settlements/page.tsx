'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { RoleAccessMessage } from '@/src/frontend/components/common/RoleAccessMessage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Wallet,
  ArrowLeft,
  DollarSign,
  Calendar,
  FileCheck,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Mock settlements data (will be replaced with real API call)
const mockSettlements = [
  {
    settlementId: 'settle_2026',
    dealId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    dealName: 'Acquisition of TechCorp Inc.',
    periodId: 'period_2026',
    periodName: '2026 Fiscal Year',
    amount: 2600000,
    currency: 'USD',
    settledAt: '2027-02-10T09:00:00Z',
    txHash: '8vqKfZTqP9J3xYz1RmN2BcD4LpW7Qh5K',
    kpiType: 'revenue',
    kpiValue: 11300000,
  },
];

export default function SettlementsPage() {
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const { currentRole } = useRole();

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
            <h1 className="text-3xl font-bold tracking-tight">Settlement History</h1>
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
                      To view settlement history, please connect your Sui wallet first.
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

  // Show role-appropriate message for non-sellers
  if (currentRole !== 'seller') {
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
            <h1 className="text-3xl font-bold tracking-tight">Settlement History</h1>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 max-w-7xl">
          <RoleAccessMessage
            allowedRole="seller"
            currentRole={currentRole}
            featureName="Settlement history"
          />
        </section>
      </div>
    );
  }

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTime = (date: string) => {
    try {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const totalSettled = mockSettlements.reduce((sum, s) => sum + s.amount, 0);

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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Settlement History</h1>
              <p className="text-muted-foreground">
                View all earn-out settlements received
              </p>
            </div>
            <Badge variant="outline" className="capitalize">
              {currentRole}
            </Badge>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Received</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalSettled.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                From {mockSettlements.length} settlement{mockSettlements.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Settlement</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockSettlements.length > 0
                  ? formatDate(mockSettlements[0].settledAt).split(',')[0]
                  : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {mockSettlements.length > 0
                  ? mockSettlements[0].periodName
                  : 'No settlements yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deals</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(mockSettlements.map(s => s.dealId)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                Active deals with settlements
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Settlements List */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">All Settlements</h2>

          {mockSettlements.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No settlements received yet
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {mockSettlements.map((settlement) => (
                <Card key={settlement.settlementId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">{settlement.dealName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{settlement.periodName}</p>
                      </div>
                      <Badge variant="secondary">Settled</Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      {/* Settlement Amount */}
                      <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 px-4 py-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <span className="font-medium">Settlement Amount</span>
                        </div>
                        <span className="text-2xl font-bold text-green-600">
                          ${settlement.amount.toLocaleString()}
                        </span>
                      </div>

                      {/* KPI Information */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            <span>KPI Performance</span>
                          </div>
                          <p className="text-lg font-semibold">
                            {settlement.kpiType.toUpperCase()}: ${settlement.kpiValue.toLocaleString()}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Settlement Date</span>
                          </div>
                          <p className="text-lg font-semibold">
                            {formatDate(settlement.settledAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            at {formatTime(settlement.settledAt)}
                          </p>
                        </div>
                      </div>

                      {/* Transaction Hash */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium mb-1">Transaction Hash</p>
                            <code className="text-xs text-muted-foreground font-mono">
                              {settlement.txHash}
                            </code>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`https://suiscan.xyz/testnet/tx/${settlement.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View on Explorer
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>

                      {/* View Deal Button */}
                      <Button variant="ghost" size="sm" asChild className="w-full">
                        <Link href={`/deals/${settlement.dealId}`}>
                          View Deal Dashboard
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
