/**
 * KPI Calculate Button Component
 *
 * Button component that triggers KPI calculation from Walrus blobs
 * Shows progress dialog with real-time updates
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useKPICalculation } from '@/src/frontend/hooks/useKPICalculation';
import {
  Calculator,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Download,
  Zap,
  Lock,
  Unlock,
  FileCheck,
  User,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ExternalLink,
} from 'lucide-react';

interface KPICalculateButtonProps {
  dealId: string;
  onCalculationComplete?: (result: any) => void;
  disabled?: boolean;
}

export function KPICalculateButton({
  dealId,
  onCalculationComplete,
  disabled = false,
}: KPICalculateButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { isCalculating, progress, result, error, calculateKPI, reset } =
    useKPICalculation();

  const handleCalculate = async () => {
    setIsDialogOpen(true);
    const calculationResult = await calculateKPI(dealId);

    if (calculationResult && onCalculationComplete) {
      onCalculationComplete(calculationResult);
    }
  };

  const handleClose = () => {
    if (!isCalculating) {
      setIsDialogOpen(false);
      reset();
    }
  };

  const getPhaseIcon = () => {
    switch (progress.phase) {
      case 'downloading':
        return <Download className="h-5 w-5 animate-pulse text-blue-600" />;
      case 'decrypting':
        return <Unlock className="h-5 w-5 animate-pulse text-amber-600" />;
      case 'calculating':
        return <Zap className="h-5 w-5 animate-pulse text-purple-600" />;
      case 'submitting':
        return <TrendingUp className="h-5 w-5 animate-pulse text-indigo-600" />;
      case 'checking_settlement':
        return <DollarSign className="h-5 w-5 animate-pulse text-green-600" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Calculator className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPhaseColor = () => {
    switch (progress.phase) {
      case 'downloading':
        return 'text-blue-600';
      case 'decrypting':
        return 'text-amber-600';
      case 'calculating':
        return 'text-purple-600';
      case 'submitting':
        return 'text-indigo-600';
      case 'checking_settlement':
        return 'text-green-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <Button
        onClick={handleCalculate}
        disabled={disabled || isCalculating}
        className="w-full"
        variant="default"
      >
        {isCalculating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Calculating...
          </>
        ) : (
          <>
            <Calculator className="mr-2 h-4 w-4" />
            Calculate KPI
          </>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>KPI Calculation</DialogTitle>
            <DialogDescription>
              Calculating KPI from financial documents stored on Walrus
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Phase Indicator */}
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
              {getPhaseIcon()}
              <div className="flex-1">
                <p className={`font-medium ${getPhaseColor()}`}>
                  {progress.message}
                </p>
                {progress.documentsFound !== undefined && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {progress.documentsFound} JSON documents found
                  </p>
                )}
              </div>
            </div>

            {/* Download Progress */}
            {progress.phase === 'downloading' && progress.downloadProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Downloading blobs
                  </span>
                  <span className="font-medium">
                    {progress.downloadProgress.downloaded} /{' '}
                    {progress.downloadProgress.total}
                  </span>
                </div>
                <Progress
                  value={
                    (progress.downloadProgress.downloaded /
                      progress.downloadProgress.total) *
                    100
                  }
                />
                {progress.downloadProgress.current && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Current: {progress.downloadProgress.current.slice(0, 16)}...
                  </p>
                )}
              </div>
            )}

            {/* Decrypt Progress */}
            {progress.phase === 'decrypting' && progress.decryptProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Decrypting with Seal
                  </span>
                  <span className="font-medium">
                    {progress.decryptProgress.current} /{' '}
                    {progress.decryptProgress.total}
                  </span>
                </div>
                <Progress
                  value={
                    (progress.decryptProgress.current /
                      progress.decryptProgress.total) *
                    100
                  }
                  className="bg-amber-100"
                />
                <p className="text-xs text-muted-foreground">
                  Requesting decryption keys from Seal Key Servers...
                </p>
              </div>
            )}

            {/* Calculation Progress (Indeterminate) */}
            {progress.phase === 'calculating' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Computing with TEE
                  </span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <Progress value={undefined} />
                <p className="text-xs text-muted-foreground">
                  Processing {progress.documentsFound} documents...
                </p>
              </div>
            )}

            {/* Submitting Progress */}
            {progress.phase === 'submitting' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Submitting to Blockchain
                  </span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <Progress value={undefined} />
                <p className="text-xs text-muted-foreground">
                  Waiting for wallet signature...
                </p>
              </div>
            )}

            {/* Checking Settlement Progress */}
            {progress.phase === 'checking_settlement' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Checking Settlement Status
                  </span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <Progress value={undefined} />
                <p className="text-xs text-muted-foreground">
                  Querying deal status from blockchain...
                </p>
              </div>
            )}

            {/* Success Result */}
            {progress.phase === 'completed' && result && (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 dark:text-green-100">
                    KPI calculation completed successfully
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                  {/* KPI Result */}
                  <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-medium">
                          Calculated KPI
                        </span>
                      </div>
                      <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(result.kpi_result.kpi)}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Documents</p>
                        <p className="font-medium">
                          {result.documentsProcessed}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">
                          Calculation Time
                        </p>
                        <p className="font-medium">
                          {(result.calculationTime / 1000).toFixed(2)}s
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Audited Documents List */}
                  {result.auditedDocuments && result.auditedDocuments.length > 0 && (
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-3">
                        <FileCheck className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-semibold">
                          Audited Documents Used ({result.auditedDocuments.length})
                        </p>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {result.auditedDocuments.map((doc) => (
                          <div
                            key={doc.blobId}
                            className="p-3 rounded-md bg-background border text-xs space-y-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileJson className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                                <span className="font-medium truncate">
                                  {doc.filename}
                                </span>
                              </div>
                              {doc.dataType && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex-shrink-0">
                                  {doc.dataType}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground pl-5">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span className="font-mono">
                                  {doc.auditor.slice(0, 6)}...{doc.auditor.slice(-4)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {new Date(doc.auditTimestamp).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Settlement Status */}
                  {result.settlement && (
                    <div className={`p-4 rounded-lg border ${
                      result.settlement.isSettled
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        {result.settlement.isSettled ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">
                              Deal Settled! 🎉
                            </p>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-5 w-5 text-amber-600" />
                            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                              KPI Not Met
                            </p>
                          </>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">KPI Value:</span>
                          <span className="font-semibold">
                            {formatCurrency(result.settlement.kpiValue)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">KPI Threshold:</span>
                          <span className="font-semibold">
                            {formatCurrency(result.settlement.kpiThreshold)}
                          </span>
                        </div>

                        {result.settlement.isSettled ? (
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-muted-foreground">Payout Amount:</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(result.settlement.settledAmount)}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-amber-700 dark:text-amber-400">
                              <span>Shortfall:</span>
                              <span className="font-semibold">
                                {formatCurrency(result.settlement.shortfall || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span>Max Payout (if met):</span>
                              <span className="font-medium">
                                {formatCurrency(result.settlement.maxPayout)}
                              </span>
                            </div>
                          </>
                        )}

                        {result.settlement.transactionDigest && (
                          <div className="pt-2 border-t">
                            <a
                              href={`https://suiscan.xyz/testnet/tx/${result.settlement.transactionDigest}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              <span>View Transaction</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Attestation Info */}
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <p className="text-xs font-semibold mb-1">
                      TEE Attestation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.attestation_bytes.length} bytes |{' '}
                      {new Date(
                        result.attestation.timestamp
                      ).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                      {result.attestation_bytes.slice(0, 40).join(' ')}...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {progress.phase === 'error' && error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            {progress.phase === 'completed' || progress.phase === 'error' ? (
              <Button onClick={handleClose}>Close</Button>
            ) : (
              <Button onClick={handleClose} variant="outline" disabled={isCalculating}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
