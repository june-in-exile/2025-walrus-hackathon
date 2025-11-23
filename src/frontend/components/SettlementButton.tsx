/**
 * Settlement Button Component
 *
 * UI component for executing TEE-based earn-out settlement.
 * Shows the complete flow with progress indicators.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/src/frontend/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/frontend/components/ui/dialog';
import { Progress } from '@/src/frontend/components/ui/progress';
import { Alert, AlertDescription } from '@/src/frontend/components/ui/alert';
import { useTEESettlement } from '@/src/frontend/hooks/useTEESettlement';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface SettlementButtonProps {
  deal: {
    id: string;
    name: string;
    kpi_threshold: number;
    max_payout: number;
    subperiods: any[];
  };
  paymentCoinId: string;
  onSettlementComplete?: () => void;
}

export function SettlementButton({
  deal,
  paymentCoinId,
  onSettlementComplete,
}: SettlementButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const {
    isLoading,
    error,
    teeResult,
    downloadAndDecryptDocuments,
    computeKPIWithTEE,
    submitSettlement,
  } = useTEESettlement();

  const steps = [
    {
      title: 'Download Documents',
      description: 'Downloading and decrypting financial documents from Walrus',
    },
    {
      title: 'Compute KPI',
      description: 'Computing KPI in Nautilus TEE with cryptographic attestation',
    },
    {
      title: 'Submit to Blockchain',
      description: 'Submitting KPI result and executing settlement on Sui',
    },
  ];

  const handleSettlement = async () => {
    try {
      // Step 1: Download and decrypt
      setCurrentStep(0);
      const documents = await downloadAndDecryptDocuments(deal);

      // Step 2: Compute with TEE
      setCurrentStep(1);
      const result = await computeKPIWithTEE(documents);

      // Step 3: Submit to blockchain
      setCurrentStep(2);
      await submitSettlement(deal.id, result, paymentCoinId);

      // Success
      setCurrentStep(3);
      onSettlementComplete?.();
    } catch (err) {
      console.error('Settlement failed:', err);
    }
  };

  const progress = isLoading ? ((currentStep + 1) / steps.length) * 100 : 0;
  const isComplete = currentStep >= steps.length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full">
          Execute Settlement
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>TEE-Based Settlement</DialogTitle>
          <DialogDescription>
            Securely compute KPI using Nautilus TEE and execute earn-out settlement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Deal Summary */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold">Deal: {deal.name}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">KPI Threshold:</span>
                <p className="font-medium">${deal.kpi_threshold.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Payout:</span>
                <p className="font-medium">${deal.max_payout.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Documents:</span>
                <p className="font-medium">
                  {deal.subperiods.reduce(
                    (sum, sp) => sum + (sp.walrus_blobs?.length || 0),
                    0
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Progress */}
          {isLoading && (
            <div className="space-y-3">
              <Progress value={progress} />
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      index === currentStep
                        ? 'bg-primary/10 border border-primary/20'
                        : index < currentStep
                        ? 'bg-muted/50'
                        : 'bg-muted/20'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {index < currentStep ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : index === currentStep ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TEE Result */}
          {teeResult && !isLoading && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">
                  TEE Computation Complete
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Computed KPI:</span>
                  <p className="font-bold text-green-900">
                    ${teeResult.kpi_result.kpi.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-green-700">Threshold Met:</span>
                  <p className="font-bold text-green-900">
                    {teeResult.kpi_result.kpi >= deal.kpi_threshold
                      ? '✅ Yes'
                      : '❌ No'}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-green-700">Attestation:</span>
                  <p className="font-mono text-xs break-all text-green-900">
                    {teeResult.attestation_bytes.slice(0, 20).join(' ')}...
                    ({teeResult.attestation_bytes.length} bytes)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success */}
          {isComplete && !isLoading && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Settlement executed successfully! The KPI result has been verified
                on-chain and the settlement is complete.
              </AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {!isLoading && !isComplete && (
            <>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSettlement}>Start Settlement</Button>
            </>
          )}
          {isComplete && (
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
