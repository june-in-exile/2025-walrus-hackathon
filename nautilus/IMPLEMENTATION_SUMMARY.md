# Nautilus TEE Integration - Implementation Summary

## 已完成的工作

### 1. Move 合约更新 ✅

**文件**: `src/backend/contracts/sources/earnout.move`

**更新内容**:
- ✅ 实现完整的 `verify_nautilus_attestation()` 函数
  - 验证 attestation 长度（144 bytes）
  - 提取并验证 KPI 值
  - 提取 computation hash（输入数据的 SHA-256）
  - 提取 timestamp（未来可添加时效性检查）
  - 提取 TEE public key
  - 使用 Sui Ed25519 模块验证签名
- ✅ 添加辅助函数：
  - `extract_bytes()`: 从 vector 中提取字节片段
  - `bytes_to_u64_le()`: 将 little-endian 字节转换为 u64

**关键代码位置**: earnout.move:418-511

### 2. Rust TEE 计算器 ✅

**文件**: `nautilus/kpi_calculator.rs`

**功能**:
- ✅ 定义 attestation 数据结构（144 bytes）
- ✅ 实现累积 KPI 计算逻辑
- ✅ 生成 Ed25519 签名的 TEE attestation
- ✅ 支持 4 种财务文档类型
- ✅ 计算输入数据的 SHA-256 hash
- ✅ 序列化为区块链兼容的字节格式
- ✅ 单元测试验证功能正确性

**关键功能**:
- `calculate_kpi_with_attestation()`: 主要入口函数
- `TEEAttestation`: Attestation 结构体（144 bytes）
- `KPIResultWithAttestation`: 完整结果（含 attestation）

### 3. Rust 项目配置 ✅

**文件**: `nautilus/Cargo.toml`

**依赖**:
- `serde` + `serde_json`: JSON 序列化
- `sha2`: SHA-256 哈希
- `ed25519-dalek`: Ed25519 签名
- `rand`: 密钥生成

**构建配置**:
- 优化编译大小（`opt-level = "z"`）
- Link Time Optimization (LTO)
- 符号剥离（strip symbols）

### 4. 前端 TEE 服务 ✅

**文件**: `src/frontend/services/tee-service.ts`

**功能**:
- ✅ `TEEService` 类：调用 Nautilus TEE API
- ✅ `MockTEEService` 类：本地开发模拟
- ✅ 类型定义（TypeScript 接口）
- ✅ Attestation 本地验证（可选）
- ✅ 工厂函数 `createTEEService()`

**使用示例**:
```typescript
const teeService = createTEEService();
const result = await teeService.computeKPIWithAttestation(documents);
// result.attestation_bytes: number[] (144 bytes)
```

### 5. React Settlement Hook ✅

**文件**: `src/frontend/hooks/useTEESettlement.ts`

**功能**:
- ✅ 完整的 Settlement 流程封装
- ✅ 三步流程：
  1. 下载并解密 Walrus 文档
  2. 调用 TEE 计算 KPI
  3. 提交结果到 Sui 区块链
- ✅ 错误处理和加载状态管理
- ✅ 支持完整流程或单步执行

**API**:
```typescript
const {
  isLoading,
  error,
  teeResult,
  executeFullSettlement
} = useTEESettlement();

await executeFullSettlement(deal, paymentCoinId);
```

### 6. UI 组件 ✅

**文件**: `src/frontend/components/SettlementButton.tsx`

**功能**:
- ✅ Settlement 对话框 UI
- ✅ 实时进度指示器
- ✅ 三步流程可视化
- ✅ TEE 计算结果展示
- ✅ 错误提示和成功确认

**特性**:
- shadcn/ui 组件库
- 响应式设计
- 清晰的用户反馈

### 7. 文档 ✅

**文件**:
- `nautilus/TEE_INTEGRATION_DESIGN.md`: 详细设计文档
- `nautilus/README.md`: 使用说明
- `nautilus/IMPLEMENTATION_SUMMARY.md`: 本文档

**内容**:
- 完整的架构设计
- 详细的流程说明
- 安全考虑和限制
- 部署指南
- 故障排查

## 完整流程示意图

```
┌─────────────────┐
│   1. 前端下载    │
│   Walrus 文档    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   2. Seal 解密   │
│   (客户端)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. 发送到 TEE   │
│   计算 KPI       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. TEE 生成      │
│   Attestation    │
│   (144 bytes)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. 前端提交到    │
│   Sui 合约       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. 合约验证      │
│   Attestation    │
│   (Ed25519)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  7. 执行结算     │
│   转账代币       │
└─────────────────┘
```

## Attestation 数据结构

```
Offset  Length  Field                Description
──────────────────────────────────────────────────────────
0       8       kpi_value            KPI * 1000 (u64, LE)
8       32      computation_hash     SHA-256(all documents)
40      8       timestamp            Unix ms (u64, LE)
48      32      tee_public_key       Ed25519 public key
80      64      signature            Ed25519 signature
──────────────────────────────────────────────────────────
Total: 144 bytes

Signature message = kpi_value || computation_hash || timestamp
```

## 环境变量配置

需要在 `.env.local` 中添加：

```bash
# Nautilus TEE 配置
NEXT_PUBLIC_NAUTILUS_TEE_ENDPOINT=https://tee.nautilus.network
NEXT_PUBLIC_TEE_PROGRAM_ID=kpi_calculator_v1

# 开发模式（使用 Mock TEE）
NEXT_PUBLIC_USE_MOCK_TEE=false  # 生产环境设为 false

# Sui 合约配置（需要在部署后更新）
NEXT_PUBLIC_EARNOUT_PACKAGE_ID=0x...  # earnout 合约 Package ID
```

## 后续步骤

### 1. 部署 TEE 到 Nautilus (高优先级)

**步骤**:
```bash
# 1. 编译 Rust 代码
cd nautilus/
cargo build --release

# 2. 部署到 Nautilus（具体命令取决于 Nautilus CLI）
nautilus deploy \
  --program kpi_calculator.wasm \
  --name kpi_calculator_v1

# 3. 记录 TEE 信息
# - Program ID: kpi_calculator_v1
# - TEE Public Key: 0x...
# - Endpoint: https://...
```

**输出**: 获取 TEE endpoint 和 public key

### 2. 更新 Move 合约（可选增强）

**选项 A**: 保持当前简化版本（接受任何 TEE）
- ✅ MVP 可用
- ⚠️ 安全性较低

**选项 B**: 添加 TEE Registry（推荐生产环境）
```move
// 在 earnout.move 中添加
public struct TEERegistry has key {
    id: UID,
    admin: address,
    trusted_public_keys: vector<vector<u8>>,
}

// 修改 verify_nautilus_attestation 接受 TEERegistry 参数
public fun verify_nautilus_attestation(
    attestation: &vector<u8>,
    expected_kpi_value: u64,
    tee_registry: &TEERegistry,  // 新增
): bool {
    // ... 验证 TEE public key 在白名单中
}
```

### 3. 重新部署 Sui 合约

```bash
# 编译 Move 合约
cd src/backend/contracts/
sui move build

# 部署到 testnet
sui client publish --gas-budget 100000000

# 记录 Package ID
export EARNOUT_PACKAGE_ID=0x...
```

**注意**: 如果添加了 TEE Registry，需要额外步骤：
```bash
# 初始化 TEE Registry
sui client call \
  --package $EARNOUT_PACKAGE_ID \
  --module earnout \
  --function init_tee_registry \
  --gas-budget 10000000

# 添加可信 TEE public key
sui client call \
  --package $EARNOUT_PACKAGE_ID \
  --module earnout \
  --function add_trusted_tee \
  --args $TEE_REGISTRY_ID "0x<tee_public_key>" \
  --gas-budget 10000000
```

### 4. 前端集成测试

**测试流程**:
1. 创建测试 Deal
2. 上传测试财务文档到 Walrus
3. 调用 TEE 计算 KPI
4. 验证 attestation 格式正确（144 bytes）
5. 提交到 Sui 链并验证结算成功

**测试代码**:
```typescript
// 在浏览器控制台或测试文件中
import { createTEEService } from '@/src/frontend/services/tee-service';

const teeService = createTEEService();

const testDocuments = [
  {
    journalEntryId: 'TEST-001',
    credits: [{ account: 'Sales Revenue', amount: 10000 }]
  }
];

const result = await teeService.computeKPIWithAttestation(testDocuments);
console.log('KPI:', result.kpi_result.kpi); // 应该是 10000
console.log('Attestation length:', result.attestation_bytes.length); // 应该是 144
```

### 5. 添加 UI 集成

在现有的 Deal 详情页面中添加 Settlement 按钮：

```tsx
// app/(dashboard)/deals/[id]/page.tsx
import { SettlementButton } from '@/src/frontend/components/SettlementButton';

export default function DealPage({ params }: { params: { id: string } }) {
  const { data: deal } = useDeal(params.id);

  return (
    <div>
      {/* 现有内容 */}

      {deal.buyer === currentUserAddress && !deal.is_settled && (
        <SettlementButton
          deal={deal}
          paymentCoinId={selectedCoin.id}
          onSettlementComplete={() => {
            // 刷新页面或显示成功消息
          }}
        />
      )}
    </div>
  );
}
```

### 6. 端到端测试

**完整测试场景**:
1. **Buyer** 创建 Deal
2. **Buyer** 上传加密财务文档（Walrus + Seal）
3. **Auditor** 下载解密并审计文档
4. **Buyer** 点击 "Execute Settlement"
5. 系统自动：
   - 下载所有文档
   - 调用 TEE 计算 KPI
   - 生成 attestation
   - 提交到链上验证
   - 执行代币转账
6. **Seller** 收到代币（如果 KPI 达标）

## 安全检查清单

### MVP 阶段（当前）
- ✅ TEE 计算隔离
- ✅ Ed25519 签名验证
- ✅ 输入数据哈希
- ⚠️ 无 TEE 白名单（任何 TEE 都可以）
- ⚠️ 无 timestamp 验证（无法防止旧 attestation）
- ⚠️ 无 blob ID 验证（无法确认数据来源）

### 生产环境增强
- [ ] 实现 TEE Registry 白名单
- [ ] 添加 timestamp 时效性检查（1 小时内）
- [ ] 在 attestation 中包含 Walrus blob IDs
- [ ] 多 TEE 节点共识（2-of-3）
- [ ] Auditor 质疑期（settlement 延迟 24 小时）
- [ ] 远程证明（SGX/SEV attestation）

## 已知限制

1. **单一 TEE 节点**: 如果 TEE 宕机，settlement 无法进行
   - **缓解**: 部署多个 TEE 节点

2. **无法验证文档来源**: TEE 只验证文档内容，不验证是否来自 Walrus
   - **缓解**: 在 computation_hash 中包含 blob IDs

3. **Timestamp 可能不准确**: TEE 时钟可能被篡改
   - **缓解**: 使用 Sui Clock object 验证时效性

4. **KPI 计算逻辑固定**: 无法支持自定义 KPI 公式
   - **缓解**: 创建多个 TEE 程序或支持动态公式

## 成本估算

**假设**:
- 每个 Deal 有 12 个 subperiods (每月一个)
- 每个 subperiod 有 4 个文档（JE, FA, Payroll, Overhead）
- 总共 48 个文档

**费用**:
1. **Walrus 存储**: ~$0.01 per GB per month
   - 48 documents × 10KB = 480KB
   - 成本: 约 $0.0005/月

2. **Nautilus TEE 计算**: 假设 $0.001 per second
   - 计算时间: ~1 秒
   - 成本: $0.001 per settlement

3. **Sui Gas 费用**:
   - `submit_kpi_and_settle`: 约 0.01 SUI
   - 成本: ~$0.01 (假设 SUI = $1)

**总成本**: 约 $0.02 per settlement (非常低！)

## 测试数据示例

### Journal Entry (Sales Revenue)
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
**KPI Impact**: +50000

### Fixed Assets Register
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
**KPI Impact**: -900 (monthly depreciation)

### Payroll Expense
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
**KPI Impact**: -20000

### Overhead Report
```json
{
  "reportTitle": "Corporate Overhead Report",
  "period": "2025-01",
  "totalOverheadCost": 50000.0,
  "allocations": [...]
}
```
**KPI Impact**: -5000 (10% allocation)

**Total KPI**: 50000 - 900 - 20000 - 5000 = **24100**

## 常见问题

### Q: 为什么 KPI 要乘以 1000？
A: 因为 Sui Move 的 u64 不支持小数，乘以 1000 可以保留 3 位小数精度。
   - 例如: 1234.567 → 1234567 (u64)

### Q: attestation 为什么是 144 bytes？
A: 固定大小便于链上验证：
   - kpi_value: 8 bytes
   - computation_hash: 32 bytes
   - timestamp: 8 bytes
   - tee_public_key: 32 bytes
   - signature: 64 bytes
   - **Total: 144 bytes**

### Q: 可以在浏览器中运行 TEE 吗？
A: 不行。TEE 需要特殊硬件（Intel SGX、AMD SEV 等），必须在服务器端运行。
   前端通过 API 调用 TEE 服务。

### Q: 如果 TEE 计算错误怎么办？
A:
1. Auditor 可以独立重新计算 KPI 验证
2. 如果发现错误，可以在链上质疑（需要实现质疑机制）
3. 多 TEE 节点共识可以降低错误风险

### Q: MockTEEService 安全吗？
A: **绝对不安全！** 只用于开发测试，生产环境必须使用真实 TEE。

## 总结

✅ **已完成**:
- Move 合约 attestation 验证逻辑
- Rust TEE KPI 计算器（含测试）
- 前端 TEE 服务和 React hooks
- UI 组件和用户流程
- 完整文档

🔨 **待完成**:
- 部署 TEE 到 Nautilus
- 重新部署 Sui 合约
- 端到端集成测试
- 可选：TEE Registry 增强

🎯 **MVP Ready**: 当前实现已经可以支持基本的 TEE KPI 计算和验证流程！

---

**作者**: Claude Code
**日期**: 2025-01-23
**版本**: 1.0
