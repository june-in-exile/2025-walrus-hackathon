/**
 * Walrus and Seal Integration Types
 *
 * Defines TypeScript interfaces for Walrus storage and Seal encryption
 * operations in hybrid encryption mode.
 */

/**
 * Encryption mode for file upload/download
 * - client_encrypted: File is encrypted by frontend using Seal SDK (Web3 mode)
 * - server_encrypted: File is encrypted by backend (Convenience mode)
 */
export type EncryptionMode = 'client_encrypted' | 'server_encrypted';

/**
 * Data types supported for financial documents
 */
export type DataType =
  | 'revenue_journal'
  | 'ebitda_report'
  | 'expense_report'
  | 'balance_sheet'
  | 'cash_flow'
  | 'kpi_calculation'
  | 'audit_report'
  | 'custom';

/**
 * User roles in the earn-out deal
 */
export type UserRole = 'buyer' | 'seller' | 'auditor';

/**
 * Request payload for Walrus upload
 */
export interface WalrusUploadRequest {
  /** The file to upload (plaintext for server_encrypted, ciphertext for client_encrypted) */
  file: Buffer | Blob;
  /** Deal ID this file belongs to */
  dealId: string;
  /** Period ID this file belongs to */
  periodId: string;
  /** Type of financial data */
  dataType: DataType;
  /** Custom data type name (required if dataType is 'custom') */
  customDataType?: string;
  /** Original filename */
  filename: string;
  /** File description */
  description?: string;
  /** Encryption mode */
  mode: EncryptionMode;
}

/**
 * Metadata provided for a new upload.
 */
export interface UploadMetadata {
  filename: string;
  mimeType: string;
  description?: string;
  dealId: string;
  periodId: string;
  uploaderAddress: string;
  dataType: DataType;
  customDataType?: string;
}

/**
 * Metadata stored with the Walrus blob
 */
export interface BlobMetadata {
  filename: string;
  mimeType: string;
  description?: string;
  dealId: string;
  periodId: string;
  encrypted: boolean;
  encryptionMode?: EncryptionMode; // Optional: undefined for unencrypted uploads
  uploadedAt: string;
  uploaderAddress: string;
  dataType: DataType;
  customDataType?: string;
}

/**
 * Reference to a Walrus blob
 * Note: size is optional because it's not stored on-chain in the Move contract
 */
export interface BlobReference {
  blobId: string;
  dataType: DataType;
  uploadedAt: string;
  uploaderAddress: string;
  size?: number;
  metadata: BlobMetadata;
  /** Audit status information (optional, fetched from DataAuditRecord) */
  auditStatus?: {
    /** Whether this blob has been audited */
    audited: boolean;
    /** Auditor address (if audited) */
    auditor?: string;
    /** Audit timestamp in ms (if audited) */
    auditTimestamp?: number;
    /** Audit record object ID on Sui */
    auditRecordId?: string;
  };
}

/**
 * Encrypted data with Seal
 */
export interface EncryptedData {
  /** Encrypted file content */
  ciphertext: Buffer;
  /** Cryptographic commitment */
  commitment: string;
  /** Encryption metadata */
  encryptionMetadata: {
    algorithm: string;
    policyObjectId: string;
    timestamp: string;
  };
}

/**
 * Result of Walrus upload operation
 */
export interface WalrusUploadResult {
  /** Blob ID assigned by Walrus */
  blobId: string;
  /** Cryptographic commitment */
  commitment: string;
  /** Size of uploaded data in bytes */
  size: number;
  /** Upload timestamp */
  uploadedAt: string;
  /** Number of storage epochs */
  storageEpochs: number;
  /** End epoch for storage */
  endEpoch?: number;
}

/**
 * Complete response for upload endpoint
 */
export interface WalrusUploadResponse {
  /** Blob ID assigned by Walrus */
  blobId: string;
  /** Cryptographic commitment */
  commitment: string;
  /** Size of uploaded data in bytes */
  size: number;
  /** Upload timestamp */
  uploadedAt: string;
  /** Blob reference information */
  blobReference: BlobReference;
  /** Audit record info (populated after on-chain registration) */
  auditRecord?: {
    /** Audit record ID (available after transaction execution) */
    auditRecordId?: string;
    /** Whether the transaction includes audit record creation */
    willBeCreated: boolean;
  };
  /** Next step for frontend to complete */
  nextStep:
    | {
        action: 'register_on_chain';
        description: string;
        transaction: {
          /** Unsigned transaction bytes */
          txBytes: string;
          /** Human-readable description */
          description: string;
        };
      }
    | {
        action: 'create_deal';
        description: string;
        transaction: undefined;
      };
}

/**
 * Information about a stored blob
 */
export interface BlobInfo {
  blobId: string;
  size: number;
  commitment: string;
  uploadedAt: string;
  storageEpochs: number;
  endEpoch?: number;
  metadata?: BlobMetadata;
}

/**
 * Request for downloading a blob
 */
export interface WalrusDownloadRequest {
  /** Blob ID to download */
  blobId: string;
  /** Deal ID for authorization */
  dealId: string;
  /** Encryption mode (determines if backend decrypts) */
  mode: EncryptionMode;
  /** User's Sui address for authorization */
  userAddress: string;
}

/**
 * Configuration for Seal encryption
 */
export interface SealEncryptionConfig {
  /** Seal policy object ID on Sui blockchain */
  policyObjectId: string;
  /** Deal ID for access control */
  dealId: string;
  /** Period ID for context */
  periodId: string;
  /** List of authorized addresses */
  authorizedAddresses?: string[];
}

/**
 * Result of Seal encryption operation
 */
export interface SealEncryptionResult {
  /** Encrypted ciphertext */
  ciphertext: Buffer;
  /** Cryptographic commitment */
  commitment: string;
  /** Seal policy used */
  policyObjectId: string;
  /** Encryption timestamp */
  encryptedAt: string;
}

/**
 * Result of Seal decryption operation
 */
export interface SealDecryptionResult {
  /** Decrypted plaintext */
  plaintext: Buffer;
  /** Metadata from encryption */
  metadata: {
    policyObjectId: string;
    encryptedAt: string;
  };
}

/**
 * Access verification result
 */
export interface AccessVerificationResult {
  /** Whether user has access */
  hasAccess: boolean;
  /** User's role in the deal */
  role?: UserRole;
  /** Reason if access denied */
  reason?: string;
}

/**
 * Walrus metadata envelope format
 *
 * This format stores metadata alongside blob data in Walrus.
 * Structure: [4 bytes: metadata length (uint32 BE)][metadata JSON][actual data]
 */
export interface WalrusMetadataEnvelope {
  /** Version of the envelope format */
  version: number;
  /** Blob metadata */
  metadata: BlobMetadata;
}

/**
 * Result of downloading a blob with metadata
 */
export interface WalrusDownloadResult {
  /** The actual data (decrypted or encrypted based on mode) */
  data: Buffer;
  /** Metadata extracted from the envelope */
  metadata: BlobMetadata;
}

/**
 * Single blob item in deal blobs list
 */
export interface DealBlobItem {
  /** Walrus blob ID */
  blobId: string;
  /** Type of data stored */
  dataType: DataType;
  /** Period this blob belongs to */
  periodId: string;
  /** Upload timestamp */
  uploadedAt: string;
  /** Sui address of uploader */
  uploaderAddress: string;
  /** File size in bytes (optional, not stored on-chain) */
  size?: number;
  /** Detailed metadata */
  metadata: BlobMetadata;
  /** Relative URL to download this blob */
  downloadUrl: string;
  /** Audit status information */
  auditStatus?: {
    /** Whether this blob has been audited */
    audited: boolean;
    /** Auditor address (if audited) */
    auditor?: string;
    /** Audit timestamp in ms (if audited) */
    auditTimestamp?: number;
    /** Audit record object ID on Sui */
    auditRecordId?: string;
  };
}

/**
 * Response for deal blobs list endpoint
 */
export interface DealBlobsListResponse {
  /** Array of blob items */
  items: DealBlobItem[];
  /** Total number of blobs for this deal (after filtering) */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Seal policy information for decryption */
  sealPolicy?: {
    packageId: string;
    whitelistObjectId: string;
  };
}

/**
 * Query parameters for listing deal blobs
 */
export interface ListDealBlobsQuery {
  /** Filter by specific period (optional) */
  periodId?: string;
  /** Filter by data type (optional) */
  dataType?: DataType;
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  limit?: number;
}
