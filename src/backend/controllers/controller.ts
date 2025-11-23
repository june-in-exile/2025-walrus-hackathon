/**
 * Walrus Controller
 *
 * Handles HTTP requests for Walrus file upload and download operations.
 * Orchestrates between Seal encryption, Walrus storage, and Sui services.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Transaction } from '@mysten/sui/transactions';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { toHex } from '@mysten/sui/utils';
import { sealService } from '@/src/backend/services/seal-service';
import { walrusService } from '@/src/backend/services/walrus-service';
import { suiService } from '@/src/backend/services/sui-service';
import { config } from '@/src/shared/config/env';
import jwt from 'jsonwebtoken';
import {
  authenticateWriteOperation,
  createAuthErrorResponse,
} from '@/src/backend/middleware/auth';

import type {
  EncryptionMode,
  WalrusUploadResponse,
  BlobMetadata,
  DataType,
  DealBlobsListResponse,
  ListDealBlobsQuery,
  DealBlobItem,
} from '@/src/shared/types/walrus';
import type { DealEncryptionConfig } from '@/src/backend/services/seal-service';

/**
 * Walrus Controller for file operations
 */
export class WalrusController {
  private suiClient: SuiClient;

  constructor() {
    this.suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
  }

  /**
   * Build transaction bytes for registering a Walrus blob on-chain
   * Also creates a DataAuditRecord for auditor verification
   *
   * @param dealId - Deal object ID
   * @param blobId - Walrus blob ID
   * @param periodId - Period identifier
   * @param dataType - Type of data stored
   * @param size - File size in bytes
   * @param uploaderAddress - Address of the uploader
   * @returns Object with hex-encoded transaction bytes and audit record creation flag
   */
  private async buildRegisterBlobTxBytes(
    dealId: string,
    blobId: string,
    periodId: string,
    dataType: string,
    uploaderAddress: string
  ): Promise<{ txBytes: string; includesAuditRecord: boolean }> {
    // Check if earnout package is configured
    if (!config.earnout.packageId) {
      console.warn('EARNOUT_PACKAGE_ID not configured, skipping transaction generation');
      return { txBytes: '', includesAuditRecord: false };
    }

    try {
      // Verify deal parameters are locked before proceeding
      const deal = await suiService.getDeal(dealId);
      if (!deal) {
        throw new Error(`Deal with ID ${dealId} not found.`);
      }
      if (!deal.parametersLocked) {
        throw new Error('Deal parameters have not been set. Please complete deal setup before uploading documents.');
      }

      const tx = new Transaction();

      // Get the shared Clock object (0x6 is the standard Sui Clock object ID)
      const clock = tx.object('0x6');

      // Call the add_walrus_blob function on the earnout module                          
      // This function automatically creates a DataAuditRecord via create_audit_record_internal
      //                                                                                  
      // Contract function signature:                                                     
      // public fun add_walrus_blob(                                                      
      //   deal: &mut Deal,                                                               
      //   subperiod_id: String,                                                          
      //   blob_id: String,                                                               
      //   data_type: String,                                                             
      //   clock: &Clock,                                                                 
      //   ctx: &mut TxContext                                                            
      // )                                                                                
      tx.moveCall({
        target: `${config.earnout.packageId}::earnout::add_walrus_blob`,
        arguments: [
          tx.object(dealId),
          tx.pure.string(periodId), // Pass the string ID directly                        
          tx.pure.string(blobId),
          tx.pure.string(dataType),
          clock,
        ],
      });

      // Note: We don't need to call create_audit_record separately
      // It's automatically created by add_walrus_blob via create_audit_record_internal

      // Set sender for gas estimation
      tx.setSender(uploaderAddress);

      // Build transaction bytes (for frontend to sign)
      const txBytes = await tx.build({ client: this.suiClient });

      return { txBytes: toHex(txBytes), includesAuditRecord: true };
    } catch (error) {
      console.error('Failed to build register blob transaction:', error);
      throw error; // Re-throw the error to be caught by the calling handler
    }
  }

  /**
   * Handle file upload with hybrid encryption mode
   *
   * Authentication is handled by the route layer before calling this method.
   *
   * @param formData - FormData containing file and metadata
   * @param userAddress - Authenticated user's Sui wallet address
   * @param mode - Encryption mode (client_encrypted or server_encrypted)
   * @param isPendingDeal - Whether this is a pending deal upload (no on-chain registration)
   * @returns Upload response
   */
  async handleUpload(
    formData: FormData,
    userAddress: string,
    mode: EncryptionMode,
    isPendingDeal: boolean
  ): Promise<NextResponse> {
    try {
      // Extract form data fields
      const file = formData.get('file') as File | null;
      const dealId = formData.get('dealId') as string;
      const periodId = formData.get('periodId') as string;
      const dataType = formData.get('dataType') as string;
      const filename = formData.get('filename') as string;
      const description = formData.get('description') as string | null;
      const customDataType = formData.get('customDataType') as string | null;

      // Validate required fields
      if (!file) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'File is required',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      if (!dealId || !periodId || !dataType) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'dealId, periodId, and dataType are required',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      // Convert file to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // Check file size
      if (fileBuffer.length > config.walrus.maxFileSize) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: `File size exceeds maximum allowed (${config.walrus.maxFileSize} bytes)`,
            statusCode: 400,
            details: {
              maxSize: config.walrus.maxFileSize,
              actualSize: fileBuffer.length,
            },
          },
          { status: 400 }
        );
      }

      // Prepare blob metadata
      const metadata: BlobMetadata = {
        filename: filename || file.name,
        mimeType: file.type || 'application/octet-stream',
        description: description || undefined,
        dealId,
        periodId,
        encrypted: !isPendingDeal, // Don't encrypt pending deals (e.g., M&A agreements)
        encryptionMode: isPendingDeal ? undefined : mode,
        uploadedAt: new Date().toISOString(),
        uploaderAddress: userAddress,
        dataType: dataType as DataType,
        customDataType: customDataType || undefined,
      };

      // Process based on encryption mode and deal status
      let dataToUpload: Buffer;

      if (isPendingDeal) {
        // Pending deal: Upload plaintext (no encryption needed for M&A agreement)
        dataToUpload = fileBuffer;
        console.log('Pending deal upload: No encryption applied');
        console.log('File size:', dataToUpload.length, 'bytes');
      } else if (mode === 'server_encrypted') {
        // Server-side encryption mode (for existing deals only)
        if (!config.app.enableServerEncryption) {
          return NextResponse.json(
            {
              error: 'ForbiddenError',
              message: 'Server-side encryption is disabled',
              statusCode: 403,
            },
            { status: 403 }
          );
        }

        // Validate required config
        if (!config.earnout.packageId) {
          return NextResponse.json(
            {
              error: 'ConfigurationError',
              message: 'Seal configuration is incomplete',
              statusCode: 500,
              details: {
                reason: 'EARNOUT_PACKAGE_ID must be set for server-side encryption',
              },
            },
            { status: 500 }
          );
        }

        // Encrypt file using Seal with Deal-based access control
        const encryptionConfig: DealEncryptionConfig = {
          dealId,
          packageId: config.earnout.packageId,
        };

        const encryptionResult = await sealService.encrypt(fileBuffer, encryptionConfig);
        dataToUpload = encryptionResult.ciphertext;

        console.log('Server-side encryption completed');
        console.log('Original size:', fileBuffer.length, 'bytes');
        console.log('Encrypted size:', dataToUpload.length, 'bytes');
      } else {
        // Client-side encryption mode (default)
        // File should already be encrypted by frontend
        dataToUpload = fileBuffer;
        console.log('Client-encrypted file received');
        console.log('Ciphertext size:', dataToUpload.length, 'bytes');
      }

      // Upload to Walrus
      const uploadResult = await walrusService.upload(dataToUpload, metadata);

      // Build transaction bytes for on-chain registration (includes audit record creation)
      // Skip for pending deals (will be registered later when deal is created)
      let txBytes = '';
      let includesAuditRecord = false;

      if (!isPendingDeal) {
        const result = await this.buildRegisterBlobTxBytes(
          dealId,
          uploadResult.blobId,
          periodId,
          dataType,
          userAddress
        );
        txBytes = result.txBytes;
        includesAuditRecord = result.includesAuditRecord;
      }

      // Build response
      const response: WalrusUploadResponse = {
        blobId: uploadResult.blobId,
        commitment: uploadResult.commitment,
        size: uploadResult.size,
        uploadedAt: uploadResult.uploadedAt,
        blobReference: {
          blobId: uploadResult.blobId,
          dataType: metadata.dataType,
          uploadedAt: uploadResult.uploadedAt,
          uploaderAddress: userAddress,
          size: uploadResult.size,
          metadata,
        },
        auditRecord: {
          willBeCreated: includesAuditRecord,
          // auditRecordId will be available after transaction execution
          // Frontend should extract it from transaction effects
        },
        nextStep: isPendingDeal
          ? {
              action: 'create_deal',
              description: 'This blob will be registered when you create the deal with this agreementBlobId',
              transaction: undefined,
            }
          : {
              action: 'register_on_chain',
              description: includesAuditRecord
                ? 'Sign transaction to register this blob and create audit record on-chain'
                : 'Sign transaction to register this blob on-chain',
              transaction: {
                txBytes,
                description: includesAuditRecord
                  ? `Register Walrus blob and create audit record: ${dataType} for ${periodId}`
                  : `Register Walrus blob: ${dataType} for ${periodId}`,
              },
            },
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Upload failed:', error);
      return NextResponse.json(
        {
          error: 'WalrusUploadError',
          message: 'Failed to upload file to Walrus network',
          statusCode: 500,
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 }
      );
    }
  }

  /**
   * Handle file download - always returns ciphertext for frontend decryption
   *
   * Authentication is handled by the route layer before calling this method.
   *
   * @param blobId - Blob ID to download
   * @param dealId - Deal ID for authorization
   * @param userAddress - Authenticated user's Sui wallet address
   * @returns Downloaded encrypted file with Seal policy headers
   */
  async handleDownload(
    blobId: string,
    dealId: string,
    userAddress: string
  ): Promise<NextResponse> {
    try {
      // Validate parameters
      if (!dealId) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'dealId query parameter is required',
            statusCode: 400,
          },
          { status: 400 }
        );
      }

      // Note: dealId is used as whitelistObjectId for access control
      // In the current design, each deal has an associated whitelist
      const whitelistObjectId = dealId;

      // Verify user has access to this blob (is on whitelist)
      const accessResult = await sealService.verifyAccess(whitelistObjectId, userAddress);

      if (!accessResult.hasAccess) {
        return NextResponse.json(
          {
            error: 'ForbiddenError',
            message: 'User is not authorized to access this blob',
            statusCode: 403,
            details: {
              reason: accessResult.reason,
              userAddress,
              whitelistObjectId,
            },
          },
          { status: 403 }
        );
      }

      // Download from Walrus with metadata
      const downloadResult = await walrusService.download(blobId);
      const encryptedData = downloadResult.data;
      const blobMetadata = downloadResult.metadata;

      // Always return ciphertext for frontend decryption
      // Frontend will use Seal SDK to decrypt with proper access control
      const dataToReturn: Buffer = encryptedData;

      console.log('Returning encrypted data for client-side decryption');
      console.log('Ciphertext size:', dataToReturn.length, 'bytes');

      // Build response headers with metadata
      const headers: Record<string, string> = {
        'Content-Type': blobMetadata.mimeType || 'application/octet-stream',
        'Content-Length': dataToReturn.length.toString(),
        'X-Blob-Id': blobId,
        'X-Original-Encryption-Mode': blobMetadata.encryptionMode || 'none', // How it was encrypted during upload
        'X-Data-Type': blobMetadata.dataType,
        'X-Period-Id': blobMetadata.periodId,
        'X-Uploaded-At': blobMetadata.uploadedAt,
        'X-Uploader-Address': blobMetadata.uploaderAddress,
      };

      // Add Seal policy information for client-side decryption
      // Frontend needs these to decrypt using Seal SDK
      if (config.earnout.packageId) {
        headers['X-Seal-Package-Id'] = config.earnout.packageId;
        headers['X-Seal-Whitelist-Id'] = whitelistObjectId; // dealId
      }

      // Add filename header if available
      if (blobMetadata.filename) {
        // RFC 5987 encoding for non-ASCII filenames
        const encodedFilename = encodeURIComponent(blobMetadata.filename);
        headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodedFilename}`;
        headers['X-Filename'] = blobMetadata.filename;
      }

      // Add optional metadata headers
      if (blobMetadata.description) {
        headers['X-Description'] = blobMetadata.description;
      }
      if (blobMetadata.customDataType) {
        headers['X-Custom-Data-Type'] = blobMetadata.customDataType;
      }

      // Return binary data with metadata headers
      // Convert Buffer to Uint8Array for proper Blob compatibility
      const dataArray = new Uint8Array(dataToReturn);
      return new NextResponse(new Blob([dataArray]), {
        status: 200,
        headers,
      });
    } catch (error) {
      console.error('Download failed:', error);

      // Check if it's a not found error
      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'NotFoundError',
            message: 'Blob not found on Walrus network',
            statusCode: 404,
            details: {
              blobId,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'WalrusDownloadError',
          message: 'Failed to download blob from Walrus network',
          statusCode: 500,
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 }
      );
    }
  }

  /**
   * Handle listing all blobs for a deal
   *
   * @param request - NextRequest
   * @param dealId - Deal ID to query blobs for
   * @param query - Query parameters (filters, pagination)
   * @returns List of blobs with metadata
   */
  async handleListDealBlobs(
    request: NextRequest,
    dealId: string,
    query: ListDealBlobsQuery
  ): Promise<NextResponse> {
    try {
      // --- JWT Authentication ---
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          {
            error: 'UnauthorizedError',
            message: 'Missing or invalid Authorization header. Please login first.',
            statusCode: 401,
          },
          { status: 401 }
        );
      }

      const token = authHeader.split(' ')[1];
      let payload: jwt.JwtPayload;

      try {
        payload = jwt.verify(token, config.app.jwtSecret) as jwt.JwtPayload;
      } catch (error) {
        return NextResponse.json(
          {
            error: 'UnauthorizedError',
            message: 'Invalid or expired token.',
            statusCode: 401,
          },
          { status: 401 }
        );
      }

      const userAddress = payload.sub;
      if (!userAddress) {
        return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
      }

      // Verify user is a participant in the deal
      const isParticipant = await suiService.verifyDealParticipant(dealId, userAddress);
      if (!isParticipant) {
        return NextResponse.json(
          {
            error: 'ForbiddenError',
            message: 'User is not authorized to view blobs for this deal',
            statusCode: 403,
            details: {
              reason: 'User is not a participant in this deal',
              userAddress,
              dealId,
            },
          },
          { status: 403 }
        );
      }

      // Query on-chain blob references
      const onChainBlobs = await suiService.getDealBlobReferences(dealId);

      if (onChainBlobs.length === 0) {
        // No blobs registered for this deal
        return NextResponse.json({
          items: [],
          total: 0,
          page: query.page || 1,
          limit: query.limit || 50,
          totalPages: 0,
          sealPolicy: config.earnout.packageId ? {
            packageId: config.earnout.packageId,
            whitelistObjectId: dealId,
          } : undefined,
        } as DealBlobsListResponse, { status: 200 });
      }

      // Fetch audit records for this deal
      const auditRecords = await suiService.getDealAuditRecords(dealId);

      // Create audit record map for quick lookup
      const auditRecordMap = new Map<string, typeof auditRecords[0]>();
      auditRecords.forEach(record => {
        auditRecordMap.set(record.dataId, record);
      });

      // Fetch metadata from Walrus for each blob
      const blobIds = onChainBlobs.map(blob => blob.blobId);
      const walrusMetadata = await walrusService.listBlobsMetadata(blobIds);

      // Create a map for quick lookup
      const metadataMap = new Map<string, BlobMetadata>();
      walrusMetadata.forEach(metadata => {
        // Use blobId from on-chain data or metadata
        const blobId = onChainBlobs.find(
          blob => blob.periodId === metadata.periodId && blob.dataType === metadata.dataType
        )?.blobId;
        if (blobId) {
          metadataMap.set(blobId, metadata);
        }
      });

      // Combine on-chain, Walrus, and audit data
      let items: DealBlobItem[] = onChainBlobs.map(onChainBlob => {
        const auditRecord = auditRecordMap.get(onChainBlob.blobId);
        const metadata = metadataMap.get(onChainBlob.blobId);

        return {
          blobId: onChainBlob.blobId,
          dataType: (metadata?.dataType || onChainBlob.dataType) as DataType,
          periodId: metadata?.periodId || onChainBlob.periodId,
          uploadedAt: metadata?.uploadedAt || onChainBlob.uploadedAt,
          uploaderAddress: metadata?.uploaderAddress || onChainBlob.uploaderAddress,
          // size is not stored on-chain, omit it
          metadata: metadata || {
            filename: 'unknown',
            mimeType: 'application/octet-stream',
            dealId,
            periodId: onChainBlob.periodId,
            encrypted: true,
            encryptionMode: 'client_encrypted' as EncryptionMode,
            uploadedAt: onChainBlob.uploadedAt,
            uploaderAddress: onChainBlob.uploaderAddress,
            dataType: onChainBlob.dataType as DataType,
          },
          downloadUrl: `/api/v1/walrus/download/${onChainBlob.blobId}?dealId=${dealId}`,
          auditStatus: auditRecord ? {
            audited: auditRecord.audited,
            auditor: auditRecord.auditor,
            auditTimestamp: auditRecord.auditTimestamp,
            auditRecordId: auditRecord.id,
          } : undefined,
        };
      });

      // Apply filters
      if (query.periodId) {
        items = items.filter(item => item.periodId === query.periodId);
      }
      if (query.dataType) {
        items = items.filter(item => item.dataType === query.dataType);
      }

      // Calculate pagination
      const page = query.page || 1;
      const limit = Math.min(query.limit || 50, 100); // Max 100 items per page
      const total = items.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      // Apply pagination
      const paginatedItems = items.slice(startIndex, endIndex);

      const response: DealBlobsListResponse = {
        items: paginatedItems,
        total,
        page,
        limit,
        totalPages,
        sealPolicy: config.earnout.packageId ? {
          packageId: config.earnout.packageId,
          whitelistObjectId: dealId,
        } : undefined,
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('List deal blobs failed:', error);

      // Check if it's a not found error
      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'NotFoundError',
            message: 'Deal not found',
            statusCode: 404,
            details: {
              dealId,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'ServerError',
          message: 'Failed to retrieve blob list',
          statusCode: 500,
          details: {
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 }
      );
    }
  }

  /**
   * Build transaction bytes for submitting KPI result from Nautilus TEE
   *
   * @param dealId - Deal object ID on Sui
   * @param periodIndex - Index of the period in the deal
   * @param kpiType - Type of KPI (e.g., "revenue", "ebitda")
   * @param kpiValue - Calculated KPI value
   * @param attestation - Nautilus TEE attestation (base64 encoded)
   * @param userAddress - Sui address of transaction sender (must be buyer)
   * @returns Transaction bytes and metadata
   */
  async buildSubmitKPIResultTxBytes(
    dealId: string,
    periodIndex: number,
    kpiType: string,
    kpiValue: number,
    attestation: string,
    userAddress: string
  ): Promise<{ txBytes: string; digest: string }> {
    try {
      if (!config.earnout.packageId) {
        throw new Error('EARNOUT_PACKAGE_ID not configured');
      }

      // Decode base64 attestation to bytes
      const attestationBytes = Buffer.from(attestation, 'base64');

      // Get all audit records for verification
      // Note: In production, we should query audit records from blockchain
      // For now, we pass an empty vector and rely on on-chain verification
      const auditRecordsVector: never[] = [];

      // Build transaction
      const tx = new Transaction();

      // Get Sui Clock object
      const clock = tx.object('0x6');

      // Call submit_kpi_result function
      tx.moveCall({
        target: `${config.earnout.packageId}::earnout::submit_kpi_result`,
        arguments: [
          tx.object(dealId),
          tx.pure.u64(periodIndex),
          tx.pure.string(kpiType),
          tx.pure.u64(kpiValue),
          tx.pure.vector('u8', Array.from(attestationBytes)),
          tx.pure.vector('u8', auditRecordsVector), // Empty vector for now
          clock,
        ],
      });

      // Set sender and build transaction bytes
      tx.setSender(userAddress);

      const txBytes = await tx.build({ client: this.suiClient });
      const digest = await tx.getDigest({ client: this.suiClient });

      return {
        txBytes: Buffer.from(txBytes).toString('base64'),
        digest,
      };
    } catch (error) {
      console.error('Failed to build submit KPI result transaction:', error);
      throw new Error(
        `Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle Nautilus KPI calculation request
   *
   * This endpoint triggers a mock KPI calculation and returns transaction bytes
   * for submitting the result on-chain.
   *
   * In production, this should:
   * 1. Call Nautilus TEE to perform secure calculation
   * 2. Receive attestation from TEE
   * 3. Build transaction for on-chain submission
   *
   * @param req - HTTP request with dealId and periodId
   * @returns Transaction bytes for submitting KPI result
   */
  async handleCalculateKPI(req: NextRequest): Promise<NextResponse> {
    try {
      // Parse request body
      const body = await req.json();
      const { dealId, periodIndex, kpiType = 'revenue' } = body;

      // Validate required fields
      if (!dealId || periodIndex === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: dealId, periodIndex' },
          { status: 400 }
        );
      }

      // Authenticate: Level 2 (Write operation - returns unsigned transaction)
      const authResult = authenticateWriteOperation(req);
      if (!authResult.authenticated) {
        return NextResponse.json(
          createAuthErrorResponse(authResult),
          { status: authResult.errorCode || 401 }
        );
      }

      const userAddress = authResult.address!;

      // TODO: In production, call Nautilus TEE to perform actual calculation
      // For now, return mock calculation result

      // Mock KPI calculation
      const mockKPIValue = 1000000; // Example: $1M revenue
      const mockAttestation = Buffer.from(
        JSON.stringify({
          enclaveId: 'mock-enclave-id',
          timestamp: Date.now(),
          dealId,
          periodIndex,
          kpiType,
          kpiValue: mockKPIValue,
        })
      ).toString('base64');

      // Build transaction for submitting KPI result
      const { txBytes, digest } = await this.buildSubmitKPIResultTxBytes(
        dealId,
        periodIndex,
        kpiType,
        mockKPIValue,
        mockAttestation,
        userAddress
      );

      return NextResponse.json({
        kpiValue: mockKPIValue,
        kpiType,
        attestation: mockAttestation,
        computedAt: Date.now(),
        nextStep: {
          action: 'submit_kpi_result',
          description: 'Sign and execute transaction to submit KPI result on-chain',
          transaction: {
            txBytes,
            digest,
            description: `Submit ${kpiType} KPI result: ${mockKPIValue}`,
          },
        },
      });
    } catch (error) {
      console.error('KPI calculation failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to calculate KPI',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }
}

/**
 * Singleton instance of WalrusController
 */
export const walrusController = new WalrusController();
