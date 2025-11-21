'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useDashboard } from '@/src/frontend/hooks/useDashboard';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { PeriodFormSection } from '@/src/frontend/components/setup/PeriodFormSection';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Wallet, ArrowLeft, Plus, Save } from 'lucide-react';
import Link from 'next/link';

const kpiSchema = z.object({
  type: z.enum(['revenue', 'ebitda', 'user_growth', 'arr', 'custom']),
  name: z.string().optional(),
  threshold: z.number().min(0),
  unit: z.string().min(1, 'Unit is required'),
  description: z.string().optional(),
});

const formulaSchema = z.object({
  type: z.enum(['linear', 'stepped', 'percentage', 'custom']),
  maxPayout: z.number().min(0, 'Max payout must be positive'),
  parameters: z.record(z.string(), z.any()).optional(),
  description: z.string().optional(),
});

const periodSchema = z.object({
  name: z.string().min(1, 'Period name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  kpiTypes: z.array(kpiSchema).min(1, 'At least one KPI is required'),
  formula: formulaSchema,
});

const setupSchema = z.object({
  periods: z.array(periodSchema).min(1, 'At least one period is required'),
});

type SetupFormData = z.infer<typeof setupSchema>;

export default function ParameterSetupPage() {
  const params = useParams();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const dealId = params.dealId as string;
  const { data: dashboard, isLoading } = useDashboard(dealId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      periods: [
        {
          name: '',
          startDate: '',
          endDate: '',
          kpiTypes: [
            {
              type: 'revenue',
              threshold: 0,
              unit: 'USD',
            },
          ],
          formula: {
            type: 'percentage',
            maxPayout: 0,
          },
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'periods',
  });

  const onSubmit = async (data: SetupFormData) => {
    setIsSubmitting(true);
    try {
      // Convert string dates to Date objects
      const payload = {
        periods: data.periods.map((period) => ({
          ...period,
          startDate: new Date(period.startDate),
          endDate: new Date(period.endDate),
        })),
      };

      console.log('Setting parameters:', payload);

      // TODO: Call API to set parameters
      // await setParameters(dealId, payload);

      toast.success('Parameters saved successfully!');
      router.push(`/deals/${dealId}`);
    } catch (error) {
      console.error('Failed to save parameters:', error);
      toast.error('Failed to save parameters. Please try again.');
    } finally {
      setIsSubmitting(false);
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
              onClick={() => router.push(`/deals/${dealId}`)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Configure Parameters</h1>
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
                      To configure deal parameters, please connect your Sui wallet first.
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
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is buyer
  if (dashboard?.dealInfo.userRole !== 'buyer') {
    return (
      <div className="container mx-auto px-4 py-20 max-w-7xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            Only the buyer can configure deal parameters.
          </p>
          <Button asChild>
            <Link href={`/deals/${dealId}`}>Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/deals/${dealId}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Configure Parameters</h1>
            <p className="text-muted-foreground">
              Set up earn-out periods, KPI targets, and payout formulas for{' '}
              <span className="font-medium">{dashboard?.dealInfo.name}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="container mx-auto px-4 py-8 max-w-5xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Periods */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Earn-out Periods</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Define time periods with KPI targets and payout formulas
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      name: '',
                      startDate: '',
                      endDate: '',
                      kpiTypes: [
                        {
                          type: 'revenue',
                          threshold: 0,
                          unit: 'USD',
                        },
                      ],
                      formula: {
                        type: 'percentage',
                        maxPayout: 0,
                      },
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Period
                </Button>
              </div>

              {fields.map((field, index) => (
                <PeriodFormSection
                  key={field.id}
                  index={index}
                  form={form}
                  onRemove={() => remove(index)}
                  canRemove={fields.length > 1}
                />
              ))}
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/deals/${dealId}`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Parameters
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </div>
  );
}
