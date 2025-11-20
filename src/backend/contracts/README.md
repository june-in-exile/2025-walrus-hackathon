# Earnout Protocol (Sui + Walrus)

This repository contains the smart contract for an M&A Earnout mechanism secured by Sui Move and Walrus Protocol. It allows buyers to lock deal terms, upload data proofs (Walrus Blobs), and automate KPI verification with an auditor.

## 📋 Deployment Information

* **Network:** Sui Testnet
* **Package ID:** `0x0870f322afea4ff897e855b74d200d14893c701b50678a8a9151ebf2f56d4848`
* **Modules:** `earnout`, `whitelist`

---

## 🛠 Integration Guide (Backend & Frontend)

### ⚠️ Important Note for Developers

In the CLI examples provided below, you will see variables like `$PACKAGE_ID`, `$DEAL_ID`, or `$DEAL_NAME`.

**For Backend/Frontend integration:**
1.  **Do NOT** manually export these specific deal variables in your server environment.
2.  **DO** ensure these values are dynamically passed from the **Frontend inputs**.

**Logic Example:**
1.  **Frontend:** User fills in a form with "Deal Name" and "Seller Address".
2.  **API Request:** Frontend sends a JSON payload (e.g., `{ name: "Deal 2025", seller: "0x..." }`) to the Backend.
3.  **Backend:** Receives the payload and injects these values into the transaction construction function.

---

## 🚀 Contract Interaction Flow

### 0. Deploy Smart Contracts

```bash
# switch to testnet
$ sui client switch --env testnet

# (optional) check your wallet 
sui client faucet

# build the contract
$ cd contracts
$ sui move build

# deploy to testnet
sui client publish --gas-budget 100000000 --skip-dependency-verification

```

If you deployed successfully, you can see the PackageID and ObjectID
![alt text](image.png)

You can use export to let terminal remember the 
```bash
$ export PACKAGE_ID=0xb2752ee42f5d063dcda98497df71a79e54d37908bfd8d9e23257cd618f92bce6 \
OBJECT_ID=0x228f84944579efb3df1f5abf7442a8f79eb5611f8b06154115e8de03904a8a37
```

### 1. Create Deal
Initializes the deal object and sets up the whitelist.

* **Function:** `create_deal`
* **Permission:** Any User (Becomes Buyer)
* **Inputs:** `name` (String), `seller` (Address), `auditor` (Address)

```bash
# CLI Example
# The backend should inject the addresses received from the frontend
sui client call --package $PACKAGE_ID --module earnout --function create_deal \
--args "Acquisition Deal 2025" "0xSELLER_ADDRESS" "0xAUDITOR_ADDRESS" \
--gas-budget 10000000
```
Note: Capture the Deal Object ID from the Created Objects field in the transaction response.

### 2. Add Period
Adds a financial period (e.g., "Q1-2025") to the deal.

* **Function:** `add_period`
* **Permission:** `Buyer Only`
* **Inputs:** `deal_id` (Object ID), `period_id` (String)

```bash
# CLI Example
sui client call --package $PACKAGE_ID --module earnout --function add_period \
--args $DEAL_ID "2025-Q1" \
--gas-budget 10000000
```

### 3. Upload Data Proof (Walrus)
Links a Walrus Blob ID to a specific period as proof of performance.

* **Function:** `add_walrus_blob`
* **Permission:** `Buyer Only`
* **Inputs:** `deal_id`, `period_index` (u64), `blob_id` (String), `data_type` (String), `clock` (0x6)

```Bash
# CLI Example
# period_index: 0 for the first period, 1 for the second...
sui client call --package $PACKAGE_ID --module earnout --function add_walrus_blob \
--args $DEAL_ID 0 "blob_id_from_walrus" "financial_report" 0x6 \
--gas-budget 10000000
```

### 4. Propose KPI
Buyer proposes a KPI value based on the uploaded data.

* **Function:** `propose_kpi`
* **Permission:** `Buyer Only`
* **Inputs:** `deal_id`, `period_index` (u64), `value` (u64), `notes` (String), `clock` (0x6)

```Bash
# CLI Example
# value: e.g., 1000000 (Revenue)
sui client call --package $PACKAGE_ID --module earnout --function propose_kpi \
--args $DEAL_ID 0 1000000 "Revenue Q1 based on blobs" 0x6 \
--gas-budget 10000000
```

### 5. Attest KPI
Auditor verifies the data and approves or rejects the KPI.

* **Function:** `attest_kpi`

* **Permission:** `Auditor Only`

* **Inputs:** `deal_id`, `period_index` (u64), `verified_value` (u64), `approve` (bool), `notes` (String), `clock` (0x6)

```Bash
# CLI Example
# Must be signed by the Auditor's wallet address
sui client call --package $PACKAGE_ID --module earnout --function attest_kpi \
--args $DEAL_ID 0 1000000 true "Verified and Approved" 0x6 \
--gas-budget 10000000
```