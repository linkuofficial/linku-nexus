# Nexus 回歸修復完成報告（2026-05-28）

## 目的

本文件補充本輪前端已知問題修復與驗證結果，作為交付與後續維運追蹤基準。

## 範圍與原則

- 以「目前程式現況」為基準，不重複處理已完成項目。
- 優先處理會影響操作可用性與可近用性的問題。
- 每項修復都補回歸測試，降低再次回歸風險。

## 已完成修復（對照已知問題）

### 1. App 主題過濾器 active state 對比不足

- 修復內容：強化 active/inactive 對比，並統一 filter 按鈕狀態色更新邏輯。
- 影響檔案：
  - `frontend/app.html`
  - `frontend/src/app-main.js`

### 2. App 頂部 hover-reveal 工具列可發現性不足

- 修復內容：強化頂部提示線可見性，collapsed 時提供更明顯提示；同時尊重 reduced-motion。
- 影響檔案：
  - `frontend/app.html`

### 3. Explorer 首次引導（onboarding）互動衝突

- 修復內容：
  - onboarding 背景可點擊關閉。
  - onboarding 卡片阻止事件外溢，避免誤觸圖譜。
  - 加入 ESC 關閉提示，並補三語文案。
- 影響檔案：
  - `frontend/explorer.html`

### 4. Explorer 推薦面板可近用性不足

- 修復內容：
  - 推薦項由 div 改為 button，可鍵盤聚焦與 Enter 啟用。
  - 補 focus-visible 樣式。
  - 保證觸控目標尺寸至少 44px。
- 影響檔案：
  - `frontend/explorer.html`

### 5. Explorer 展開行為文案不一致

- 修復內容：
  - welcome / tour / shortcuts 文案統一為「double-click 或在節點上 right-click 展開」。
  - 補中英日三語對齊。
- 影響檔案：
  - `frontend/explorer.html`

### 6. App 語言切換在面板開啟時可視性風險（overflow/遮擋）

- 修復內容：
  - 新增面板開關狀態統一控制（`body.panel-open`）。
  - 面板開啟時語言切換自動位移至面板左側安全區，避免被擠出或遮擋。
  - 補桌面斷點寬度（364/330）對應。
- 影響檔案：
  - `frontend/src/app-main.js`
  - `frontend/app.html`

## 測試補強

### 新增/更新的回歸測試

- Explorer onboarding 可點背景關閉。
- Explorer recommended item 可鍵盤啟用（button + Enter）。
- App filter chips 具全名 title 與 aria-label（縮寫+全名）。
- App 面板開啟時語言切換器保持可視且不與面板重疊。
- Index 觸控快速標籤流程改為穩定判斷（等待資料就緒後驗證導航結果）。
- Index Search Directly 測試改為穩定行為斷言（focus 成功）。

- 影響檔案：
  - `tests/e2e/regression.spec.ts`

## 驗證結果

本輪實測指令與結果：

1. `npm run build`
- 結果：成功（產出 `dist/app.html`, `dist/index.html`, `dist/explorer.html`）

2. `python -m pytest tests -q`
- 結果：`71 passed, 1 skipped`

3. `npx playwright test tests/e2e/regression.spec.ts`
- 結果：`15 passed`

4. `npx playwright test tests/e2e/smoke.spec.ts`
- 結果：`1 passed`

## 殘留風險（低）

- 目前未發現阻斷上線的功能缺陷。
- 已處理部分 Playwright 時序型 flake，但 CI 環境仍可能因資源負載差異偶發延遲；現已改為偏「穩定結果導向」斷言，風險可接受。

## 交接建議

- 若後續調整首頁動畫或 tooltip 時序，請同步維護 `tests/e2e/regression.spec.ts` 的 touch flow 測試。
- 若調整 app 右側面板寬度，請同步更新 `--panel-desktop-width`。
