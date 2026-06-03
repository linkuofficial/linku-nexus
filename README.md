# Nexus

Nexus 是一個跨領域知識圖譜平台，包含資料生成與治理腳本、FastAPI 後端，以及前端探索介面。

## 1. 先看這裡（交接入口）

- [docs/chrome_claude_report_archive_2026-05-28.md](docs/chrome_claude_report_archive_2026-05-28.md)：Chrome/Claude 問題清單最終收斂校準與完成狀態。
- [docs/regression_fix_report_2026-05-28.md](docs/regression_fix_report_2026-05-28.md)：本輪前端已知問題修復、測試補強與驗證結果總結。
- [docs/go_live_nexus_linku_tech_2026-05-28.md](docs/go_live_nexus_linku_tech_2026-05-28.md)：nexus.linku.tech 正式上線手冊（Fly.io + Cloudflare DNS）。
- [docs/current_status_2026-05-24.md](docs/current_status_2026-05-24.md)：目前已完成項目、風險與下一步。
- [docs/current_status_candidate_2026-05-25.md](docs/current_status_candidate_2026-05-25.md)：目前狀態候補檔（當日實測與待確認事項）。
- [docs/verification_runbook.md](docs/verification_runbook.md)：建置、測試、整合驗證標準流程。
- [docs/go_live_blueprint_2weeks_2026-05-24.md](docs/go_live_blueprint_2weeks_2026-05-24.md)：2 週最小上線藍圖（P0/P1/P2 與排程）。
- [docs/deployment_env_matrix.md](docs/deployment_env_matrix.md)：dev/staging/prod 變數矩陣與 production fail-fast 規則。
- [docs/go_live_runbook.md](docs/go_live_runbook.md)：上線、健康檢查、告警與回滾 SOP。
- [docs/p1_preparation_2026-05-24.md](docs/p1_preparation_2026-05-24.md)：P1 開工前置、測試骨架與拆分順序。
- [docs/p2_execution_2026-05-24.md](docs/p2_execution_2026-05-24.md)：P2 執行現況（拓撲、壓測、審計查詢）。
- [docs/p3_preflight_2026-05-24.md](docs/p3_preflight_2026-05-24.md)：P3 Lite 執行方案（輕運維、重體驗）。
- [docs/lite_backlog_2weeks.md](docs/lite_backlog_2weeks.md)：兩週實作清單（可直接照單執行）。
- [.env.example](.env.example)：最新環境變數範本（含 CORS 與 Admin 防濫用參數）。

## 2. 快速啟動

### 2.1 安裝依賴

```bash
pip install -r requirements.txt
npm install
```

### 2.2 準備環境變數

```bash
cp .env.example .env
```

生產環境至少確認：

- `ADMIN_API_KEY` 已設定。
- `ADMIN_ALLOWED_IPS` 已限制為你的固定管理來源（例如 office/VPN IP）。
- 若有反向代理：`ADMIN_TRUST_FORWARDED_FOR=true` 並設定 `ADMIN_TRUSTED_PROXIES`。
- 若無反向代理：`ADMIN_TRUST_FORWARDED_FOR=false`。
- `ADMIN_ENABLE_GENERATION_IN_PRODUCTION=false`（需要時再短暫開啟）。
- `CORS_ORIGINS` 不是 `*`。
- `ADMIN_TRIGGER_MAX_REQUESTS` / `ADMIN_TRIGGER_WINDOW_SECONDS` 合理。
- `ADMIN_ALERT_PER_MINUTE` / `ADMIN_ALERT_PER_DAY` 已依流量調整。
- `ALERT_WEBHOOK_URL` 已設定到 Slack/Teams/Email 相容通知通道（建議）。

### 2.3 本機開發

```bash
# Terminal A
npm run backend

# Terminal B
npm run dev
```

### 2.4 正式上線與交付前核對

- 正式網址：<https://nexus.linku.tech>
- 備用網址：<https://nexus-linku.fly.dev>
- 部署平台：Fly.io（nrt / Tokyo）

交付前請先確認以下指令都通過，再進行 `git push`：

```bash
npm run build
python -m pytest tests -q
npm run test:e2e
```

## 3. 驗證指令（交付前最小集）

```bash
# Python tests
python -m pytest tests -q

# API contract tests
npm run test:contract

# Frontend production build
npm run build

# E2E smoke tests
npm run test:e2e

# P2 API load baseline
python scripts/load_test_api.py --base-url http://127.0.0.1:8000 --requests 40 --concurrency 8

# P2 API load baseline with benchmark artifacts
python scripts/load_test_api.py --base-url http://127.0.0.1:8000 --requests 40 --concurrency 8 --output-dir docs/benchmarks

# P2 benchmark guardrail check
python scripts/benchmark_guard.py --current docs/benchmarks/latest.json --baseline docs/benchmarks/baseline.json --max-regression-pct 35 --max-graph-p95-ms 300 --max-search-p95-ms 120

# P2 promote latest benchmark to baseline
python scripts/update_benchmark_baseline.py --reason "post-release calibration"

# Description enhancement trial (report only, no data overwrite)
python scripts/enhance_descriptions.py --limit 30 --dry-run
```

Nightly alert webhook:

- 設定 repository secret `PERF_ALERT_WEBHOOK`（可對接 Slack/Teams 相容 webhook）。
- 可在 Actions 手動觸發 `Nexus Nightly Performance` 並開啟 `simulate_failure=true` 進行告警演練。

預期：

- 最新實測基準（2026-05-28）：`71 passed, 1 skipped`（`python -m pytest tests -q`）。
- 前端回歸基準（2026-05-28）：`15 passed`（`npx playwright test tests/e2e/regression.spec.ts`）。
- `npm run build` 成功並輸出 `dist/app.html`, `dist/index.html`, `dist/explorer.html`。

## 4. 專案結構（現行）

```text
Nexus/
├── backend/                # FastAPI routers/services/config
├── frontend/               # app.html / index.html / explorer.html
├── data/                   # all_nodes.json, i18n, batches, reports
├── scripts/                # generation, validate, dedup, import utilities
├── tests/                  # pytest tests and integration smoke test
├── docs/                   # status, runbook, prompts
├── requirements.txt
├── package.json
├── .env.example
└── Dockerfile
```

## 5. 運維與安全重點

- 後端已加入 request id 與全域例外處理，錯誤可追蹤。
- `/api/admin/generate/trigger` 已有速率限制、任務清理與容量上限。
- Admin 路由統一使用 `X-Admin-Key` 驗證：缺少金鑰回應 401，錯誤金鑰回應 403。
- i18n 已加入 locale 格式與路徑安全檢查。
- 前端已補載入失敗重試、基礎輸入驗證、可用性與 reduced-motion 支援。
- 執行期異常可透過 `ALERT_WEBHOOK_URL` 發送最小通知，涵蓋 5xx、admin trigger burst、Neo4j fallback。

## 6. 歷史資料（保留）

以下內容屬早期生成階段紀錄，保留作背景參考，非目前交付入口：

- 資料生成里程碑與批次統計
- 10,000 節點擴展計畫
- 舊版手動流程與 FAQ

如需追蹤完整歷程，請優先以 [docs/current_status_2026-05-24.md](docs/current_status_2026-05-24.md) 為基準，再回頭查詢 scripts 與 data 下歷史檔案。
