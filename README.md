# Decentralized M&A Earn-out Management Platform

<div align="center">

![M&A Logo](./public/M&A%20Logo.png)

**A decentralized, transparent M&A earn-out management platform powered by Sui, Walrus, and Seal**

[Live Demo](https://ma-earnout-2025walrushackathon.vercel.app) | [Video Demo](#) | [Documentation](./docs)

_Built for [2025 Walrus Hackathon](https://walrus.site)_

</div>

---

## 🎯 The Problem

In traditional M&A (Mergers & Acquisitions) transactions, **earn-out agreements** are common but problematic:

- **Opacity**: Sellers can't verify if buyers are reporting revenue honestly
- **Disputes**: 70% of earn-outs end in litigation over KPI calculations
- **Slow Settlement**: Manual audits take months, delaying payments to sellers
- **High Costs**: Legal and auditing fees consume 10-15% of earn-out value

**Example**: A $30M earn-out payment contingent on $900K revenue often results in:

- Buyer provides opaque financial reports
- Seller disputes the calculations
- 6-12 months of legal negotiations
- $3-4M in legal and auditing costs

## 💡 Our Solution

A **trustless earn-out protocol** where:

1. **Buyers upload encrypted financial documents to Walrus** (invoices, payroll, expense reports)
2. **Smart contracts on Sui** enforce role-based access (buyer, seller, auditor)
3. **Auditors verify data** stored on Walrus without central authority
4. **KPI calculations run in Nautilus TEE** with cryptographic attestation
5. **Automatic settlement** when KPIs are met - no lawyers needed

### Why Walrus?

**Walrus is central to our architecture**, not peripheral:

| Feature            | Traditional Solution                                      | Our Solution with Walrus                               |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------ |
| **Data Storage**   | Centralized servers (AWS/Azure) - single point of failure | Decentralized storage on Walrus - censorship-resistant |
| **Data Privacy**   | Encrypted at rest, but cloud provider has access          | Seal encryption - only authorized roles can decrypt    |
| **Data Integrity** | Trust the database - no proof of tampering                | Immutable blob IDs registered on-chain                 |
| **Availability**   | 99.9% SLA, subject to provider policies                   | Byzantine fault-tolerant storage network               |
| **Censorship**     | Can be seized, blocked, or deleted                        | No single entity controls access                       |

**Walrus enables**:

- **Decentralized document repository** that no single party controls
- **Verifiable data integrity** via on-chain blob ID registration
- **Scalable storage** for large financial datasets (reports, invoices, contracts)
- **Cost efficiency** compared to on-chain storage (1000x cheaper)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js + React)                  │
│                    • Sui Wallet Integration                     │
│                    • Seal SDK (Encrypt/Decrypt)                 │
│                    • TEE Client                                 │
└─┬──────────┬────────────────┬──────────────┬────────────────────┘
  │          │                │              │
  │          │                │              └──────────────┐
  │          ▼                ▼                             ▼
  │  ┌──────────────┐  ┌──────────────┐          ┌────────────────┐
  │  │ Seal Service │  │   Backend    │          │  Nautilus TEE  │
  │  │              │  │   (Relay)    │          │                │
  │  │ • Encrypt    │  │              │          │ • KPI Compute  │
  │  │ • Decrypt    │  │ • Upload     │───────┐  │ • Attestation  │
  │  │ • Key Policy │  │   Relay      │       │  │ • Ed25519 Sign │
  │  └──────────────┘  └──────────────┘       │  └────────────────┘
  │                                           │
  │                                           ▼
  │                                  ┌──────────────────┐
  │                                  │ Walrus Storage   │
  │                                  │                  │
  └─────────────────────────────────►│ • Encrypted Data │
  │                                  │ • Blob IDs       │
  │                                  │ • Decentralized  │
  │                                  └────────┬─────────┘
  │                                           │
  │                                           │ Blob IDs
  └                                           │
  │                                           ▼
  │                                  ┌──────────────────┐
  │                                  │  Sui Blockchain  │
  │                                  │                  │
  │                                  │ • Deal Contracts │
  └─────────────────────────────────►│ • Access Control │
                                     │ • KPI Registry   │
                                     │ • Blob Registry  │
                                     └──────────────────┘
```

### Data Flow

**Deal Creation Flow**:

1. **Buyer** prepares deal parameters (seller address, auditor address, KPI targets, etc.)
2. **Frontend** → **Backend Relay** → **Walrus** (upload encrypted deal docs)
3. **Frontend** signs Sui transaction with deal parameters + blob ID
4. **Sui Blockchain** creates deal contract and stores blob ID (`earnout::create_deal`)

**Financial Data Upload Flow**:

1. **Frontend** encrypts financial docs with Seal SDK (client-side)
2. **Frontend** → **Backend Relay** → **Walrus** (upload encrypted blob)
3. **Frontend** signs Sui transaction to register blob ID on-chain
4. **Sui Blockchain** stores blob ID + metadata in deal contract (`earnout::add_walrus_blob`)

**Download & Verification Flow**:

1. **Frontend** fetches encrypted blob from **Walrus** (via blob ID)
2. **Frontend** decrypts with Seal SDK (`earnout::seal_approve`)
3. **Auditor** verifies decrypted data and attests it on-chain
4. **Smart Contract** updates verification status (`earnout::audit_data`)

**KPI Calculation with TEE**:

1. **Frontend** downloads encrypted blobs from **Walrus**
2. **Frontend** decrypts data with Seal SDK
3. **Frontend** sends decrypted data to **Nautilus TEE**
4. **TEE** computes KPI + generates cryptographic attestation
5. **Frontend** submits KPI result + attestation to **Sui Blockchain** (`earnout::submit_kpi_and_settle`)
6. **Smart Contract** verifies attestation → executes settlement (`earnout::verify_nautilus_attestation`)

## ✨ Key Features

### For Buyers

- **Transparent Process**: On-chain proof of all financial submissions
- **Reduced Legal Costs**: Automated KPI verification eliminates disputes
- **Flexible Reporting**: Upload revenue, expenses, and payroll data monthly

### For Sellers

- **Real-time Monitoring**: Track KPI progress against targets
- **Trustless Verification**: Decrypt financial docs anytime without buyer permission
- **Guaranteed Payment**: Smart contract escrow ensures funds are available

### For Auditors

- **Immutable Audit Trail**: All data submissions timestamped on-chain
- **Efficient Workflow**: Download encrypted docs from Walrus, verify, attest KPI
- **Cryptographic Proof**: Sign attestations with wallet key

## 🛠️ Tech Stack

| Component           | Technology            | Purpose                                       |
| ------------------- | --------------------- | --------------------------------------------- |
| **Blockchain**      | Sui Network           | Smart contracts, access control, KPI registry |
| **Storage**         | **Walrus Protocol**   | Decentralized storage for financial documents |
| **Encryption**      | Mysten Seal           | Role-based access control for sensitive data  |
| **TEE**             | Nautilus              | Trustless KPI computation with attestation    |
| **Smart Contracts** | Sui Move              | On-chain deal logic and settlement            |
| **Frontend**        | Next.js 16 + React 19 | Web application with wallet integration       |
| **Wallet**          | @mysten/dapp-kit      | Sui wallet connection and transaction signing |
| **UI**              | Tailwind + shadcn/ui  | Responsive, accessible components             |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Sui Wallet (Sui Wallet Extension or zkLogin)
- Sui Testnet tokens ([faucet](https://discord.com/channels/916379725201563759/971488439931392130))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/2025-walrus-hackathon.git
cd 2025-walrus-hackathon

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Environment Configuration

Key variables in `.env.local`:

```bash
# Sui Network
SUI_NETWORK=testnet
EARNOUT_PACKAGE_ID=
NEXT_PUBLIC_EARNOUT_PACKAGE_ID=

# Walrus Storage
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space

# Seal Encryption
SEAL_KEY_SERVER_OBJECT_IDS=
```

See `.env.example` for full configuration options.

## 📖 Usage Example

### 1. Create an Earn-out Deal

```typescript
// Buyer connects wallet and creates deal
const deal = await createDeal({
  name: "TechCorp Acquisition 2025",
  seller: "0xSELLER_ADDRESS",
  auditor: "0xAUDITOR_ADDRESS",
  earnoutPeriodYears: 3,
  kpiTargetAmount: 900000, // $900K revenue target
});
```

### 2. Upload Financial Data to Walrus

```typescript
// Buyer uploads encrypted invoice
const result = await uploadFile(invoiceFile, {
  dealId: deal.id,
  periodId: "2025-Q1",
  dataType: "sales_invoice",
  encryptionMode: "client_encrypted", // Seal encryption
});

// Walrus blob ID registered on-chain
console.log("Blob ID:", result.blobId);
```

### 3. Auditor Verifies Data

```typescript
// Auditor retrieves and decrypts from Walrus
const blob = await fetchBlobFromWalrus(result.blobId);
const decrypted = await sealDecrypt(blob, auditorWallet);

// Verify calculations and attest KPI
await attestKPI({
  dealId: deal.id,
  periodId: "2025-Q1",
  verifiedValue: 250000, // Verified revenue
  approve: true,
});
```

### 4. Automatic Settlement

```typescript
// If KPI target met, smart contract transfers funds
// No manual intervention required
```

## 🏆 Walrus Integration Highlights

### 1. Decentralized Document Repository

Instead of storing financial documents on centralized servers, we use **Walrus as the single source of truth**:

```typescript
// Upload to Walrus
const response = await fetch("/api/v1/walrus/upload", {
  method: "POST",
  body: formData,
});
const { blobId } = await response.json();

// Register blob ID on Sui blockchain
tx.moveCall({
  target: `${packageId}::earnout::add_walrus_blob`,
  arguments: [dealId, periodIndex, blobId, dataType, clock],
});
```

**Benefits**:

- **Immutable references**: Blob IDs can't be changed after registration
- **No single point of failure**: Data survives even if original uploader disappears
- **Censorship resistance**: No entity can delete or block access to data

### 2. Seal + Walrus Integration

We combine **Seal encryption** with **Walrus storage** for privacy:

```typescript
// Encrypt with Seal policy (buyer, seller, auditor can decrypt)
const encrypted = await sealEncrypt(fileData, {
  keyServerIds: SEAL_KEY_SERVERS,
  policy: {
    allowedAddresses: [buyer, seller, auditor],
  },
});

// Upload encrypted blob to Walrus
const blobId = await walrusUpload(encrypted);
```

**Result**: Financial data is stored publicly on Walrus, but only authorized parties can decrypt it.

### 3. TEE Attestation with Walrus Data

Nautilus TEE retrieves data from Walrus for tamper-proof KPI calculation:

```typescript
// TEE fetches encrypted data from Walrus
const blobs = await Promise.all(blobIds.map((id) => fetchFromWalrus(id)));

// TEE decrypts and computes KPI
const kpi = computeKPI(blobs);

// TEE signs attestation
const attestation = sign(kpi, teePrivateKey); // 144 bytes
```

**Guarantee**: KPI was computed from the exact data stored on Walrus, verified by TEE signature.

## 📚 Project Structure

```
├── app/                    # Next.js App Router
│   ├── (frontend)/        # User-facing pages
│   └── api/v1/            # REST API endpoints
│
├── src/
│   ├── backend/
│   │   ├── contracts/     # Sui Move smart contracts
│   │   └── services/      # Business logic (Walrus, Seal, Sui)
│   ├── frontend/
│   │   ├── components/    # React UI components
│   │   └── hooks/         # Custom hooks for blockchain/Walrus
│   └── shared/            # Shared types and utilities
│
├── nautilus/              # Rust TEE code for KPI calculation
└── docs/                  # OpenAPI specifications
```

## 🧪 Smart Contract

Deployed on **Sui Testnet**:

- **Package ID**: ``
- **Module**: `earnout`

Key functions:

- `create_deal`: Initialize earn-out agreement
- `add_walrus_blob`: Register Walrus blob ID on-chain
- `propose_kpi`: Buyer proposes KPI value
- `attest_kpi`: Auditor verifies and approves KPI
- `execute_settlement`: Transfer funds based on attested KPI

See [Contract README](./src/backend/contracts/README.md) for deployment guide.

## 🎥 Demo

> **[Live Application](https://ma-earnout-2025walrushackathon.vercel.app)**

1. Connect Sui wallet (testnet)
2. Create a new earn-out deal
3. Upload sample financial data (encrypted with Seal, stored on Walrus)
4. View dashboard with KPI tracking
5. Execute settlement when KPI target is met

## 🔮 Future Enhancements

- **Multi-TEE Consensus**: Require 2-of-3 TEE nodes to agree on KPI
- **Advanced KPI Formulas**: Support EBITDA, gross margin, custom metrics
- **Dispute Resolution**: On-chain arbitration mechanism
- **Mobile App**: React Native app for on-the-go monitoring
- **Analytics Dashboard**: Historical KPI trends and forecasting

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

Built with:

- [Walrus Protocol](https://walrus.site) - Decentralized storage
- [Sui Network](https://sui.io) - High-performance blockchain
- [Mysten Seal](https://github.com/MystenLabs/seal) - Role-based encryption
- [Nautilus](https://nautilus.network) - Trusted Execution Environment

---

<div align="center">

**Built for 2025 Walrus Hackathon**

[Report Bug](https://github.com/yourusername/2025-walrus-hackathon/issues) | [Request Feature](https://github.com/yourusername/2025-walrus-hackathon/issues)

</div>
