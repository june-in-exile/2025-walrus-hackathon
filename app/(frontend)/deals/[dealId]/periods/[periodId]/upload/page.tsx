'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentAccount, useSuiClient, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useDashboard } from '@/src/frontend/hooks/useDashboard';
import { useWalrusUpload, type DataType } from '@/src/frontend/hooks/useWalrusUpload';
import { usePeriodBlobs } from '@/src/frontend/hooks/usePeriodBlobs';
import { decryptData } from '@/src/frontend/lib/seal';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { FileUploadZone } from '@/src/frontend/components/features/upload/FileUploadZone';
import { RequestChangesModal } from '@/src/frontend/components/features/auditor/RequestChangesModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Loader2,
  Wallet,
  ArrowLeft,
  Upload as UploadIcon,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

const uploadSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a file' }),
  dataType: z.enum([
    'revenue_report',
    'expense_report',
    'custom',
  ]),
  customDataType: z.string().optional(),
  description: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

// Type for newly uploaded files in session state
type UploadedFile = {
  blobId: string;
  filename: string;
  dataType: string;
  customDataType?: string;
  description?: string;
  size: number;
  uploadedAt: Date;
  reviewStatus: 'pending' | 'approved' | 'changes_requested';
};

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const { currentRole } = useRole();
  const dealId = params.dealId as string;
  const periodId = params.periodId as string;
  const { data: dashboard, isLoading } = useDashboard(dealId);
  const { upload: uploadToWalrus, isUploading } = useWalrusUpload();
  const { data: periodBlobsData, isLoading: isBlobsLoading } = usePeriodBlobs(dealId, periodId);
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [downloadingBlobId, setDownloadingBlobId] = useState<string | null>(null);
  const [requestChangesModal, setRequestChangesModal] = useState<{
    open: boolean;
    blobId: string;
    filename: string;
  }>({
    open: false,
    blobId: '',
    filename: '',
  });

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      dataType: 'revenue_report',
      description: '',
    },
  });

  const watchDataType = form.watch('dataType');

  const onSubmit = async (data: UploadFormData) => {
    try {
      console.log('Uploading file:', {
        dealId,
        periodId,
        file: data.file.name,
        dataType: data.dataType,
        customDataType: data.customDataType,
        description: data.description,
      });

      // Upload to Walrus with Seal encryption
      const result = await uploadToWalrus({
        file: data.file,
        dealId,
        periodId,
        dataType: data.dataType as DataType,
        customDataType: data.customDataType,
        description: data.description,
        enableEncryption: true, // Enable Seal encryption
        onSuccess: (uploadResult) => {
          // Add to uploaded files list
          setUploadedFiles((prev) => [
            ...prev,
            {
              blobId: uploadResult.blobId,
              filename: uploadResult.filename,
              dataType: data.dataType,
              customDataType: data.customDataType,
              description: data.description,
              size: uploadResult.size,
              uploadedAt: new Date(uploadResult.uploadedAt),
              reviewStatus: 'pending',
            },
          ]);

          // Reset form
          form.reset({
            dataType: 'revenue_report',
            description: '',
          });
        },
        onError: (error) => {
          console.error('Failed to upload file:', error);
        },
      });

      if (!result) {
        // Upload was cancelled or failed (error already shown by hook)
        return;
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file. Please try again.');
    }
  };

  const handleApproveFile = async (blobId: string) => {
    console.log('Approving file:', blobId);
    toast.success('File approved', {
      description: 'File has been marked as approved.',
    });
    // TODO: Update on-chain
  };

  const handleRequestChanges = async (notes: string) => {
    try {
      console.log('Requesting changes for blob:', requestChangesModal.blobId, notes);
      // TODO: Update on-chain
      await new Promise((resolve) => setTimeout(resolve, 500));

      toast.success('Changes requested', {
        description: 'Buyer will be notified to revise this document.',
      });
    } catch (error) {
      toast.error('Failed to submit feedback', {
        description: 'Please try again later.',
      });
      throw error;
    }
  };

  const handleDownload = async (blobId: string, filename: string) => {
    if (!currentAccount?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setDownloadingBlobId(blobId);

    try {
      const message = new Date().toISOString();
      const { signature } = await signPersonalMessage({
        message: new TextEncoder().encode(message),
      });

      const response = await fetch(`/api/v1/walrus/download/${blobId}?dealId=${dealId}`, {
        headers: {
          'X-Sui-Address': currentAccount.address,
          'X-Sui-Signature': signature,
          'X-Sui-Signature-Message': message,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download file');
      }

      const encryptedBuffer = await response.arrayBuffer();
      const packageId = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;

      if (!packageId) {
        throw new Error('Seal decryption is not configured');
      }

      const decryptedBuffer = await decryptData(
        suiClient,
        encryptedBuffer,
        dealId,
        packageId,
        currentAccount.address,
        signPersonalMessage
      );

      const blob = new Blob([new Uint8Array(decryptedBuffer)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download file');
    } finally {
      setDownloadingBlobId(null);
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
            <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
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
                      To manage documents, please connect your Sui wallet first.
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

  // Fetch existing blobs from blockchain via API
  const existingBlobs = periodBlobsData?.blobs || [];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
      case 'changes_requested':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Changes Requested</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Pending Review</Badge>;
    }
  };

  const pageTitle = currentRole === 'buyer' ? 'Upload Documents' : currentRole === 'auditor' ? 'Review Documents' : 'View Documents';

  return (
    <div className="w-full">
      {/* Header */}
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
              <h1 className="text-3xl font-bold tracking-tight mb-2">{pageTitle}</h1>
              <p className="text-muted-foreground">
                {currentRole === 'buyer' && 'Upload encrypted financial documents for '}
                {currentRole === 'seller' && 'View uploaded documents for '}
                {currentRole === 'auditor' && 'Review and audit documents for '}
                <span className="font-medium">{period?.name}</span>
              </p>
            </div>
            <Badge variant="outline" className="capitalize">{currentRole}</Badge>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column: Upload Form (Buyer only) or Info */}
          <div>
            {currentRole === 'buyer' ? (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                          control={form.control}
                          name="file"
                          render={({ field: { value, onChange } }) => (
                            <FormItem>
                              <FormLabel>Select File *</FormLabel>
                              <FormControl>
                                <FileUploadZone
                                  onFileSelect={(file) => onChange(file)}
                                  disabled={isUploading}
                                  dealId={dealId}
                                  enableEncryption={true}
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
                                  <SelectItem value="revenue_report">Revenue Report</SelectItem>
                                  <SelectItem value="expense_report">Expense Report</SelectItem>
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
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Period Information</h3>
                      <p className="text-sm text-muted-foreground">
                        {period?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(period?.dateRange.start)} - {formatDate(period?.dateRange.end)}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Your Role</h3>
                      <p className="text-sm text-muted-foreground">
                        {currentRole === 'seller' && 'As a Seller, you can view all uploaded documents but cannot upload or modify them.'}
                        {currentRole === 'auditor' && 'As an Auditor, you can review documents and approve or request changes for each file.'}
                      </p>
                    </div>
                    {currentRole === 'auditor' && (
                      <div className="pt-4 border-t">
                        <h3 className="font-semibold mb-2">Review Process</h3>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Review each document carefully</li>
                          <li>• Approve documents that meet requirements</li>
                          <li>• Request changes if revisions are needed</li>
                          <li>• Provide clear feedback to the buyer</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Uploaded Files List */}
          <div>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">
                  {currentRole === 'buyer' && 'Uploaded Documents'}
                  {currentRole === 'seller' && 'Available Documents'}
                  {currentRole === 'auditor' && 'Documents for Review'}
                </h3>

                {isBlobsLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading documents...</p>
                  </div>
                ) : existingBlobs.length === 0 && uploadedFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {currentRole === 'buyer' ? 'No documents uploaded yet' : 'No documents available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Existing blobs from blockchain */}
                    {existingBlobs.map((blob) => (
                      <div
                        key={blob.blobId}
                        className="p-4 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{blob.dataType}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span title={blob.blobId}>
                                  Blob ID: {blob.blobId.substring(0, 8)}...
                                </span>
                                <span>{formatDate(blob.uploadedAt)}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(blob.blobId, blob.dataType)}
                            disabled={downloadingBlobId === blob.blobId}
                          >
                            {downloadingBlobId === blob.blobId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {/* Status Badge - Note: Audit status not yet integrated */}
                        <div className="mb-2">
                          {getStatusBadge('pending')}
                        </div>

                        {/* Uploader info */}
                        <div className="text-xs text-muted-foreground mt-2">
                          Uploaded by: {blob.uploaderAddress.substring(0, 8)}...{blob.uploaderAddress.substring(blob.uploaderAddress.length - 6)}
                        </div>
                      </div>
                    ))}

                    {/* Newly uploaded files (session only) */}
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={`new-${index}`}
                        className="p-4 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{file.filename}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{formatFileSize(file.size)}</span>
                                <span>{formatDate(file.uploadedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">
                          {getStatusBadge('pending')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section >

      {/* Request Changes Modal */}
      < RequestChangesModal
        open={requestChangesModal.open}
        onOpenChange={(open) =>
          setRequestChangesModal((prev) => ({ ...prev, open }))
        }
        filename={requestChangesModal.filename}
        onSubmit={handleRequestChanges}
      />
    </div >
  );
}
