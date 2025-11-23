/**
 * KPI Calculation Service
 *
 * Backend implementation of KPI calculation logic, matching the Rust version
 * in nautilus/kpi_calculator.rs. This service can be used for testing before
 * deploying to actual Nautilus TEE.
 *
 * @module kpi-calculation-service
 */

import crypto from 'crypto';

// --- Type Definitions ---

export interface KPIResult {
  kpi: number;
  change: number;
  file_type: string;
}

export interface TEEAttestation {
  kpi_value: number; // u64 representation (kpi * 1000)
  computation_hash: Buffer; // 32 bytes
  timestamp: number; // Unix timestamp in ms
  tee_public_key: Buffer; // 32 bytes
  signature: Buffer; // 64 bytes
}

export interface KPIResultWithAttestation {
  kpi_result: KPIResult;
  attestation: TEEAttestation;
  attestation_bytes: number[]; // 144 bytes for blockchain submission
}

// --- Document Type Identification ---

type FileType =
  | 'JournalEntry'
  | 'FixedAssetsRegister'
  | 'PayrollExpense'
  | 'OverheadReport'
  | 'Unknown';

/**
 * Identify the type of financial document based on its structure
 */
function identifyFileType(data: any): FileType {
  // Journal Entry: has journalEntryId
  if (data.journalEntryId !== undefined) {
    return 'JournalEntry';
  }

  // Fixed Assets Register: has assetList with assetID
  if (
    Array.isArray(data.assetList) &&
    data.assetList.length > 0 &&
    data.assetList[0].assetID !== undefined
  ) {
    return 'FixedAssetsRegister';
  }

  // Payroll Expense: has employeeDetails
  if (data.employeeDetails !== undefined) {
    return 'PayrollExpense';
  }

  // Overhead Report: reportTitle equals "Corporate Overhead Report"
  if (data.reportTitle === 'Corporate Overhead Report') {
    return 'OverheadReport';
  }

  return 'Unknown';
}

// --- Document Processing Functions ---

/**
 * Process Journal Entry: Extract Sales Revenue from credits
 */
function processJournalEntry(data: any): number {
  const credits = data.credits || [];

  for (const credit of credits) {
    if (credit.account === 'Sales Revenue') {
      return Number(credit.amount) || 0;
    }
  }

  return 0;
}

/**
 * Process Fixed Assets Register: Calculate total monthly depreciation
 */
function processFixedAssets(data: any): number {
  const assetList = data.assetList || [];
  let totalDepreciation = 0;

  for (const asset of assetList) {
    const originalCost = Number(asset.originalCost) || 0;
    const residualValue = Number(asset.residualValue) || 0;
    const usefulLifeYears = Number(asset.usefulLife_years) || 1;

    // Monthly depreciation = (cost - residual) / (life_years * 12)
    const monthlyDepreciation =
      (originalCost - residualValue) / (usefulLifeYears * 12);
    totalDepreciation += monthlyDepreciation;
  }

  // Depreciation is a negative impact on KPI
  return -totalDepreciation;
}

/**
 * Process Payroll Expense: Extract gross pay as negative KPI impact
 */
function processPayroll(data: any): number {
  const grossPay = Number(data.grossPay) || 0;
  // Payroll is an expense, negative impact
  return -grossPay;
}

/**
 * Process Overhead Report: Calculate 10% allocation as negative KPI impact
 */
function processOverhead(data: any): number {
  const totalOverheadCost = Number(data.totalOverheadCost) || 0;
  // 10% allocation of overhead cost
  return -(totalOverheadCost * 0.1);
}

/**
 * Process a single document and return KPI change
 */
function processDocument(document: any): { fileType: FileType; change: number } {
  const fileType = identifyFileType(document);
  let change = 0;

  switch (fileType) {
    case 'JournalEntry':
      change = processJournalEntry(document);
      break;
    case 'FixedAssetsRegister':
      change = processFixedAssets(document);
      break;
    case 'PayrollExpense':
      change = processPayroll(document);
      break;
    case 'OverheadReport':
      change = processOverhead(document);
      break;
    default:
      change = 0;
  }

  return { fileType, change };
}

// --- KPI Calculation ---

/**
 * Calculate cumulative KPI from multiple documents (simplified version)
 *
 * This matches the legacy `calculate_kpi` function in kpi_calculator.rs
 */
export function calculateKPI(
  documents: any[],
  initialKPI: number = 0
): KPIResult {
  let cumulativeKPI = initialKPI;
  let lastFileType: FileType = 'Unknown';

  for (const document of documents) {
    const { fileType, change } = processDocument(document);
    cumulativeKPI += change;
    lastFileType = fileType;
  }

  return {
    kpi: cumulativeKPI,
    change: cumulativeKPI - initialKPI,
    file_type: lastFileType,
  };
}

// --- TEE Attestation Generation (Mock) ---

/**
 * Calculate SHA-256 hash of input documents
 */
function calculateDocumentsHash(documentsJSON: string): Buffer {
  return crypto.createHash('sha256').update(documentsJSON).digest();
}

/**
 * Generate mock TEE attestation for testing
 *
 * WARNING: This is NOT cryptographically secure! Only use for testing.
 * In production, use actual Nautilus TEE with hardware-backed keys.
 */
export function calculateKPIWithMockAttestation(
  documents: any[],
  mockPrivateKey?: Buffer
): KPIResultWithAttestation {
  // Calculate KPI
  const kpiResult = calculateKPI(documents, 0);

  // Calculate documents hash
  const documentsJSON = JSON.stringify(documents);
  const computationHash = calculateDocumentsHash(documentsJSON);

  // Get current timestamp
  const timestamp = Date.now();

  // Convert KPI to u64 (multiply by 1000 to preserve 3 decimals)
  const kpiValueU64 = Math.round(kpiResult.kpi * 1000);

  // Generate or use provided mock keypair
  let teePrivateKey: Buffer;
  let teePublicKey: Buffer;

  if (mockPrivateKey && mockPrivateKey.length === 32) {
    teePrivateKey = mockPrivateKey;
    // For Ed25519, public key is derived from private key
    // In a real implementation, use a proper Ed25519 library
    // For now, we'll use a deterministic mock
    teePublicKey = crypto
      .createHash('sha256')
      .update(teePrivateKey)
      .digest()
      .subarray(0, 32);
  } else {
    // Generate random mock keys
    teePrivateKey = crypto.randomBytes(32);
    teePublicKey = crypto.randomBytes(32);
  }

  // Build message to sign: kpi_value || computation_hash || timestamp
  const message = Buffer.allocUnsafe(8 + 32 + 8);
  message.writeBigUInt64LE(BigInt(kpiValueU64), 0);
  computationHash.copy(message, 8);
  message.writeBigUInt64LE(BigInt(timestamp), 40);

  // Generate mock signature (HMAC-SHA512 as placeholder)
  // In real TEE, this would be Ed25519 signature
  const signature = crypto
    .createHmac('sha512', teePrivateKey)
    .update(message)
    .digest()
    .subarray(0, 64);

  // Create attestation
  const attestation: TEEAttestation = {
    kpi_value: kpiValueU64,
    computation_hash: computationHash,
    timestamp,
    tee_public_key: teePublicKey,
    signature,
  };

  // Serialize to bytes (144 bytes total)
  const attestationBytes = serializeAttestation(attestation);

  return {
    kpi_result: kpiResult,
    attestation,
    attestation_bytes: attestationBytes,
  };
}

/**
 * Serialize attestation to 144-byte array
 */
function serializeAttestation(attestation: TEEAttestation): number[] {
  const buffer = Buffer.allocUnsafe(144);

  // kpi_value (8 bytes, little-endian)
  buffer.writeBigUInt64LE(BigInt(attestation.kpi_value), 0);

  // computation_hash (32 bytes)
  attestation.computation_hash.copy(buffer, 8);

  // timestamp (8 bytes, little-endian)
  buffer.writeBigUInt64LE(BigInt(attestation.timestamp), 40);

  // tee_public_key (32 bytes)
  attestation.tee_public_key.copy(buffer, 48);

  // signature (64 bytes)
  attestation.signature.copy(buffer, 80);

  // Convert to number array
  return Array.from(buffer);
}

/**
 * Verify attestation locally (for testing)
 *
 * WARNING: This is a mock verification. Real verification happens on-chain.
 */
export function verifyAttestationLocally(
  attestation: TEEAttestation,
  expectedKPIValue: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check KPI value matches
  const expectedU64 = Math.round(expectedKPIValue * 1000);
  if (attestation.kpi_value !== expectedU64) {
    errors.push(
      `KPI value mismatch: expected ${expectedU64}, got ${attestation.kpi_value}`
    );
  }

  // Check timestamp is recent (within 1 hour)
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  if (Math.abs(now - attestation.timestamp) > oneHour) {
    errors.push(
      `Timestamp too old: ${new Date(attestation.timestamp).toISOString()}`
    );
  }

  // Check buffer lengths
  if (attestation.computation_hash.length !== 32) {
    errors.push(`Invalid computation_hash length: ${attestation.computation_hash.length}`);
  }
  if (attestation.tee_public_key.length !== 32) {
    errors.push(`Invalid tee_public_key length: ${attestation.tee_public_key.length}`);
  }
  if (attestation.signature.length !== 64) {
    errors.push(`Invalid signature length: ${attestation.signature.length}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// --- Service Class ---

export class KPICalculationService {
  private mockPrivateKey?: Buffer;

  constructor(mockPrivateKey?: string) {
    if (mockPrivateKey) {
      // Convert hex string to buffer
      this.mockPrivateKey = Buffer.from(mockPrivateKey, 'hex');
    }
  }

  /**
   * Calculate KPI without attestation (simple calculation)
   */
  calculateSimple(documents: any[], initialKPI: number = 0): KPIResult {
    return calculateKPI(documents, initialKPI);
  }

  /**
   * Calculate KPI with mock TEE attestation
   */
  calculateWithAttestation(documents: any[]): KPIResultWithAttestation {
    return calculateKPIWithMockAttestation(documents, this.mockPrivateKey);
  }

  /**
   * Verify attestation locally
   */
  verifyAttestation(
    attestation: TEEAttestation,
    expectedKPIValue: number
  ): { isValid: boolean; errors: string[] } {
    return verifyAttestationLocally(attestation, expectedKPIValue);
  }

  /**
   * Parse attestation from 144-byte array
   */
  parseAttestationBytes(bytes: number[]): TEEAttestation | null {
    if (bytes.length !== 144) {
      console.error(`Invalid attestation length: ${bytes.length}`);
      return null;
    }

    const buffer = Buffer.from(bytes);

    try {
      const attestation: TEEAttestation = {
        kpi_value: Number(buffer.readBigUInt64LE(0)),
        computation_hash: buffer.subarray(8, 40),
        timestamp: Number(buffer.readBigUInt64LE(40)),
        tee_public_key: buffer.subarray(48, 80),
        signature: buffer.subarray(80, 144),
      };

      return attestation;
    } catch (error) {
      console.error('Failed to parse attestation bytes:', error);
      return null;
    }
  }
}

// Export singleton instance
export const kpiCalculationService = new KPICalculationService();
