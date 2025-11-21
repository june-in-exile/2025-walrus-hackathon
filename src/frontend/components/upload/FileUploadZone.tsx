import { useCallback, useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSuiClient } from '@mysten/dapp-kit';
import { encryptData } from '@/src/frontend/lib/seal';

interface FileUploadZoneProps {
  onFileSelect?: (file: File) => void;
  onUploadComplete?: (result: { blobId: string; filename: string }) => void;
  disabled?: boolean;
  accept?: string;
  maxSize?: number; // in MB
  enableEncryption?: boolean;
}

export function FileUploadZone({
  onFileSelect,
  onUploadComplete,
  disabled = false,
  accept = '.pdf,.xlsx,.xls,.csv,.doc,.docx,.json',
  maxSize = 50,
  enableEncryption = false,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suiClient = useSuiClient();

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isUploading) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize}MB limit`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      const fileBuffer = await file.arrayBuffer();
      let blobToUpload: Blob;

      if (enableEncryption) {
        // Get Seal configuration from environment
        const packageId = process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID;
        const whitelistObjectId = process.env.NEXT_PUBLIC_SEAL_POLICY_OBJECT_ID;

        if (!packageId || !whitelistObjectId) {
          throw new Error('Seal encryption is not configured. Please set NEXT_PUBLIC_SEAL_PACKAGE_ID and NEXT_PUBLIC_SEAL_POLICY_OBJECT_ID.');
        }

        // Encrypt data using Seal
        const encryptedBuffer = await encryptData(
          suiClient,
          fileBuffer,
          whitelistObjectId,
          packageId
        );

        // Convert Uint8Array to Blob using Array.from() to avoid TypeScript issues
        blobToUpload = new Blob([new Uint8Array(encryptedBuffer)], { type: 'application/octet-stream' });
      } else {
        // No encryption - upload raw file
        blobToUpload = new Blob([fileBuffer], { type: file.type || 'application/octet-stream' });
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('file', blobToUpload, file.name);

      // Upload to backend
      const response = await fetch('/api/v1/walrus/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();

      // Call onUploadComplete with blobId
      onUploadComplete?.({ blobId: result.blobId, filename: file.name });

    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred during upload.';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // If onFileSelect is provided, just pass the file (no upload)
    if (onFileSelect) {
      onFileSelect(file);
      return;
    }

    // Otherwise, upload the file
    uploadFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, isUploading, onFileSelect, onUploadComplete]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const isComponentDisabled = disabled || isUploading;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging && !isComponentDisabled && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25',
          isComponentDisabled && 'opacity-50 cursor-not-allowed',
          !isComponentDisabled && 'cursor-pointer hover:border-primary/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!isComponentDisabled) {
            document.getElementById('file-input')?.click();
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFileInput}
          disabled={isComponentDisabled}
        />

        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <>
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-medium">
                {enableEncryption ? 'Encrypting & Uploading...' : 'Uploading...'}
              </p>
            </>
          ) : isDragging ? (
            <>
              <Upload className="h-10 w-10 text-primary animate-bounce" />
              <p className="text-sm font-medium">Drop file here</p>
            </>
          ) : (
            <>
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported: PDF, Excel, CSV, Word, JSON (max {maxSize}MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
