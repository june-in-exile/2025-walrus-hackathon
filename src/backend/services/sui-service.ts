/**
 * Sui Blockchain Service
 *
 * Handles interactions with Sui blockchain for querying on-chain data.
 */

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { config, debugConfig } from '@/src/shared/config/env';

/**
 * On-chain blob reference from Deal object
 * Note: periodId is derived from the parent Period struct, not from WalrusBlobRef itself
 */
export interface OnChainBlobReference {
  blobId: string;
  periodId: string;
  dataType: string;
  uploadedAt: string;
  uploaderAddress: string;
}

/**
 * Data Audit Record from blockchain
 */
export interface DataAuditRecord {
  id: string;
  dataId: string;           // Walrus blob ID
  dealId: string;           // Parent Deal ID
  periodId: string;         // Parent Period ID
  uploader: string;         // Uploader address
  uploadTimestamp: number;  // Upload timestamp (ms)
  audited: boolean;         // Audit status
  auditor?: string;         // Auditor address (optional)
  auditTimestamp?: number;  // Audit timestamp (optional)
}

/**
 * Sui Service for blockchain queries
 */
export class SuiService {
  private client: SuiClient;

  constructor() {
    const network = config.sui.network || 'testnet';
    this.client = new SuiClient({ url: getFullnodeUrl(network) });

    if (debugConfig.sui) {
      console.log('SuiService initialized');
      console.log('Network:', network);
    }
  }

  /**
   * Query all blob IDs registered for a deal
   *
   * This method fetches the Deal object from Sui blockchain and extracts
   * the list of Walrus blob IDs that have been registered via add_walrus_blob.
   *
   * Move struct hierarchy:
   *   Deal { periods: vector<Period> }
   *   Period { id: String, walrus_blobs: vector<WalrusBlobRef> }
   *   WalrusBlobRef { blob_id, data_type, uploaded_at, uploader }
   *
   * @param dealId - Deal object ID on Sui
   * @returns Array of blob IDs registered for this deal
   */
  async getDealBlobIds(dealId: string): Promise<string[]> {
    try {
      if (debugConfig.sui) {
        console.log('Querying blob IDs for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, cannot query on-chain blobs');
        return [];
      }

      // Fetch the Deal object from blockchain
      const dealObject = await this.client.getObject({
        id: dealId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!dealObject.data) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      const content = dealObject.data.content;
      if (!content || content.dataType !== 'moveObject') {
        throw new Error('Invalid Deal object structure');
      }

      const fields = content.fields as Record<string, unknown>;

      // Extract periods array from Deal
      // Move struct: Deal { periods: vector<Period> }
      const periods = fields.periods as Array<{
        fields?: {
          walrus_blobs?: Array<{ fields?: { blob_id?: string } }>;
        };
      }> | undefined;

      if (!periods || !Array.isArray(periods)) {
        if (debugConfig.sui) {
          console.log('No periods field found in Deal object, returning empty list');
        }
        return [];
      }

      // Extract blob IDs from all periods
      const blobIds: string[] = [];
      for (const period of periods) {
        const walrusBlobs = period.fields?.walrus_blobs;
        if (walrusBlobs && Array.isArray(walrusBlobs)) {
          for (const blob of walrusBlobs) {
            const blobId = blob.fields?.blob_id;
            if (blobId) {
              blobIds.push(blobId);
            }
          }
        }
      }

      if (debugConfig.sui) {
        console.log(`Found ${blobIds.length} blobs for deal ${dealId}`);
      }

      return blobIds;
    } catch (error) {
      console.error('Failed to query deal blob IDs:', error);
      throw new Error(
        `Failed to query on-chain blob data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query detailed blob references for a deal
   *
   * Returns full blob reference data including period, data type, etc.
   *
   * Move struct hierarchy:
   *   Deal { periods: vector<Period> }
   *   Period { id: String, walrus_blobs: vector<WalrusBlobRef> }
   *   WalrusBlobRef { blob_id, data_type, uploaded_at, uploader }
   *
   * @param dealId - Deal object ID on Sui
   * @returns Array of on-chain blob references
   */
  async getDealBlobReferences(dealId: string): Promise<OnChainBlobReference[]> {
    try {
      if (debugConfig.sui) {
        console.log('Querying all blob references for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, cannot query on-chain blobs');
        return [];
      }

      // Fetch the Deal object from blockchain
      const dealObject = await this.client.getObject({
        id: dealId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!dealObject.data) {
        throw new Error(`Deal not found: ${dealId}`);
      }

      const content = dealObject.data.content;
      if (!content || content.dataType !== 'moveObject') {
        throw new Error('Invalid Deal object structure');
      }

      const fields = content.fields as Record<string, unknown>;

      // Extract periods array from Deal
      // Move struct: Deal { periods: vector<Period> }
      const periods = fields.periods as Array<{
        fields?: {
          id?: string;
          walrus_blobs?: Array<{
            fields?: {
              blob_id?: string;
              data_type?: string;
              uploaded_at?: string;
              uploader?: string;
            };
          }>;
        };
      }> | undefined;

      if (!periods || !Array.isArray(periods)) {
        if (debugConfig.sui) {
          console.log('No periods field found in Deal object, returning empty list');
        }
        return [];
      }

      // Extract blob references from all periods
      const blobReferences: OnChainBlobReference[] = [];
      for (const period of periods) {
        const periodId = period.fields?.id || '';
        const walrusBlobs = period.fields?.walrus_blobs;

        if (walrusBlobs && Array.isArray(walrusBlobs)) {
          for (const blob of walrusBlobs) {
            const blobFields = blob.fields;
            if (blobFields) {
              blobReferences.push({
                blobId: blobFields.blob_id || '',
                periodId: periodId,  // Derived from parent Period
                dataType: blobFields.data_type || '',
                uploadedAt: blobFields.uploaded_at
                  ? new Date(parseInt(blobFields.uploaded_at)).toISOString()
                  : new Date().toISOString(),
                uploaderAddress: blobFields.uploader || '',
              });
            }
          }
        }
      }

      if (debugConfig.sui) {
        console.log(`Found ${blobReferences.length} blob references for deal ${dealId}`);
      }

      return blobReferences;
    } catch (error) {
      console.error('Failed to query deal blob references:', error);
      throw new Error(
        `Failed to query on-chain blob data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query all DataAuditRecord objects for a specific deal
   *
   * Uses Sui events to find all DataAuditRecordCreated events and fetches the objects
   *
   * @param dealId - Deal object ID
   * @returns Array of DataAuditRecord objects
   */
  async getDealAuditRecords(dealId: string): Promise<DataAuditRecord[]> {
    try {
      if (debugConfig.sui) {
        console.log('Querying audit records for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, cannot query audit records');
        return [];
      }

      // Query DataAuditRecordCreated events for this deal
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${config.earnout.packageId}::earnout::DataAuditRecordCreated`,
        },
        limit: 1000, // Adjust based on expected number of audit records
      });

      if (debugConfig.sui) {
        console.log(`Found ${events.data.length} DataAuditRecordCreated events`);
      }

      // Filter events for this deal and extract audit record IDs
      const auditRecordIds: string[] = [];
      for (const event of events.data) {
        const parsedJson = event.parsedJson as {
          audit_record_id?: string;
          deal_id?: string;
        };

        if (parsedJson.deal_id === dealId && parsedJson.audit_record_id) {
          auditRecordIds.push(parsedJson.audit_record_id);
        }
      }

      if (auditRecordIds.length === 0) {
        if (debugConfig.sui) {
          console.log('No audit records found for this deal');
        }
        return [];
      }

      // Fetch all audit record objects
      const auditRecords: DataAuditRecord[] = [];
      for (const recordId of auditRecordIds) {
        try {
          const obj = await this.client.getObject({
            id: recordId,
            options: {
              showContent: true,
            },
          });

          if (!obj.data) continue;

          const content = obj.data.content;
          if (!content || content.dataType !== 'moveObject') continue;

          const fields = content.fields as {
            data_id?: string;
            deal_id?: string;
            period_id?: string;
            uploader?: string;
            upload_timestamp?: string;
            audited?: boolean;
            auditor?: { vec?: string[] };
            audit_timestamp?: { vec?: string[] };
          };

          auditRecords.push({
            id: recordId,
            dataId: fields.data_id || '',
            dealId: fields.deal_id || '',
            periodId: fields.period_id || '',
            uploader: fields.uploader || '',
            uploadTimestamp: fields.upload_timestamp ? parseInt(fields.upload_timestamp) : 0,
            audited: fields.audited || false,
            auditor: fields.auditor?.vec?.[0],
            auditTimestamp: fields.audit_timestamp?.vec?.[0] ? parseInt(fields.audit_timestamp.vec[0]) : undefined,
          });
        } catch (error) {
          console.error(`Failed to fetch audit record ${recordId}:`, error);
          continue;
        }
      }

      if (debugConfig.sui) {
        console.log(`Retrieved ${auditRecords.length} audit records for deal ${dealId}`);
      }

      return auditRecords;
    } catch (error) {
      console.error('Failed to query audit records:', error);
      throw new Error(
        `Failed to query audit records: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query audit record for a specific blob
   *
   * @param dealId - Deal object ID
   * @param blobId - Blob ID (data_id in audit record)
   * @returns DataAuditRecord or null if not found
   */
  async getBlobAuditRecord(dealId: string, blobId: string): Promise<DataAuditRecord | null> {
    try {
      const auditRecords = await this.getDealAuditRecords(dealId);
      return auditRecords.find(record => record.dataId === blobId) || null;
    } catch (error) {
      console.error('Failed to query blob audit record:', error);
      return null;
    }
  }

  /**
   * Verify if user is a participant in a deal
   *
   * @param dealId - Deal object ID
   * @param userAddress - Sui address to verify
   * @returns Whether user is a participant (buyer/seller/auditor)
   */
  async verifyDealParticipant(dealId: string, userAddress: string): Promise<boolean> {
    try {
      if (debugConfig.sui) {
        console.log('Verifying deal participant:', userAddress, 'for deal:', dealId);
      }

      // Check if earnout package is configured
      if (!config.earnout.packageId) {
        console.warn('EARNOUT_PACKAGE_ID not configured, skipping participant verification');
        return true; // Allow access if not configured (development mode)
      }

      // Fetch the Deal object
      const dealObject = await this.client.getObject({
        id: dealId,
        options: {
          showContent: true,
        },
      });

      if (!dealObject.data) {
        return false;
      }

      const content = dealObject.data.content;
      if (!content || content.dataType !== 'moveObject') {
        return false;
      }

      const fields = content.fields as Record<string, unknown>;

      // Check if user is buyer, seller, or auditor
      const buyer = fields.buyer as string | undefined;
      const seller = fields.seller as string | undefined;
      const auditor = fields.auditor as string | undefined;

      const isParticipant =
        buyer === userAddress ||
        seller === userAddress ||
        auditor === userAddress;

      if (debugConfig.sui) {
        console.log('Participant verification result:', isParticipant);
      }

      return isParticipant;
    } catch (error) {
      console.error('Failed to verify deal participant:', error);
      // Return false on error for security
      return false;
    }
  }
}

/**
 * Singleton instance of SuiService
 */
export const suiService = new SuiService();
