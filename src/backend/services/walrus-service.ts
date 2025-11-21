/**
 * Walrus Storage Service
 *
 * Handles file upload and download operations with Walrus decentralized storage.
 * Uses HTTP API to bypass WASM loading issues in Next.js environment.
 */

import { config, debugConfig } from '@/src/shared/config/env';
import type {
  WalrusUploadResult,
  BlobInfo,
  BlobMetadata,
  UploadMetadata,
  WalrusMetadataEnvelope,
  WalrusDownloadResult,
} from '@/src/shared/types/walrus';

// Current envelope format version
const ENVELOPE_VERSION = 1;

// Walrus aggregator response types
interface WalrusStoreResponse {
  newlyCreated?: {
    blobObject: {
      id: string;
      storedEpoch: number;
      blobId: string;
      size: number;
      erasureCodeType: string;
      certifiedEpoch: number;
      storage: {
        id: string;
        startEpoch: number;
        endEpoch: number;
        storageSize: number;
      };
    };
    resourceOperation: {
      RegisterFromScratch?: {
        encoded_length: number;
        epochs_ahead: number;
      };
    };
    cost: number;
  };
  alreadyCertified?: {
    blobId: string;
    endEpoch: number;
  };
}

/**
 * Walrus Service for backend file operations
 * Uses HTTP API to Walrus aggregator (bypasses WASM issues)
 */
export class WalrusService {
  private aggregatorUrl: string;
  private publisherUrl: string;

  constructor() {
    // Use aggregator URL for both read and write
    // Publisher is typically at a different endpoint for writes
    this.aggregatorUrl = config.walrus.aggregatorUrl || 'https://walrus-testnet.blockscope.net';
    this.publisherUrl = config.walrus.publisherUrl || 'https://walrus-testnet.blockscope.net:11444';

    if (debugConfig.walrus) {
      console.log('WalrusService initialized (HTTP API mode)');
      console.log('Network:', config.sui.network);
      console.log('Aggregator URL:', this.aggregatorUrl);
      console.log('Publisher URL:', this.publisherUrl);
      console.log('Storage Epochs:', config.walrus.storageEpochs);
    }
  }

  /**
   * Upload data to Walrus using upload relay pattern
   *
   * This method sends encrypted data to Walrus via the backend,
   * avoiding the need for ~2000 HTTP requests from the browser.
   * Metadata is stored alongside the data using an envelope format.
   *
   * @param data - Encrypted data to upload
   * @param metadata - Blob metadata
   * @returns Upload result with blob ID and commitment
   */
  async upload(data: Buffer, metadata: UploadMetadata): Promise<WalrusUploadResult> {
    try {
      if (debugConfig.walrus) {
        console.log('Uploading to Walrus via HTTP API');
        console.log('Data size:', data.length, 'bytes');
        console.log('Storage epochs:', config.walrus.storageEpochs);
      }

      // Validate file size
      if (data.length > config.walrus.maxFileSize) {
        throw new Error(
          `File size ${data.length} exceeds maximum allowed ${config.walrus.maxFileSize} bytes`
        );
      }

      // Create the full metadata object
      const fullMetadata: BlobMetadata = {
        ...metadata,
        encrypted: false, // This would be determined by encryption logic
        encryptionMode: 'client_encrypted', // This would be determined by encryption logic
        uploadedAt: new Date().toISOString(),
      };

      // Wrap data with metadata envelope
      const envelopedData = this.wrapWithMetadataEnvelope(data, fullMetadata);

      if (debugConfig.walrus) {
        console.log('Envelope size:', envelopedData.length, 'bytes');
        console.log('Metadata included:', JSON.stringify(fullMetadata).substring(0, 100) + '...');
      }

      // Upload using Walrus Publisher HTTP API
      // PUT /v1/blobs with epochs query parameter
      const url = `${this.publisherUrl}/v1/blobs?epochs=${config.walrus.storageEpochs}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(envelopedData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Walrus upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result: WalrusStoreResponse = await response.json();

      if (debugConfig.walrus) {
        console.log('Upload response:', JSON.stringify(result, null, 2));
      }

      // Extract blob ID and end epoch from response
      let blobId: string;
      let endEpoch: number;
      let commitment: string;

      if (result.newlyCreated) {
        blobId = result.newlyCreated.blobObject.blobId;
        endEpoch = result.newlyCreated.blobObject.storage.endEpoch;
        commitment = result.newlyCreated.blobObject.id;
      } else if (result.alreadyCertified) {
        blobId = result.alreadyCertified.blobId;
        endEpoch = result.alreadyCertified.endEpoch;
        commitment = `walrus:${blobId}`;
      } else {
        throw new Error('Unexpected response format from Walrus');
      }

      if (debugConfig.walrus) {
        console.log('Upload successful');
        console.log('Blob ID:', blobId);
        console.log('End Epoch:', endEpoch);
      }

      const uploadResult: WalrusUploadResult = {
        blobId,
        commitment,
        size: data.length, // Original data size (without envelope)
        uploadedAt: new Date().toISOString(),
        storageEpochs: config.walrus.storageEpochs,
        endEpoch,
      };

      return uploadResult;
    } catch (error) {
      console.error('Walrus upload failed:', error);
      throw new Error(
        `Failed to upload to Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Download data from Walrus with metadata extraction
   *
   * @param blobId - Blob ID to download
   * @returns Downloaded data and metadata
   */
  async download(blobId: string): Promise<WalrusDownloadResult> {
    try {
      if (debugConfig.walrus) {
        console.log('Downloading from Walrus with metadata via HTTP API');
        console.log('Blob ID:', blobId);
      }

      // Download using Walrus Aggregator HTTP API
      const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Blob not found: ${blobId}`);
        }
        const errorText = await response.text();
        throw new Error(`Walrus download failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (debugConfig.walrus) {
        console.log('Download successful');
        console.log('Raw data size:', buffer.length, 'bytes');
      }

      // Extract data and metadata from envelope
      const result = this.unwrapMetadataEnvelope(buffer);

      if (debugConfig.walrus) {
        console.log('Metadata extracted:', JSON.stringify(result.metadata).substring(0, 100) + '...');
        console.log('Actual data size:', result.data.length, 'bytes');
      }

      return result;
    } catch (error) {
      console.error('Walrus download with metadata failed:', error);
      throw new Error(
        `Failed to download from Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get blob metadata and status
   * Note: Limited information available via HTTP API
   *
   * @param blobId - Blob ID to query
   * @returns Blob information
   */
  async getBlobInfo(blobId: string): Promise<BlobInfo> {
    try {
      if (debugConfig.walrus) {
        console.log('Getting blob info via HTTP API');
        console.log('Blob ID:', blobId);
      }

      // Try to download the blob to get its size
      // This is a workaround since HTTP API doesn't have a dedicated info endpoint
      const url = `${this.aggregatorUrl}/v1/blobs/${blobId}`;
      const response = await fetch(url, { method: 'HEAD' });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Blob not found: ${blobId}`);
        }
        throw new Error(`Failed to get blob info: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength, 10) : 0;

      const blobInfo: BlobInfo = {
        blobId,
        size,
        commitment: `walrus:${blobId}`,
        uploadedAt: new Date().toISOString(), // Not available via HTTP API
        storageEpochs: config.walrus.storageEpochs,
        endEpoch: 0, // Not available via HTTP API
      };

      if (debugConfig.walrus) {
        console.log('Blob info retrieved');
        console.log('Size:', blobInfo.size, 'bytes');
      }

      return blobInfo;
    } catch (error) {
      console.error('Failed to get blob info:', error);
      throw new Error(
        `Failed to get blob info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Wrap data with metadata envelope
   *
   * Format: [4 bytes: metadata length (uint32 BE)][metadata JSON][actual data]
   *
   * @param data - The actual data to wrap
   * @param metadata - Metadata to include
   * @returns Enveloped data buffer
   */
  private wrapWithMetadataEnvelope(data: Buffer, metadata: BlobMetadata): Buffer {
    // Create envelope structure
    const envelope: WalrusMetadataEnvelope = {
      version: ENVELOPE_VERSION,
      metadata,
    };

    // Serialize metadata to JSON
    const metadataJson = JSON.stringify(envelope);
    const metadataBytes = Buffer.from(metadataJson, 'utf-8');

    // Create length prefix (4 bytes, big-endian)
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32BE(metadataBytes.length, 0);

    // Combine: [length][metadata][data]
    return Buffer.concat([lengthPrefix, metadataBytes, data]);
  }

  /**
   * Unwrap data from metadata envelope
   *
   * @param envelopedData - Data with metadata envelope
   * @returns Extracted data and metadata
   * @throws Error if envelope is invalid
   */
  private unwrapMetadataEnvelope(envelopedData: Buffer): WalrusDownloadResult {
    // Minimum size: 4 (length) + 2 (min JSON "{}") + 0 (empty data)
    if (envelopedData.length < 6) {
      throw new Error('Invalid envelope: data too small');
    }

    // Read metadata length from first 4 bytes
    const metadataLength = envelopedData.readUInt32BE(0);

    // Validate metadata length
    if (metadataLength > envelopedData.length - 4) {
      throw new Error('Invalid envelope: metadata length exceeds data size');
    }

    // Extract metadata JSON
    const metadataBytes = envelopedData.subarray(4, 4 + metadataLength);
    const metadataJson = metadataBytes.toString('utf-8');

    // Parse envelope
    let envelope: WalrusMetadataEnvelope;
    try {
      envelope = JSON.parse(metadataJson);
    } catch (error) {
      throw new Error('Invalid envelope: failed to parse metadata JSON');
    }

    // Validate envelope version
    if (envelope.version !== ENVELOPE_VERSION) {
      throw new Error(`Unsupported envelope version: ${envelope.version}`);
    }

    // Extract actual data
    const data = envelopedData.subarray(4 + metadataLength);

    return {
      data,
      metadata: envelope.metadata,
    };
  }

  /**
   * List all blobs for a deal by fetching metadata from each blob
   *
   * Note: This is a simplified implementation that assumes blob IDs are tracked elsewhere.
   * In production, blob IDs should be queried from on-chain Deal object.
   *
   * @param blobIds - Array of blob IDs to fetch metadata for
   * @returns Array of blob metadata
   */
  async listBlobsMetadata(blobIds: string[]): Promise<BlobMetadata[]> {
    const metadataList: BlobMetadata[] = [];

    for (const blobId of blobIds) {
      try {
        const result = await this.download(blobId);
        metadataList.push(result.metadata);
      } catch (error) {
        console.error(`Failed to fetch metadata for blob ${blobId}:`, error);
        // Continue with other blobs even if one fails
      }
    }

    return metadataList;
  }
}

/**
 * Singleton instance of WalrusService
 */
export const walrusService = new WalrusService();
