# Auditor Data Audit Feature Implementation Plan

This document describes the complete implementation plan for the Auditor Data Audit feature, including smart contracts, backend APIs, frontend components, and Nautilus TEE integration.

## Feature Overview

- **Auditor Data Audit**: Verify Walrus blob content and mark `audited = true` on-chain with signature
- **Nautilus KPI Calculation**: Calculate KPI in TEE and generate attestation
- **Contract Settlement Verification**: Verify attestation and calculate Earn-out amount

---

## 1. Sui Smart Contract

### 1.1 New Data Structures

```move
// Data Audit Record Object
struct DataAuditRecord has key, store {
    id: UID,
    data_id: String,              // Walrus blob ID
    deal_id: ID,                  // Parent Deal
    period_id: u64,               // Parent Period
    uploader: address,            // Uploader address
    upload_timestamp: u64,        // Upload timestamp
    audited: bool,                // Audit status (default false)
    auditor: Option<address>,     // Auditor address
    audit_timestamp: Option<u64>, // Audit timestamp
}

// KPI Calculation Result (from Nautilus)
struct KPIResult has store, drop {
    period_id: u64,
    kpi_type: String,             // e.g., "revenue", "ebitda"
    value: u64,                   // Calculation result (in smallest unit)
    attestation: vector<u8>,      // Nautilus TEE attestation
    computed_at: u64,             // Computation timestamp
}
```

### 1.2 Functions to Implement

#### `create_audit_record`

- **Trigger**: When Buyer uploads data to Walrus and registers blob on-chain
- **Function**: Create `DataAuditRecord` object with `audited = false`
- **Permission**: Only Deal's Buyer can call

#### `audit_data`

- **Function**: Auditor audits single data record
- **Parameters**:
  - `deal`: &Deal
  - `audit_record`: &mut DataAuditRecord
  - `signature`: vector<u8>
  - `message`: vector<u8>
- **Verification Logic**:
  1. Check if caller is the Deal's auditor
  2. Rebuild expected message (using `data_id`)
  3. Use `sui::ed25519::ed25519_verify` to verify signature
  4. Update `audited = true`, `auditor`, `audit_timestamp`
- **Event**: Emit `DataAudited` event

#### `check_period_audit_status`

- **Function**: Check if all data in a period has been audited
- **Returns**: `(total_count, audited_count, is_ready)`

#### `submit_kpi_result`

- **Function**: Submit Nautilus-calculated KPI result
- **Parameters**:
  - `deal`: &mut Deal
  - `period_id`: u64
  - `kpi_value`: u64
  - `attestation`: vector<u8>
- **Verification Logic**:
  1. Check all data in the period is audited
  2. Verify Nautilus attestation
- **Permission**: Buyer or system account

#### `settle` (Update existing function)

- **New Verification**: Check for valid KPI result and attestation
- **Calculation**: Use verified KPI value to calculate Earn-out

### 1.3 Event Definitions

```move
// Data Audit Completed Event
struct DataAudited has copy, drop {
    deal_id: ID,
    data_id: String,
    auditor: address,
    timestamp: u64,
}

// KPI Result Submitted Event
struct KPIResultSubmitted has copy, drop {
    deal_id: ID,
    period_id: u64,
    kpi_value: u64,
    timestamp: u64,
}
```

---

## 2. Backend API

### 2.1 New API Endpoints

#### `GET /api/v1/deals/{dealId}/audit-records`

- **Function**: Get all audit records for a Deal
- **Response**:

  ```typescript
  {
    records: DataAuditRecord[],
    summary: {
      total: number,
      audited: number,
      pending: number
    }
  }
  ```

#### `GET /api/v1/deals/{dealId}/periods/{periodId}/audit-status`

- **Function**: Get audit progress for a specific Period
- **Response**:

  ```typescript
  {
    periodId: string,
    totalBlobs: number,
    auditedBlobs: number,
    isReadyForSettlement: boolean,
    records: DataAuditRecord[]
  }
  ```

#### `POST /api/v1/nautilus/calculate-kpi`

- **Function**: Trigger Nautilus TEE to calculate KPI
- **Request**:

  ```typescript
  {
    dealId: string,
    periodId: string
  }
  ```

- **Response**:

  ```typescript
  {
    kpiValue: number,
    attestation: string,  // base64 encoded
    computedAt: number
  }
  ```

### 2.2 Update Existing API

#### `POST /api/v1/walrus/upload`

- **New Logic**: After successful upload, call contract to create `DataAuditRecord`
- **New Response Field**: `auditRecordId`

---

## 3. Frontend Components

### 3.1 New Pages/Components

#### `DataAuditPage`

- **Path**: `/deals/{dealId}/audit`
- **Features**:
  - Display audit progress for all Periods
  - List each blob's audit status
  - Provide download/decrypt/audit operations

#### `AuditRecordList`

- **Features**: Display blob list including:
  - Blob ID
  - Upload timestamp
  - Uploader
  - Audit status (Audited / Not Audited)
  - Action buttons (Download / Audit)

#### `AuditDataButton`

- **Features**:
  1. Build audit message (containing `data_id`)
  2. Call Sui wallet to sign message
  3. Call contract `audit_data` function
  4. Display transaction result

#### `SettlementPanel` (Update)

- **New Features**:
  - Display audit completion status
  - "Calculate KPI" button to trigger Nautilus calculation
  - Display KPI calculation result and attestation status

### 3.2 Required Hooks

#### `useAuditRecords(dealId)`

- Get audit record list
- Subscribe to `DataAudited` events for status updates

#### `useAuditData()`

- Handle audit signature flow
- Call contract and process result

#### `useNautilusKPI(dealId, periodId)`

- Trigger Nautilus calculation
- Get calculation result

### 3.3 Frontend Signature Flow

```typescript
// 1. Build audit message
const message = new TextEncoder().encode(`AUDIT:${dataId}`);

// 2. Sign with Sui wallet
const { signature } = await signPersonalMessage({
  message,
});

// 3. Build transaction
const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::earnout::audit_data`,
  arguments: [
    tx.object(dealId),
    tx.object(auditRecordId),
    tx.pure(bcs.vector(bcs.u8()).serialize(signature)),
    tx.pure(bcs.vector(bcs.u8()).serialize(message)),
  ],
});

// 4. Execute transaction
const result = await signAndExecuteTransaction({ transaction: tx });
```

---

## 4. Nautilus TEE Integration

### 4.1 TEE Calculation Logic

```typescript
// Execute inside Nautilus enclave
async function calculateKPI(dealId: string, periodId: string) {
  // 1. Get all audited blob IDs for this period
  const auditRecords = await getAuditedRecords(dealId, periodId);

  // 2. Download data from Walrus
  const blobs = await Promise.all(
    auditRecords.map(r => walrusClient.download(r.dataId))
  );

  // 3. Decrypt using Seal
  const decryptedData = await Promise.all(
    blobs.map(b => sealClient.decrypt(b))
  );

  // 4. Calculate based on KPI type
  const kpiValue = computeKPI(decryptedData, kpiType);

  // 5. Generate attestation
  const attestation = generateAttestation({
    dealId,
    periodId,
    kpiValue,
    dataIds: auditRecords.map(r => r.dataId),
  });

  return { kpiValue, attestation };
}
```

### 4.2 Attestation Structure

```typescript
interface NautilusAttestation {
  enclaveId: string;          // TEE enclave identifier
  timestamp: number;          // Computation timestamp
  inputHash: string;          // Hash of input data
  outputHash: string;         // Hash of output result
  signature: string;          // TEE signature
}
```

### 4.3 Contract Attestation Verification

```move
public fun verify_nautilus_attestation(
    attestation: &vector<u8>,
    expected_output_hash: vector<u8>,
): bool {
    // 1. Parse attestation structure
    // 2. Verify enclave ID is in whitelist
    // 3. Verify TEE signature
    // 4. Verify output hash matches
    // ...
}
```

---

## 5. Implementation Order

### Phase 1: Smart Contract Foundation

1. [ ] Define `DataAuditRecord` structure
2. [ ] Implement `create_audit_record` function
3. [ ] Implement `audit_data` function (with signature verification)
4. [ ] Write contract tests

### Phase 2: Backend API

5. [ ] Add audit record related API endpoints
6. [ ] Update Walrus upload API to create audit records
7. [ ] Write API tests

### Phase 3: Frontend Audit Features

8. [ ] Build `DataAuditPage` page
9. [ ] Implement `AuditDataButton` signature flow
10. [ ] Implement `useAuditRecords` hook
11. [ ] Update Dashboard to show audit progress

### Phase 4: Nautilus Integration

12. [ ] Design Nautilus enclave calculation logic
13. [ ] Implement attestation generation
14. [ ] Add attestation verification to contract
15. [ ] Add Nautilus API to backend
16. [ ] Frontend integration for KPI calculation trigger

### Phase 5: Settlement Flow Update

17. [ ] Update `settle` function verification logic
18. [ ] Update `SettlementPanel` component
19. [ ] End-to-end testing

---

## 6. Smart Contract Unit Testing

Unit tests for the Sui Move contract to ensure robustness and security of the contract logic. These tests run on the Sui CLI local test validator.

### 6.1 Authorization Tests

#### Success Cases

- **Auditor can audit**: Designated auditor calls `audit_data` function, transaction should succeed
- **Admin can audit**: Contract admin calls `audit_data` function, transaction should succeed

#### Failure Cases

- **Buyer cannot audit**: Buyer address calls `audit_data`, transaction must fail with explicit authorization error
- **Seller cannot audit**: Seller address calls `audit_data`, transaction must fail with explicit authorization error
- **Random address cannot audit**: Unrelated random address calls `audit_data`, transaction must fail with explicit authorization error

### 6.2 Signature Verification Tests

#### Success Cases

- **Valid signature passes**: Auditor signs the correct `dataId` message with their wallet, contract verifies successfully and updates `audited` field from `false` to `true`

#### Failure Cases

- **Wrong dataId signature**: Auditor provides a signature for a different `dataId`, contract verification must fail
- **Invalid signature format**: Provide a malformed or randomly generated signature, contract verification must fail
- **Impersonation attack**: Sign message with another address's private key but claim it's the auditor's signature, contract verification must fail

### 6.3 State Change Tests

#### State Confirmation

- **Audit state update**: Verify that after successful `audit_data` execution, the on-chain object's `audited` field actually changes from `false` to `true`
- **Auditor field update**: Verify that `auditor` field is set to the correct auditor address
- **Timestamp update**: Verify that `audit_timestamp` is set to the current timestamp

#### Edge Cases

- **Duplicate audit attempt**: When an object's `audited` is already `true`, calling `audit_data` again should fail or produce no state change (to save gas fees). Expected error: `EAlreadyAudited`
- **Non-existent target**: Attempt to audit a non-existent `dataId`, contract should handle gracefully with error code `EDataIdNotFound`

### 6.4 Object Creation Tests

- **Default audit state**: When `DataAuditRecord` is created, verify that `audited` field is correctly defaulted to `false`
- **Default auditor state**: Verify that `auditor` field is `Option::none()` on creation
- **Default timestamp state**: Verify that `audit_timestamp` field is `Option::none()` on creation

### 6.5 Error Codes

```move
// Expected error codes for test assertions
const ENotAuthorized: u64 = 1;        // Caller is not authorized auditor/admin
const EInvalidSignature: u64 = 2;     // Signature verification failed
const EAlreadyAudited: u64 = 3;       // Data has already been audited
const EDataIdNotFound: u64 = 4;       // Data ID does not exist
const ESignatureMismatch: u64 = 5;    // Signature doesn't match expected message
```

### 6.6 Test Setup and Commands

```bash
# Navigate to Move contract directory
cd contracts/earnout

# Run all tests
sui move test

# Run specific test module
sui move test --filter audit_data_tests

# Run tests with verbose output
sui move test -v

# Run tests on local test validator (for integration tests)
sui client switch --env localnet
sui move test --test-env localnet
```

### 6.7 Test Implementation Example

```move
#[test_only]
module earnout::audit_data_tests {
    use sui::test_scenario::{Self, Scenario};
    use sui::test_utils::assert_eq;
    use earnout::earnout::{Self, Deal, DataAuditRecord};

    #[test]
    fun test_auditor_can_audit_data() {
        let auditor = @0xAUDITOR;
        let mut scenario = test_scenario::begin(auditor);

        // Setup: Create deal and audit record
        // ...

        // Action: Auditor calls audit_data
        // ...

        // Assert: audited = true, auditor address set, timestamp set
        // ...

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = earnout::ENotAuthorized)]
    fun test_buyer_cannot_audit_data() {
        let buyer = @0xBUYER;
        let mut scenario = test_scenario::begin(buyer);

        // Setup: Create deal and audit record
        // ...

        // Action: Buyer attempts to call audit_data (should fail)
        // ...

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = earnout::EAlreadyAudited)]
    fun test_duplicate_audit_fails() {
        // Test that auditing an already-audited record fails
        // ...
    }
}
```