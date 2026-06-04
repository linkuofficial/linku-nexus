# Nodus P2 執行計畫與現況（2026-05-24）

## 1. 目標範圍

P2 聚焦三件事：
- 多環境部署拓撲（staging/prod）
- 壓測與容量基線（含快取熱身觀察）
- 管理操作審計查詢能力

## 2. 已落地（本次）

### 2.1 多環境部署拓撲（文件）

建議拓撲：
- staging：
  - 與 production 同版號部署流程
  - 獨立資料源（Neo4j staging）
  - 啟用完整 smoke + contract + e2e
- production：
  - 僅由通過 CI 的 artifact 升版
  - 監控 /api/metrics 與告警閾值
  - 發生異常時走 runbook 回滾

流量路徑（簡化）：
- Client -> CDN/Edge -> API Gateway/Ingress -> FastAPI -> Neo4j + data/*

### 2.2 API 壓測腳本

新增腳本：scripts/load_test_api.py

用途：
- 驗證 /api/graph/subgraph、/api/search 在既定併發下的平均/95 分位延遲
- 比較 first hit 與後續批量請求（快取熱身前後）

範例：
- python scripts/load_test_api.py --base-url http://127.0.0.1:8000 --requests 40 --concurrency 8
- python scripts/load_test_api.py --base-url http://127.0.0.1:8000 --requests 40 --concurrency 8 --output-dir docs/benchmarks

輸出重點：
- first_hit（graph/search）
- avg_ms / p95_ms / max_ms / non_2xx

benchmark artifacts：
- docs/benchmarks/latest.json
- docs/benchmarks/latest.md
- docs/benchmarks/latest_guard.json
- docs/benchmarks/baseline.json
- docs/benchmarks/<prefix>.json
- docs/benchmarks/<prefix>.md

guardrail：
- scripts/benchmark_guard.py 會比較 current vs baseline 並在超過退化門檻時回傳非 0。

### 2.3 管理操作審計查詢

新增 endpoint：
- GET /api/admin/audit

查詢參數：
- limit: 1..500（預設 50）
- event_type: 可選
- status: 可選

資料來源：
- data/admin_audit_log.jsonl

目前會記錄：
- /api/admin/generate/trigger 的 accepted / rejected / rate_limited
- /api/admin/generate/status, /api/admin/generate/tasks, /api/admin/quality, /api/admin/dedup, /api/admin/costs, /api/admin/i18n/status, /api/admin/audit 的讀取操作
- 欄位含 timestamp, event_type, status, request_id, client_ip, admin_key_prefix, detail

### 2.4 Nightly 壓測流程

新增 workflow：
- .github/workflows/nightly-performance.yml

能力：
- 排程每天執行（UTC 02:00）
- 自動啟動 API
- 執行 load_test_api.py 產生 benchmark 檔
- 執行 benchmark_guard.py 做退化檢查（fail gate）
- 失敗時透過 PERF_ALERT_WEBHOOK 發送通知
- 上傳 benchmark artifacts

### 2.5 2026-05-24 校準與演練結果

baseline 校準（nightly 同參數 requests=80, concurrency=16）：
- graph_subgraph: avg_ms=181.4, p95_ms=288.0, non_2xx=0
- search: avg_ms=46.8, p95_ms=110.5, non_2xx=0

fail 演練（故意嚴格門檻）：
- benchmark_guard.py 回傳 fail（預期）
- 產出 docs/benchmarks/drill_guard_fail.json，包含 violation 詳細訊息

pass 驗證（正式門檻）：
- benchmark_guard.py 回傳 pass
- latest_guard.json 可供 nightly summary 與 webhook 通知使用

## 3. 建議下一步（P2 後續）

1. 把 load_test_api.py 輸出接到趨勢報表（每次版本都保存結果）。
2. 在 CI nightly 增加 staging 壓測工作，追蹤 p95 漂移。
3. 將 admin audit 擴展到更多敏感操作（例如成本、資料治理觸發任務）。
4. 將 audit log 送入集中式 log 平台，提供長期檢索與告警。

## 4. P2.5 補強完成（2026-05-24）

已完成項目：
- 通知演練制度化：nightly workflow 支援 `workflow_dispatch` 的 `simulate_failure`/`drill_reason`。
- baseline versioning：新增 `scripts/update_benchmark_baseline.py`，並將升級紀錄寫入 `docs/benchmarks/baseline_history.jsonl`。
- admin audit retention：加入 retention days + file size rotate + rotated files 上限控制。
- failure 分類：benchmark guard 產出 `violation_summary` 與 category（availability/threshold/regression），便於值班判讀與通知。
