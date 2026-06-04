# NODUS Claude Chrome Report 歸檔分析（2026-05-28）

## 1. 歸檔目的

將 2026-05-28 提供之 Claude Chrome 問題清單轉為可追蹤的工程歸檔文件，並以現行程式碼做靜態驗證，區分：

- 已確認（Code-verified）
- 部分確認（Likely / needs browser repro）
- 已過時（Outdated，現況已改善或描述不符）

## 2. 驗證範圍與方法

- 範圍：frontend/index.html、frontend/app.html、frontend/explorer.html、frontend/src/app-main.js、frontend/src/i18n.js
- 方法：程式碼靜態檢查（非完整瀏覽器 E2E 重跑）
- 說明：本文件不覆蓋你原始報告內容，而是補上「當前 codebase 狀態」

## 3. 分級結論摘要

- P0：1 項，已確認 1
- P1：4 項，已確認 4（其中 1 項需 UI 重現補證）
- P2：8 項，已確認 6、已過時 1、部分確認 1
- P3：7 項，已確認 6、已過時 1

## 4. 條目驗證矩陣

| ID | 優先級 | 原報告主張 | 目前狀態 | 分析與歸檔結論 |
|---|---|---|---|---|
| B1 | P0 | app 描述區 Markdown 未渲染 | 已確認 | `renderPanelDescription()` 僅 `escHtml(raw)` 後包 `<p>`，未做 markdown inline 轉換。 |
| B2 | P1 | app ESC 關閉搜尋但不清空 input | 已確認 | `setupSearch()` 的 Escape 分支僅 `hideResults()`，未清空 `input.value`。 |
| B3 | P1 | explorer ESC 後重聚焦不回復下拉 | 部分確認 | Escape 會隱藏 results 並 blur；未清值。是否「不回復」仍需瀏覽器重現，但機制風險存在。 |
| I3 | P1 | 部分 display_tags 在 ZH/JA 未翻譯 | 已確認 | `TAG_LABELS` 覆蓋有限，缺 key 會 fallback 到 `humanizeTag()`（英文化）。 |
| W1 | P1 | index 使用 Tailwind CDN runtime | 已確認 | `index.html` 載入 `/tailwind-standalone.js`，符合報告警示方向。 |
| A1 | P2 | app 搜尋框缺 aria-label | 已過時 | `app.html` 的 `#search-input` 已有 `aria-label`。 |
| A2 | P2 | app filter 按鈕用 div 非 button | 已確認 | `buildFilters()` 仍是 `document.createElement('div')`。 |
| A3 | P2 | 語言切換按鈕用 div 非 button | 已確認 | `app.html`、`explorer.html` 仍為 `.lang-btn` div（含 role/tabindex）。 |
| A4 | P2 | app 搜尋缺 form 包裝 | 已確認 | `#search-input` 位於一般容器內，無 `<form>`。 |
| W2 | P2 | 缺 OG/Twitter meta | 已確認 | 三個 HTML 未見 OG/Twitter meta。 |
| W3 | P2 | 缺 favicon | 已確認 | 三個 HTML 未見 `<link rel="icon">`。 |
| W4 | P2 | 缺 meta description | 已確認 | 三個 HTML 未見 `<meta name="description">`。 |
| W5 | P2 | 版權年份硬編碼 2024 | 已確認 | `index.html` footer 存在 `&copy; 2024`。 |
| A5 | P3 | 初始 html lang 固定 en | 已確認 | 三頁初始 HTML 均為 `lang="en"`。 |
| A6 | P3 | 外部 CDN 依賴（字型、D3） | 已確認 | app/explorer 載入 cdnjs D3 與 Google Fonts。 |
| A7 | P3 | `_searchIndex` 語言切換後未更新 | 已確認 | `_searchIndex` 初建後未在 `setLang()` 重建。 |
| A8 | P3 | `applyLPVisibility()` 使用 `some()` 造成 O(n²) | 已確認 | `linkEls.each()` 內反覆 `prereqEdges.some()`。 |
| A9 | P3 | navHistory 未跨 session 持久化 | 已確認 | `navHistory` 為記憶體陣列，未寫入 storage。 |
| A10 | P3 | app/explorer welcome 文案不一致 | 已確認 | app 用 start，explorer 用 begin。 |
| A11 | P3 | explorer 連結面板只顯示 3 筆 | 已過時 | 現況為 `CONN_LIMIT = 5` 且具 `Show all/Show less` 切換。 |

## 5. 建議修復順序（可直接轉工單）

### Wave 1（立即）

1. B1：app 描述區加入安全的 inline markdown（至少 `**bold**`、`_italic_`）
2. B2 + B3：統一 app/explorer 搜尋 ESC 行為（關閉結果 + 清空值 + 重置 activeIndex）
3. I3：補齊 `TAG_LABELS.zh/ja` 缺漏 key（至少報告列出的 5 個）

### Wave 2（上線前）

1. A2 + A3：filter/lang 改語意化 button，保留既有樣式與鍵盤交互
2. W2/W3/W4/W5：補 head SEO 基礎標記、favicon、版權年份動態化
3. W1：移除 tailwind runtime，改建置時輸出 CSS

### Wave 3（性能與體驗）

1. A7：`setLang()` 後重建 `_searchIndex`
2. A8：`prereqEdges` 預建 `Set`，把 lookup 改 O(1)
3. A10：統一 welcome 文案
4. A9：評估是否將 navHistory 放入 sessionStorage

## 6. 歸檔備註

- 本歸檔顯示原報告中至少兩項已過時（A1、A11）。
- 若要作為正式 release gate，建議補跑對應 Playwright case（ESC 行為、panel markdown、tags i18n、SEO head 檢查）。
- 原始報告可保留為外部輸入，本文件作為「現況校準版」。

---

## 7. 第二次校準（依本次「完整問題清單」）

本節針對你本次貼上的完整清單再次比對現行程式碼，重點補充「範圍敘述偏差」與「狀態更新」。

### 7.1 校準重點（Delta）

1. **A3（語言按鈕語意化）需修正範圍描述**：非「所有頁面」
	- `index.html` 已使用 `<button class="lang-btn">`
	- `app.html`、`explorer.html` 仍為 `<div class="lang-btn" role="button" tabindex="0">`
2. **W5（版權年份硬編碼）需修正範圍描述**：非「所有頁面」
	- 目前可見 `&copy; 2024` 僅在 `index.html` footer
3. **A11（Explorer CONNECTIONS 只顯示 3 筆）已過時**
	- 現況為 `CONN_LIMIT = 5`，且已有 `Show all / Show less` toggle
4. **B3（Explorer ESC 後不回復下拉）機制上成立**
	- ESC 只隱藏結果並 blur，未清除 input value
	- 重新 focus 若 value 不變，不會觸發 input 事件，符合你描述的卡住風險

### 7.2 重新統計（以本次清單口徑）

- P0：1 項，已確認 1
- P1：4 項，已確認 4（B3 建議再補一次瀏覽器錄影證據）
- P2：8 項，已確認 5、部分確認 2、已過時 1
- P3：7 項，已確認 6、已過時 1

### 7.3 P2 分類說明（避免工單誤導）

- **已確認**：A2、A4、W2、W3、W4
- **部分確認（範圍需修正）**：A3（僅 app/explorer）、W5（僅 index）
- **已過時**：A1（app 搜尋框已存在 `aria-label`）

## 8. 建議工單拆分（補檔可直接落地）

### Ticket Group A：功能與內容正確性（上線前）

1. B1：`app-main.js` 描述渲染加入安全 inline markdown（`**bold**`、`_italic_`）
2. B2/B3：統一 app + explorer ESC 行為（hide + clear + 重置 activeIndex）
3. I3：補齊 `TAG_LABELS.zh/ja`，並建立缺漏 key 檢查（CI 或腳本）

### Ticket Group B：語意與可訪問性（上線前）

1. A2：filter 元件改 `<button type="button">`
2. A3：app/explorer 語言切換由 div 改 button（保留既有樣式）
3. A4：search 區塊包 `<form role="search">`

### Ticket Group C：平台與維護（可併版）

1. W1：下線 Tailwind runtime CDN，改建置期輸出 CSS
2. W2/W3/W4：補齊 OG/Twitter、favicon、meta description
3. W5：`index.html` footer 年份改動態

### Ticket Group D：效能與一致性（次階段）

1. A7：語言切換後重建 `_searchIndex`
2. A8：`prereqEdges` 改 `Set` lookup
3. A10：welcome 文案統一（start vs begin）
4. A9：評估 navHistory 是否進 `sessionStorage`

## 9. 驗收建議（最小回歸清單）

1. app/explorer：輸入搜尋字後按 ESC，需同時隱藏結果且清空 value
2. app：描述含 `**bold**` 與 `_italic_` 時，面板顯示為對應樣式
3. ZH/JA：指定缺漏 tag 不再回退英文
4. explorer：CONNECTIONS 預設 5 筆，可展開顯示全部
5. 三頁 head：可檢出 favicon + meta description + OG/Twitter

## 10. 歸檔結論（本次補檔）

你提供的清單大方向正確，且與既有歸檔高度一致；需特別校正的是三個「敘述範圍或時效」：

1. A3 非所有頁面
2. W5 非所有頁面
3. A11 已非現況問題

其餘高優先項（B1/B2/B3/I3/W1）仍屬有效修復目標。

## 11. 最終收斂更新（2026-05-28, Late）

本節反映後續實作完成後的最新狀態，用於覆蓋前文中「仍待修復」的描述。

### 11.1 已完成項（對照原報告）

- B1：app 描述區已支援安全 inline markdown（`**bold**`、`_italic_`）
- B2 / B3：app + explorer 搜尋 ESC 行為已統一為「隱藏結果 + 清空值 + 重置焦點流程」
- A2：app filter 控制已使用語意化 button
- A3：app / explorer 語言切換已使用語意化 button
- A4：app 搜尋區已以 `<form role="search">` 包裝
- W1：index 已改為 build-time Tailwind（不再使用 runtime CDN）
- W2 / W3 / W4 / W5：三頁 SEO/meta/favicon 與年份動態化已完成
- A5 / A6：初始 lang bootstrap 與外部 CDN 依賴移除已完成
- A7 / A8 / A10 / A9：搜尋索引重建、LP lookup 優化、文案一致、session 導覽歷史已落地
- A11：已屬過時項（現況為 CONN_LIMIT=5 + Show all/less）

### 11.2 I3 最新狀態

- I3：`display_tags` 在 JA 缺漏 key 時，新增 token-based fallback 本地化流程（由 `TAG_TOKEN_JA` 支援），可顯著降低英文化 fallback。
- 說明：此更新屬於「覆蓋率強化」，不是只補單一 key，後續新增 tags 時風險較低。

### 11.3 收斂結論

以目前程式碼狀態，原報告中的高優先修復清單已完成落地；剩餘工作以「持續資料翻譯覆蓋率提升」與「新功能回歸測試擴充」為主，不再屬於 blocker 級別。
