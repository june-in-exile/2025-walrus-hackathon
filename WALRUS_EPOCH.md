# Walrus Blob Dynamic Storage Extension Mechanism

## Why This Feature?

### Business Context

In the M&A earn-out mechanism, financial documents (transaction records, invoices, etc.) are stored on Walrus as encrypted blobs. These documents serve as evidence for:

- KPI verification by auditors
- Dispute resolution
- Compliance and audit trails

### The Problem

Currently, all blobs are stored with a fixed duration (`WALRUS_STORAGE_EPOCHS=1`), which means:

- ❌ Short-lived evidence may expire before KPI attestation
- ❌ Unnecessary storage costs for documents after KPI is met
- ❌ No flexibility based on deal progress

### The Solution

**Dynamic Storage Extension Based on KPI Status**:

- **Before KPI Met**: Automatically extend blob storage each month (evidence still needed)
- **After KPI Met**: Stop extending, let blobs naturally expire (historical data no longer critical)
- **Cost Optimization**: Only pay for storage when documents are actively needed

---

## Implementation Strategy

### Core Concept

Implement a **lifecycle management system** that:

1. Monitors KPI attestation status for each period
2. Automatically extends blob storage for active (unmet) periods
3. Stops renewal once KPI targets are achieved
4. Provides manual override options for special cases

---

## Implementation Options

### Option A: Smart Contract Auto-Extension (Recommended)

**Move Contract Implementation**:

```move
// In earnout.move module
public entry fun extend_blob_storage_if_needed(
    deal: &mut Deal,
    period_id: u64,
    blob_id: String,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let period = vector::borrow(&deal.periods, period_id);

    // Check if KPI already met
    if (period.kpi_attested && period.kpi_value >= period.target_kpi) {
        // KPI met, no need to extend, refund payment
        transfer::public_transfer(payment, tx_context::sender(ctx));
        return
    };

    // KPI not met, extend storage via Walrus
    walrus::extend_blob(blob_id, EPOCHS_TO_EXTEND, payment);

    // Emit event for tracking
    event::emit(BlobExtended {
        deal_id: object::id(deal),
        period_id,
        blob_id,
        extended_epochs: EPOCHS_TO_EXTEND,
        timestamp: clock::timestamp_ms(clock)
    });
}
```

**Triggered by**:

- Backend cron job (automated)
- Buyer manual trigger (with gas fee incentive)
- Scheduled transactions (if Sui supports it)

**Pros**:

- ✅ Fully decentralized logic
- ✅ Transparent and auditable on-chain
- ✅ No trust required in backend services

**Cons**:

- ⚠️ Requires gas fees for each extension
- ⚠️ Depends on external trigger mechanism

---

### Option B: Backend Service Periodic Check

**Service Implementation**:

```typescript
// src/backend/services/blob-lifecycle-service.ts

import { SuiClient } from "@mysten/sui/client";
import { WalrusClient } from "@mysten/walrus";

export class BlobLifecycleService {
  private suiClient: SuiClient;
  private walrusClient: WalrusClient;

  constructor() {
    this.suiClient = new SuiClient({ url: process.env.SUI_RPC_URL });
    this.walrusClient = new WalrusClient({
      aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL,
    });
  }

  /**
   * Main entry point: Scan all active periods and extend blobs as needed
   */
  async extendBlobsForActivePeriods(): Promise<void> {
    console.log("[BlobLifecycle] Starting periodic blob extension check...");

    // Step 1: Get all periods that need storage extension
    const activePeriods = await this.getActivePeriodsNeedingExtension();
    console.log(`[BlobLifecycle] Found ${activePeriods.length} active periods`);

    for (const period of activePeriods) {
      try {
        await this.processPeriodBlobs(period);
      } catch (error) {
        console.error(
          `[BlobLifecycle] Failed to process period ${period.id}:`,
          error
        );
        // Continue with next period even if one fails
      }
    }

    console.log("[BlobLifecycle] Blob extension check completed");
  }

  /**
   * Process all blobs for a specific period
   */
  private async processPeriodBlobs(period: ActivePeriod): Promise<void> {
    // Step 2: Get all blobs associated with this period
    const blobs = await this.getBlobsForPeriod(period.dealId, period.id);
    console.log(
      `[BlobLifecycle] Period ${period.id} has ${blobs.length} blobs`
    );

    for (const blob of blobs) {
      try {
        await this.checkAndExtendBlob(blob, period);
      } catch (error) {
        console.error(
          `[BlobLifecycle] Failed to extend blob ${blob.id}:`,
          error
        );
      }
    }
  }

  /**
   * Check if a blob needs extension and extend if necessary
   */
  private async checkAndExtendBlob(
    blob: BlobMetadata,
    period: ActivePeriod
  ): Promise<void> {
    // Step 3: Check blob expiry time
    const expiryEpoch = await this.walrusClient.getBlobExpiry(blob.id);
    const currentEpoch = await this.suiClient.getCurrentEpoch();
    const remainingEpochs = expiryEpoch - currentEpoch;

    console.log(
      `[BlobLifecycle] Blob ${blob.id}: ${remainingEpochs} epochs remaining`
    );

    // Step 4: Decide if extension is needed
    const shouldExtend = this.shouldExtendBlob(
      remainingEpochs,
      period.endDate,
      period.kpiAttested
    );

    if (!shouldExtend) {
      console.log(`[BlobLifecycle] Blob ${blob.id} does not need extension`);
      return;
    }

    // Step 5: Calculate optimal extension duration
    const epochsToExtend = this.calculateOptimalExtension(
      remainingEpochs,
      period.endDate
    );

    // Step 6: Extend storage
    console.log(
      `[BlobLifecycle] Extending blob ${blob.id} by ${epochsToExtend} epochs`
    );
    await this.extendBlobStorage(blob.id, epochsToExtend);

    // Step 7: Record extension in database/on-chain
    await this.recordBlobExtension(blob.id, period.dealId, epochsToExtend);
  }

  /**
   * Query all periods that are active and need storage extension
   */
  private async getActivePeriodsNeedingExtension(): Promise<ActivePeriod[]> {
    // Query Sui events to find all periods
    const events = await this.suiClient.queryEvents({
      query: {
        MoveEventType: `${process.env.EARNOUT_PACKAGE_ID}::earnout::PeriodCreated`,
      },
    });

    const activePeriods: ActivePeriod[] = [];

    for (const event of events.data) {
      const period = event.parsedJson as PeriodEvent;

      // Filter: Only periods that are NOT yet KPI-attested or NOT met target
      if (!period.kpi_attested || period.kpi_value < period.target_kpi) {
        activePeriods.push({
          dealId: period.deal_id,
          id: period.period_id,
          endDate: new Date(period.end_date),
          kpiAttested: period.kpi_attested,
          kpiValue: period.kpi_value,
          targetKpi: period.target_kpi,
        });
      }
    }

    return activePeriods;
  }

  /**
   * Get all blobs associated with a specific period
   */
  private async getBlobsForPeriod(
    dealId: string,
    periodId: number
  ): Promise<BlobMetadata[]> {
    // Query WalrusBlobAdded events for this period
    const events = await this.suiClient.queryEvents({
      query: {
        MoveEventType: `${process.env.EARNOUT_PACKAGE_ID}::earnout::WalrusBlobAdded`,
      },
    });

    return events.data
      .filter((event) => {
        const data = event.parsedJson as WalrusBlobEvent;
        return data.deal_id === dealId && data.period_id === periodId;
      })
      .map((event) => {
        const data = event.parsedJson as WalrusBlobEvent;
        return {
          id: data.blob_id,
          dealId: data.deal_id,
          periodId: data.period_id,
          uploadedAt: new Date(data.timestamp),
        };
      });
  }

  /**
   * Determine if a blob should be extended based on business logic
   */
  private shouldExtendBlob(
    remainingEpochs: number,
    periodEndDate: Date,
    kpiAttested: boolean
  ): boolean {
    // Rule 1: If KPI already attested, no need to extend
    if (kpiAttested) {
      console.log("[BlobLifecycle] KPI already attested, skipping extension");
      return false;
    }

    // Rule 2: Calculate how many epochs we need until period end
    const now = Date.now();
    const daysUntilPeriodEnd =
      (periodEndDate.getTime() - now) / (1000 * 60 * 60 * 24);
    const DAYS_PER_EPOCH = 7; // Adjust based on actual Walrus epoch duration
    const epochsNeeded = Math.ceil(daysUntilPeriodEnd / DAYS_PER_EPOCH);

    // Rule 3: Extend if remaining epochs < needed epochs (with buffer)
    const BUFFER_EPOCHS = 10; // Safety margin
    const threshold = epochsNeeded + BUFFER_EPOCHS;

    console.log(
      `[BlobLifecycle] Need ${epochsNeeded} epochs, have ${remainingEpochs}, threshold ${threshold}`
    );

    return remainingEpochs < threshold;
  }

  /**
   * Calculate optimal number of epochs to extend
   */
  private calculateOptimalExtension(
    remainingEpochs: number,
    periodEndDate: Date
  ): number {
    const now = Date.now();
    const daysUntilPeriodEnd =
      (periodEndDate.getTime() - now) / (1000 * 60 * 60 * 24);
    const DAYS_PER_EPOCH = 7;
    const epochsNeeded = Math.ceil(daysUntilPeriodEnd / DAYS_PER_EPOCH);

    // Extend to cover period end + buffer, minus what we already have
    const BUFFER_EPOCHS = 10;
    const targetEpochs = epochsNeeded + BUFFER_EPOCHS;
    const epochsToAdd = Math.max(0, targetEpochs - remainingEpochs);

    // Cap at maximum extension limit
    const MAX_EXTENSION_PER_CALL = 100;
    return Math.min(epochsToAdd, MAX_EXTENSION_PER_CALL);
  }

  /**
   * Extend blob storage on Walrus
   */
  private async extendBlobStorage(
    blobId: string,
    epochs: number
  ): Promise<void> {
    // Check if Walrus supports direct extension
    if (typeof this.walrusClient.extendBlob === "function") {
      await this.walrusClient.extendBlob(blobId, epochs);
    } else {
      // Fallback: Re-upload mechanism (if Walrus doesn't support extension)
      await this.reuploadBlob(blobId, epochs);
    }
  }

  /**
   * Fallback: Re-upload blob if direct extension not supported
   */
  private async reuploadBlob(
    oldBlobId: string,
    epochs: number
  ): Promise<string> {
    console.log(
      `[BlobLifecycle] Re-uploading blob ${oldBlobId} (extension not supported)`
    );

    // Step 1: Download existing blob
    const data = await this.walrusClient.download(oldBlobId);

    // Step 2: Re-upload with new epochs
    const newBlobId = await this.walrusClient.upload(data, epochs);

    // Step 3: Update blob ID on-chain
    // TODO: Implement update_blob_id function in Move contract
    // await this.suiClient.moveCall({
    //   target: `${process.env.EARNOUT_PACKAGE_ID}::earnout::update_blob_id`,
    //   arguments: [dealId, periodId, oldBlobId, newBlobId]
    // });

    console.log(
      `[BlobLifecycle] Blob re-uploaded: ${oldBlobId} -> ${newBlobId}`
    );
    return newBlobId;
  }

  /**
   * Record blob extension in database or on-chain
   */
  private async recordBlobExtension(
    blobId: string,
    dealId: string,
    extendedEpochs: number
  ): Promise<void> {
    const currentEpoch = await this.suiClient.getCurrentEpoch();

    // Option 1: Store in local database
    // await db.blobExtensions.create({
    //   blobId,
    //   dealId,
    //   extendedAt: currentEpoch,
    //   extendedBy: extendedEpochs
    // });

    // Option 2: Emit on-chain event (requires Move contract support)
    // This would be done in the extend_blob_storage() Move function

    console.log(
      `[BlobLifecycle] Recorded extension for blob ${blobId}: +${extendedEpochs} epochs`
    );
  }
}

// TypeScript interfaces
interface ActivePeriod {
  dealId: string;
  id: number;
  endDate: Date;
  kpiAttested: boolean;
  kpiValue: number;
  targetKpi: number;
}

interface BlobMetadata {
  id: string;
  dealId: string;
  periodId: number;
  uploadedAt: Date;
}

interface PeriodEvent {
  deal_id: string;
  period_id: number;
  end_date: number;
  kpi_attested: boolean;
  kpi_value: number;
  target_kpi: number;
}

interface WalrusBlobEvent {
  deal_id: string;
  period_id: number;
  blob_id: string;
  timestamp: number;
}
```

**Cron Job Setup**:

```typescript
// app/api/cron/extend-blobs/route.ts

import { NextRequest, NextResponse } from "next/server";
import { BlobLifecycleService } from "@/src/backend/services/blob-lifecycle-service";

// This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions)
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const service = new BlobLifecycleService();
    await service.extendBlobsForActivePeriods();

    return NextResponse.json({
      success: true,
      message: "Blob extension check completed",
    });
  } catch (error) {
    console.error("[Cron] Blob extension failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

**Schedule via Vercel Cron**:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/extend-blobs",
      "schedule": "0 0 * * *" // Daily at midnight UTC
    }
  ]
}
```

**Or via GitHub Actions**:

```yaml
# .github/workflows/extend-blobs.yml
name: Extend Walrus Blobs

on:
  schedule:
    - cron: "0 0 * * *" # Daily at midnight UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  extend-blobs:
    runs-on: ubuntu-latest
    steps:
      - name: Call cron endpoint
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-app.vercel.app/api/cron/extend-blobs
```

**Pros**:

- ✅ Automated and hands-off
- ✅ Centralized logic, easy to update
- ✅ Can handle complex business rules

**Cons**:

- ⚠️ Requires trusted backend service
- ⚠️ Single point of failure
- ⚠️ Backend needs SUI tokens for gas fees

---

### Option C: Hybrid Approach (Recommended)

**Combine both methods**:

1. **Smart Contract Function**: `extend_blob_storage()` provides the on-chain capability
2. **Backend Automation**: Cron job automatically calls the contract function
3. **Frontend Manual Trigger**: Buyer can manually extend via Dashboard UI (with gas fee rebate incentive)

**Benefits**:

- ✅ Decentralized logic (on-chain)
- ✅ Automated execution (backend)
- ✅ User override (frontend)

---

## Technical Considerations

### 1. Walrus Storage Extension/Renewal (Confirmed ✅)

**CONFIRMED**: Walrus **SUPPORTS** blob storage extension via **Storage resource** on Sui blockchain.

#### How Walrus Storage Extension Works

**Core Concepts**:
- When you initially purchase storage, you **reserve** storage for a specific epoch range (`start_epoch` to `end_epoch`)
- Each blob is associated with a **Storage object** on Sui (not just the blob data itself)
- The Storage object has `start_epoch` and `end_epoch` fields
- **Extension = Pushing the `end_epoch` forward** via a Sui transaction

**Extension Mechanism**:
```typescript
// Extension is done by interacting with the Storage resource on Sui
import { Transaction } from '@mysten/sui/transactions';

async function extendBlobStorage(
  storageObjectId: string,  // Storage resource object ID on Sui (not blob ID!)
  additionalEpochs: number,
  storageResourceCoin: string  // Storage resource payment
): Promise<string> {
  const tx = new Transaction();

  // Call Walrus system package to extend the Storage object's end_epoch
  tx.moveCall({
    target: `${WALRUS_SYSTEM_PACKAGE}::storage::extend_storage`,
    arguments: [
      tx.object(storageObjectId),      // The Storage object to extend
      tx.pure.u64(additionalEpochs),   // Additional epochs to add
      tx.object(storageResourceCoin)   // Payment in storage resource tokens
    ]
  });

  const txBytes = await tx.build({ client: suiClient });
  return Buffer.from(txBytes).toString('base64');
}
```

**Important Design Details**:
1. **Storage object, not blob**: You extend the **Storage resource object**, not the blob itself
2. **Sui transaction required**: Extension is an on-chain operation (costs gas)
3. **Payment required**: Must pay for additional storage resource (not just gas)
4. **Maximum limit**: Walrus has a maximum storage duration (~2 years / max epoch count)

#### Storage vs Blob Relationship

```
Blob (data stored on Walrus network)
  ↓ associated with
Storage Object (on Sui blockchain)
  ├── start_epoch: u64
  ├── end_epoch: u64   ← This is what gets extended
  ├── blob_id: String
  └── storage_size: u64
```

#### Extension Workflow

**Step 1: Query Storage Object**
```typescript
// Find the Storage object associated with a blob
async function getStorageObjectForBlob(blobId: string): Promise<string> {
  const events = await suiClient.queryEvents({
    query: {
      MoveEventType: `${WALRUS_SYSTEM_PACKAGE}::blob::BlobRegistered`
    }
  });

  const blobEvent = events.data.find(e =>
    e.parsedJson.blob_id === blobId
  );

  return blobEvent.parsedJson.storage_object_id;
}
```

**Step 2: Check Current Expiry**
```typescript
async function getStorageExpiry(storageObjectId: string): Promise<number> {
  const storageObject = await suiClient.getObject({
    id: storageObjectId,
    options: { showContent: true }
  });

  const fields = storageObject.data.content.fields;
  return fields.end_epoch;
}
```

**Step 3: Extend Storage**
```typescript
async function extendStorage(
  storageObjectId: string,
  newEndEpoch: number
): Promise<void> {
  // Purchase additional storage resource
  const storageResource = await purchaseStorageResource(
    calculateStorageCost(currentEndEpoch, newEndEpoch)
  );

  // Extend via Move call
  const tx = new Transaction();
  tx.moveCall({
    target: `${WALRUS_SYSTEM_PACKAGE}::storage::extend`,
    arguments: [
      tx.object(storageObjectId),
      tx.pure.u64(newEndEpoch),
      tx.object(storageResource)
    ]
  });

  await suiClient.signAndExecuteTransaction({ transaction: tx });
}
```

#### Important Considerations

**1. Maximum Storage Duration (~2 Years)**
- Walrus has a system-defined maximum storage period
- Currently designed for approximately 2 years
- Cannot extend beyond this limit (must re-upload if needed)

**2. Gas Costs**
- Every extension requires a Sui transaction
- Gas fees must be paid in addition to storage resource cost
- Batch extensions recommended to reduce overhead

**3. Storage Resource Payment**
- Must purchase Storage resource tokens to extend
- Cost = `blob_size × additional_epochs × price_per_byte_per_epoch`
- Requires funding pool or automated payment mechanism

**4. Automated Renewal Strategy**
- Walrus designers encourage embedding renewal logic in smart contracts
- Enables "theoretically infinite" storage as long as someone continues paying
- Critical for long-term data availability

**5. Risk of Expiry**
- If automated renewal fails, blob will expire
- No automatic extension without active transaction
- Must monitor and trigger extensions proactively

#### Integration with Earnout Contract

**Move Contract Pattern**:
```move
// In earnout.move
public entry fun extend_deal_blob_storage(
    deal: &mut Deal,
    period_id: u64,
    blob_id: String,
    storage_object_id: ID,  // The Storage object to extend
    additional_epochs: u64,
    storage_payment: Coin<SUI>,
    ctx: &mut TxContext
) {
    // Verify caller is authorized
    assert!(is_buyer(deal, tx_context::sender(ctx)), ENotAuthorized);

    // Verify blob belongs to this period
    let period = vector::borrow(&deal.periods, period_id);
    assert!(blob_exists_in_period(period, &blob_id), EBlobNotFound);

    // Call Walrus system to extend storage
    walrus::storage::extend(
        storage_object_id,
        additional_epochs,
        storage_payment
    );

    // Emit event for tracking
    event::emit(BlobStorageExtended {
        deal_id: object::id(deal),
        period_id,
        blob_id,
        storage_object_id,
        new_end_epoch: /* calculate */,
        extended_at: clock::timestamp_ms(clock)
    });
}
```

**Backend Service Adjustments**:
```typescript
// Update BlobLifecycleService to track Storage objects
interface BlobMetadata {
  blobId: string;
  storageObjectId: string;  // ← Critical: Track Storage object ID
  dealId: string;
  periodId: number;
  endEpoch: number;
  uploadedAt: Date;
}

// When uploading, store both blob ID and Storage object ID
async function recordBlobUpload(
  blobId: string,
  storageObjectId: string,  // Retrieved from Walrus upload response
  dealId: string,
  periodId: number
) {
  await db.blobs.create({
    blobId,
    storageObjectId,  // Must store this for future extensions
    dealId,
    periodId,
    endEpoch: /* get from Storage object */
  });
}
```

**Fallback: Re-upload Mechanism** (only if max duration reached):

```typescript
async function renewBlob(
  oldBlobId: string,
  newEpochs: number
): Promise<string> {
  // 1. Download existing blob data
  const data = await walrusClient.download(oldBlobId);

  // 2. Re-upload with new epoch count (creates new blob ID)
  const newBlobId = await walrusClient.upload(data, newEpochs);

  // 3. Update blob ID reference on-chain
  await updateBlobIdOnChain(oldBlobId, newBlobId);

  return newBlobId;
}
```

**Move Contract Support**:

```move
// Add function to update blob ID mapping
public entry fun update_blob_id(
    deal: &mut Deal,
    period_id: u64,
    old_blob_id: String,
    new_blob_id: String,
    ctx: &mut TxContext
) {
    // Verify caller is authorized
    // Update blob_id in period.walrus_blobs vector
    // Emit BlobIdUpdated event
}
```

---

### 2. Cost Calculation & Optimization

**Estimate Extension Costs**:

```typescript
interface ExtensionCostCalculator {
  // Walrus pricing (need to verify actual values)
  COST_PER_MB_PER_EPOCH: number; // e.g., 0.001 SUI

  calculateExtensionCost(blobSizeBytes: number, epochs: number): number {
    const sizeInMB = blobSizeBytes / (1024 * 1024);
    return sizeInMB * epochs * this.COST_PER_MB_PER_EPOCH;
  }

  // Calculate total storage cost for a deal
  async estimateDealStorageCost(dealId: string): Promise<number> {
    const blobs = await this.getAllBlobsForDeal(dealId);
    let totalCost = 0;

    for (const blob of blobs) {
      const size = await walrusClient.getBlobSize(blob.id);
      const expiryEpoch = await walrusClient.getBlobExpiry(blob.id);
      const currentEpoch = await suiClient.getCurrentEpoch();
      const remainingEpochs = expiryEpoch - currentEpoch;

      totalCost += this.calculateExtensionCost(size, remainingEpochs);
    }

    return totalCost;
  }
}
```

**Smart Extension Strategy**:

- Extend in batches (e.g., 30 epochs at a time) to reduce transaction overhead
- Monitor Walrus pricing and adjust extension frequency
- Allow buyers to prepay for extended storage

---

### 3. Database Schema for Tracking

**Option 1: Off-chain Database**:

```typescript
// Prisma schema example
model BlobLifecycle {
  id                String   @id @default(cuid())
  blobId            String   @unique
  dealId            String
  periodId          Int

  uploadedEpoch     Int
  currentExpiryEpoch Int

  autoRenewalEnabled Boolean @default(true)

  extensions        BlobExtension[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model BlobExtension {
  id              String   @id @default(cuid())
  blobLifecycleId String
  blobLifecycle   BlobLifecycle @relation(fields: [blobLifecycleId], references: [id])

  extendedAtEpoch Int
  extendedByEpochs Int
  costInSUI       Float
  txDigest        String

  createdAt       DateTime @default(now())
}
```

**Option 2: On-chain Tracking**:

```move
// In earnout.move
struct BlobMetadata has store {
    blob_id: String,
    uploaded_epoch: u64,
    expiry_epoch: u64,
    extension_history: vector<Extension>
}

struct Extension has store, copy, drop {
    epoch: u64,
    extended_by: u64,
    tx_digest: vector<u8>
}
```

---

### 4. Frontend Dashboard Integration

**Display Storage Status**:

```typescript
// src/frontend/components/features/dashboard/BlobStorageStatus.tsx

interface BlobStorageStatusProps {
  dealId: string;
  periodId: number;
}

export function BlobStorageStatus({
  dealId,
  periodId,
}: BlobStorageStatusProps) {
  const { data: blobs } = useQuery({
    queryKey: ["blobs", dealId, periodId],
    queryFn: () =>
      fetch(`/api/deals/${dealId}/periods/${periodId}/blobs`).then((r) =>
        r.json()
      ),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Storage Status</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Expires In</TableHead>
              <TableHead>Auto-Renew</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blobs?.map((blob) => (
              <TableRow key={blob.id}>
                <TableCell>{blob.filename}</TableCell>
                <TableCell>{formatBytes(blob.size)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      blob.remainingEpochs < 10 ? "destructive" : "default"
                    }
                  >
                    {blob.remainingEpochs} epochs
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={blob.autoRenewEnabled}
                    onCheckedChange={(checked) =>
                      toggleAutoRenew(blob.id, checked)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => extendBlobManually(blob.id)}
                  >
                    Extend Now
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm">
            💡 <strong>Storage Cost Estimate:</strong>{" "}
            {formatCost(totalStorageCost)} SUI/month
          </p>
          <p className="text-sm text-muted-foreground">
            Auto-renewal will stop once this period's KPI is attested and met.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Manual Extension API**:

```typescript
// app/api/deals/[dealId]/blobs/[blobId]/extend/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: { dealId: string; blobId: string } }
) {
  const { epochs } = await request.json();

  // Generate unsigned transaction bytes
  const tx = new Transaction();
  tx.moveCall({
    target: `${process.env.EARNOUT_PACKAGE_ID}::earnout::extend_blob_storage`,
    arguments: [
      tx.object(params.dealId),
      tx.pure.u64(/* period_id */),
      tx.pure.string(params.blobId),
      tx.pure.u64(epochs)
    ]
  });

  const txBytes = await tx.build({ client: suiClient });

  return NextResponse.json({
    txBytes: Buffer.from(txBytes).toString('base64'),
    estimatedGasCost: /* calculate */
  });
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

1. ✅ **Research Walrus API**

   - Verify if `extendBlob()` API exists
   - Document API endpoints and parameters
   - Test on Walrus testnet

2. ✅ **Design Database Schema**

   - Create `BlobLifecycle` and `BlobExtension` models
   - Set up migration scripts
   - Add indexes for efficient querying

3. ✅ **Update Move Contracts**
   ```move
   // Add to earnout.move:
   - extend_blob_storage()
   - update_blob_id() // If re-upload needed
   - BlobExtended event
   ```

### Phase 2: Backend Service (Week 2)

4. ✅ **Implement BlobLifecycleService**

   - `extendBlobsForActivePeriods()`
   - `getActivePeriodsNeedingExtension()`
   - `shouldExtendBlob()` business logic
   - `calculateOptimalExtension()`

5. ✅ **Create Cron Job Endpoint**

   - `/api/cron/extend-blobs`
   - Add authentication (CRON_SECRET)
   - Error handling and logging
   - Alerting for failures

6. ✅ **Set Up Scheduling**
   - Configure Vercel Cron or GitHub Actions
   - Test cron execution
   - Monitor logs

### Phase 3: Frontend Integration (Week 3)

7. ✅ **Build Dashboard UI**

   - `BlobStorageStatus` component
   - Display expiry status for each blob
   - Auto-renewal toggle
   - Manual extension button

8. ✅ **API Endpoints**

   - `GET /api/deals/:dealId/periods/:periodId/blobs` - List blobs with status
   - `POST /api/deals/:dealId/blobs/:blobId/extend` - Manual extension
   - `PATCH /api/deals/:dealId/blobs/:blobId/auto-renew` - Toggle auto-renewal

9. ✅ **Cost Estimation**
   - Display estimated storage costs
   - Show extension history
   - Alert when costs exceed threshold

### Phase 4: Testing & Optimization (Week 4)

10. ✅ **Integration Testing**

    - Test full lifecycle: upload → auto-extend → KPI met → stop extension
    - Test manual extension flow
    - Test re-upload fallback (if extension not supported)

11. ✅ **Cost Optimization**

    - Batch extensions to reduce gas costs
    - Optimize extension frequency
    - Implement cost alerts

12. ✅ **Documentation**
    - Update API documentation
    - Write user guide for storage management
    - Document cron job setup

---

## Environment Configuration

Add to `.env`:

```bash
# Blob Lifecycle Management
BLOB_EXTENSION_ENABLED="true"
BLOB_EXTENSION_CRON_SCHEDULE="0 0 * * *"  # Daily at midnight
BLOB_EXPIRY_THRESHOLD_EPOCHS="10"  # Extend when < 10 epochs remaining
BLOB_EXTENSION_AMOUNT_EPOCHS="30"  # Extend by 30 epochs each time
CRON_SECRET="your_secure_cron_secret_here"

# Cost Management
MAX_MONTHLY_STORAGE_COST="100"  # Alert if cost exceeds 100 SUI/month
STORAGE_COST_PER_MB_PER_EPOCH="0.001"  # Adjust based on actual Walrus pricing
```

---

## Monitoring & Alerts

**Metrics to Track**:

- Number of blobs extended per day
- Total storage cost per deal
- Failed extension attempts
- Blobs nearing expiry

**Alert Conditions**:

- ⚠️ Blob expires in < 5 epochs and extension failed
- ⚠️ Monthly storage cost exceeds budget
- ⚠️ Cron job hasn't run for > 48 hours
- ⚠️ Extension API errors > 5 in 1 hour

**Logging**:

```typescript
// Use structured logging
logger.info("[BlobLifecycle] Extension completed", {
  blobId,
  dealId,
  periodId,
  extendedEpochs,
  costInSUI,
  txDigest,
});
```

---

## Security Considerations

1. **Cron Endpoint Protection**

   - Use strong `CRON_SECRET`
   - Rate limiting
   - IP whitelist (if possible)

2. **Gas Fee Management**

   - Backend wallet should have sufficient SUI
   - Alert when balance < threshold
   - Consider gas price limits

3. **Access Control**
   - Only authorized roles can manually extend
   - Verify deal participation before extension
   - Audit log all extension actions

---

## Cost-Benefit Analysis

### Current Approach (Fixed 1 Epoch)

- **Pros**: Simple, predictable
- **Cons**:
  - ❌ May lose data before KPI attestation
  - ❌ No cost optimization

### Dynamic Extension Approach

- **Pros**:
  - ✅ Data available when needed
  - ✅ Cost savings after KPI met (~50-70% reduction)
  - ✅ Flexible and adaptive
- **Cons**:
  - ⚠️ Added complexity
  - ⚠️ Requires monitoring infrastructure
  - ⚠️ Gas fees for extensions

**ROI Calculation**:

```
Typical Deal:
- 10 documents uploaded per period
- Average size: 5MB per document
- Storage cost: 0.001 SUI per MB per epoch
- Deal duration: 12 months (52 weeks)

Fixed Storage (52 epochs):
Cost = 10 docs × 5MB × 52 epochs × 0.001 = 2.6 SUI

Dynamic Storage (avg 26 epochs before KPI met):
Cost = 10 docs × 5MB × 26 epochs × 0.001 = 1.3 SUI
Savings = 1.3 SUI per deal (50% reduction)
```

---

## Future Enhancements

1. **Predictive Extension**

   - Use ML to predict optimal extension timing
   - Analyze historical KPI attestation patterns

2. **Batch Operations**

   - Extend multiple blobs in single transaction
   - Reduce gas overhead

3. **Decentralized Triggers**

   - Use Sui's scheduled transactions (when available)
   - Reduce reliance on centralized cron

4. **Cost Optimization**

   - Dynamic epoch calculation based on real-time Walrus pricing
   - Prepaid storage pools for bulk discounts

5. **User Notifications**
   - Email/SMS alerts when blobs near expiry
   - Weekly storage cost reports

---

## Summary

This dynamic blob storage extension mechanism provides:

1. **Cost Efficiency**: Only pay for storage when documents are actively needed
2. **Reliability**: Automatic extension ensures data availability for audits
3. **Flexibility**: Manual override for special cases
4. **Transparency**: Full audit trail of extensions on-chain

**Next Steps**:

1. Verify Walrus extension API capabilities
2. Implement Move contract functions
3. Build backend lifecycle service
4. Deploy cron job scheduling
5. Create frontend dashboard UI

---

## References

- Walrus Documentation: https://docs.walrus.site
- Sui Move Documentation: https://docs.sui.io/guides/developer/sui-101/create-coin
- Cron Job Setup: Vercel Cron / GitHub Actions

---

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Author**: Claude Code Assistant
**Status**: Implementation Pending
