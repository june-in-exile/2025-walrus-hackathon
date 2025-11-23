import type { SuiClient } from '@mysten/sui/client';

/**
 * Walrus Blob Service (Frontend)
 *
 * Handles bulk download and processing of Walrus blobs for KPI calculation
 */

export interface BlobDownloadResult {
  blobId: string;
  encryptedData: Uint8Array; // Encrypted binary data from Walrus
  success: boolean;
  error?: string;
}

export interface BlobRef {
  blobId: string;
  dataType?: string; // Optional: from Walrus metadata
  uploadedAt?: string;
  uploaderAddress?: string;
  metadata?: {
    filename?: string;
    mimeType?: string;
    description?: string;
    dealId?: string;
    periodId?: string;
    encrypted?: boolean;
    encryptionMode?: string;
    uploadedAt?: string;
    uploaderAddress?: string;
    dataType?: string;
    customDataType?: string;
  };
  auditStatus?: {
    audited: boolean;
    auditor?: string;
    auditTimestamp?: number;
    auditRecordId?: string;
  };
}

export interface DownloadProgress {
  total: number;
  downloaded: number;
  processed: number;
  current?: string; // Current blob ID being processed
}

/**
 * Walrus Blob Download Service
 */
export class WalrusBlobService {

  /**
   * Download encrypted blobs from Walrus
   *
   * Strategy:
   * 1. If blob has dataType metadata and it's not 'json', skip it
   * 2. If blob has dataType='json' or no metadata, download it
   * 3. Download encrypted blob from backend API
   * 4. Return encrypted binary data (caller responsible for decryption)
   *
   * @param dealId - Deal ID for access control
   * @param blobs - Array of blob references
   * @param userAddress - User's Sui wallet address for authentication
   * @param onProgress - Progress callback
   * @returns Array of successfully downloaded encrypted blobs
   */
  async downloadAndProcessBlobs(
    dealId: string,
    blobs: BlobRef[],
    userAddress: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<BlobDownloadResult[]> {
    const results: BlobDownloadResult[] = [];
    const total = blobs.length;


    // Filter blobs: skip non-JSON types if metadata exists
    const blobsToDownload = blobs.filter((blob) => {
      // If no dataType metadata, we need to download and check
      if (!blob.dataType) return true;

      // Skip known non-JSON types
      const nonJsonTypes = ['image', 'pdf', 'binary', 'text'];
      if (nonJsonTypes.includes(blob.dataType.toLowerCase())) {
        console.log(`Skipping blob ${blob.blobId}: type=${blob.dataType}`);
        return false;
      }

      // Download JSON and unknown types
      return true;
    });

    console.log(
      `Filtered ${blobs.length} blobs -> ${blobsToDownload.length} to download`
    );

    // Download and process each blob
    for (let i = 0; i < blobsToDownload.length; i++) {
      const blob = blobsToDownload[i];

      // Update progress
      onProgress?.({
        total,
        downloaded: i,
        processed: results.length,
        current: blob.blobId,
      });

      try {
        // Download encrypted blob from backend API
        const response = await fetch(
          `/api/v1/walrus/download/${blob.blobId}?dealId=${dealId}`,
          {
            method: 'GET',
            headers: {
              'X-Sui-Address': userAddress,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get encrypted binary data
        const arrayBuffer = await response.arrayBuffer();
        const encryptedData = new Uint8Array(arrayBuffer);

        results.push({
          blobId: blob.blobId,
          encryptedData,
          success: true,
        });

        console.log(`✅ Blob ${blob.blobId} downloaded (${encryptedData.length} bytes)`);
      } catch (error) {
        console.error(`Failed to download blob ${blob.blobId}:`, error);
        results.push({
          blobId: blob.blobId,
          encryptedData: new Uint8Array(0),
          success: false,
          error: error instanceof Error ? error.message : 'Download failed',
        });
      }
    }

    // Final progress update
    onProgress?.({
      total,
      downloaded: blobsToDownload.length,
      processed: results.length,
    });

    // Return only successful downloads
    const successfulBlobs = results.filter((r) => r.success);
    console.log(
      `Downloaded ${successfulBlobs.length}/${blobsToDownload.length} encrypted blobs`
    );

    return successfulBlobs;
  }

  /**
   * Get all blobs for a deal from backend API
   */
  async getDealBlobs(dealId: string): Promise<BlobRef[]> {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Using the correct API endpoint for blobs
      const response = await fetch(`/api/v1/deals/${dealId}/blobs`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deal data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get deal blobs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const walrusBlobService = new WalrusBlobService();
