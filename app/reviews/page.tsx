'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { RoleAccessMessage } from '@/src/frontend/components/common/RoleAccessMessage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Calendar,
  TrendingUp,
  FileCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Mock review history data (will be replaced with real API call)
const mockReviews = [
  {
    reviewId: 'review_2026',
    dealId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    dealName: 'Acquisition of TechCorp Inc.',
    periodId: 'period_2026',
    periodName: '2026 Fiscal Year',
    kpiType: 'revenue',
    proposedValue: 11300000,
    attestedValue: 11300000,
    approved: true,
    attestedAt: '2027-02-01T14:30:00Z',
    calculatedPayout: 2600000,
    notes: 'Verified all revenue journals. Calculations accurate.',
    txHash: '9wqLfZUqP9K3xYz1RnN2BcE4MpX7Ri5L',
  },
  {
    reviewId: 'review_2025',
    dealId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    dealName: 'Acquisition of DataFlow Systems',
    periodId: 'period_2025',
    periodName: '2025 Performance Period',
    kpiType: 'ebitda',
    proposedValue: 2100000,
    attestedValue: 2050000,
    approved: true,
    attestedAt: '2026-03-15T11:20:00Z',
    calculatedPayout: 1800000,
    notes: 'Minor adjustment to EBITDA calculation. Depreciation overstated by $50K.',
    txHash: '7pqJfYSqN8H2xWy0QmM1AcC3KoV6Pg4J',
  },
];

export default function ReviewsPage() {
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
            <h1 className="text-3xl font-bold tracking-tight">Review History</h1>
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
                      To view review history, please connect your Sui wallet first.
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

  // Show role-appropriate message for non-auditors
  if (currentRole !== 'auditor') {
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
            <h1 className="text-3xl font-bold tracking-tight">Review History</h1>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 max-w-7xl">
          <RoleAccessMessage
            allowedRole="auditor"
            currentRole={currentRole}
            featureName="Review history"
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

  const totalReviews = mockReviews.length;
  const approvedReviews = mockReviews.filter((r) => r.approved).length;
  const rejectedReviews = totalReviews - approvedReviews;

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
              <h1 className="text-3xl font-bold tracking-tight mb-2">Review History</h1>
              <p className="text-muted-foreground">
                View all KPI attestations you have completed
              </p>
            </div>
            <Badge variant="outline" className="capitalize">
              Auditor
            </Badge>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReviews}</div>
              <p className="text-xs text-muted-foreground">
                KPI attestations completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedReviews}</div>
              <p className="text-xs text-muted-foreground">
                {totalReviews > 0 ? Math.round((approvedReviews / totalReviews) * 100) : 0}% approval rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{rejectedReviews}</div>
              <p className="text-xs text-muted-foreground">
                Required revisions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reviews List */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">All Attestations</h2>

          {mockReviews.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No reviews completed yet
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {mockReviews.map((review) => (
                <Card key={review.reviewId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">{review.dealName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{review.periodName}</p>
                      </div>
                      {review.approved ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      {/* KPI Information */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <TrendingUp className="h-4 w-4" />
                              <span>KPI Type</span>
                            </div>
                            <p className="text-lg font-semibold uppercase">
                              {review.kpiType}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Proposed Value</p>
                            <p className="text-lg font-semibold">
                              ${review.proposedValue.toLocaleString()}
                            </p>
                          </div>

                          {review.proposedValue !== review.attestedValue && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Attested Value</p>
                              <p className="text-lg font-semibold text-primary">
                                ${review.attestedValue.toLocaleString()}
                              </p>
                              <p className="text-xs text-amber-600">
                                Adjusted by ${Math.abs(review.attestedValue - review.proposedValue).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Calendar className="h-4 w-4" />
                              <span>Attestation Date</span>
                            </div>
                            <p className="text-lg font-semibold">
                              {formatDate(review.attestedAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              at {formatTime(review.attestedAt)}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Calculated Payout</p>
                            <p className="text-lg font-semibold text-green-600">
                              ${review.calculatedPayout.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {review.notes && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Attestation Notes</p>
                          <p className="text-sm text-muted-foreground">
                            {review.notes}
                          </p>
                        </div>
                      )}

                      {/* Transaction Hash */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium mb-1">Transaction Hash</p>
                            <code className="text-xs text-muted-foreground font-mono">
                              {review.txHash}
                            </code>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`https://suiscan.xyz/testnet/tx/${review.txHash}`}
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
                        <Link href={`/deals/${review.dealId}`}>
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
