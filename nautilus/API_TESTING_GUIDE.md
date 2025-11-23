# TEE KPI Calculation API - Testing Guide

## 概述

本指南说明如何测试后端 KPI 计算 API，该 API 模拟 Nautilus TEE 的功能，可用于在真正的 TEE 部署之前测试整个流程。

## API 端点

```
POST /api/v1/tee/compute
GET  /api/v1/tee/compute (API 信息)
```

## 快速开始

### 1. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

### 2. 测试基本 KPI 计算

使用 curl 或任何 HTTP 客户端：

```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "journalEntryId": "JE-2025-001",
        "credits": [
          {"account": "Sales Revenue", "amount": 50000}
        ]
      }
    ],
    "operation": "simple"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "kpi_result": {
      "kpi": 50000,
      "change": 50000,
      "file_type": "JournalEntry"
    }
  },
  "message": "KPI calculated successfully (simple mode)"
}
```

### 3. 测试带 Attestation 的 KPI 计算

```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "journalEntryId": "JE-2025-001",
        "credits": [
          {"account": "Sales Revenue", "amount": 50000}
        ]
      },
      {
        "employeeDetails": {},
        "grossPay": 20000
      }
    ],
    "operation": "with_attestation"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "kpi_result": {
      "kpi": 30000,
      "change": 30000,
      "file_type": "PayrollExpense"
    },
    "attestation": {
      "kpi_value": 30000000,
      "computation_hash": "a1b2c3d4...",
      "timestamp": 1700000000000,
      "tee_public_key": "1234abcd...",
      "signature": "9876fedc..."
    },
    "attestation_bytes": [0, 160, 134, 1, 0, 0, 0, 0, ...]
  },
  "message": "KPI calculated with mock TEE attestation"
}
```

## 测试场景

### 场景 1: Journal Entry (Sales Revenue)

**输入文档**:
```json
{
  "journalEntryId": "JE-2025-001",
  "date": "2025-01-31",
  "credits": [
    {"account": "Sales Revenue", "amount": 50000.0}
  ],
  "debits": [
    {"account": "Accounts Receivable", "amount": 50000.0}
  ]
}
```

**KPI 影响**: +50000 (增加收入)

**测试命令**:
```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "documents": [
    {
      "journalEntryId": "JE-2025-001",
      "credits": [
        {"account": "Sales Revenue", "amount": 50000}
      ]
    }
  ]
}
EOF
```

### 场景 2: Fixed Assets Register (Depreciation)

**输入文档**:
```json
{
  "assetList": [
    {
      "assetID": "MACH-001A",
      "originalCost": 120000.0,
      "residualValue": 12000.0,
      "usefulLife_years": 10,
      "purchaseDate": "2020-01-01"
    }
  ]
}
```

**KPI 影响**: -900 (月折旧)
- 月折旧 = (120000 - 12000) / (10 * 12) = 900

**测试命令**:
```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "documents": [
    {
      "assetList": [
        {
          "assetID": "MACH-001A",
          "originalCost": 120000,
          "residualValue": 12000,
          "usefulLife_years": 10
        }
      ]
    }
  ]
}
EOF
```

### 场景 3: Payroll Expense

**输入文档**:
```json
{
  "employeeDetails": {
    "employeeId": "EMP-123",
    "name": "John Doe"
  },
  "grossPay": 20000.0,
  "deductions": 2000.0,
  "netPay": 18000.0
}
```

**KPI 影响**: -20000 (工资支出)

**测试命令**:
```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "documents": [
    {
      "employeeDetails": {"employeeId": "EMP-123"},
      "grossPay": 20000
    }
  ]
}
EOF
```

### 场景 4: Overhead Report

**输入文档**:
```json
{
  "reportTitle": "Corporate Overhead Report",
  "period": "2025-01",
  "totalOverheadCost": 50000.0,
  "allocations": []
}
```

**KPI 影响**: -5000 (10% 分摊)

**测试命令**:
```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "documents": [
    {
      "reportTitle": "Corporate Overhead Report",
      "totalOverheadCost": 50000
    }
  ]
}
EOF
```

### 场景 5: 完整月度计算

**输入**: 一个月的所有财务文档

**KPI 计算**:
- Sales Revenue: +50000
- Depreciation: -900
- Payroll: -20000
- Overhead: -5000
- **Total KPI: 24100**

**测试命令**:
```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "documents": [
    {
      "journalEntryId": "JE-2025-001",
      "credits": [
        {"account": "Sales Revenue", "amount": 50000}
      ]
    },
    {
      "assetList": [
        {
          "assetID": "MACH-001A",
          "originalCost": 120000,
          "residualValue": 12000,
          "usefulLife_years": 10
        }
      ]
    },
    {
      "employeeDetails": {"employeeId": "EMP-123"},
      "grossPay": 20000
    },
    {
      "reportTitle": "Corporate Overhead Report",
      "totalOverheadCost": 50000
    }
  ],
  "operation": "with_attestation"
}
EOF
```

**预期 KPI**: 24100

## 前端集成测试

### 使用浏览器控制台

打开 http://localhost:3000 并在浏览器控制台中运行：

```javascript
// 测试 TEE Service
const testTEE = async () => {
  const response = await fetch('/api/v1/tee/compute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documents: [
        {
          journalEntryId: 'JE-2025-001',
          credits: [{ account: 'Sales Revenue', amount: 50000 }]
        },
        {
          employeeDetails: {},
          grossPay: 20000
        }
      ],
      operation: 'with_attestation'
    })
  });

  const result = await response.json();
  console.log('KPI:', result.data.kpi_result.kpi);
  console.log('Attestation bytes:', result.data.attestation_bytes.length);
  return result;
};

testTEE();
```

### 使用 React Hook

在任何 React 组件中：

```tsx
import { useTEESettlement } from '@/src/frontend/hooks/useTEESettlement';

function TestComponent() {
  const { computeKPIWithTEE } = useTEESettlement();

  const handleTest = async () => {
    const testDocuments = [
      {
        journalEntryId: 'JE-2025-001',
        credits: [{ account: 'Sales Revenue', amount: 50000 }]
      }
    ];

    const result = await computeKPIWithTEE(testDocuments);
    console.log('KPI Result:', result.kpi_result);
    console.log('Attestation:', result.attestation_bytes.length, 'bytes');
  };

  return <button onClick={handleTest}>Test TEE Calculation</button>;
}
```

## Attestation 验证

### 验证 Attestation 格式

```javascript
// 在浏览器控制台中运行
const verifyAttestation = (attestationBytes) => {
  console.log('Attestation length:', attestationBytes.length); // 应该是 144

  // 提取 KPI value (前 8 bytes, little-endian)
  const kpiBytes = attestationBytes.slice(0, 8);
  const view = new DataView(new Uint8Array(kpiBytes).buffer);
  const kpiValue = view.getBigUint64(0, true);
  console.log('KPI value (u64):', kpiValue);
  console.log('KPI value (decimal):', Number(kpiValue) / 1000);

  // 提取 timestamp (bytes 40-47)
  const timestampBytes = attestationBytes.slice(40, 48);
  const timestampView = new DataView(new Uint8Array(timestampBytes).buffer);
  const timestamp = timestampView.getBigUint64(0, true);
  console.log('Timestamp:', new Date(Number(timestamp)));

  return {
    kpiValue: Number(kpiValue),
    timestamp: Number(timestamp)
  };
};

// 使用示例
fetch('/api/v1/tee/compute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documents: [
      { journalEntryId: 'JE-001', credits: [{ account: 'Sales Revenue', amount: 10000 }] }
    ]
  })
})
.then(r => r.json())
.then(result => verifyAttestation(result.data.attestation_bytes));
```

## 错误测试

### 测试空文档数组

```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d '{"documents": []}'
```

**预期**: 400 Bad Request

### 测试无效文档结构

```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d '{"documents": "not an array"}'
```

**预期**: 400 Bad Request

### 测试缺少 documents 字段

```bash
curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d '{}'
```

**预期**: 400 Bad Request

## 性能测试

### 测试大量文档处理

```bash
# 生成 100 个文档的测试
node -e "
const documents = Array.from({length: 100}, (_, i) => ({
  journalEntryId: \`JE-\${i+1}\`,
  credits: [{ account: 'Sales Revenue', amount: 1000 }]
}));

require('fs').writeFileSync('test-100-docs.json', JSON.stringify({
  documents,
  operation: 'with_attestation'
}));
"

# 测试 API
time curl -X POST http://localhost:3000/api/v1/tee/compute \
  -H "Content-Type: application/json" \
  -d @test-100-docs.json
```

**预期**: 应该在 1 秒内完成

## OpenAPI 文档

访问 Swagger UI 查看完整的 API 文档：

```
http://localhost:3000/api-docs
```

或获取 OpenAPI JSON：

```
http://localhost:3000/api/openapi
```

## 环境配置

创建 `.env.local` 文件：

```bash
# TEE Configuration
NEXT_PUBLIC_NAUTILUS_TEE_ENDPOINT=/api/v1/tee
NEXT_PUBLIC_USE_MOCK_TEE=false  # 使用后端 API (不是 MockTEEService)

# 如果使用真实的 Nautilus TEE，设置：
# NEXT_PUBLIC_NAUTILUS_TEE_ENDPOINT=https://tee.nautilus.network
# NEXT_PUBLIC_TEE_PROGRAM_ID=kpi_calculator_v1
```

## 集成测试脚本

创建 `test-tee-api.sh`:

```bash
#!/bin/bash

# Test TEE API Integration

API_URL="http://localhost:3000/api/v1/tee/compute"

echo "=== Testing TEE KPI Calculation API ==="
echo

# Test 1: Simple calculation
echo "Test 1: Simple KPI Calculation"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {"journalEntryId": "JE-001", "credits": [{"account": "Sales Revenue", "amount": 10000}]}
    ],
    "operation": "simple"
  }' | jq '.data.kpi_result.kpi'
echo

# Test 2: With attestation
echo "Test 2: KPI with Attestation"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {"journalEntryId": "JE-001", "credits": [{"account": "Sales Revenue", "amount": 50000}]},
      {"employeeDetails": {}, "grossPay": 20000}
    ]
  }' | jq '.data'
echo

# Test 3: Full month calculation
echo "Test 3: Full Month Calculation"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {"journalEntryId": "JE-001", "credits": [{"account": "Sales Revenue", "amount": 50000}]},
      {"assetList": [{"assetID": "A-001", "originalCost": 120000, "residualValue": 12000, "usefulLife_years": 10}]},
      {"employeeDetails": {}, "grossPay": 20000},
      {"reportTitle": "Corporate Overhead Report", "totalOverheadCost": 50000}
    ]
  }' | jq '.data.kpi_result'
echo

echo "=== Tests Complete ==="
```

运行测试：

```bash
chmod +x test-tee-api.sh
./test-tee-api.sh
```

## 常见问题

### Q: Attestation bytes 总是 144 吗？

A: 是的，attestation 格式固定为 144 bytes，便于链上验证。

### Q: 为什么 kpi_value 比实际 KPI 大 1000 倍？

A: 因为 Sui Move 的 u64 不支持小数，乘以 1000 保留 3 位小数精度。
   - 例如: 24100.567 → 24100567 (u64)

### Q: Mock attestation 安全吗？

A: **不安全！** 仅用于测试。生产环境必须使用真实的 Nautilus TEE。

### Q: 如何切换到真实 TEE？

A: 更新环境变量：
```bash
NEXT_PUBLIC_NAUTILUS_TEE_ENDPOINT=https://tee.nautilus.network
NEXT_PUBLIC_TEE_PROGRAM_ID=your_deployed_program_id
```

## 下一步

1. ✅ 测试后端 API 功能
2. ✅ 验证 attestation 格式正确
3. ⏭️ 部署 Rust 代码到真实 Nautilus TEE
4. ⏭️ 更新前端配置使用真实 TEE endpoint
5. ⏭️ 重新部署 Sui 合约（包含 attestation 验证）
6. ⏭️ 端到端集成测试

## 参考资料

- [后端服务代码](../src/backend/services/kpi-calculation-service.ts)
- [API 路由](../app/api/v1/tee/compute/route.ts)
- [前端 TEE Service](../src/frontend/services/tee-service.ts)
- [React Hook](../src/frontend/hooks/useTEESettlement.ts)
- [Rust TEE 代码](./kpi_calculator.rs)
- [TEE 集成设计](./TEE_INTEGRATION_DESIGN.md)
