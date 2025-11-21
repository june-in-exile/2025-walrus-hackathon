/**
 * Backend mock data for development
 * This file contains all mock data that will be returned by API endpoints
 *
 * Data structures follow the generated TypeScript types from OpenAPI spec
 * Represents deals with periods demonstrating KPI achievement
 */

import type {
  Deal,
  DealSummary,
  DealStatusEnum,
  Period,
  PeriodStatusEnum,
  DashboardResponse,
} from '@/src/frontend/lib/api-client';
import type { AssetReference } from '@/src/shared/types/asset';
import { getFixedAssets } from '@/src/frontend/lib/loadFixedAssets';

// Mock Sui addresses
export const MOCK_ADDRESSES = {
  buyer: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  seller: '0xef012345678890abcdef1234567890abcdef1234567890abcdef1234567890ef',
  auditor: '0x9876543210abcdef1234567890abcdef1234567890abcdef1234567890abcd98',
};

// Mock Assets data from Fixed_Asset.json
const fixedAssets = getFixedAssets();
export const mockAssetsReferences: AssetReference[] = fixedAssets.map(asset => ({
  assetID: asset.assetID,
  assetName: asset.assetName,
  originalCost: asset.originalCost,
  acquisitionDate: asset.acquisitionDate,
  estimatedUsefulLife_months: asset.usefulLife_years * 12,
}));

// Extended WalrusBlob type for mock data with audit status
export type WalrusBlobWithAudit = {
  blobId: string;
  commitment?: string;
  dataType: string;
  size: number;
  uploadedAt: string;
  uploaderAddress: string;
  metadata?: any;
  // Audit fields (not in OpenAPI spec, for frontend dev only)
  reviewStatus?: 'pending' | 'approved' | 'changes_requested';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
};

// Extended Period type with KPI calculation fields
export type PeriodWithKPI = Period & {
  monthlyRevenue?: number;
  monthlyExpenses?: {
    depreciation: number;
    payroll: number;
    overheadAllocation: number;
  };
  monthlyNetProfit?: number;
  cumulativeNetProfit?: number;
  kpiProgress?: number; // 0-1
  kpiAchieved?: boolean;
  settlement?: {
    settled: boolean;
    settledAt: string;
    payoutAmount: number;
    txHash: string;
    recipient: string;
  };
};

// Extended Deal type for mock data
export type DealWithExtendedFields = Deal & {
  buyerName?: string;
  sellerName?: string;
  earnoutPeriodYears?: number;
  kpiTargetAmount?: number;
  contingentConsiderationAmount?: number;
  headquarterExpenseAllocationPercentage?: number;
};

// KPI Calculation constants
const MONTHLY_REVENUE = 825000;
const MONTHLY_DEPRECIATION = 7697.92;
const MONTHLY_PAYROLL = 22950;
const MONTHLY_OVERHEAD = 205000;
const MONTHLY_NET_PROFIT = 589352.08;

// Nov 2025 Period - walrusBlobs (Deal 1 - All approved)
const novBlobs: WalrusBlobWithAudit[] = [
  // Transaction blobs for Nov 10
  {
    blobId: 'blob_nov_1110_cash_receipt',
    commitment: 'commitment_nov_1110_cr_abc123',
    dataType: 'transaction',
    size: 34886,
    uploadedAt: '2025-11-11T09:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110CashReceipt.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1110_journal',
    commitment: 'commitment_nov_1110_je_def456',
    dataType: 'transaction',
    size: 566,
    uploadedAt: '2025-11-11T09:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110JournalEntry.json',
      mimeType: 'application/json',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
      revenue: 75000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1110_sales_contract',
    commitment: 'commitment_nov_1110_sc_ghi789',
    dataType: 'transaction',
    size: 37043,
    uploadedAt: '2025-11-11T09:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110SalesContract.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1110_sales_invoice',
    commitment: 'commitment_nov_1110_si_jkl012',
    dataType: 'transaction',
    size: 36056,
    uploadedAt: '2025-11-11T09:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110SalesInvoice.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1110_shipping',
    commitment: 'commitment_nov_1110_sd_mno345',
    dataType: 'transaction',
    size: 35938,
    uploadedAt: '2025-11-11T09:20:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110ShippingDocument.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:00:00Z',
  },
  // Transaction blobs for Nov 20
  {
    blobId: 'blob_nov_1120_cash_receipt',
    commitment: 'commitment_nov_1120_cr_pqr678',
    dataType: 'transaction',
    size: 34920,
    uploadedAt: '2025-11-21T09:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120CashReceipt.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1120_journal',
    commitment: 'commitment_nov_1120_je_stu901',
    dataType: 'transaction',
    size: 570,
    uploadedAt: '2025-11-21T09:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120JournalEntry.json',
      mimeType: 'application/json',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
      revenue: 750000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1120_sales_contract',
    commitment: 'commitment_nov_1120_sc_vwx234',
    dataType: 'transaction',
    size: 37100,
    uploadedAt: '2025-11-21T09:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120SalesContract.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1120_sales_invoice',
    commitment: 'commitment_nov_1120_si_yza567',
    dataType: 'transaction',
    size: 36120,
    uploadedAt: '2025-11-21T09:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120SalesInvoice.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T10:00:00Z',
  },
  {
    blobId: 'blob_nov_1120_shipping',
    commitment: 'commitment_nov_1120_sd_bcd890',
    dataType: 'transaction',
    size: 35980,
    uploadedAt: '2025-11-21T09:20:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120ShippingDocument.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T10:00:00Z',
  },
  // Expense reports for Nov 30
  {
    blobId: 'blob_nov_1130_corporate_overhead',
    commitment: 'commitment_nov_1130_co_efg123',
    dataType: 'expense_report',
    size: 414,
    uploadedAt: '2025-12-01T10:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'CorporateOverheadReport_forHeadquarterCostAllocation.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
      totalOverheadPool: 2050000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-02T09:00:00Z',
  },
  {
    blobId: 'blob_nov_1130_fixed_assets',
    commitment: 'commitment_nov_1130_fa_hij456',
    dataType: 'expense_report',
    size: 1393,
    uploadedAt: '2025-12-01T10:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'FixedAssetsRegister_forDepreciation.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-02T09:00:00Z',
  },
  {
    blobId: 'blob_nov_1130_payslip_first',
    commitment: 'commitment_nov_1130_ps1_klm789',
    dataType: 'expense_report',
    size: 941,
    uploadedAt: '2025-12-01T10:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'Payslip_first_forPayrollExpense.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
      employeeName: 'Mark Smith',
      grossPay: 3950,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-02T09:00:00Z',
  },
  {
    blobId: 'blob_nov_1130_payslip_second',
    commitment: 'commitment_nov_1130_ps2_nop012',
    dataType: 'expense_report',
    size: 929,
    uploadedAt: '2025-12-01T10:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'Payslip_second_forPayrollExpense.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
      employeeName: 'Lily Chen',
      grossPay: 19000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-02T09:00:00Z',
  },
];

// Dec 2025 Period - walrusBlobs (Deal 1 - All approved)
const decBlobs: WalrusBlobWithAudit[] = [
  // Similar structure to Nov, with Dec dates
  {
    blobId: 'blob_dec_1210_cash_receipt',
    commitment: 'commitment_dec_1210_cr_qrs345',
    dataType: 'transaction',
    size: 34890,
    uploadedAt: '2025-12-11T09:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1210CashReceipt.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-12T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1210_journal',
    commitment: 'commitment_dec_1210_je_tuv678',
    dataType: 'transaction',
    size: 568,
    uploadedAt: '2025-12-11T09:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1210JournalEntry.json',
      mimeType: 'application/json',
      transactionDate: '2025-12-10',
      updateType: 'transaction',
      revenue: 75000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-12T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1210_sales_contract',
    commitment: 'commitment_dec_1210_sc_wxy901',
    dataType: 'transaction',
    size: 37050,
    uploadedAt: '2025-12-11T09:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1210SalesContract.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-12T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1210_sales_invoice',
    commitment: 'commitment_dec_1210_si_zab234',
    dataType: 'transaction',
    size: 36060,
    uploadedAt: '2025-12-11T09:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1210SalesInvoice.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-12T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1210_shipping',
    commitment: 'commitment_dec_1210_sd_cde567',
    dataType: 'transaction',
    size: 35940,
    uploadedAt: '2025-12-11T09:20:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1210ShippingDocument.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-12T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1220_cash_receipt',
    commitment: 'commitment_dec_1220_cr_fgh890',
    dataType: 'transaction',
    size: 34925,
    uploadedAt: '2025-12-21T09:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1220CashReceipt.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-22T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1220_journal',
    commitment: 'commitment_dec_1220_je_ijk123',
    dataType: 'transaction',
    size: 572,
    uploadedAt: '2025-12-21T09:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1220JournalEntry.json',
      mimeType: 'application/json',
      transactionDate: '2025-12-20',
      updateType: 'transaction',
      revenue: 750000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-22T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1220_sales_contract',
    commitment: 'commitment_dec_1220_sc_lmn456',
    dataType: 'transaction',
    size: 37110,
    uploadedAt: '2025-12-21T09:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1220SalesContract.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-22T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1220_sales_invoice',
    commitment: 'commitment_dec_1220_si_opq789',
    dataType: 'transaction',
    size: 36130,
    uploadedAt: '2025-12-21T09:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1220SalesInvoice.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-22T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1220_shipping',
    commitment: 'commitment_dec_1220_sd_rst012',
    dataType: 'transaction',
    size: 35990,
    uploadedAt: '2025-12-21T09:20:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1220ShippingDocument.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-12-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-22T10:00:00Z',
  },
  {
    blobId: 'blob_dec_1231_corporate_overhead',
    commitment: 'commitment_dec_1231_co_uvw345',
    dataType: 'expense_report',
    size: 415,
    uploadedAt: '2026-01-02T10:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'CorporateOverheadReport_forHeadquarterCostAllocation.json',
      mimeType: 'application/json',
      date: '2025-12-31',
      updateType: 'expense_report',
      totalOverheadPool: 2050000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2026-01-03T09:00:00Z',
  },
  {
    blobId: 'blob_dec_1231_fixed_assets',
    commitment: 'commitment_dec_1231_fa_xyz678',
    dataType: 'expense_report',
    size: 1395,
    uploadedAt: '2026-01-02T10:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'FixedAssetsRegister_forDepreciation.json',
      mimeType: 'application/json',
      date: '2025-12-31',
      updateType: 'expense_report',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2026-01-03T09:00:00Z',
  },
  {
    blobId: 'blob_dec_1231_payslip_first',
    commitment: 'commitment_dec_1231_ps1_abc901',
    dataType: 'expense_report',
    size: 943,
    uploadedAt: '2026-01-02T10:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'Payslip_first_forPayrollExpense.json',
      mimeType: 'application/json',
      date: '2025-12-31',
      updateType: 'expense_report',
      employeeName: 'Mark Smith',
      grossPay: 3950,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2026-01-03T09:00:00Z',
  },
  {
    blobId: 'blob_dec_1231_payslip_second',
    commitment: 'commitment_dec_1231_ps2_def234',
    dataType: 'expense_report',
    size: 931,
    uploadedAt: '2026-01-02T10:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'Payslip_second_forPayrollExpense.json',
      mimeType: 'application/json',
      date: '2025-12-31',
      updateType: 'expense_report',
      employeeName: 'Lily Chen',
      grossPay: 19000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2026-01-03T09:00:00Z',
  },
];

// Nov 2025 Period for Deal 2 (Mixed audit status)
const nov2Blobs: WalrusBlobWithAudit[] = [
  {
    blobId: 'blob_nov2_1110_cash_receipt',
    commitment: 'commitment_nov2_1110_cr_aaa111',
    dataType: 'transaction',
    size: 34886,
    uploadedAt: '2025-11-11T09:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110CashReceipt.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:00:00Z',
    reviewNotes: 'Cash receipt verified.',
  },
  {
    blobId: 'blob_nov2_1110_journal',
    commitment: 'commitment_nov2_1110_je_bbb222',
    dataType: 'transaction',
    size: 566,
    uploadedAt: '2025-11-11T09:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110JournalEntry.json',
      mimeType: 'application/json',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
      revenue: 75000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:05:00Z',
    reviewNotes: 'Journal entry approved.',
  },
  {
    blobId: 'blob_nov2_1110_sales_contract',
    commitment: 'commitment_nov2_1110_sc_ccc333',
    dataType: 'transaction',
    size: 37043,
    uploadedAt: '2025-11-11T09:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110SalesContract.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-12T10:10:00Z',
    reviewNotes: 'Sales contract approved.',
  },
  {
    blobId: 'blob_nov2_1110_sales_invoice',
    commitment: 'commitment_nov2_1110_si_ddd444',
    dataType: 'transaction',
    size: 36056,
    uploadedAt: '2025-11-11T09:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110SalesInvoice.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'pending',
  },
  {
    blobId: 'blob_nov2_1110_shipping',
    commitment: 'commitment_nov2_1110_sd_eee555',
    dataType: 'transaction',
    size: 35938,
    uploadedAt: '2025-11-11T09:20:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1110ShippingDocument.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-10',
      updateType: 'transaction',
    },
    reviewStatus: 'pending',
  },
  {
    blobId: 'blob_nov2_1120_cash_receipt',
    commitment: 'commitment_nov2_1120_cr_fff666',
    dataType: 'transaction',
    size: 34920,
    uploadedAt: '2025-11-21T09:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120CashReceipt.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T10:00:00Z',
    reviewNotes: 'Cash receipt verified.',
  },
  {
    blobId: 'blob_nov2_1120_journal',
    commitment: 'commitment_nov2_1120_je_ggg777',
    dataType: 'transaction',
    size: 570,
    uploadedAt: '2025-11-21T09:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120JournalEntry.json',
      mimeType: 'application/json',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
      revenue: 750000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T10:05:00Z',
    reviewNotes: 'Journal entry approved.',
  },
  {
    blobId: 'blob_nov2_1120_sales_contract',
    commitment: 'commitment_nov2_1120_sc_hhh888',
    dataType: 'transaction',
    size: 37100,
    uploadedAt: '2025-11-21T09:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120SalesContract.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'changes_requested',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T14:30:00Z',
    reviewNotes: 'Please provide additional documentation for the contract terms section. The delivery schedule is unclear.',
  },
  {
    blobId: 'blob_nov2_1120_sales_invoice',
    commitment: 'commitment_nov2_1120_si_iii999',
    dataType: 'transaction',
    size: 36120,
    uploadedAt: '2025-11-21T09:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120SalesInvoice.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'changes_requested',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T14:35:00Z',
    reviewNotes: 'Invoice amount discrepancy detected. Please verify the tax calculation matches the journal entry.',
  },
  {
    blobId: 'blob_nov2_1120_shipping',
    commitment: 'commitment_nov2_1120_sd_jjj000',
    dataType: 'transaction',
    size: 35980,
    uploadedAt: '2025-11-21T09:20:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: '1120ShippingDocument.pdf',
      mimeType: 'application/pdf',
      transactionDate: '2025-11-20',
      updateType: 'transaction',
    },
    reviewStatus: 'changes_requested',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-11-22T14:40:00Z',
    reviewNotes: 'Shipping document is missing recipient signature. Please upload the signed version.',
  },
  {
    blobId: 'blob_nov2_1130_corporate_overhead',
    commitment: 'commitment_nov2_1130_co_kkk111',
    dataType: 'expense_report',
    size: 414,
    uploadedAt: '2025-12-01T10:00:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'CorporateOverheadReport_forHeadquarterCostAllocation.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
      totalOverheadPool: 2050000,
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-02T09:00:00Z',
    reviewNotes: 'Corporate overhead report approved.',
  },
  {
    blobId: 'blob_nov2_1130_fixed_assets',
    commitment: 'commitment_nov2_1130_fa_lll222',
    dataType: 'expense_report',
    size: 1393,
    uploadedAt: '2025-12-01T10:05:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'FixedAssetsRegister_forDepreciation.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
    },
    reviewStatus: 'approved',
    reviewedBy: MOCK_ADDRESSES.auditor,
    reviewedAt: '2025-12-02T09:05:00Z',
    reviewNotes: 'Fixed assets register approved.',
  },
  {
    blobId: 'blob_nov2_1130_payslip_first',
    commitment: 'commitment_nov2_1130_ps1_mmm333',
    dataType: 'expense_report',
    size: 941,
    uploadedAt: '2025-12-01T10:10:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'Payslip_first_forPayrollExpense.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
      employeeName: 'Mark Smith',
      grossPay: 3950,
    },
    reviewStatus: 'pending',
  },
  {
    blobId: 'blob_nov2_1130_payslip_second',
    commitment: 'commitment_nov2_1130_ps2_nnn444',
    dataType: 'expense_report',
    size: 929,
    uploadedAt: '2025-12-01T10:15:00Z',
    uploaderAddress: MOCK_ADDRESSES.buyer,
    metadata: {
      filename: 'Payslip_second_forPayrollExpense.json',
      mimeType: 'application/json',
      date: '2025-11-30',
      updateType: 'expense_report',
      employeeName: 'Lily Chen',
      grossPay: 19000,
    },
    reviewStatus: 'pending',
  },
];

// Mock Periods with KPI data
const mockPeriodsWithKPI: PeriodWithKPI[] = [
  {
    periodId: 'period_nov_2025',
    name: 'November 2025',
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    status: 'settled' as PeriodStatusEnum,
    walrusBlobs: novBlobs,
    monthlyRevenue: MONTHLY_REVENUE,
    monthlyExpenses: {
      depreciation: MONTHLY_DEPRECIATION,
      payroll: MONTHLY_PAYROLL,
      overheadAllocation: MONTHLY_OVERHEAD,
    },
    monthlyNetProfit: MONTHLY_NET_PROFIT,
    cumulativeNetProfit: MONTHLY_NET_PROFIT,
    kpiProgress: MONTHLY_NET_PROFIT / 900000,
    kpiAchieved: false,
  },
  {
    periodId: 'period_dec_2025',
    name: 'December 2025',
    startDate: '2025-12-01',
    endDate: '2025-12-31',
    status: 'settled' as PeriodStatusEnum,
    walrusBlobs: decBlobs,
    monthlyRevenue: MONTHLY_REVENUE,
    monthlyExpenses: {
      depreciation: MONTHLY_DEPRECIATION,
      payroll: MONTHLY_PAYROLL,
      overheadAllocation: MONTHLY_OVERHEAD,
    },
    monthlyNetProfit: MONTHLY_NET_PROFIT,
    cumulativeNetProfit: MONTHLY_NET_PROFIT * 2,
    kpiProgress: (MONTHLY_NET_PROFIT * 2) / 900000,
    kpiAchieved: true,
    settlement: {
      settled: true,
      settledAt: '2026-01-05T10:00:00Z',
      payoutAmount: 30000000,
      txHash: 'KpI8rEdFgHnM2xYz1RnN2BcE4MpX7Ri5L',
      recipient: MOCK_ADDRESSES.seller,
    },
  },
] as any;

// Mock Periods for Deal 2
const mockPeriodsWithKPI_Deal2: PeriodWithKPI[] = [
  {
    periodId: 'period_nov_2025_deal2',
    name: 'November 2025',
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    status: 'data_collection' as PeriodStatusEnum,
    walrusBlobs: nov2Blobs,
    monthlyRevenue: MONTHLY_REVENUE,
    monthlyExpenses: {
      depreciation: MONTHLY_DEPRECIATION,
      payroll: MONTHLY_PAYROLL,
      overheadAllocation: MONTHLY_OVERHEAD,
    },
    monthlyNetProfit: MONTHLY_NET_PROFIT,
    cumulativeNetProfit: MONTHLY_NET_PROFIT,
    kpiProgress: MONTHLY_NET_PROFIT / 900000,
    kpiAchieved: false,
  },
] as any;

// Mock Deals
export const mockDeals: DealWithExtendedFields[] = [
  {
    dealId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    name: 'BuyYou Inc. & Global Tech Solutions Inc. Aquirement',
    buyerName: 'BuyYou Inc.',
    sellerName: 'Global Tech Solutions Inc.',
    agreementDate: new Date('2025-11-3'),
    currency: 'USD',
    buyer: MOCK_ADDRESSES.buyer,
    seller: MOCK_ADDRESSES.seller,
    auditor: MOCK_ADDRESSES.auditor,
    status: 'active' as DealStatusEnum,
    earnoutPeriodYears: 3,
    kpiTargetAmount: 900000,
    contingentConsiderationAmount: 30000000,
    headquarterExpenseAllocationPercentage: 0.10,
    periods: mockPeriodsWithKPI,
    metadata: {
      industry: 'Technology',
      dealSize: '$30M USD',
      notes: 'KPI achieved in Dec 2025 - Contingent consideration paid',
      assets: mockAssetsReferences,
    },
    createdAt: new Date('2025-10-15T10:00:00Z'),
    updatedAt: new Date('2026-01-05T10:00:00Z'),
  },
  {
    dealId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    name: 'BuyYou Inc. & Global Tech Solutions Inc. Asset Purchase (Period - Nov.)',
    buyerName: 'BuyYou Inc.',
    sellerName: 'Global Tech Solutions Inc.',
    agreementDate: new Date('2025-11-3'),
    currency: 'USD',
    buyer: MOCK_ADDRESSES.buyer,
    seller: MOCK_ADDRESSES.seller,
    auditor: MOCK_ADDRESSES.auditor,
    status: 'active' as DealStatusEnum,
    earnoutPeriodYears: 3,
    kpiTargetAmount: 900000,
    contingentConsiderationAmount: 30000000,
    headquarterExpenseAllocationPercentage: 0.10,
    periods: mockPeriodsWithKPI_Deal2,
    metadata: {
      industry: 'Technology',
      dealSize: '$30M USD',
      notes: 'In-progress deal showing audit workflow in November 2025',
      assets: mockAssetsReferences,
    },
    createdAt: new Date('2025-10-15T10:00:00Z'),
    updatedAt: new Date('2025-12-01T10:15:00Z'),
  },
];

// Mock Deal Summaries
export const mockDealSummaries: DealSummary[] = mockDeals.map((deal) => ({
  dealId: deal.dealId,
  name: deal.name,
  agreementDate: deal.agreementDate as any,
  currency: deal.currency,
  status: deal.status,
  userRole: 'buyer',
  periodCount: deal.periods?.length || 0,
  settledPeriods: deal.periods?.filter((p) => p.status === 'settled').length || 0,
  lastActivity: deal.updatedAt as any,
}));

// Helper to get dashboard by dealId and role
export function getDashboardByDealId(
  dealId: string,
  role: 'buyer' | 'seller' | 'auditor' = 'buyer'
): DashboardResponse {
  const deal = mockDeals.find(d => d.dealId === dealId) || mockDeals[0];
  const periods = (deal.periods || []) as PeriodWithKPI[];

  const periodsSummary = periods.map(period => {
    const blobCount = period.walrusBlobs?.length || 0;
    const lastBlob = period.walrusBlobs?.[period.walrusBlobs.length - 1];

    return {
      periodId: period.periodId,
      name: period.name,
      dateRange: {
        start: period.startDate,
        end: period.endDate,
      },
      dataUploadProgress: {
        blobCount: blobCount,
        lastUploadAt: lastBlob?.uploadedAt || period.startDate,
        completeness: 100,
      },
      kpiStatus: period.kpiAchieved ? 'approved' : (period.status === 'settled' ? 'approved' : 'pending'),
      kpiValue: period.cumulativeNetProfit || 0,
      settlementStatus: period.status,
      settlementAmount: period.settlement?.payoutAmount,
    };
  });

  const recentEvents = [];

  for (const period of periods) {
    if (period.settlement?.settled) {
      recentEvents.push({
        type: 'settlement' as const,
        timestamp: period.settlement.settledAt || period.endDate,
        actor: deal.buyer,
        actorRole: 'buyer' as const,
        description: `KPI Target ${period.kpiAchieved ? 'Achieved' : 'Met'}! Settlement executed: $${(period.settlement.payoutAmount || 0).toLocaleString()}`,
        txHash: period.settlement.txHash || '',
        metadata: {
          periodId: period.periodId,
          amount: period.settlement.payoutAmount || 0,
          cumulativeNetProfit: period.cumulativeNetProfit || 0,
          kpiTarget: deal.kpiTargetAmount || 0,
        },
      });
    }

    if (period.walrusBlobs && period.walrusBlobs.length > 0) {
      const lastBlob = period.walrusBlobs[period.walrusBlobs.length - 1];
      recentEvents.push({
        type: 'data_upload' as const,
        timestamp: lastBlob.uploadedAt,
        actor: lastBlob.uploaderAddress,
        actorRole: 'buyer' as const,
        description: `Financial data uploaded for ${period.name}`,
        metadata: {
          periodId: period.periodId,
          blobCount: period.walrusBlobs.length,
        },
      });
    }
  }

  recentEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    dealInfo: {
      dealId: deal.dealId,
      name: deal.name,
      buyerName: deal.buyerName,
      sellerName: deal.sellerName,
      agreementDate: deal.agreementDate,
      currency: deal.currency,
      status: deal.status,
      earnoutPeriodYears: deal.earnoutPeriodYears,
      kpiTargetAmount: deal.kpiTargetAmount,
      contingentConsiderationAmount: deal.contingentConsiderationAmount,
      headquarterExpenseAllocationPercentage: deal.headquarterExpenseAllocationPercentage,
      roles: {
        buyer: deal.buyer,
        seller: deal.seller,
        auditor: deal.auditor,
      },
      userRole: role,
    },
    periodsSummary,
    recentEvents: recentEvents.slice(0, 10),
    healthMetrics: {
      overallProgress: periods.length > 0
        ? (periods.filter(p => p.status === 'settled').length / periods.length) * 100
        : 0,
      pendingActions: periods.filter(p => p.status !== 'settled').length,
      nextDeadline: undefined,
      dataCompletenessScore: 100,
      risksDetected: [],
    },
  } as any;
}
