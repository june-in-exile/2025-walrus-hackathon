# Set Parameters API Implementation Plan

## Overview

This document outlines the implementation plan for the `set_parameters` API endpoint, which is required to configure earn-out parameters and create subperiods on-chain before any Walrus blob uploads can be registered.

## Current Problem

**Issue**: Users cannot upload files to deals because `add_walrus_blob()` requires `parameters_locked == true` on-chain.

**Root Cause**: The `set_parameters` API endpoint is not implemented, so users cannot call the Move contract's `set_parameters()` function to:

1. Set `period_months`, `kpi_threshold`, and `max_payout`
2. Create subperiods on-chain
3. Lock parameters (set `parameters_locked = true`)

**Impact**:

- ❌ Cannot upload Walrus blobs to deals
- ❌ Subperiods only exist in frontend (not on-chain)
- ❌ Deal workflow is blocked at the "draft" stage

## Architecture Flow

```
Frontend (Deal Setup Page)
    ↓ POST /api/v1/deals/{dealId}/parameters
Backend Controller
    ↓ Validates request & user authorization
Parameters Service
    ↓ Generates subperiods from period_months
    ↓ Builds Sui Transaction
Sui Service
    ↓ Returns unsigned txBytes
Frontend
    ↓ User signs transaction with wallet
    ↓ Transaction executed on-chain
Sui Blockchain
    ↓ earnout::set_parameters() called
    ✅ Subperiods created, parameters locked
```

## Implementation Steps

### Step 1: Create OpenAPI Specification

**File**: `docs/v1/parameters.yaml`

**Request Body** (`SetParametersRequest`):

```yaml
SetParametersRequest:
  type: object
  required:
    - periodMonths
    - kpiThreshold
    - maxPayout
  properties:
    periodMonths:
      type: integer
      minimum: 1
      maximum: 120
      description: Total earn-out duration in months
      example: 12
    kpiThreshold:
      type: integer
      minimum: 0
      description: Cumulative KPI target (in smallest unit)
      example: 900000
    maxPayout:
      type: integer
      minimum: 1
      description: Maximum payout amount (in MIST for SUI)
      example: 30000000
```

**Response** (`SetParametersResponse`):

```typescript
{
  success: true;
  message: "Parameters configured successfully";
  parameters: {
    periodMonths: 12;
    kpiThreshold: 900000;
    maxPayout: 30000000;
    subperiods: Array<{
      id: string; // "period_2025_11"
      name: string; // "November 2025"
      startDate: string; // "2025-11-01"
      endDate: string; // "2025-11-30"
    }>;
  }
  transaction: {
    txBytes: string; // Unsigned transaction bytes (hex)
    estimatedGas: string; // Estimated gas in MIST
  }
  nextStep: {
    action: "sign_transaction";
    description: string;
    warning: string;
  }
}
```
