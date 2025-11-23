'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateDeal } from '@/src/frontend/hooks/useDeals';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Loader2, Plus } from 'lucide-react';

const createDealSchema = z.object({
  name: z.string().min(1, 'Deal name is required').max(200, 'Name too long'),
  closingDate: z.string().min(1, 'Closing date is required'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'SUI']),
  sellerAddress: z.string().optional(),
  auditorAddress: z.string().optional(),
  notes: z.string().optional(),
});

type CreateDealFormData = z.infer<typeof createDealSchema>;

interface CreateDealDialogProps {
  children?: React.ReactNode;
}

export function CreateDealDialog({ children }: CreateDealDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const createDeal = useCreateDeal();

  const form = useForm<CreateDealFormData>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      name: '',
      closingDate: '',
      currency: 'USD',
      sellerAddress: '',
      auditorAddress: '',
      notes: '',
    },
  });

  const onSubmit = async (data: CreateDealFormData) => {
    if (!currentAccount) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const result = await createDeal.mutateAsync({
        name: data.name,
        closingDate: new Date(data.closingDate) as any,
        currency: data.currency,
        buyerAddress: currentAccount.address,
        sellerAddress: data.sellerAddress,
        auditorAddress: data.auditorAddress,
        metadata: data.notes ? { notes: data.notes } : undefined,
      });

      // Close dialog and reset form
      setOpen(false);
      form.reset();

      toast.success('Deal created successfully!');

      // Navigate to the new deal's dashboard
      if (result.deal.dealId) {
        router.push(`/deals/${result.deal.dealId}`);
      }
    } catch (error) {
      console.error('Failed to create deal:', error);
      toast.error('Failed to create deal. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Create New Deal
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Earn-out Deal</DialogTitle>
          <DialogDescription>
            Set up a new M&A earn-out agreement. You can configure parameters and periods later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Deal Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Acquisition of TechCorp Inc."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this earn-out agreement
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Closing Date */}
            <FormField
              control={form.control}
              name="closingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Closing Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    The date when the acquisition was finalized
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Currency */}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                      <SelectItem value="SUI">SUI - Sui Token</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Currency for all earn-out calculations
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seller Address (Optional) */}
            <FormField
              control={form.control}
              name="sellerAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seller Sui Address (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Sui wallet address of the seller (can be set later)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auditor Address (Optional) */}
            <FormField
              control={form.control}
              name="auditorAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auditor Sui Address (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0x..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Sui wallet address of the auditor (can be set later)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional information about this deal..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Any additional context or details
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createDeal.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createDeal.isPending}>
                {createDeal.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Deal
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
