# Smart Contract & API Specification (Based on MA_agreement.pdf)

This document outlines the technical specifications for the Earn-out smart contract and the corresponding API endpoints, based on the `MA_agreement.pdf` and operational documents.

## Major Finding: KPI Definition Discrepancy

A critical point of ambiguity exists between the legal contract and the operational documents.

- **Legal Agreement (`MA_agreement.pdf`, Section 2.1 & 2.2)**: Defines the KPI as "**Net Revenue**" but includes a contradictory rule for calculating an expense based on a percentage of that same "Net Revenue," creating a circular dependency.
- **Operational Logic (`M&A_blockchain_doc.txt`)**: Implies the KPI is **Net Profit** (`Revenue - Expenses`) and calculates the problematic expense (Headquarter Allocation) based on a separate, pre-defined cost pool.

**Recommendation:** The following specification adopts the **operational logic** as it is computationally feasible. However, the engineering team **must seek clarification from the legal/business team** to align the legal agreement with the implementation logic.

---

## 1. "Create a new deal" API Endpoint

This endpoint deploys a new Earn-out smart contract with its foundational, immutable parameters.

**Endpoint**: `POST /deals`

**Request Body**:
```json
{
  "dealName": "BuyYou Inc. & Global Tech Solutions Inc. Asset Purchase",
  "buyerName": "BuyYou Inc.",
  "sellerName": "Global Tech Solutions Inc.",
  "acquirerAddress": "0x...",
  "acquireeAddress": "0x...",
  "auditorAddress": "0x...",
  
  "earnoutPeriodYears": 3,
  "kpiTargetAmount": 900000,
  "contingentConsiderationAmount": 30000000,

  "rules": {
    "headquarterExpenseAllocationPercentage": 10
  }
}
```

---

## 2. "Update" API Endpoint

This endpoint is used to feed new data (transactions and expenses) to the smart contract for calculation.

**Endpoint**: `POST /deals/{dealId}/periods/{periodId}/propose`

### A. Transaction Revenue Update

Submits revenue from a transaction.

**Request Body**:
```json
{
  "updateType": "transaction",
  "date": "2025-11-10",
  "revenue": 75000,
  "documents": [
    { "name": "1110salesInvoice.pdf", "url": "/uploads/..." }
  ]
}
```

### B. Month-End Expense Update

Submits a consolidated report of all expenses for the month.

**Request Body**:
```json
{
  "updateType": "expense_report",
  "date": "2025-11-30",
  "data": {
    "fixedAssets": [
      { "assetId": "MACH-001A", "initialCost": 500000, "salvageValue": 50000, "lifeInYears": 10 },
      { "assetId": "MACH-002B", "initialCost": 350000, "salvageValue": 35000, "lifeInYears": 8 },
      { "assetId": "OFFICE-015", "initialCost": 40000, "salvageValue": 0, "lifeInYears": 5 }
    ],
    "payroll": [
      { 
        "employee": "John Doe", 
        "amount": 3950,
        "approvalTxHash": "0x... or null" 
      }
    ],
    "corporateOverhead": {
      "totalOverheadPool": 2050000
    }
  },
  "documents": [
    { "name": "FixedAssetsRegister_forDepreciation.json", "url": "/uploads/..." }
  ]
}
```
*Note*: The `approvalTxHash` field for payroll changes enforces the governance rule from Section 2.2.3 of the M&A agreement, requiring Seller approval for salary adjustments.

---

## 3. KPI Calculation Logic and Frequency

### Calculation Frequency

- **Revenue Aggregation**: **Real-time**. Revenue is added to the current month's total as each transaction is submitted.
- **Net Profit Calculation**: **Monthly**. Performed once at the end of the month upon submission of an `expense_report`.
- **KPI Check**: **Monthly**. Occurs immediately after the Net Profit calculation.

### Calculation Logic (Implemented in Smart Contract)

1.  **Initialize**: `cumulativeNetProfit` = `0`; `currentMonthRevenue` = `0`.
2.  **Aggregate Revenue**: On each `transaction` update, `currentMonthRevenue += revenue`.
3.  **Calculate Month-End Net Profit**: On an `expense_report` update:
    a.  **Calculate Total Depreciation**: Sum of `(asset.initialCost - asset.salvageValue) / (asset.lifeInYears * 12)` for all fixed assets.
    b.  **Calculate Total Payroll**: Sum of `payroll.amount`.
    c.  **Calculate Allocated Overhead**: `corporateOverhead.totalOverheadPool * rules.headquarterExpenseAllocationPercentage`.
    d.  **Calculate Current Month's Net Profit**: `currentMonthRevenue - Total Depreciation - Total Payroll - Allocated Overhead`.
4.  **Update Cumulative Profit & Check KPI**:
    a.  `cumulativeNetProfit += Current Month's Net Profit`.
    b.  `currentMonthRevenue` is reset to `0`.
    c.  **Condition Check**: `if (cumulativeNetProfit >= kpiTargetAmount)`:
        - **True**: Trigger payment of `contingentConsiderationAmount` to the `acquireeAddress`.
        - **False**: Continue to the next period.
5.  **End of Period**: If `earnoutPeriodYears` is reached and the KPI is not met, funds are returned to the `acquirerAddress`.
