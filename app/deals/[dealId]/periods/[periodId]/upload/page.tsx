'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDashboard } from '@/src/frontend/hooks/useDashboard';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { FileUploadZone } from '@/src/frontend/components/upload/FileUploadZone';
import { UploadedFilesList } from '@/src/frontend/components/upload/UploadedFilesList';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wallet, ArrowLeft, Upload as UploadIcon } from 'lucide-react';
import Link from 'next/link';

const uploadSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a file' }),
  dataType: z.enum([
    'revenue_journal',
    'ebitda_report',
    'expense_report',
    'balance_sheet',
    'cash_flow',
    'kpi_calculation',
    'audit_report',
    'custom',
  ]),
  customDataType: z.string().optional(),
  description: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export default function DataUploadPage() {
  const params = useParams();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const dealId = params.dealId as string;
  const periodId = params.periodId as string;
  const { data: dashboard, isLoading } = useDashboard(dealId);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      dataType: 'revenue_journal',
      description: '',
    },
  });

  const watchDataType = form.watch('dataType');

  const onSubmit = async (data: UploadFormData) => {
    setIsUploading(true);
    try {
      console.log('Uploading file:', {
        dealId,
        periodId,
        file: data.file.name,
        dataType: data.dataType,
        customDataType: data.customDataType,
        description: data.description,
      });

      // TODO: Implement actual Walrus upload
      // 1. Encrypt file using Seal SDK
      // 2. Upload to Walrus via relay API
      // 3. Store blob reference on-chain

      // Simulate upload
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Add to uploaded files list
      setUploadedFiles((prev) => [
        ...prev,
        {
          filename: data.file.name,
          dataType: data.dataType,
          customDataType: data.customDataType,
          description: data.description,
          size: data.file.size,
          uploadedAt: new Date(),
        },
      ]);

      // Reset form
      form.reset({
        dataType: 'revenue_journal',
        description: '',
      });

      alert('File uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
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
            <h1 className="text-3xl font-bold tracking-tight">Upload Documents</h1>
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
                      To upload documents, please connect your Sui wallet first.
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

  // Find the current period
  const period = dashboard?.periodsSummary.find((p) => p.periodId === periodId);

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
            <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Documents</h1>
            <p className="text-muted-foreground">
              Upload encrypted financial documents for{' '}
              <span className="font-medium">{period?.name}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Upload Form */}
          <div>
            <Card>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="file"
                      render={({ field: { value, onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel>Select File *</FormLabel>
                          <FormControl>
                            <FileUploadZone
                              onFileSelect={(file) => onChange(file)}
                              disabled={isUploading}
                            />
                          </FormControl>
                          {value && (
                            <p className="text-sm text-muted-foreground">
                              Selected: {value.name} ({(value.size / 1024).toFixed(2)} KB)
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dataType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Type *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isUploading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="revenue_journal">Revenue Journal</SelectItem>
                              <SelectItem value="ebitda_report">EBITDA Report</SelectItem>
                              <SelectItem value="expense_report">Expense Report</SelectItem>
                              <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                              <SelectItem value="cash_flow">Cash Flow Statement</SelectItem>
                              <SelectItem value="kpi_calculation">KPI Calculation</SelectItem>
                              <SelectItem value="audit_report">Audit Report</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchDataType === 'custom' && (
                      <FormField
                        control={form.control}
                        name="customDataType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Type Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Monthly Sales Report"
                                disabled={isUploading}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes about this document..."
                              className="min-h-[80px]"
                              disabled={isUploading}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Provide context about the document
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={isUploading}>
                      {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <UploadIcon className="mr-2 h-4 w-4" />
                      {isUploading ? 'Uploading...' : 'Upload to Walrus'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="mt-6 bg-muted/30">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Encryption & Privacy</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Files are encrypted using Seal before upload</li>
                  <li>• Only authorized parties can decrypt</li>
                  <li>• Stored on decentralized Walrus network</li>
                  <li>• Access control enforced on-chain</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Uploaded Files List */}
          <div>
            <UploadedFilesList
              files={uploadedFiles}
              onDelete={(index) =>
                setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
