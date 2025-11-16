## 1. 登入 & 角色確認（Sui Wallet）

使用者打開 Web App，首頁只有一個很單純的入口：**Connect Wallet**。
他用 **Slush** 連線並簽一次訊息後，就會進入系統，前端透過 dApp Kit 取得目前的 Sui address。

進來之後，如果這個地址已經在某個 deal 中被指派角色，你會在介面上看到自己的身份標籤，例如：

* Buyer / Acquirer
* Seller
* Auditor

這些角色資訊是從 Sui 智能合約裡讀出來的，不是前端 mock。
如果是買方管理者（Acquirer Admin），還會看到一個 **「建立新 Deal」** 的按鈕；其他角色只能看到自己被授權參與的 deal 列表，不能新增。

---

## 2. 建立一個 Earn-out Deal（在 Sui 上開一個工作空間）

買方管理者按下「建立新 Deal」後，會開一個表單，填入：

* Deal 名稱（如：Acquisition of X Corp）
* Closing Date
* 貨幣（例如 USD）
* …（其他需要的備註欄位）

送出後，前端會發一筆 Sui 交易，呼叫 Move 合約建立一個新的 `Deal` 物件，並在前端顯示這個 deal 的 **Dashboard**。
從現在開始，這個 deal 在鏈上就是一個獨立的 Earn-out Workspace，有自己的：

* Buyer / Seller / Auditor 地址
* Period 列表
* Walrus blob 關聯
* KPI / Settlement 狀態

接著，Admin 會在這個 deal 的「成員設定」區，把各個 Sui address 標記成 Buyer / Seller / Auditor（實際上是對合約呼叫設定角色的 function），不同角色以後看到的功能就會不一樣。

---

## 3. 設定 Earn-out 參數（把 Stock Purchase Agreement 條款變成 on-chain 參數）

在新建立的 deal 裡，Buyer 會進到一個「Earn-out 設定」畫面，這個畫面是把 Stock Purchase Agreement / Share Purchase Agreement 裡的條款拆成幾個可編輯區塊：

1. **期間設定**
   例如：

   * Period 1：2026-01-01 ~ 2026-12-31
   * Period 2：2027-01-01 ~ 2027-12-31

2. **KPI 類型與門檻**
   對每個 period，Buyer 設定：

   * ...

3. **Earn-out 計算公式**
   例如：

   * ...

當 Buyer 把這些表單填好後，畫面上會同時顯示兩個東西：

* 一段「人類可讀」的 summary，例如：

  > 2026 年度，如果 Revenue ≥ 10M USD，賣方可拿到最多 3M USD 的 earn-out，採線性比例發放……
* 一段對應的「合約參數 JSON 預覽」（實際會 encode 成 Move 結構寫進 Sui 合約）

Buyer 檢查沒有問題後，按下「Confirm & Write On-chain」，系統會要求用 Sui 錢包簽署一筆交易，把這整組 Earn-out 條件寫死在鏈上的 `Deal` 物件裡。
這一步會有二次確認提示，因為這些參數一旦鎖定就視為不可逆（除非另外開設明確的修訂流程）。

---

## 4. 買方定期上傳營運資料：Seal 加密 → Walrus 儲存 → Sui 掛指標

Earn-out 期間開始後，Buyer 的財務團隊會定期進入這個 deal 的「Data Upload」頁面。

操作流程變成：

1. **選擇期間 & 資料類型**

   * Period：例如 2026 Q1
   * Data Type：...

2. **前端用 Seal 加密檔案**

   * Buyer 上傳一個 CSV/Excel 檔（例如 `revenue_2026_Q1.csv`）。
   * 檔案不會直接明文丟到 Walrus，而是先在前端透過 **Seal TS SDK** 做加密，變成 ciphertext。
   * 這個 ciphertext 是未來要存進 Walrus 的內容。

3. **把 ciphertext 丟進 Walrus**

   * 前端呼叫你實作的 Upload Relay API，把 ciphertext 傳給後端。
   * Relay 伺服器用 Walrus SDK 將 ciphertext 上傳到 Walrus 網路。
   * Walrus 回傳一個 blob id / commitment 等 metadata。

4. **在 Sui 上掛上這個 blob**

   * 前端拿到 blob id 後，用 Sui 錢包簽名發一筆交易，呼叫 `add_walrus_blob(deal, period, blob_ref)`。
   * 合約會把這個 blob id 和相關 metadata（期間、類型、提交人地址）記錄在對應的 Period 底下。

完成後，這個 deal 的「Data Timeline」頁面會顯示：

* 2026-02-01 – Revenue Journal – Period 2026-Q1 – Blob #123 – submitted by 0xBuyer
* 2026-03-15 – EBITDA Adjustment – Period 2026-Q1 – Blob #124 – submitted by 0xBuyer

對 Buyer 來說，這是自己的送件紀錄；對系統來說，這代表「有一份被加密、存放在 Walrus 的檔案，被這樣的 metadata 錨定到 Sui 上」。

---

## 5. 賣方視角：監控資料提報是否完整（看得到 blob，看不到內容）

Seller 登入後，進入同一個 deal，看到的是相同的 Data Timeline，但在這個頁面上只能 **讀取**，不能新增 / 修改 blob 關聯。

他會非常清楚知道：

* 某個 period 到底有沒有定期被提交資料
* 哪些類型的資料已經上鏈（Revenue / EBITDA / 自訂 KPI）
* 每一個 Walrus blob 的 id、提交時間、提交人地址

內容本身仍然是加密狀態，真正要看內容時，會走 Seal 的解密流程（見後面 Auditor 章節）。
不過光是 blob 時間線，已經足夠讓 Seller 提早發現問題：例如整個 Q2 完全沒有任何與 revenue 相關的 blob 被提交，就可以早點質疑，而不是等年底一次看到被裁剪過的報表。

---

## 6. Period 結束後：Buyer 提出 KPI 結果（寫進 Sui）

當某個 period 結束，例如 2026 年度結束，Buyer 會到「KPI Proposal」頁面。

這頁面會顯示：

* 此 period 底下所有已提交的 Walrus blob（按時間、類型列出）
* 方便 Buyer 對照自己在內部的計算來源

Buyer 先在公司內部算好 KPI，接著在介面輸入：

* KPI 類型：如 Revenue
* 計算結果：例如 11.3M USD
* 附註：簡短文字說明（可選）

前端會做兩件事：

1. 用已經寫死在 Sui 合約裡的公式，先在 UI 做一次「試算」，計算出這個 KPI 對應的 Earn-out 金額，在畫面上預覽給 Buyer 看。
2. 用 Sui 錢包簽名，發一筆交易呼叫 `propose_kpi(deal, period, value)`，把這個 KPI 值當成這個 period 的官方提案，存進合約狀態。

這樣之後 auditor 跟 seller 都可以在鏈上看到「這個 period，buyer 認為 KPI = 11.3M」。

---

## 7. Auditor 驗證：從 Walrus 解密資料，然後 on-chain 簽章

Auditor 登入後，進入同一個 deal 的「KPI Review」頁面，可以看到：

* 每個 period 的 KPI 提案（例如：2026 – Revenue = 11.3M）
* 此 KPI 相關聯的 Walrus blob 列表（例如該年度 revenue journal 的各個 batch）

當 auditor 想要抽樣檔案時，流程是：

1. 在 UI 點選某個 blob
2. 前端用 Seal SDK 根據當前 Sui address + 這個 blob 所屬的 Deal / Period，向 Seal Key Servers 請求解密 key

   * Key Servers 會根據 `earnout_seal_policy` Move 模組的邏輯去 Sui 上查：目前這個地址是否是這個 Deal 的 auditor / buyer / seller，有沒有權限解密
3. 如果通過，前端拿到解密 key，從 Walrus 把 ciphertext 抓回來，在本地解密成原始 CSV / 檔案內容
4. Auditor 自己用本地工具驗證：

   * 檔案內容是否合理
   * 計算出來的 Revenue 是否真的有對上

驗證完成後，Auditor 會在「KPI Review」頁面直接進行審核動作：

* 按下 Approve 或 Reject
* 如果 Approve：用自己的 Sui 錢包簽名，發交易呼叫 `attest_kpi(deal, period, value)`，把他認可的 KPI 值寫進合約，作為 **attested KPI**
* 如果 Reject：在 UI 填寫拒絕原因，前端會透過鏈上 event 或 off-chain 記錄讓 Buyer / Seller 都看得到

對 Buyer 和 Seller 來說，UI 上會看到每個 period 的 KPI 狀態：

* Pending – Auditor 尚未審核
* Approved – KPI 已被 auditor 簽章確認（合約裡有 attested KPI 值）
* Rejected – 被退回，需要 Buyer 重提或補資料

只有 Approved 的 period，才允許進下一步的結算流程。

---

## 8. Earn-out 結算 & 付款（依 attested KPI 由 Sui 合約算錢）

當某一個 period 的 KPI 已經被 Auditor Approved，系統會在這個 period 的「Settlement」區塊顯示：

* 已確認的 KPI 值（來自 `attested_kpi`）
* Earn-out 合約中的計算公式（可視化給使用者看）
* 代入公式後的應付 Earn-out 金額（試算結果 + on-chain 實際計算結果）

Buyer 在確認沒有問題後，可以：

1. 按下「Settle Period」
2. 系統要求 Buyer 用 Sui 錢包簽署 settlement 交易
3. Move 合約中的 `settle(deal, period)` 會：

   * 確認該 period 已經有 attested KPI，且尚未結算
   * 依公式算出金額
   * 更新該 Period 的 settlement 狀態
     -（選擇性）從 escrow / treasury address 轉出對應 token 給 Seller（比賽版可以用 testnet SUI 或 demo token）

交易成功後：

* Seller 的介面會看到：

  * 這個 period 的實際付款金額
  * 付款時間
  * TX hash（可以點出去 Sui explorer 查看）
* 這些資訊變成未來法律、稅務、爭議處理時的證據來源。

---

## 9. Dashboard：所有角色的一眼總覽（Sui 狀態 + Walrus 時間線）

對 Buyer、Seller、Auditor 來說，打開某個 deal 的首頁 Dashboard，大概會看到這些關鍵資訊：

* Period 清單（例如 2026 / 2027 / 2028）

* 每個 Period 的狀態：

  * 資料提交進度：這個 period 下有多少 Walrus blob、最後一次提交時間
  * KPI 狀態：Not Proposed / Proposed / Approved / Rejected
  * Settlement 狀態：Not Settled / Settled with X token / Settled (0)

* 最近 5 筆鏈上事件（由 Sui events 撈出來）：

  * 資料上傳 / 新 blob 綁定
  * KPI 提案
  * Auditor 簽章
  * Settlement 完成

你可以把這個 Dashboard 當作「Earn-out 健康度面板」，不用一直點進細節頁面，就能知道：

* 買方有沒有乖乖上傳資料
* Auditor 卡在哪個 period
* 哪些年度已經結算完畢

---

## 10. Admin：管理地址 & 風險提示（權限在鏈上，一律二次確認）

最後是 Admin 的操作：

* 在「Access Control」頁面，Admin 可以為這個 deal 新增或移除：

  * Buyer address
  * Seller address
  * Auditor address

這些變更會對應到合約裡的角色設定（可以是 on-chain role mapping，也可以搭配 Seal policy 做權限判斷），確保未來要換 auditor / 換窗口時，不需要重新部署整套系統。

同時，在一些關鍵操作上，UI 都會跳出明確警示：

* Lock Earn-out Parameters
* Trigger Settlement for Period X
* 變更 Deal 重要角色（例如更換 Auditor 地址）

會清楚講明：

> 這個操作一旦寫入 Sui 鏈上就無法任意修改，請再次確認。

並要求使用者再次用錢包簽署或輸入「CONIRM」之類的文字，以降低誤操作風險。
