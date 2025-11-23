/**
 * TEE Service for Nautilus Integration
 *
 * This service handles interaction with Nautilus TEE for KPI calculation
 * with cryptographic attestation.
 */

export interface KPIResult {
  kpi: number;
  change: number;
  file_type: string;
}

export interface TEEAttestation {
  kpi_value: number; // u64 representation (kpi * 1000)
  computation_hash: Uint8Array; // 32 bytes
  timestamp: number; // Unix timestamp in ms
  tee_public_key: Uint8Array; // 32 bytes
  signature: Uint8Array; // 64 bytes
}

export interface KPIResultWithAttestation {
  kpi_result: KPIResult;
  attestation: TEEAttestation;
  attestation_bytes: number[]; // 144 bytes for blockchain submission
}

export interface TEEServiceConfig {
  teeEndpoint?: string;
  programId?: string;
}

/**
 * TEE Service for computing KPI with cryptographic attestation
 */
export class TEEService {
  private teeEndpoint: string;
  private programId: string;

  constructor(config?: TEEServiceConfig) {
    // Use local backend API for testing, or external Nautilus TEE in production
    this.teeEndpoint = config?.teeEndpoint ||
      process.env.NEXT_PUBLIC_NAUTILUS_TEE_ENDPOINT ||
      '/api/v1/tee'; // Default to local backend API

    this.programId = config?.programId ||
      process.env.NEXT_PUBLIC_TEE_PROGRAM_ID ||
      'kpi_calculator_v1';
  }

  /**
   * Calculate cumulative KPI with TEE attestation
   *
   * @param documents - Array of decrypted financial documents
   * @returns KPI result with cryptographic attestation
   */
  async computeKPIWithAttestation(
    documents: any[]
  ): Promise<KPIResultWithAttestation> {
    try {
      // Call backend TEE API
      const response = await fetch(`${this.teeEndpoint}/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documents,
          operation: 'with_attestation',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `TEE computation failed: ${response.statusText}`
        );
      }

      const result = await response.json();

      // Check if response is successful
      if (!result.success || !result.data) {
        throw new Error(result.error || 'TEE computation failed');
      }

      // Parse TEE response
      return this.parseTEEResponse(result.data);
    } catch (error) {
      console.error('TEE service error:', error);
      throw new Error(
        `Failed to compute KPI with TEE: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse TEE response and convert to typed structure
   */
  private parseTEEResponse(response: any): KPIResultWithAttestation {
    const { kpi_result, attestation, attestation_bytes } = response;

    // Convert hex strings to Uint8Array
    const hexToUint8Array = (hex: string): Uint8Array => {
      const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
      return new Uint8Array(bytes);
    };

    return {
      kpi_result: {
        kpi: kpi_result.kpi,
        change: kpi_result.change,
        file_type: kpi_result.file_type,
      },
      attestation: {
        kpi_value: attestation.kpi_value,
        computation_hash: hexToUint8Array(attestation.computation_hash),
        timestamp: attestation.timestamp,
        tee_public_key: hexToUint8Array(attestation.tee_public_key),
        signature: hexToUint8Array(attestation.signature),
      },
      attestation_bytes: attestation_bytes,
    };
  }

  /**
   * Verify attestation locally (optional, for debugging)
   * Note: Real verification happens on-chain
   */
  async verifyAttestationLocally(
    attestation: TEEAttestation,
    expectedKPIValue: number
  ): Promise<boolean> {
    try {
      // Import verification library (e.g., tweetnacl or noble-ed25519)
      const nacl = await import('tweetnacl');

      // Build message: kpi_value || computation_hash || timestamp
      const message = new Uint8Array(8 + 32 + 8);
      const view = new DataView(message.buffer);

      // kpi_value (8 bytes, little-endian)
      view.setBigUint64(0, BigInt(attestation.kpi_value), true);

      // computation_hash (32 bytes)
      message.set(attestation.computation_hash, 8);

      // timestamp (8 bytes, little-endian)
      view.setBigUint64(40, BigInt(attestation.timestamp), true);

      // Verify signature
      const isValid = nacl.sign.detached.verify(
        message,
        attestation.signature,
        attestation.tee_public_key
      );

      // Check KPI value matches
      const expectedU64 = Math.round(expectedKPIValue * 1000);
      const kpiMatches = attestation.kpi_value === expectedU64;

      return isValid && kpiMatches;
    } catch (error) {
      console.error('Local attestation verification failed:', error);
      return false;
    }
  }
}

/**
 * Mock TEE Service for development/testing
 * Uses a simulated local computation instead of actual TEE
 */
export class MockTEEService extends TEEService {
  async computeKPIWithAttestation(
    documents: any[]
  ): Promise<KPIResultWithAttestation> {
    console.warn('Using MockTEEService - not suitable for production!');

    // Simulate KPI calculation
    let cumulativeKPI = 0;
    let lastFileType = 'Unknown';

    for (const doc of documents) {
      const { fileType, change } = this.processDocument(doc);
      cumulativeKPI += change;
      lastFileType = fileType;
    }

    // Generate mock attestation (WARNING: Not cryptographically secure!)
    const kpi_value_u64 = Math.round(cumulativeKPI * 1000);
    const computation_hash = new Uint8Array(32).fill(0); // Mock hash
    const timestamp = Date.now();
    const tee_public_key = new Uint8Array(32).fill(1); // Mock public key
    const signature = new Uint8Array(64).fill(2); // Mock signature

    // Build attestation bytes (144 bytes)
    const attestation_bytes = new Array(144).fill(0);
    const view = new DataView(new ArrayBuffer(144));

    // kpi_value (8 bytes, little-endian)
    view.setBigUint64(0, BigInt(kpi_value_u64), true);
    for (let i = 0; i < 8; i++) {
      attestation_bytes[i] = view.getUint8(i);
    }

    // computation_hash (32 bytes)
    for (let i = 0; i < 32; i++) {
      attestation_bytes[8 + i] = computation_hash[i];
    }

    // timestamp (8 bytes, little-endian)
    view.setBigUint64(40, BigInt(timestamp), true);
    for (let i = 0; i < 8; i++) {
      attestation_bytes[40 + i] = view.getUint8(40 + i);
    }

    // tee_public_key (32 bytes)
    for (let i = 0; i < 32; i++) {
      attestation_bytes[48 + i] = tee_public_key[i];
    }

    // signature (64 bytes)
    for (let i = 0; i < 64; i++) {
      attestation_bytes[80 + i] = signature[i];
    }

    return {
      kpi_result: {
        kpi: cumulativeKPI,
        change: cumulativeKPI,
        file_type: lastFileType,
      },
      attestation: {
        kpi_value: kpi_value_u64,
        computation_hash,
        timestamp,
        tee_public_key,
        signature,
      },
      attestation_bytes,
    };
  }

  private processDocument(doc: any): { fileType: string; change: number } {
    // Journal Entry
    if (doc.journalEntryId) {
      const credits = doc.credits || [];
      for (const credit of credits) {
        if (credit.account === 'Sales Revenue') {
          return { fileType: 'JournalEntry', change: credit.amount || 0 };
        }
      }
      return { fileType: 'JournalEntry', change: 0 };
    }

    // Fixed Assets
    if (doc.assetList && Array.isArray(doc.assetList)) {
      let totalDepreciation = 0;
      for (const asset of doc.assetList) {
        const cost = asset.originalCost || 0;
        const residual = asset.residualValue || 0;
        const life = asset.usefulLife_years || 1;
        const monthlyDep = (cost - residual) / (life * 12);
        totalDepreciation += monthlyDep;
      }
      return { fileType: 'FixedAssetsRegister', change: -totalDepreciation };
    }

    // Payroll
    if (doc.employeeDetails !== undefined) {
      const grossPay = doc.grossPay || 0;
      return { fileType: 'PayrollExpense', change: -grossPay };
    }

    // Overhead
    if (doc.reportTitle === 'Corporate Overhead Report') {
      const overhead = doc.totalOverheadCost || 0;
      return { fileType: 'OverheadReport', change: -(overhead * 0.1) };
    }

    return { fileType: 'Unknown', change: 0 };
  }
}

// Export factory function for easy instantiation
export function createTEEService(config?: TEEServiceConfig): TEEService {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_TEE === 'true';

  if (useMock) {
    console.warn('Creating MockTEEService - only use for development!');
    return new MockTEEService(config);
  }

  return new TEEService(config);
}
