# Nodus 最小上線藍圖（2 週）

更新日期：2026-05-24
目標：在 2 週內把現有專案提升到「可控風險上線」狀態（不是最終完整形態），並以低運維負擔為原則。

## 0. 成功定義（Definition of Done）

上線前需要同時滿足：
- 功能可用：核心 API 與前端探索流程可穩定操作。
- 風險可控：管理端與資料寫入路徑有驗證、限流、審計。
- 可觀測：可快速定位錯誤來源（request id + health/metrics + notification）。
- 可回滾：部署流程具備最小回滾手段與版本標記。

---

## 1. 範圍與優先順序

### P0（必做，不完成不上線）

1. 認證與授權最小化
- 內容：
  - Admin API key 改為固定 header 規範與集中驗證。
  - 管理路由統一拒絕未授權請求，補齊 401/403 行為一致性。
- 輸出：
  - backend auth middleware 或依賴注入統一檢查。
  - 管理端 API 文件明確列出 auth 規則。
- 驗收：
  - 未帶 key 全數 401；錯誤 key 全數 403；合法 key 可通過。

2. 生產配置與 secrets 治理
- 內容：
  - 產出 env matrix（dev/staging/prod）與必要變數清單。
  - 明確禁止在生產使用預設弱值（例如空白 key、CORS=*）。
- 輸出：
  - docs/deployment_env_matrix.md
  - 啟動時配置檢查（至少 warning，最好在 prod 直接 fail-fast）。
- 驗收：
  - 缺關鍵變數時服務拒絕啟動或高可見告警。

3. 基礎觀測性與通知
- 內容：
  - 保留 /api/health 與 /api/metrics（或等價指標出口）。
  - 建立最小通知通道，至少覆蓋 5xx rate、admin trigger burst、Neo4j 連線失敗。
- 輸出：
  - health/metrics 出口 + notification 規則草案。
- 驗收：
  - 可在 5 分鐘內回答「服務有沒有掛、近期錯誤來自哪裡、是否需要回滾」。

4. CI 最小門檻
- 內容：
  - 建置 CI：pytest + npm build + Docker build。
  - PR 未通過檢查不可合併（至少在團隊流程中明文化）。
- 輸出：
  - .github/workflows/ci.yml（若目前非 GitHub，可替換為對應 CI 平台）。
- 驗收：
  - 每次提交可自動產生綠/紅燈結果。

5. 上線 Runbook + 回滾步驟
- 內容：
  - 產出一頁式 runbook：部署、健康檢查、回滾、緊急聯絡。
- 輸出：
  - docs/go_live_runbook.md
- 驗收：
  - 非原作者也可照文件完成部署與回滾。

### P1（強烈建議，建議同時推進）

狀態更新（2026-05-24）：P1-1 / P1-2 / P1-3 已完成最小可交付版本並通過驗證。

1. 前端模組化拆分（先拆高風險區）
- 內容：
  - 將 frontend/app.html 的 API 呼叫、狀態管理、圖譜渲染拆成模組檔。
- 輸出：
  - frontend/src/api.js
  - frontend/src/state.js
  - frontend/src/graph.js
  - frontend/src/app-main.js
- 驗收：
  - 主要流程行為不變，且 bug 修復成本明顯下降。

2. E2E smoke tests
- 內容：
  - 針對「載入圖譜、搜尋、切換語言、切換學習狀態」建立 1 條 happy path。
- 輸出：
  - tests/e2e/smoke.spec.ts（Playwright 或等價）。
- 驗收：
  - 每次 build 後可自動跑 smoke。
  - 目前 smoke 已覆蓋載入圖譜、搜尋、語言切換、學習模式切換。

3. API 合約測試
- 內容：
  - 對 /api/graph、/api/search、/api/learning-path 建立 schema/contract assertions。
- 驗收：
  - 破壞性欄位變更會被測試攔下。
  - 目前已覆蓋 404/400/429 錯誤情境。

### P2（可延後）

1. 多環境部署拓撲（staging/prod）
2. 壓測與容量模型（含快取命中率追蹤）
3. 管理操作審計頁與操作歷史查詢

---

## 2. 兩週排程（建議）

### Week 1

Day 1-2
- 完成 P0-1（auth 統一）與 P0-2（env matrix + prod 檢查）。

Day 3-4
- 完成 P0-3（health/metrics + notification 草案）。

Day 5
- 完成 P0-4（CI）並跑第一次全流程。

### Week 2

Day 6-7
- 完成 P0-5（go-live runbook + 回滾步驟）。

Day 8-9
- 推進 P1-1（前端拆分第一階段：API + state）。

Day 10
- 完成 P1-2（E2E smoke）與 P1-3（API contract）最小版。

---

## 3. 每日追蹤指標（建議）

每日站會只追 5 個數字：
- open P0 items
- API 5xx rate
- API p95 latency
- CI pass rate
- 未解決 blocker 數量

---

## 4. 風險與緩解

1. 風險：前端單檔過大，改動容易引入回歸。
- 緩解：先做無行為變更拆分，搭配 smoke test。

2. 風險：管理端路由未完全一致套用授權。
- 緩解：集中 middleware/依賴，禁用分散式手動判斷。

3. 風險：異常只有 log，無主動通知。
- 緩解：至少先落地 Slack/Webhook/Email 任一通知通道。

---

## 5. 建議立刻開的工作項目（Issue 標題）

1. P0: Unify admin authentication and authorization responses
2. P0: Add deployment environment matrix and prod fail-fast checks
3. P0: Keep basic health/metrics and add notifications
4. P0: Add CI pipeline for pytest, npm build, docker build
5. P0: Write go-live runbook and rollback checklist
6. P1: Extract app.html API and state modules
7. P1: Add frontend E2E smoke tests
8. P1: Add API contract tests for graph/search/learning-path
