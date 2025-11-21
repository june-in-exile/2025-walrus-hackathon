'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Shield,
  Calculator,
  DollarSign,
} from 'lucide-react';
import { useAuditRecords } from '@/src/frontend/hooks/useAuditRecords';
import { useNautilusKPI } from '@/src/frontend/hooks/useNautilusKPI';
import { toast } from 'sonner';

interface SettlementPanelProps {
  dealId: string;
  periodId: string;
  periodIndex: number;
  isBuyer: boolean;
}

export function SettlementPanel({
  dealId,
  periodId,
  periodIndex,
  isBuyer,
}: SettlementPanelProps) {
  const [showKPICalculation, setShowKPICalculation] = useState(false);

  // Fetch audit progress
  const { totalRecords, auditedRecords, auditProgress, isLoading: isLoadingAudit } =
    useAuditRecords({
      dealId,
      periodId,
      enabled: true,
    });

  // KPI calculation hook
  const { calculateKPI, submitKPI, isCalculating, isSubmitting, kpiResult } = useNautilusKPI();

  const isFullyAudited = totalRecords > 0 && auditedRecords === totalRecords;
  const canCalculateKPI = isFullyAudited && isBuyer && !kpiResult;
  const canSubmitKPI = kpiResult && !isSubmitting;

  const handleCalculateKPI = async () => {
    const result = await calculateKPI({
      dealId,
      periodIndex,
      kpiType: 'revenue',
      onSuccess: () => {
        setShowKPICalculation(true);
      },
    });
  };

  const handleSubmitKPI = async () => {
    if (!kpiResult?.nextStep?.transaction?.txBytes) {
      toast.error('Transaction data not available');
      return;
    }

    await submitKPI({
      txBytes: kpiResult.nextStep.transaction.txBytes,
      onSuccess: () => {
        toast.success('KPI result submitted successfully!');
        setShowKPICalculation(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Audit Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingAudit ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {auditedRecords} of {totalRecords} documents audited
                  </span>
                  <span className="font-medium">{auditProgress.toFixed(0)}%</span>
                </div>
                <Progress value={auditProgress} className="h-2" />
              </div>

              {isFullyAudited ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    All documents audited - Ready for KPI calculation
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Waiting for auditor to complete document review
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* KPI Calculation */}
      {isBuyer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              KPI Calculation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!kpiResult ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Calculate KPI using Nautilus Trusted Execution Environment (TEE).
                  All documents must be audited before calculation.
                </p>
                <Button
                  onClick={handleCalculateKPI}
                  disabled={!canCalculateKPI || isCalculating}
                  className="w-full"
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
                {!isFullyAudited && (
                  <p className="text-xs text-muted-foreground text-center">
                    Calculation will be enabled after all documents are audited
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {/* KPI Result Display */}
                <div className="bg-primary/5 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {kpiResult.kpiType.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-3xl font-bold">
                    ${kpiResult.kpiValue.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      TEE Attested
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(kpiResult.computedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Submit to Blockchain */}
                <div className="space-y-2">
                  <Label>Submit KPI Result On-Chain</Label>
                  <p className="text-xs text-muted-foreground">
                    Sign transaction to register KPI result on Sui blockchain
                  </p>
                  <Button
                    onClick={handleSubmitKPI}
                    disabled={!canSubmitKPI || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Submit to Blockchain
                      </>
                    )}
                  </Button>
                </div>

                {/* Attestation Details */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View Attestation Details
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded font-mono text-xs break-all">
                    {kpiResult.attestation}
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settlement (Future Implementation) */}
      {isBuyer && kpiResult && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-5 w-5" />
              Settlement (Coming Soon)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Settlement functionality will be available after KPI result is submitted on-chain.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
