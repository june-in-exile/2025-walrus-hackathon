import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Trash2, Download, Loader2, Copy, Check } from 'lucide-react';
import { useSuiClient, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { decryptData } from '@/src/frontend/lib/seal';

interface UploadedFile {
  filename: string;
  dataType: string;
  customDataType?: string;
  description?: string;
  size: number;
  uploadedAt: Date;
  blobId?: string;
}

interface UploadedFilesListProps {
  files: UploadedFile[];
  onDelete?: (index: number) => void;
  dealId: string;
}

type DownloadStatus = 'idle' | 'downloading' | 'error';

export function UploadedFilesList({
  files,
  onDelete,
  dealId,
}: UploadedFilesListProps) {
  const [downloadStatus, setDownloadStatus] = useState<Record<number, DownloadStatus>>({});
  const [downloadError, setDownloadError] = useState<Record<number, string | null>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const handleCopyBlobId = async (index: number, blobId: string) => {
    try {
      await navigator.clipboard.writeText(blobId);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy blob ID:', error);
    }
  };

  const handleDownload = async (index: number, blobId: string, filename: string) => {
    if (!currentAccount?.address) {
      setDownloadError(prev => ({ ...prev, [index]: 'Please connect your wallet first.' }));
      return;
    }

    setDownloadStatus(prev => ({ ...prev, [index]: 'downloading' }));
    setDownloadError(prev => ({ ...prev, [index]: null }));

    try {
      // Create authentication message (ISO timestamp format)
      const message = new Date().toISOString();

      // Sign message with wallet
      const signatureResult = await signPersonalMessage({
        message: new TextEncoder().encode(message),
      });

      // Fetch encrypted file from API with authentication headers
      const response = await fetch(`/api/v1/walrus/download/${blobId}?dealId=${dealId}`, {
        method: 'GET',
        headers: {
          'X-Sui-Address': currentAccount.address,
          'X-Sui-Signature': signatureResult.signature,
          'X-Sui-Signature-Message': message,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download file');
      }

      const encryptedBuffer = await response.arrayBuffer();

      // Get Seal configuration from environment
      const packageId = process.env.NEXT_PUBLIC_EARNOUT_PACKAGE_ID;

      if (!packageId) {
        throw new Error('Seal decryption is not configured. Please set NEXT_PUBLIC_EARNOUT_PACKAGE_ID.');
      }

      const decryptedBuffer = await decryptData(
        suiClient,
        encryptedBuffer,
        dealId,
        packageId,
        currentAccount.address,
        signPersonalMessage
      );

      // Convert Uint8Array to Blob
      const decryptedBlob = new Blob([new Uint8Array(decryptedBuffer)]);
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDownloadStatus(prev => ({ ...prev, [index]: 'idle' }));
    } catch (e: unknown) {
      console.error('Download failed:', e);
      setDownloadStatus(prev => ({ ...prev, [index]: 'error' }));
      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
      setDownloadError(prev => ({ ...prev, [index]: errorMessage }));
      // Reset error after a few seconds
      setTimeout(() => {
        setDownloadStatus(prev => ({ ...prev, [index]: 'idle' }));
        setDownloadError(prev => ({ ...prev, [index]: null }));
      }, 5000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDataType = (type: string): string => {
    const typeMap: Record<string, string> = {
      revenue_journal: 'Revenue Journal',
      ebitda_report: 'EBITDA Report',
      expense_report: 'Expense Report',
      balance_sheet: 'Balance Sheet',
      cash_flow: 'Cash Flow',
      kpi_calculation: 'KPI Calculation',
      audit_report: 'Audit Report',
      custom: 'Custom',
    };
    return typeMap[type] || type;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload your first document to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Uploaded Documents ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="p-2 rounded-md bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {file.customDataType || formatDataType(file.dataType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(file.uploadedAt)}
                      </span>
                    </div>
                    {file.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {file.description}
                      </p>
                    )}
                    {file.blobId && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          Blob ID: {file.blobId.slice(0, 8)}...{file.blobId.slice(-8)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyBlobId(index, file.blobId!)}
                          className="h-5 w-5 p-0"
                          title="Copy full Blob ID"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                    {downloadError[index] && (
                      <p className="text-xs text-destructive mt-1">
                        Error: {downloadError[index]}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {file.blobId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(index, file.blobId!, file.filename)}
                        disabled={downloadStatus[index] === 'downloading'}
                        className="h-8 w-8 p-0"
                      >
                        {downloadStatus[index] === 'downloading' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
