# TECH STACK

本文件說明本專案在 **Sui + Walrus + Seal + Next.js** 上的技術選型與邊界。

## 1. 系統總覽

本專案是一個用於 **M&A Earn-out 機制** 的 Web dApp，主要能力：

- 把 Earn-out 條款（期間、KPI、公式）寫入 Sui 智能合約  
- 用 Walrus 儲存實際財務檔案（journal CSV、報表等）  
- 用 Seal 做加密與存取控制，確保只有 Buyer / Seller / Auditor 等角色能解密  
- 用 Next.js 做前端 UI，負責：
  - Connect Wallet / 角色判斷
  - 建立 deal、設定參數
  - 上傳檔案 → 加密 → 丟進 Walrus → 把 blob id 綁到對應 Deal / Period
  - KPI 提報 / Auditor 簽章 / Earn-out 結算流程

高層架構（簡化文字版）：

- **Frontend**：Next.js (React, TS)  
- **Blockchain**：Sui (Move contracts)  
  - `earnout`：Deal / Period / KPI / Settlement  
  - `earnout_seal_policy`：Seal policy & access control
- **Storage**：Walrus blobs，blob id 由 Sui 合約引用  
- **Encryption / Access Control**：Seal SDK + Seal Key Servers（由 Sui 上的 policy 控管）

---

## 2. Frontend：Next.js App

### 2.1 Framework

- **Next.js**（App Router，TypeScript）
- **React 18+**
- **npm**

### 2.2 UI / 狀態管理

- Styling：Tailwind CSS
- 狀態 & 資料抓取：
  - `@tanstack/react-query`（隨 Sui dApp Kit 一起使用）  

### 2.3 Sui 前端整合

- 套件：
  - `@mysten/dapp-kit` – React hooks + components + Provider，處理錢包連線與 RPC。  
  - `@mysten/sui` – TypeScript SDK，負責查鏈 / 發交易。  

- 功能要求：
  - Connect Wallet（支援 Sui 錢包 / Suiet 等常見 Sui 錢包）
  - 透過 dApp Kit provider 管理：
    - 目前網路（devnet / testnet / mainnet）
    - 目前錢包地址
  - 只在「需要簽名的操作」時發起 Sui transaction：
    - 建立 Deal
    - 鎖定 Earn-out 參數
    - 綁定 Walrus blob 到某個 Deal / Period
    - KPI proposal / Auditor attestation
    - Settlement

### 2.4 Next.js Routing

（實作時可以微調，但請保持結構接近這種語意）

- `/`  
  - 單純 landing / Connect Wallet 入口
- `/deals`  
  - 列出當前錢包參與的所有 Deal
- `/deals/[dealId]`  
  - Dashboard（狀態總覽）
- `/deals/[dealId]/setup`  
  - Earn-out 參數設定頁（Buyer 用）
- `/deals/[dealId]/data`  
  - Data timeline：上傳 / 檢視 Walrus blobs
- `/deals/[dealId]/kpi`  
  - KPI proposal（Buyer）+ KPI review（Auditor）
- `/deals/[dealId]/settlement`  
  - Earn-out 計算結果 + 結算按鈕 + TX log

---

## 3. Blockchain：Sui + Move Contracts

### 3.1 目標網路

- 預設：**Sui testnet**（如要改 devnet / mainnet，統一在 config 裡調整）

### 3.2 Move Package：`earnout`

職責：**業務邏輯核心**，不負責加密，只記錄 Walrus blob id 與 KPI  / 結算狀態。

Key 概念（實作時請對應成 `struct` / `event`）：

- `Deal`
  - `buyer: address`
  - `seller: address`
  - `auditor: address`
  - `periods: vector<Period>`
  - `status`
- `Period`
  - `year` / `start_ts` / `end_ts`
  - KPI 類型與公式的參數
  - `walrus_blobs: vector<BlobRef>`（僅存 blob id / commit hash，不存原文資料）
  - `kpi_proposed` / `kpi_attested`
  - `settlement` 狀態（已結算金額等）

必要公開方法（命名可調，但語意不要跑掉）：

- `create_deal(...)`
- `set_parameters(...)`（只允許在初始化階段呼叫，之後鎖定）
- `add_walrus_blob(deal, period_id, blob_ref)`
- `propose_kpi(deal, period_id, value)`
- `attest_kpi(deal, period_id, value)`（只允許 Auditor 地址）
- `settle(deal, period_id)`（根據 attested KPI 和公式算金額，更新狀態並發 event）

### 3.3 Move Package：`earnout_seal_policy`

職責：**Seal 存取政策**，告訴 Seal「哪些地址有權解密哪些 blob」。

- 需要實作 Seal 規範要求的 policy 模組，供 Seal Key Servers 檢查。  
- 邏輯大致為：
  - 對於某個 Walrus blob，如果它掛在某個 Deal / Period 底下：
    - Buyer / Seller / Auditor（這三種角色）可以解密
    - 其他地址一律拒絕
- Policy 內需能查詢：
  - blob 對應的 Deal / Period
  - 該 Deal 的角色 mapping

---

## 4. Storage：Walrus

### 4.1 Walrus SDK

- 使用 `@mysten/walrus` TypeScript SDK。  
- 注意：直接在瀏覽器使用 SDK 上傳／讀取 blob 會需要大量請求（官方數字上傳一個 blob 約 2000+ requests）。  
  - 實作時 **務必透過 Upload Relay** 減少請求數與瀏覽器壓力。  

### 4.2 Upload Relay

- 本專案預期做法：
  - 在 Next.js 專案中實作一個簡單 API Route 作為 upload relay：
    - 前端把已加密的檔案丟給 relay
    - relay 使用 Walrus SDK 實際上傳到 Walrus 節點
  - Relay 的 endpoint、Walrus RPC URL 等，從 `.env` 讀取。

### 4.3 On-chain Metadata

- 上傳完成後，Walrus 回傳 blob id / commitment 等 metadata。
- 前端發一筆 Sui transaction 呼叫 `add_walrus_blob`，把 blob id 綁到 Deal / Period 上。
- **Sui 上只存「指標」與 metadata，不存檔案本身**。

---

## 5. Encryption & Access Control：Seal

### 5.1 Seal SDK

- 使用 `@mysten/seal` TypeScript SDK。  
- Seal 的角色：
  - 前端（或後端）用它來：
    - 加密檔案（上傳前）
    - 根據使用者當前 address + on-chain policy 請求解密 key（下載時）

### 5.2 加解密流程

1. **上傳時（Buyer）**
   - 使用 Seal SDK 對檔案做加密（Seal 會跟一組 Key Servers 溝通）
   - 產生 ciphertext → ciphertext 才丟到 Walrus
   - 取得 blob id → 寫入 Sui `Deal/Period` 底下

2. **閱讀時（Buyer / Seller / Auditor）**
   - 先確認當前錢包地址在該 Deal 中是什麼角色（從 Sui 讀）
   - 使用 Seal SDK 根據 blob id + 當前 address 向 Key Servers 要解密 key（Key Servers 會依據 `earnout_seal_policy` 決定是否核准）  
   - 如果核准，前端拿到 key 解密 Walrus 的 ciphertext，得到原始 CSV / 檔案內容。

3. **安全邊界**
   - Walrus 裡永遠只有 ciphertext  
   - 「誰能解密」完全由 Sui 上的 policy 控制（不寫死在後端）

---

## 6. 環境與工具

### 6.1 基本開發環境

- Node.js：LTS（22+）
- Package manager：`npm`
- TypeScript：集中設定在 `tsconfig.json`

### 6.2 主要依賴（概念層級）

```text
Frontend:
  - next
  - react, react-dom
  - typescript
  - tailwindcss
  - @tanstack/react-query

Sui / Web3:
  - @mysten/sui
  - @mysten/dapp-kit

Walrus:
  - @mysten/walrus

Seal:
  - @mysten/seal
