# Audit & Sign Feature Implementation Plan

## Goal
To make the "Audit & Sign" button on the `app/(frontend)/deals/[dealId]/periods/[periodId]/audit/page.tsx` page functional. When clicked, it should trigger the `audit_data` function on the Sui blockchain contract, submitting a signature to confirm (audit) the corresponding `DataAuditRecord`. After a successful audit, the frontend UI should update to reflect the on-chain "audited" status.

## Implementation Steps & Status

### 1. Review Smart Contract (`earnout.move`)
*   **Status**: `✅ Completed`
*   **Objective**: Confirm the exact signature, required parameters, and on-chain state changes of the `audit_data` function.
*   **File**: `src/backend/contracts/sources/earnout.move`
*   **Outcome**: The function `audit_data(deal: &Deal, audit_record: &mut DataAuditRecord, signature: vector<u8>, public_key: vector<u8>, clock: &Clock, ...)` was identified. It requires the `Deal` object, the `DataAuditRecord` object, and a signature of the message `"AUDIT:{data_id}"` to be passed.

### 2. Update Frontend Transaction Logic (Custom Hook)
*   **Status**: `✅ Completed`
*   **Objective**: Encapsulate the logic for interacting with the Sui blockchain for the audit action, making it reusable and keeping the component clean.
*   **Files**:
    *   `src/frontend/hooks/useAuditData.ts` (Modified)
    *   `app/(frontend)/deals/[dealId]/periods/[periodId]/audit/page.tsx` (Modified)
*   **Direction Change**: Instead of creating a new hook (`useAuditPeriod.ts`), an existing hook `useAuditData.ts` was found. The decision was made to modify this existing hook to align with project conventions.
*   **Actions Taken**:
    1.  **Identified Existing Hook**: Found `useAuditData.ts` being used by the target page.
    2.  **Upgraded Transaction Method**: Replaced the deprecated `Transaction` and `useSignAndExecuteTransaction` with the current `TransactionBlock` and `useSignAndExecuteTransactionBlock`.
    3.  **Integrated Query Invalidation**: Added `useQueryClient` to the hook. Upon successful transaction, `queryClient.invalidateQueries` is now called to ensure the UI automatically refetches data from the `useAuditRecords` hook and reflects the new on-chain state.
    4.  **Updated Page Component**: Modified the `handleAudit` function in `audit/page.tsx` to pass the necessary `periodId` to the updated `auditData` hook.
    5.  **Standardized Messages**: Ensured all user-facing `toast` notifications are in English.

### 3. Modify Frontend Page (`audit/page.tsx`)
*   **Status**: `✅ Completed` (as part of Step 2)
*   **Objective**: Connect the "Audit & Sign" button to the transaction logic and have the UI react to on-chain state.
*   **Action**: The `handleAudit` function was updated to correctly call the modified `useAuditData` hook. The existing rendering logic, which conditionally shows the button or an "Audited" status based on data from `useAuditRecords`, was already in place and is now expected to work correctly with the new query invalidation.

### 4. Verify UI State Update
*   **Status**: `⏳ Pending Verification`
*   **Objective**: Ensure the entire flow works seamlessly from button click to UI update.
*   **Action**: This step involves running the application and testing the feature to confirm that after a successful audit, the UI automatically updates to show the "Audited" status without a manual page refresh.

## Expected Result
*   When a user clicks the "Audit & Sign" button, a wallet signing prompt appears.
*   After signing and transaction submission, the UI shows a pending state.
*   Upon transaction success, the page automatically refreshes its data, and the "Audit & Sign" button for that item is replaced with an "Audited" status indicator.
*   The entire flow is seamless and reactive.
