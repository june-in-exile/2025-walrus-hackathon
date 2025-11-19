/**
 * Mock data for frontend development
 * All data structures follow the generated TypeScript types from OpenAPI spec
 */

import type {
  Deal,
  DealSummary,
  DealStatusEnum,
  Period,
  PeriodStatusEnum,
  KPIType,
  EarnoutFormula,
  DashboardResponse,
} from './api-client';

// Mock Sui addresses
export const MOCK_ADDRESSES = {
  buyer: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  seller: '0xef012345678890abcdef1234567890abcdef1234567890abcdef1234567890ef',
  auditor: '0x9876543210abcdef1234567890abcdef1234567890abcdef1234567890abcd98',
};

// Mock KPI Types
const mockKPITypes: KPIType[] = [
  {
    type: 'revenue',
    threshold: 10000000,
    unit: 'USD',
    description: 'Annual revenue target for earn-out calculation',
  },
  {
    type: 'ebitda',
    threshold: 2000000,
    unit: 'USD',
    description: 'EBITDA target for performance bonus',
  },
];

// Mock Earnout Formula
const mockFormula: EarnoutFormula = {
  type: 'linear',
  maxPayout: 5000000,
  parameters: {
    minThreshold: 10000000,
    maxThreshold: 15000000,
    minPayout: 0,
    maxPayout: 5000000,
  },
};

// Mock Periods
const mockPeriods: Period[] = ([
  {
    periodId: 'period_2026',
    name: '2026 Fiscal Year',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    kpiTypes: mockKPITypes,
    formula: mockFormula,
    status: 'settled' as PeriodStatusEnum,
    walrusBlobs: [
      {
        blobId: 'blob_2026_revenue_q1',
        commitment: 'commitment_hash_q1_abc123',
        dataType: 'revenue_journal',
        size: 2048576,
        uploadedAt: '2026-04-15T10:30:00Z',
        uploaderAddress: MOCK_ADDRESSES.buyer,
        metadata: {
          filename: 'Q1_2026_Revenue.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          encrypted: true,
          sealPolicyId: 'seal_policy_001',
        },
      },
    ],
    kpiProposal: {
      kpiType: 'revenue',
      value: 11300000,
      unit: 'USD',
      proposedBy: MOCK_ADDRESSES.buyer,
      proposedAt: '2027-01-15T10:00:00Z',
      status: 'approved',
      calculatedPayout: 2600000,
      notes: 'Based on audited financial statements',
      supportingBlobIds: ['blob_2026_revenue_q1', 'blob_2026_revenue_q2'],
    },
    kpiAttestation: {
      kpiType: 'revenue',
      attestedValue: 11300000,
      unit: 'USD',
      attestedBy: MOCK_ADDRESSES.auditor,
      attestedAt: '2027-02-01T14:30:00Z',
      approved: true,
      finalPayout: 2600000,
      notes: 'Verified all revenue journals. Calculations accurate.',
      verifiedBlobIds: ['blob_2026_revenue_q1', 'blob_2026_revenue_q2'],
      txHash: '9wqLfZUqP9K3xYz1RnN2BcE4MpX7Ri5L',
    },
    settlement: {
      settled: true,
      settledAt: '2027-02-10T09:00:00Z',
      payoutAmount: 2600000,
      txHash: '8vqKfZTqP9J3xYz1RmN2BcD4LpW7Qh5K',
      recipient: MOCK_ADDRESSES.seller,
    },
  },
  {
    periodId: 'period_2027',
    name: '2027 Fiscal Year',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    kpiTypes: mockKPITypes,
    formula: mockFormula,
    status: 'kpi_attested' as PeriodStatusEnum,
    walrusBlobs: [],
  },
  {
    periodId: 'period_2028',
    name: '2028 Fiscal Year',
    startDate: '2028-01-01',
    endDate: '2028-12-31',
    kpiTypes: mockKPITypes,
    formula: mockFormula,
    status: 'pending' as PeriodStatusEnum,
    walrusBlobs: [],
  },
]) as any;

// Mock Deals
export const mockDeals: Deal[] = [
  {
    dealId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    name: 'Acquisition of TechCorp Inc.',
    closingDate: new Date('2025-12-31'),
    currency: 'USD',
    buyer: MOCK_ADDRESSES.buyer,
    seller: MOCK_ADDRESSES.seller,
    auditor: MOCK_ADDRESSES.auditor,
    status: 'active' as DealStatusEnum,
    periods: mockPeriods,
    metadata: {
      industry: 'Technology',
      dealSize: '50M USD',
      notes: 'Standard SaaS acquisition',
    },
    createdAt: new Date('2025-11-16T10:00:00Z'),
    updatedAt: new Date('2025-11-16T15:30:00Z'),
  },
  {
    dealId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    name: 'Acquisition of DataFlow Systems',
    closingDate: new Date('2026-03-15'),
    currency: 'USD',
    buyer: MOCK_ADDRESSES.buyer,
    seller: MOCK_ADDRESSES.seller,
    auditor: MOCK_ADDRESSES.auditor,
    status: 'active' as DealStatusEnum,
    periods: ([
      {
        periodId: 'period_2026',
        name: '2026 Period',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        kpiTypes: mockKPITypes,
        formula: mockFormula,
        status: 'data_collection' as PeriodStatusEnum,
        walrusBlobs: [],
      },
    ]) as any,
    metadata: {
      industry: 'Data Analytics',
      dealSize: '30M USD',
    },
    createdAt: new Date('2026-01-10T08:00:00Z'),
    updatedAt: new Date('2026-01-10T08:00:00Z'),
  },
  {
    dealId: '0xdraft123456789abcdef1234567890abcdef1234567890abcdef1234567890ab',
    name: 'New Deal - CloudTech Acquisition',
    closingDate: new Date('2026-06-01'),
    currency: 'USD',
    buyer: MOCK_ADDRESSES.buyer,
    seller: MOCK_ADDRESSES.seller,
    auditor: MOCK_ADDRESSES.auditor,
    status: 'draft' as DealStatusEnum,
    periods: [],
    metadata: {
      industry: 'Cloud Computing',
      dealSize: '40M USD',
      notes: 'Parameters not yet configured',
    },
    createdAt: new Date('2025-11-17T10:00:00Z'),
    updatedAt: new Date('2025-11-17T10:00:00Z'),
  },
];

// Mock Deal Summaries
export const mockDealSummaries: DealSummary[] = mockDeals.map((deal) => ({
  dealId: deal.dealId,
  name: deal.name,
  closingDate: deal.closingDate as any,
  currency: deal.currency,
  status: deal.status,
  userRole: 'buyer',
  periodCount: deal.periods?.length || 0,
  settledPeriods: deal.periods?.filter((p) => p.status === 'settled').length || 0,
  lastActivity: deal.updatedAt as any,
}));

// Mock Dashboard Response
export const mockDashboardResponse: DashboardResponse = ({
  dealInfo: {
    dealId: mockDeals[0].dealId,
    name: mockDeals[0].name,
    closingDate: mockDeals[0].closingDate,
    currency: mockDeals[0].currency,
    status: mockDeals[0].status,
    roles: {
      buyer: MOCK_ADDRESSES.buyer,
      seller: MOCK_ADDRESSES.seller,
      auditor: MOCK_ADDRESSES.auditor,
    },
    userRole: 'seller',
  },
  periodsSummary: [
    {
      periodId: 'period_2026',
      name: '2026 Fiscal Year',
      dateRange: {
        start: '2026-01-01',
        end: '2026-12-31',
      },
      dataUploadProgress: {
        blobCount: 8,
        lastUploadAt: '2026-12-20T14:30:00Z',
        completeness: 100,
      },
      kpiStatus: 'approved',
      kpiValue: 11300000,
      settlementStatus: 'settled',
      settlementAmount: 2600000,
      nextAction: {
        action: 'View Settlement Details',
        actor: 'seller',
        deadline: '2027-03-01',
      },
    },
    {
      periodId: 'period_2027',
      name: '2027 Fiscal Year',
      dateRange: {
        start: '2027-01-01',
        end: '2027-12-31',
      },
      dataUploadProgress: {
        blobCount: 12,
        lastUploadAt: '2027-12-28T16:00:00Z',
        completeness: 95,
      },
      kpiStatus: 'approved',
      kpiValue: 12500000,
      settlementStatus: 'pending',
      nextAction: {
        action: 'Execute Settlement',
        actor: 'buyer',
        deadline: '2028-02-15',
      },
    },
    {
      periodId: 'period_2028',
      name: '2028 Fiscal Year',
      dateRange: {
        start: '2028-01-01',
        end: '2028-12-31',
      },
      dataUploadProgress: {
        blobCount: 0,
        completeness: 0,
      },
      kpiStatus: 'not_proposed',
      settlementStatus: 'not_settled',
      nextAction: {
        action: 'Upload Financial Documents',
        actor: 'seller',
        deadline: '2029-01-31',
      },
    },
  ],
  recentEvents: [
    {
      type: 'settlement',
      timestamp: '2027-02-10T09:00:00Z',
      actor: MOCK_ADDRESSES.buyer,
      actorRole: 'buyer',
      description: 'Settlement executed for period_2026: $2,600,000 paid to seller',
      txHash: '8vqKfZTqP9J3xYz1RmN2BcD4LpW7Qh5K',
      metadata: {
        periodId: 'period_2026',
        amount: 2600000,
      },
    },
    {
      type: 'kpi_attested',
      timestamp: '2027-02-01T14:30:00Z',
      actor: MOCK_ADDRESSES.auditor,
      actorRole: 'auditor',
      description: 'KPI attested for period_2026: Revenue = $11,300,000 (Approved)',
      txHash: '9wqLfZUqP9K3xYz1RnN2BcE4MpX7Ri5L',
      metadata: {
        periodId: 'period_2026',
        kpiType: 'revenue',
        value: 11300000,
      },
    },
    {
      type: 'data_upload',
      timestamp: '2026-12-20T14:30:00Z',
      actor: MOCK_ADDRESSES.buyer,
      actorRole: 'buyer',
      description: 'Uploaded revenue_journal for period_2026',
      metadata: {
        periodId: 'period_2026',
        blobId: 'blob_2026_revenue_q4',
        dataType: 'revenue_journal',
      },
    },
  ],
  healthMetrics: {
    overallProgress: 66.7,
    pendingActions: 2,
    nextDeadline: '2028-02-15',
    dataCompletenessScore: 85.5,
    risksDetected: [
      {
        severity: 'medium',
        category: 'Missing Data',
        description: 'Period 2028 has no data uploads yet',
        periodId: 'period_2028',
      },
    ],
  },
}) as any;

// Mock Dashboard Response for Draft Deal
export const mockDraftDealDashboard: DashboardResponse = ({
  dealInfo: {
    dealId: '0xdraft123456789abcdef1234567890abcdef1234567890abcdef1234567890ab',
    name: 'New Deal - CloudTech Acquisition',
    closingDate: new Date('2026-06-01'),
    currency: 'USD',
    status: 'draft',
    roles: {
      buyer: MOCK_ADDRESSES.buyer,
      seller: MOCK_ADDRESSES.seller,
      auditor: MOCK_ADDRESSES.auditor,
    },
    userRole: 'buyer',
  },
  periodsSummary: [],
  recentEvents: [
    {
      type: 'deal_created',
      timestamp: '2025-11-17T10:00:00Z',
      actor: MOCK_ADDRESSES.buyer,
      actorRole: 'buyer',
      description: 'Deal created: New Deal - CloudTech Acquisition',
      metadata: {
        dealId: '0xdraft123456789abcdef1234567890abcdef1234567890abcdef1234567890ab',
      },
    },
  ],
  healthMetrics: {
    overallProgress: 0,
    pendingActions: 1,
    nextDeadline: undefined,
    dataCompletenessScore: 0,
    risksDetected: [
      {
        severity: 'high',
        category: 'Configuration',
        description: 'Deal parameters not yet configured',
      },
    ],
  },
}) as any;

// Helper to get dashboard by dealId and role
export function getDashboardByDealId(dealId: string, role: 'buyer' | 'seller' | 'auditor' = 'buyer'): DashboardResponse {
  if (dealId === '0xdraft123456789abcdef1234567890abcdef1234567890abcdef1234567890ab') {
    return {
      ...mockDraftDealDashboard,
      dealInfo: {
        ...mockDraftDealDashboard.dealInfo,
        userRole: role,
      },
    };
  }

  // Default: return first deal's dashboard with updated dealId and role
  const deal = mockDeals.find(d => d.dealId === dealId) || mockDeals[0];

  // Customize period summaries based on role
  const basePeriods = mockDashboardResponse.periodsSummary;
  const rolePeriods = basePeriods.map(period => {
    // Clone the period
    const p = { ...period };

    // Customize nextAction based on period and role
    if (period.periodId === 'period_2026') {
      // Period 2026: Settled - no action needed
      p.nextAction = undefined;
    } else if (period.periodId === 'period_2027') {
      // Period 2027: KPI approved, awaiting settlement
      if (role === 'buyer') {
        p.nextAction = {
          action: 'Execute Settlement',
          actor: 'buyer',
          deadline: '2028-02-15',
        } as any;
      } else if (role === 'seller') {
        p.nextAction = {
          action: 'Awaiting Settlement Payment',
          actor: 'buyer',
          deadline: '2028-02-15',
        } as any;
      } else {
        p.nextAction = undefined;
      }
    } else if (period.periodId === 'period_2028') {
      // Period 2028: Pending, needs data upload and attestation
      if (role === 'seller') {
        p.nextAction = {
          action: 'Upload Financial Documents',
          actor: 'seller',
          deadline: '2029-01-31',
        } as any;
      } else if (role === 'auditor') {
        p.nextAction = {
          action: 'Awaiting Data Upload',
          actor: 'seller',
          deadline: '2029-01-31',
        } as any;
      } else {
        p.nextAction = {
          action: 'Awaiting Data Upload',
          actor: 'seller',
          deadline: '2029-01-31',
        } as any;
      }
    }

    return p;
  });

  return {
    ...mockDashboardResponse,
    dealInfo: {
      ...mockDashboardResponse.dealInfo,
      dealId: deal.dealId,
      name: deal.name,
      closingDate: deal.closingDate,
      currency: deal.currency,
      status: deal.status,
      userRole: role,
    },
    periodsSummary: rolePeriods,
  } as any;
}
