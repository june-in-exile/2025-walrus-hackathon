# Walrus & Seal API Technical Documentation

This document details the API endpoints, testing methods, and frontend integration for Walrus storage and Seal encryption APIs.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Backend Testing](#backend-testing)
3. [Frontend Integration](#frontend-integration)
4. [Environment Configuration](#environment-configuration)

---

## API Endpoints

### POST /api/v1/walrus/upload

**Function:** Upload file to Walrus distributed storage

**Query Parameters:**

- `mode`: `client_encrypted` | `server_encrypted` (default: `client_encrypted`)

**Headers:**

```
X-Sui-Address: 0x...           # User's Sui address
X-Sui-Signature: ...           # Base64-encoded signature
X-Sui-Signature-Message: ...   # ISO timestamp that was signed
Content-Type: multipart/form-data
```

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | File content (ciphertext for client_encrypted) |
| dealId | string | Yes | Deal ID |
| periodId | string | Yes | Period ID |
| dataType | string | Yes | Data type |
| filename | string | No | Filename |
| description | string | No | File description |
| customDataType | string | No | Custom data type name |

**Success Response (200):**

```json
{
  "blobId": "ABC123...",
  "commitment": "walrus:...",
  "size": 1024,
  "uploadedAt": "2025-01-01T00:00:00.000Z",
  "blobReference": {
    "blobId": "ABC123...",
    "dataType": "revenue_journal",
    "uploadedAt": "2025-01-01T00:00:00.000Z",
    "uploaderAddress": "0x...",
    "size": 1024,
    "metadata": { ... }
  },
  "nextStep": {
    "action": "register_on_chain",
    "description": "Sign transaction to register this blob on-chain",
    "transaction": {
      "txBytes": "",
      "description": "Register Walrus blob: revenue_journal for period1"
    }
  }
}
```

**Error Responses:**

- 400: Validation error (missing required fields, file too large, etc.)
- 401: Missing authentication headers
- 403: Server encryption disabled
- 500: Internal error

---

### GET /api/v1/walrus/download/{blobId}

**Function:** Download encrypted file from Walrus (frontend decryption)

**Path Parameters:**

- `blobId`: Walrus blob ID

**Query Parameters:**

- `dealId`: Deal ID (required for authorization)

**Headers:**

```
X-Sui-Address: 0x...           # User's Sui address
X-Sui-Signature: ...           # Base64-encoded signature
X-Sui-Signature-Message: ...   # ISO timestamp that was signed
```

**Success Response (200):**

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Length: 1024
Content-Disposition: attachment; filename*=UTF-8''Q4-2024-revenue.xlsx
X-Blob-Id: ABC123...
X-Original-Encryption-Mode: client_encrypted
X-Seal-Package-Id: 0x8a211625...
X-Seal-Whitelist-Id: 0x1234...abcd
X-Filename: Q4-2024-revenue.xlsx
X-Data-Type: revenue_journal
X-Period-Id: period-2024-q4
X-Uploaded-At: 2025-01-15T10:30:00.000Z
X-Uploader-Address: 0x1234...abcd
X-Description: Q4 2024 revenue journal (optional)
X-Custom-Data-Type: inventory_report (optional, when dataType is "custom")

[Binary encrypted data - frontend must decrypt using Seal SDK]
```

**Metadata Headers:**

| Header                     | Description                            | Always Present |
| -------------------------- | -------------------------------------- | -------------- |
| Content-Type               | Original file MIME type                | Yes            |
| Content-Disposition        | Attachment with original filename      | If filename    |
| X-Filename                 | Original filename                      | If filename    |
| X-Data-Type                | Data type (revenue_journal, etc.)      | Yes            |
| X-Period-Id                | Period identifier                      | Yes            |
| X-Uploaded-At              | Upload timestamp (ISO 8601)            | Yes            |
| X-Uploader-Address         | Sui address of uploader                | Yes            |
| X-Original-Encryption-Mode | Original encryption mode (from upload) | Yes            |
| X-Seal-Package-Id          | Seal package ID for decryption         | Yes            |
| X-Seal-Whitelist-Id        | Whitelist object ID for seal_approve   | Yes            |
| X-Description              | File description                       | Optional       |
| X-Custom-Data-Type         | Custom data type name                  | Optional       |

**Error Responses:**

- 400: Validation error
- 401: Missing authentication headers
- 403: No access permission / Server decryption disabled
- 404: Blob not found
- 500: Internal error

---

## Backend Testing

The backend can be tested manually using `cURL`, or through automated scripts for services and API endpoints.

### Manual Testing with cURL

**1. Health Check:**

```bash
curl http://localhost:3000/api/v1/health
```

**2. Upload File (client_encrypted mode):**

```bash
# Create test file
echo "Test encrypted data" > /tmp/test.txt

# Generate timestamp for signature
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Upload (note: you need to sign the timestamp with your wallet)
curl -X POST "http://localhost:3000/api/v1/walrus/upload?mode=client_encrypted" \
  -H "X-Sui-Address: 0x1234..." \
  -H "X-Sui-Signature: test_sig" \
  -H "X-Sui-Signature-Message: $TIMESTAMP" \
  -F "file=@/tmp/test.txt" \
  -F "dealId=0xdeal123" \
  -F "periodId=period1" \
  -F "dataType=revenue_journal" \
  -F "filename=test.txt"
```

**3. Download File:**

```bash
# Generate timestamp for signature
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

curl "http://localhost:3000/api/v1/walrus/download/{blobId}?dealId=0xdeal123" \
  -H "X-Sui-Address: 0x1234..." \
  -H "X-Sui-Signature: test_sig" \
  -H "X-Sui-Signature-Message: $TIMESTAMP" \
  --output encrypted.bin
```

### Automated Test Scripts

This project includes several scripts in the `/scripts` directory to test backend services and API endpoints.

#### 1. WalrusService Test (`scripts/test-walrus-service.ts`) ✅

A comprehensive test script for `WalrusService` storage operations.

**Usage:**

```bash
npx tsx scripts/test-walrus-service.ts
```

**Environment Variables Required:**

```bash
WALRUS_AGGREGATOR_URL="https://walrus-testnet.blockscope.net"
WALRUS_PUBLISHER_URL="https://walrus-testnet.blockscope.net:11444"
WALRUS_STORAGE_EPOCHS="1"
DEBUG_WALRUS="true" # Optional for verbose logging
```

**Tests Covered:**

| Test   | Description                                | Status  |
| ------ | ------------------------------------------ | ------- |
| Test 1 | Upload Small File (with metadata envelope) | ✅ Pass |
| Test 2 | Download and Verify Data Integrity         | ✅ Pass |
| Test 3 | Get Blob Info (HEAD request)               | ✅ Pass |
| Test 4 | Upload Larger File (10KB)                  | ✅ Pass |
| Test 6 | Error Handling - Non-existent Blob         | ✅ Pass |
| Test 7 | Binary Data Upload and Verification        | ✅ Pass |

---

#### 2. SealService Whitelist Test (`scripts/test-seal-service.ts`) ✅

A comprehensive test script for `SealService` whitelist operations.

**Usage:**

```bash
npx tsx scripts/test-seal-service.ts
```

**Environment Variables Required:**

```bash
SUI_BACKEND_PRIVATE_KEY="base64_encoded_key"
SEAL_KEY_SERVER_OBJECT_IDS="0x73d05d62...,0xf5d14a81..."

# Optional (for reusing existing whitelist)
TEST_PACKAGE_ID="0x8a211625..."
TEST_WHITELIST_ID="0x572960a3..."
TEST_CAP_ID="0x299098c9..."
DEBUG_SEAL="true"  # For verbose logging
```

**Tests Covered:**

| Test   | Description                                      | Status  |
| ------ | ------------------------------------------------ | ------- |
| Test 1 | Create Whitelist                                 | ✅ Pass |
| Test 2 | Add Addresses to Whitelist                       | ✅ Pass |
| Test 3 | Verify Access (whitelisted + non-whitelisted)    | ✅ Pass |
| Test 4 | Remove Address from Whitelist                    | ✅ Pass |
| Test 5 | Encryption with Whitelist Policy                 | ✅ Pass |
| Test 6 | Decryption with Whitelisted Address              | ✅ Pass |
| Test 7 | Decryption Rejection for Non-Whitelisted Address | ✅ Pass |

---

#### 3. SuiService Integration Test (`scripts/test-sui-service.ts`) ✅

Tests the `SuiService` methods for querying on-chain Deal blob metadata by performing a complete upload-register-query workflow.

**Usage:**

```bash
# Mock Walrus mode (no dev server needed - recommended)
npm run test:sui-service
# or
MOCK_WALRUS=true npx tsx scripts/test-sui-service.ts

# Real Walrus mode (requires dev server running)
MOCK_WALRUS=false npx tsx scripts/test-sui-service.ts
```

**Test Flow:**

1. **Upload Phase**: Upload 3 test files to Walrus via `WalrusService`:

   - File A → dealId_1, period "2025-Q1", type "revenue_journal"
   - File B → dealId_1, period "2025-Q2", type "ebitda_report"
   - File C → dealId_2, period "2025-Q1", type "revenue_journal"

2. **Registration Phase**: Simulate on-chain blob registration:

   - dealId_1 registers [A, B]
   - dealId_2 registers [C]
   - dealId_3 has no blobs (empty)

3. **Query Phase**: Test `SuiService` query methods

**Tests Covered:**

| Test                              | Description                        | Expected Result                       |
| --------------------------------- | ---------------------------------- | ------------------------------------- |
| `getDealBlobIds(dealId_1)`        | Query blob IDs for deal 1          | Returns [A, B]                        |
| `getDealBlobIds(dealId_2)`        | Query blob IDs for deal 2          | Returns [C]                           |
| `getDealBlobIds(dealId_3)`        | Query blob IDs for empty deal      | Returns []                            |
| `getDealBlobReferences(dealId_1)` | Query full metadata for deal 1     | Returns [A, B] with complete metadata |
| `getDealBlobReferences(dealId_2)` | Query full metadata for deal 2     | Returns [C] with complete metadata    |
| `getDealBlobReferences(dealId_3)` | Query full metadata for empty deal | Returns []                            |

**Validation Performed:**

- ✅ Correct blob count for each deal
- ✅ All expected blob IDs present
- ✅ Metadata fields (periodId, dataType, uploaderAddress, size, uploadedAt) are valid
- ✅ Empty deals return empty arrays (not errors)

### Unit Testing with Jest/Vitest

For component-level or service-level unit tests, a testing framework like Vitest or Jest can be used.

```typescript
// tests/walrus-api.test.ts
import { describe, it, expect } from "vitest";

describe("Walrus Upload API", () => {
  it("should reject upload without auth headers", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["test"]));
    formData.append("dealId", "0x123");
    formData.append("periodId", "period1");
    formData.append("dataType", "revenue_journal");

    const response = await fetch("http://localhost:3000/api/v1/walrus/upload", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(401);
  });
});
```

### Troubleshooting

**Problem**: "Deal not found" error in `test-sui-service`
**Solution**: In real mode, verify `TEST_DEAL_ID` points to an actual Deal object on-chain.

**Problem**: "EARNOUT_PACKAGE_ID not configured"
**Solution**: Set `EARNOUT_PACKAGE_ID` in your `.env` file.

**Problem**: API tests fail with "Server is not available"
**Solution**:

1.  Start the dev server first: `npm run dev`
2.  Or use the auto-start feature: `AUTO_START_SERVER=true npm run test:deal-blobs`

**Problem**: Walrus upload fails
**Solution**: Check that the Walrus publisher is accessible and your `.env` file has the correct `WALRUS_*` URLs.

---

## Frontend Integration

### Dependencies

```bash
npm install @mysten/sui @mysten/dapp-kit @mysten/seal @mysten/walrus
```

### Authentication (Signature Verification)

All API requests require signature verification to prevent address spoofing. The frontend must sign a timestamp message using the user's wallet.

**How it works:**

1. Frontend generates an ISO timestamp
2. User signs the timestamp with their wallet
3. Frontend sends the signature and timestamp in request headers
4. Backend verifies signature matches the claimed address
5. Signatures expire after 5 minutes (replay attack prevention)

**Frontend Implementation:**

```typescript
import { useSignPersonalMessage } from "@mysten/dapp-kit";

// Hook for signing messages
const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

async function createAuthHeaders(userAddress: string): Promise<HeadersInit> {
  // 1. Generate timestamp
  const timestamp = new Date().toISOString();

  // 2. Sign the timestamp
  const messageBytes = new TextEncoder().encode(timestamp);
  const { signature } = await signPersonalMessage({
    message: messageBytes,
  });

  // 3. Return headers
  return {
    "X-Sui-Address": userAddress,
    "X-Sui-Signature": signature,
    "X-Sui-Signature-Message": timestamp,
  };
}

// Usage example
async function uploadWithAuth(
  file: File,
  dealId: string,
  periodId: string,
  userAddress: string
) {
  const authHeaders = await createAuthHeaders(userAddress);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("dealId", dealId);
  formData.append("periodId", periodId);
  formData.append("dataType", "revenue_journal");

  const response = await fetch("/api/v1/walrus/upload?mode=client_encrypted", {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });

  return response.json();
}
```

**Important Notes:**

- Signatures expire after **5 minutes** - generate fresh signature for each request
- Clock skew tolerance is 30 seconds (future timestamps rejected)
- The message must be an ISO 8601 timestamp string
- Backend uses `@mysten/sui/verify` to cryptographically verify signatures

### Client-Encrypted Mode (Recommended - Frontend Encrypts)

**Upload Flow:**

```typescript
import { SealClient } from "@mysten/seal";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";

async function uploadEncryptedFile(
  file: File,
  dealId: string,
  periodId: string,
  dataType: string,
  userAddress: string
) {
  // 1. Read file
  const arrayBuffer = await file.arrayBuffer();
  const plaintext = new Uint8Array(arrayBuffer);

  // 2. Encrypt with Seal
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: [
      { objectId: "0x73d05d62...", weight: 1 },
      { objectId: "0xf5d14a81...", weight: 1 },
    ],
  });

  const { encryptedObject } = await sealClient.encrypt({
    threshold: 2,
    packageId: WHITELIST_PACKAGE_ID,
    id: WHITELIST_OBJECT_ID, // hex string without 0x prefix
    data: plaintext,
  });

  // 3. Upload ciphertext to backend
  const formData = new FormData();
  formData.append("file", new Blob([encryptedObject]));
  formData.append("dealId", dealId);
  formData.append("periodId", periodId);
  formData.append("dataType", dataType);
  formData.append("filename", file.name);

  // Get auth headers (see Authentication section above)
  const authHeaders = await createAuthHeaders(userAddress);

  const response = await fetch("/api/v1/walrus/upload?mode=client_encrypted", {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });

  const result = await response.json();

  // 4. Sign transaction to register blob on-chain
  // TODO: Use nextStep.transaction.txBytes to build transaction

  return result;
}
```

**Download Flow (All Modes):**

```typescript
async function downloadAndDecrypt(
  blobId: string,
  dealId: string,
  userAddress: string,
  sealClient: SealClient
) {
  // 1. Download ciphertext (always encrypted, regardless of upload mode)
  const authHeaders = await createAuthHeaders(userAddress);
  const response = await fetch(
    `/api/v1/walrus/download/${blobId}?dealId=${dealId}`,
    {
      headers: authHeaders,
    }
  );

  const ciphertext = new Uint8Array(await response.arrayBuffer());

  // 2. Create Session Key
  const sessionKey = new SessionKey({
    address: userAddress,
    packageId: WHITELIST_PACKAGE_ID,
    ttlMin: 10,
  });

  // 3. Sign session key
  const message = sessionKey.getPersonalMessage();
  // Sign with wallet...

  // 4. Fetch decryption keys
  const encryptedKeyId = EncryptedObject.parse(ciphertext).id;

  // Build seal_approve transaction
  const tx = new Transaction();
  tx.moveCall({
    target: `${WHITELIST_PACKAGE_ID}::whitelist::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(encryptedKeyId))),
      tx.object(WHITELIST_OBJECT_ID),
    ],
  });

  const txBytes = await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });

  await sealClient.fetchKeys({
    ids: [encryptedKeyId],
    txBytes,
    sessionKey,
    threshold: 2,
  });

  // 5. Decrypt
  const plaintext = await sealClient.decrypt({
    data: ciphertext,
    sessionKey,
    txBytes,
  });

  return plaintext;
}
```

### Server-Encrypted Mode (Simplified Upload - Backend Encrypts)

**Key Point**: Upload is simplified (backend encrypts), but download always requires frontend decryption.

```typescript
// Upload (backend encrypts)
async function uploadPlaintext(
  file: File,
  dealId: string,
  periodId: string,
  userAddress: string
) {
  const authHeaders = await createAuthHeaders(userAddress);

  const formData = new FormData();
  formData.append("file", file); // plaintext - backend will encrypt
  formData.append("dealId", dealId);
  formData.append("periodId", periodId);
  formData.append("dataType", "revenue_journal");

  const response = await fetch("/api/v1/walrus/upload?mode=server_encrypted", {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });

  return response.json();
}

// Download - Same as client_encrypted mode (see above section)
// Frontend always decrypts using Seal SDK, regardless of upload mode
```

**When to Use `server_encrypted` Mode:**

- ✅ Simplifying initial MVP development (skip frontend Seal integration for uploads)
- ✅ Mobile apps where Seal SDK integration is challenging for encryption
- ✅ Rapid prototyping where upload simplicity is prioritized
- ❌ High-security scenarios requiring zero-knowledge uploads
- ❌ When backend trust is not acceptable during upload phase

**Important**: Download flow is identical for both modes - frontend must integrate Seal SDK for decryption.

---

## Environment Configuration

### Required Configuration

```bash
# .env

# Sui Configuration
SUI_NETWORK="testnet"
SUI_RPC_URL="https://fullnode.testnet.sui.io:443"
SUI_BACKEND_PRIVATE_KEY="base64_encoded_key"  # Required for server_encrypted mode

# Walrus Configuration (HTTP API mode)
WALRUS_AGGREGATOR_URL="https://walrus-testnet.blockscope.net"
WALRUS_PUBLISHER_URL="https://walrus-testnet.blockscope.net:11444"
WALRUS_STORAGE_EPOCHS="1"
WALRUS_MAX_FILE_SIZE="104857600"  # 100MB

# Seal Configuration
SEAL_KEY_SERVER_OBJECT_IDS="0x73d05d62...,0xf5d14a81..."
SEAL_POLICY_OBJECT_ID="0x..."  # Set after deploying Move contract

# Earnout Contract Configuration
EARNOUT_PACKAGE_ID="0x..."  # Required for transaction byte generation

# Application Configuration
DEFAULT_UPLOAD_MODE="client_encrypted"
ENABLE_SERVER_ENCRYPTION="true"
```

### Test Configuration

```bash
# Debug mode
DEBUG_WALRUS="true"
DEBUG_SEAL="true"
DEBUG_API="true"

# Test contracts (deployed)
TEST_PACKAGE_ID="0x8a211625..."
TEST_WHITELIST_ID="0x572960a3..."
TEST_CAP_ID="0x299098c9..."
```

---

## Related Resources

- [Walrus SDK Documentation](https://docs.walrus.site/)
- [Seal SDK Documentation](https://docs.sui.io/guides/developer/cryptography/seal)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)
- [Project CLAUDE.md](../CLAUDE.md)

---

_Document last updated: 2025-11-21_
