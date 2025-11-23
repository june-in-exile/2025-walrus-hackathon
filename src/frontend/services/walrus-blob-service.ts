/**
 * Walrus Blob Service (Frontend)
 *
 * Handles bulk download and processing of Walrus blobs for KPI calculation
 */

export interface BlobDownloadResult {
  blobId: string;
  data: any; // Parsed JSON data
  dataType: string; // e.g., "JournalEntry", "FixedAssetsRegister"
  success: boolean;
  error?: string;
}

export interface BlobRef {
  blob_id: string;
  data_type?: string; // Optional: from Walrus metadata
  uploaded_at?: number;
  uploader?: string;
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
   * Download and process all blobs for a deal
   *
   * Strategy:
   * 1. If blob has data_type metadata and it's not 'json', skip it
   * 2. If blob has data_type='json' or no metadata, download it
   * 3. Decrypt blob using Seal (via backend API)
   * 4. Try to parse as JSON
   * 5. Only return successfully parsed JSON blobs
   *
   * @param dealId - Deal ID for access control
   * @param blobs - Array of blob references
   * @param onProgress - Progress callback
   * @returns Array of successfully downloaded and parsed JSON blobs
   */
  async downloadAndProcessBlobs(
    dealId: string,
    blobs: BlobRef[],
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<BlobDownloadResult[]> {
    const results: BlobDownloadResult[] = [];
    const total = blobs.length;

    // Filter blobs: skip non-JSON types if metadata exists
    const blobsToDownload = blobs.filter((blob) => {
      // If no data_type metadata, we need to download and check
      if (!blob.data_type) return true;

      // Skip known non-JSON types
      const nonJsonTypes = ['image', 'pdf', 'binary', 'text'];
      if (nonJsonTypes.includes(blob.data_type.toLowerCase())) {
        console.log(`Skipping blob ${blob.blob_id}: type=${blob.data_type}`);
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
        current: blob.blob_id,
      });

      try {
        // Download and decrypt blob via backend API
        const response = await fetch(
          `/api/v1/walrus/download/${blob.blob_id}?dealId=${dealId}`,
          {
            method: 'GET',
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Try to parse as JSON
        let parsedData: any;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          // Response is already JSON
          parsedData = await response.json();
        } else {
          // Try to parse text as JSON
          const text = await response.text();
          try {
            parsedData = JSON.parse(text);
          } catch {
            // Not valid JSON, skip this blob
            console.log(
              `Blob ${blob.blob_id} is not valid JSON, skipping`
            );
            continue;
          }
        }

        // Determine data type from parsed JSON
        const dataType = this.identifyDataType(parsedData);

        results.push({
          blobId: blob.blob_id,
          data: parsedData,
          dataType,
          success: true,
        });

        console.log(
          `✅ Blob ${blob.blob_id} downloaded and parsed (type: ${dataType})`
        );
      } catch (error) {
        console.error(`Failed to download blob ${blob.blob_id}:`, error);
        results.push({
          blobId: blob.blob_id,
          data: null,
          dataType: 'Unknown',
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

    // Return only successful JSON blobs
    const successfulBlobs = results.filter((r) => r.success);
    console.log(
      `Downloaded ${successfulBlobs.length}/${blobsToDownload.length} JSON blobs`
    );

    return successfulBlobs;
  }

  /**
   * Identify financial document type from parsed JSON
   *
   * Matches the logic in kpi-calculation-service.ts
   */
  private identifyDataType(data: any): string {
    if (!data || typeof data !== 'object') {
      return 'Unknown';
    }

    // Journal Entry
    if (data.journalEntryId !== undefined) {
      return 'JournalEntry';
    }

    // Fixed Assets Register
    if (
      Array.isArray(data.assetList) &&
      data.assetList.length > 0 &&
      data.assetList[0].assetID !== undefined
    ) {
      return 'FixedAssetsRegister';
    }

    // Payroll Expense
    if (data.employeeDetails !== undefined) {
      return 'PayrollExpense';
    }

    // Overhead Report
    if (data.reportTitle === 'Corporate Overhead Report') {
      return 'OverheadReport';
    }

    return 'Unknown';
  }

  /**
   * Get all blobs for a deal from backend API
   */
  async getDealBlobs(dealId: string): Promise<BlobRef[]> {
    try {
      // TODO: Replace with actual API endpoint
      // For now, we'll use the dashboard API to get period blobs
      const response = await fetch(`/api/v1/deals/${dealId}/dashboard`);

      if (!response.ok) {
        throw new Error(`Failed to fetch deal data: ${response.statusText}`);
      }

      const dashboard = await response.json();

      // Extract all blobs from all periods
      const allBlobs: BlobRef[] = [];

      if (dashboard.periodsSummary) {
        for (const period of dashboard.periodsSummary) {
          if (period.walrus_blobs && Array.isArray(period.walrus_blobs)) {
            for (const blob of period.walrus_blobs) {
              allBlobs.push({
                blob_id: blob.blob_id,
                data_type: blob.data_type,
                uploaded_at: blob.uploaded_at,
                uploader: blob.uploader,
              });
            }
          }
        }
      }

      console.log(`Found ${allBlobs.length} blobs for deal ${dealId}`);
      return allBlobs;
    } catch (error) {
      console.error('Failed to get deal blobs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const walrusBlobService = new WalrusBlobService();
