# Walrus & Seal API Technical Documentation

This document details the implementation locations, testing methods, frontend integration, and known issues for Walrus storage and Seal encryption APIs.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [File Locations](#file-locations)
3. [API Endpoints](#api-endpoints)
4. [Backend Testing](#backend-testing)
5. [Frontend Integration](#frontend-integration)
6. [Known Issues](#known-issues)
7. [Environment Configuration](#environment-configuration)

---

## API Overview

### Encryption Modes

The system supports two encryption modes:

| Mode               | Description                                           | Security                        | Frontend Complexity |
| ------------------ | ----------------------------------------------------- | ------------------------------- | ------------------- |
| `client_encrypted` | Frontend encrypts using Seal SDK, backend only relays | High (zero-knowledge)           | High                |
| `server_encrypted` | Backend encrypts/decrypts using Seal SDK              | Medium (requires backend trust) | Low                 |

### Endpoint List

| Method | Endpoint                           | Description               |
| ------ | ---------------------------------- | ------------------------- |
| POST   | `/api/v1/walrus/upload`            | Upload file to Walrus     |
| GET    | `/api/v1/walrus/download/{blobId}` | Download file from Walrus |

---

## File Locations

### API Routes (Next.js App Router)

```
app/api/v1/walrus/
├── upload/
│   └── route.ts              # POST /api/v1/walrus/upload
└── download/
    └── [blobId]/
        └── route.ts          # GET /api/v1/walrus/download/{blobId}
```

### Backend Layer Architecture

```
src/backend/
├── controllers/
│   └── walrus-controller.ts  # HTTP request handling, validation, orchestration
├── services/
│   ├── walrus-service.ts     # Walrus storage operations
│   └── seal-service.ts       # Seal encryption/decryption operations
└── models/
    └── (to be implemented)
```

### Shared Types

```
src/shared/
├── types/
│   └── walrus.ts             # TypeScript interface definitions
└── config/
    └── env.ts                # Environment variable configuration
```

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

**Function:** Download file from Walrus

**Path Parameters:**

- `blobId`: Walrus blob ID

**Query Parameters:**

- `mode`: `client_encrypted` | `server_encrypted` (default: `client_encrypted`)
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
X-Encryption-Mode: client_encrypted
X-Filename: Q4-2024-revenue.xlsx
X-Data-Type: revenue_journal
X-Period-Id: period-2024-q4
X-Uploaded-At: 2025-01-15T10:30:00.000Z
X-Uploader-Address: 0x1234...abcd
X-Description: Q4 2024 revenue journal (optional)
X-Custom-Data-Type: inventory_report (optional, when dataType is "custom")

[Binary data]
```

**Metadata Headers:**

| Header               | Description                           | Always Present |
| -------------------- | ------------------------------------- | -------------- |
| Content-Type         | Original file MIME type               | Yes            |
| Content-Disposition  | Attachment with original filename     | If filename    |
| X-Filename           | Original filename                     | If filename    |
| X-Data-Type          | Data type (revenue_journal, etc.)     | Yes            |
| X-Period-Id          | Period identifier                     | Yes            |
| X-Uploaded-At        | Upload timestamp (ISO 8601)           | Yes            |
| X-Uploader-Address   | Sui address of uploader               | Yes            |
| X-Description        | File description                      | Optional       |
| X-Custom-Data-Type   | Custom data type name                 | Optional       |

**Error Responses:**

- 400: Validation error
- 401: Missing authentication headers
- 403: No access permission / Server decryption disabled
- 404: Blob not found
- 500: Internal error

---

## Backend Testing

### Testing with cURL

**1. Health Check:**

```bash
curl http://localhost:3000/api/v1/health
```

**2. Upload File (client_encrypted mode):**

```bash
# Create test file
echo "Test encrypted data" > /tmp/test.txt

# Upload
curl -X POST "http://localhost:3000/api/v1/walrus/upload?mode=client_encrypted" \
  -H "X-Sui-Address: 0x1234..." \
  -H "X-Sui-Signature: test_sig" \
  -F "file=@/tmp/test.txt" \
  -F "dealId=0xdeal123" \
  -F "periodId=period1" \
  -F "dataType=revenue_journal" \
  -F "filename=test.txt"
```

**3. Download File:**

```bash
curl "http://localhost:3000/api/v1/walrus/download/{blobId}?mode=client_encrypted&dealId=0xdeal123" \
  -H "X-Sui-Address: 0x1234..." \
  -H "X-Sui-Signature: test_sig" \
  --output downloaded.bin
```

### Testing with Jest/Vitest

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

### Client-Encrypted Mode (Recommended)

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

**Download Flow:**

```typescript
async function downloadAndDecrypt(
  blobId: string,
  dealId: string,
  userAddress: string,
  sealClient: SealClient
) {
  // 1. Download ciphertext
  const authHeaders = await createAuthHeaders(userAddress);
  const response = await fetch(
    `/api/v1/walrus/download/${blobId}?mode=client_encrypted&dealId=${dealId}`,
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

### Server-Encrypted Mode (Simplified)

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
  formData.append("file", file); // plaintext
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

// Download (backend decrypts)
async function downloadPlaintext(
  blobId: string,
  dealId: string,
  userAddress: string
) {
  const authHeaders = await createAuthHeaders(userAddress);

  const response = await fetch(
    `/api/v1/walrus/download/${blobId}?mode=server_encrypted&dealId=${dealId}`,
    {
      headers: authHeaders,
    }
  );

  return response.blob(); // decrypted plaintext
}
```

---

## Known Issues

### Critical Issues

#### 1. WASM File Loading Failure

**Error Message:**

```
ENOENT: no such file or directory, open '/ROOT/node_modules/@mysten/walrus-wasm/walrus_wasm_bg.wasm'
```

**Impact:** All Walrus operations completely non-functional

**Root Cause:** `@mysten/walrus` SDK resolves WASM file path incorrectly in Next.js environment

**Possible Solutions:**

1. Upgrade `@mysten/walrus` to latest version
2. Configure Next.js `next.config.js` for WASM handling
3. Use HTTP to call Walrus aggregator directly (bypass SDK)

---

#### 2. Transaction Bytes Not Generated

**Location:** `walrus-controller.ts:175`

```typescript
transaction: {
  txBytes: '', // TODO: Generate actual transaction bytes
  description: `Register Walrus blob: ${dataType} for ${periodId}`,
}
```

**Impact:** Frontend cannot complete on-chain registration step

---

### ~~Low Priority Issues~~ Resolved

#### ~~3. Blob Metadata Storage~~ ✅ Fixed

**Solution Implemented: Walrus Metadata Envelope**

Metadata is now persisted alongside the blob data using a **metadata envelope format**. When uploading, metadata is prepended to the actual data. When downloading, metadata is extracted and returned in response headers.

**Envelope Format:**

```
[4 bytes: metadata length (uint32 BE)][metadata JSON][actual data]
```

**How it works:**

1. **Upload**: `walrusService.upload()` automatically wraps data with metadata envelope
2. **Download**: `walrusService.downloadWithMetadata()` extracts metadata from envelope
3. **Response**: Controller returns metadata in HTTP headers (see [Download Response](#get-apiv1walrusdownloadblobid))

**Benefits:**

- ✅ Metadata travels with data (no separate storage needed)
- ✅ Download response includes filename, mimeType, dataType, periodId, etc.
- ✅ Frontend can display file list with proper names and types
- ✅ Backward compatible (legacy blobs without envelope return raw data)

**Implementation Files:**

- `src/shared/types/walrus.ts` - `WalrusMetadataEnvelope` interface
- `src/backend/services/walrus-service.ts` - `wrapWithMetadataEnvelope()`, `unwrapMetadataEnvelope()`
- `src/backend/controllers/walrus-controller.ts` - Metadata in response headers

---

## Environment Configuration

### Required Configuration

```bash
# .env

# Sui Configuration
SUI_NETWORK="testnet"
SUI_RPC_URL="https://fullnode.testnet.sui.io:443"
SUI_BACKEND_PRIVATE_KEY="base64_encoded_key"  # Required for server_encrypted mode

# Walrus Configuration
WALRUS_AGGREGATOR_URL="https://aggregator-testnet.walrus.space"
WALRUS_STORAGE_EPOCHS="1"
WALRUS_MAX_FILE_SIZE="104857600"  # 100MB

# Seal Configuration
SEAL_KEY_SERVER_OBJECT_IDS="0x73d05d62...,0xf5d14a81..."
SEAL_POLICY_OBJECT_ID="0x..."  # Set after deploying Move contract

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

## Next Steps

### Immediate Fixes (Blocking Issues)

1. **Resolve WASM Loading Issue**

   - Check `@mysten/walrus` version
   - Configure Next.js WASM support
   - Or switch to HTTP API for aggregator calls

2. ~~**Implement Missing Seal Methods**~~ ✅ Done - Controller correctly uses existing methods

3. ~~**Unify Interface Definitions**~~ ✅ Done - Using `WhitelistEncryptionConfig`

### Follow-up Optimizations

4. ~~Implement signature verification~~ ✅ Done
5. Generate actual transaction bytes
6. Add unit and integration tests
7. ~~Implement metadata persistence~~ ✅ Done (Walrus metadata envelope)

---

## Related Resources

- [Walrus SDK Documentation](https://docs.walrus.site/)
- [Seal SDK Documentation](https://docs.sui.io/guides/developer/cryptography/seal)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)
- [Project CLAUDE.md](../CLAUDE.md)

---

_Document last updated: 2025-11-19_
