'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Wallet,
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

// Mock period review data (will be replaced with real API call)
const mockPeriodReview = {
  periodId: 'period_2027',
  periodName: '2027 Fiscal Year',
  dateRange: {
    start: '2027-01-01',
    end: '2027-12-31',
  },
  dealId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  dealName: 'Acquisition of TechCorp Inc.',
  uploadedBlobs: [
    {
      blobId: 'blob_2027_revenue_q1',
      filename: 'Q1_2027_Revenue.xlsx',
      dataType: 'revenue_journal',
      size: 2048576,
      uploadedAt: '2027-04-15T10:30:00Z',
      uploaderAddress: '0xabcd1234...567890ab',
    },
    {
      blobId: 'blob_2027_revenue_q2',
      filename: 'Q2_2027_Revenue.xlsx',
      dataType: 'revenue_journal',
      size: 1856432,
      uploadedAt: '2027-07-20T14:00:00Z',
      uploaderAddress: '0xabcd1234...567890ab',
    },
    {
      blobId: 'blob_2027_revenue_q3',
      filename: 'Q3_2027_Revenue.xlsx',
      dataType: 'revenue_journal',
      size: 2156789,
      uploadedAt: '2027-10-18T09:15:00Z',
      uploaderAddress: '0xabcd1234...567890ab',
    },
    {
      blobId: 'blob_2027_revenue_q4',
      filename: 'Q4_2027_Revenue.xlsx',
      dataType: 'revenue_journal',
      size: 2234567,
      uploadedAt: '2027-12-28T16:00:00Z',
      uploaderAddress: '0xabcd1234...567890ab',
    },
  ],
  proposedKPI: {
    kpiType: 'revenue',
    value: 12500000,
    unit: 'USD',
    proposedBy: '0xabcd1234...567890ab',
    proposedAt: '2028-01-15T10:00:00Z',
    calculatedPayout: 3750000,
    notes: 'Based on audited Q1-Q4 financial statements. All revenue journals verified.',
  },
};

export default function KPIReviewPage() {
  const params = useParams();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const { currentRole } = useRole();
  const dealId = params.dealId as string;
  const periodId = params.periodId as string;

  const [attestedValue, setAttestedValue] = useState(mockPeriodReview.proposedKPI.value.toString());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If wallet not connected, show connect wallet prompt
  if (!currentAccount) {
    return (
      <div className="w-full">
        <section className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/deals/${dealId}`)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">KPI Review</h1>
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
                      To review KPIs, please connect your Sui wallet first.
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
              onClick={() => router.push(`/deals/${dealId}`)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">KPI Review</h1>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 max-w-7xl">
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="text-center py-8">
                <AlertCircle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Auditor Access Required</h2>
                <p className="text-muted-foreground mb-4">
                  KPI review is only available for Auditor role.
                </p>
                <p className="text-sm text-muted-foreground">
                  Current role: <Badge variant="outline" className="capitalize">{currentRole}</Badge>
                </p>
              </div>
            </CardContent>
          </Card>
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success('KPI attested successfully', {
        description: `${mockPeriodReview.proposedKPI.kpiType.toUpperCase()} value of $${Number(attestedValue).toLocaleString()} has been approved.`,
      });
      router.push(`/deals/${dealId}`);
    } catch (error) {
      toast.error('Failed to attest KPI', {
        description: 'Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      toast.error('Please provide rejection notes');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success('KPI rejected', {
        description: 'The buyer will be notified to revise the proposal.',
      });
      router.push(`/deals/${dealId}`);
    } catch (error) {
      toast.error('Failed to reject KPI', {
        description: 'Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header Section */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/deals/${dealId}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                KPI Review - {mockPeriodReview.periodName}
              </h1>
              <p className="text-muted-foreground">{mockPeriodReview.dealName}</p>
            </div>
            <Badge variant="outline" className="capitalize">
              Auditor
            </Badge>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Period Info & Documents */}
          <div className="lg:col-span-2 space-y-6">
            {/* Period Information */}
            <Card>
              <CardHeader>
                <CardTitle>Period Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {formatDate(mockPeriodReview.dateRange.start)} -{' '}
                      {formatDate(mockPeriodReview.dateRange.end)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground">Period ID</p>
                    <code className="text-xs font-mono">{periodId}</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Uploaded Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Financial Documents</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review all documents before attesting KPI
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockPeriodReview.uploadedBlobs.map((blob) => (
                    <div
                      key={blob.blobId}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{blob.filename}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatFileSize(blob.size)}</span>
                            <span>{formatDate(blob.uploadedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Total: {mockPeriodReview.uploadedBlobs.length} documents
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: KPI Proposal & Attestation */}
          <div className="space-y-6">
            {/* Proposed KPI */}
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle>Proposed KPI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-primary/5 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {mockPeriodReview.proposedKPI.kpiType.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-3xl font-bold">
                    ${mockPeriodReview.proposedKPI.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mockPeriodReview.proposedKPI.unit}
                  </p>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-1">Calculated Payout</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${mockPeriodReview.proposedKPI.calculatedPayout.toLocaleString()}
                  </p>
                </div>

                {mockPeriodReview.proposedKPI.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-1">Buyer Notes</p>
                    <p className="text-sm text-muted-foreground">
                      {mockPeriodReview.proposedKPI.notes}
                    </p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-2">
                  <p>Proposed by: {mockPeriodReview.proposedKPI.proposedBy}</p>
                  <p>Date: {formatDate(mockPeriodReview.proposedKPI.proposedAt)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Attestation Form */}
            <Card>
              <CardHeader>
                <CardTitle>Attest KPI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="attestedValue">Attested Value (USD)</Label>
                  <Input
                    id="attestedValue"
                    type="number"
                    value={attestedValue}
                    onChange={(e) => setAttestedValue(e.target.value)}
                    placeholder="Enter attested value"
                  />
                  <p className="text-xs text-muted-foreground">
                    Adjust if the proposed value is incorrect
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Attestation Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter your verification notes..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve and Attest
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting}
                    variant="destructive"
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject Proposal
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
