# Nautilus TEE KPI Calculator

This directory contains the Rust code for the KPI calculator that runs in Nautilus Trusted Execution Environment (TEE).

## Overview

The KPI calculator processes financial documents (Journal Entries, Fixed Assets, Payroll, Overhead) and computes cumulative KPI values with cryptographic attestation. This ensures that KPI calculations are tamper-proof and verifiable on the Sui blockchain.

## Features

- ✅ **Multiple Document Types**: Supports 4 types of financial documents
- ✅ **Cumulative KPI Calculation**: Processes multiple documents to compute total KPI
- ✅ **Cryptographic Attestation**: Generates Ed25519 signatures proving TEE computation
- ✅ **Blockchain-Ready Output**: 144-byte attestation format for Sui Move verification
- ✅ **Input Data Hashing**: SHA-256 hash of all input documents for verification

## File Structure

```
nautilus/
├── kpi_calculator.rs      # Main KPI calculation logic with TEE attestation
├── Cargo.toml             # Rust dependencies
├── README.md              # This file
└── TEE_INTEGRATION_DESIGN.md  # Detailed integration design document
```

## Building

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Nautilus SDK (example - replace with actual installation)
cargo install nautilus-cli
```

### Build for TEE

```bash
cd nautilus/
cargo build --release
```

### Run Tests

```bash
cargo test
```

Expected output:
```
running 2 tests
test tests::test_calculate_kpi_with_attestation ... ok
test tests::test_attestation_serialization ... ok

test result: ok. 2 passed; 0 failed; 0 ignored
```

## Attestation Format

The TEE generates a 144-byte attestation with the following structure:

| Offset | Length | Field              | Description                           |
|--------|--------|--------------------|---------------------------------------|
| 0      | 8      | kpi_value          | u64, KPI * 1000 (little-endian)      |
| 8      | 32     | computation_hash   | SHA-256 hash of input documents       |
| 40     | 8      | timestamp          | Unix timestamp in ms (little-endian)  |
| 48     | 32     | tee_public_key     | Ed25519 public key of TEE             |
| 80     | 64     | signature          | Ed25519 signature                     |

**Total: 144 bytes**

### Signature Message

The TEE signs the following message:
```
message = kpi_value (8 bytes) || computation_hash (32 bytes) || timestamp (8 bytes)
```

This ensures that:
- The KPI value is authentic
- The computation was based on specific input documents (verified by hash)
- The computation timestamp is recorded

## Usage Example

### In TEE Environment

```rust
use kpi_calculator::{calculate_kpi_with_attestation, KPIResultWithAttestation};
use ed25519_dalek::Keypair;
use rand::rngs::OsRng;

// Generate TEE keypair (in production, this is managed by Nautilus)
let mut csprng = OsRng{};
let tee_keypair = Keypair::generate(&mut csprng);

// Financial documents as JSON array
let documents_json = r#"[
    {
        "journalEntryId": "JE-2025-001",
        "credits": [
            {"account": "Sales Revenue", "amount": 50000.0}
        ]
    },
    {
        "employeeDetails": {},
        "grossPay": 20000.0
    }
]"#;

// Compute KPI with attestation
let result = calculate_kpi_with_attestation(documents_json, &tee_keypair);

println!("KPI: {}", result.kpi_result.kpi);
println!("Attestation: {} bytes", result.attestation_bytes.len());

// Use attestation_bytes for blockchain submission
```

### From Frontend (TypeScript)

```typescript
import { createTEEService } from '@/src/frontend/services/tee-service';

const teeService = createTEEService();

// Decrypted financial documents
const documents = [
  {
    journalEntryId: 'JE-2025-001',
    credits: [{ account: 'Sales Revenue', amount: 50000 }]
  },
  {
    employeeDetails: {},
    grossPay: 20000
  }
];

// Compute KPI with TEE attestation
const result = await teeService.computeKPIWithAttestation(documents);

console.log('KPI:', result.kpi_result.kpi); // 30000
console.log('Attestation bytes:', result.attestation_bytes.length); // 144

// Submit to Sui blockchain
// (see useTEESettlement hook for complete flow)
```

## KPI Calculation Logic

### Supported Document Types

#### 1. Journal Entry
**Identifier**: Has `journalEntryId` field

**Calculation**: Extract "Sales Revenue" from credits
```rust
// Example document
{
  "journalEntryId": "JE-2025-001",
  "credits": [
    {"account": "Sales Revenue", "amount": 50000.0}
  ]
}

// KPI impact: +50000
```

#### 2. Fixed Assets Register
**Identifier**: Has `assetList` field with `assetID`

**Calculation**: Sum of monthly depreciation
```rust
// Example document
{
  "assetList": [
    {
      "assetID": "MACH-001A",
      "originalCost": 120000.0,
      "residualValue": 12000.0,
      "usefulLife_years": 10
    }
  ]
}

// Monthly depreciation = (120000 - 12000) / (10 * 12) = 900
// KPI impact: -900 (expense reduces KPI)
```

#### 3. Payroll Expense
**Identifier**: Has `employeeDetails` field

**Calculation**: Negative of `grossPay`
```rust
// Example document
{
  "employeeDetails": {...},
  "grossPay": 20000.0
}

// KPI impact: -20000
```

#### 4. Overhead Report
**Identifier**: `reportTitle` equals "Corporate Overhead Report"

**Calculation**: 10% of `totalOverheadCost`
```rust
// Example document
{
  "reportTitle": "Corporate Overhead Report",
  "totalOverheadCost": 50000.0
}

// KPI impact: -(50000 * 0.1) = -5000
```

### Cumulative KPI Formula

```
Cumulative KPI = Σ(document changes)
               = Sales Revenue - Depreciation - Payroll - Overhead Allocation
```

**Example**:
- Sales Revenue: +50000
- Depreciation: -900
- Payroll: -20000
- Overhead: -5000
- **Total KPI: 24100**

## Deployment to Nautilus TEE

### 1. Build for TEE Target

```bash
# Build optimized binary
cargo build --release --target wasm32-unknown-unknown

# Or use Nautilus-specific target
nautilus build --profile production
```

### 2. Deploy to Nautilus

```bash
# Deploy to Nautilus TEE network
nautilus deploy \
  --program kpi_calculator.wasm \
  --name kpi_calculator_v1 \
  --network testnet

# Output:
# Program ID: kpi_calculator_v1
# TEE Public Key: 0x1234abcd...
# Endpoint: https://tee.nautilus.network/compute
```

### 3. Register TEE Public Key on Sui

```bash
# Call Sui contract to add TEE to trusted registry
sui client call \
  --package $EARNOUT_PACKAGE_ID \
  --module earnout \
  --function add_trusted_tee \
  --args $TEE_REGISTRY_ID "0x1234abcd..." \
  --gas-budget 10000000
```

## Security Considerations

### ✅ What This Provides

1. **Tamper-Proof Computation**: KPI calculations happen in isolated TEE
2. **Cryptographic Proof**: Ed25519 signatures prove computation integrity
3. **Input Verification**: SHA-256 hash ensures correct input documents
4. **Replay Protection**: Timestamp prevents attestation reuse

### ⚠️ Current Limitations (MVP)

1. **No TEE Registry**: Sui contract accepts any TEE public key
   - **Solution**: Implement `TEERegistry` to whitelist trusted TEEs

2. **No Timestamp Validation**: Contract doesn't verify attestation freshness
   - **Solution**: Add clock-based timestamp checks (e.g., within 1 hour)

3. **Single TEE Node**: No redundancy if TEE is unavailable
   - **Solution**: Deploy multiple TEE nodes with load balancing

4. **No Input Source Verification**: TEE doesn't verify documents came from Walrus
   - **Solution**: Include Walrus blob IDs in attestation

### 🔒 Production Enhancements

For production deployment, consider:

1. **TEE Remote Attestation**: Verify TEE hardware authenticity using Intel SGX/AMD SEV attestation
2. **Multi-TEE Consensus**: Require 2-of-3 TEE nodes to agree on KPI
3. **Blob ID Verification**: Include Walrus blob IDs in computation_hash
4. **Timelock Settlement**: Add delay between KPI submission and fund transfer
5. **Auditor Review Period**: Allow auditor to challenge KPI before settlement

## Troubleshooting

### Build Errors

**Error**: `package `ed25519-dalek` cannot be built because it requires rustc 1.60 or newer`

**Solution**:
```bash
rustup update stable
rustc --version  # Should be 1.60+
```

### Test Failures

**Error**: `assertion failed: (left == right)`

**Solution**: Check if test documents match expected KPI calculation logic

### TEE Connection Failed

**Error**: `Failed to connect to TEE endpoint`

**Solution**:
- Verify `NEXT_PUBLIC_NAUTILUS_TEE_ENDPOINT` in `.env.local`
- Check TEE service is running: `curl $TEE_ENDPOINT/health`
- Use mock service for development: `NEXT_PUBLIC_USE_MOCK_TEE=true`

## Development vs Production

### Development Mode

Use `MockTEEService` for local testing without real TEE:

```typescript
// .env.local
NEXT_PUBLIC_USE_MOCK_TEE=true
```

**⚠️ WARNING**: Mock service does NOT provide cryptographic security!

### Production Mode

Deploy actual Nautilus TEE and configure:

```typescript
// .env.local
NEXT_PUBLIC_USE_MOCK_TEE=false
NEXT_PUBLIC_NAUTILUS_TEE_ENDPOINT=https://tee.nautilus.network
NEXT_PUBLIC_TEE_PROGRAM_ID=kpi_calculator_v1
```

## References

- [Nautilus TEE Documentation](https://docs.nautilus.network) (假设的链接)
- [Ed25519 Signature Scheme](https://ed25519.cr.yp.to/)
- [Sui Move Ed25519 Module](https://docs.sui.io/references/framework/sui-framework/ed25519)
- [TEE Integration Design](./TEE_INTEGRATION_DESIGN.md)

## License

SPDX-License-Identifier: MIT
