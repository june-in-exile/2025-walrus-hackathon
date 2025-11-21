'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { useAuditRecords } from '@/src/frontend/hooks/useAuditRecords';
import { useAuditData } from '@/src/frontend/hooks/useAuditData';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Wallet,
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DealBlobItem } from '@/src/shared/types/walrus';

export default function DataAuditPage() {
  const params = useParams();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const { currentRole } = useRole();
  const dealId = params.dealId as string;
  const periodId = params.periodId as string;

  // Fetch audit records
  const {
    records,
    isLoading,
    error,
    refetch,
    totalRecords,
    auditedRecords,
    auditProgress,
  } = useAuditRecords({
    dealId,
    periodId,
    enabled: !!currentAccount?.address,
  });

  // Audit data hook
  const { auditData, isAuditing } = useAuditData();

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
            <h1 className="text-3xl font-bold tracking-tight">Data Audit</h1>
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
                      To audit data, please connect your Sui wallet first.
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
            <h1 className="text-3xl font-bold tracking-tight">Data Audit</h1>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 max-w-7xl">
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="text-center py-8">
                <AlertCircle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Auditor Access Required</h2>
                <p className="text-muted-foreground mb-4">
                  Data audit is only available for Auditor role.
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
        hour: '2-digit',
        minute: '2-digit',
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

  const handleAudit = async (record: DealBlobItem) => {
    if (!record.auditStatus?.auditRecordId) {
      toast.error('Audit record ID not found');
      return;
    }

    await auditData({
      dealId,
      auditRecordId: record.auditStatus.auditRecordId,
      blobId: record.blobId,
      onSuccess: () => {
        refetch();
      },
    });
  };

  const handleDownload = (record: DealBlobItem) => {
    // Implement download logic
    toast.info('Download functionality coming soon');
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
                Data Audit - Period {periodId}
              </h1>
              <p className="text-muted-foreground">Review and audit financial documents</p>
            </div>
            <Badge variant="outline" className="capitalize">
              <Shield className="mr-1 h-3 w-3" />
              Auditor
            </Badge>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          {/* Audit Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {auditedRecords} of {totalRecords} documents audited
                  </span>
                  <span className="font-medium">{auditProgress.toFixed(0)}%</span>
                </div>
                <Progress value={auditProgress} className="h-2" />
              </div>

              {auditProgress === 100 && totalRecords > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    All documents have been audited!
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Documents</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review each document and sign to mark as audited
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                  <p className="text-red-600 mb-2">Failed to load documents</p>
                  <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
                  <Button onClick={refetch} variant="outline">
                    Try Again
                  </Button>
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No documents uploaded for this period</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {records.map((record) => {
                    const isAudited = record.auditStatus?.audited || false;
                    const auditedAt = record.auditStatus?.auditTimestamp;

                    return (
                      <div
                        key={record.blobId}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          isAudited
                            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                            : 'bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {isAudited ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{record.metadata.filename}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                              <span className="capitalize">{record.dataType.replace('_', ' ')}</span>
                              <span>{formatFileSize(record.size ?? 0)}</span>
                              <span>
                                <Calendar className="inline h-3 w-3 mr-1" />
                                {formatDate(record.uploadedAt)}
                              </span>
                            </div>
                            {isAudited && auditedAt && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Audited on {formatDate(new Date(auditedAt).toISOString())}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(record)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          {!isAudited && (
                            <Button
                              size="sm"
                              onClick={() => handleAudit(record)}
                              disabled={isAuditing}
                            >
                              {isAuditing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Auditing...
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Audit & Sign
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
