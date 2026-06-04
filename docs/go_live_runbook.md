# Nodus Go-Live Runbook

更新日期：2026-05-24

## 1. 部署目標

- 服務：Nodus FastAPI + built frontend
- 入口健康檢查：/api/health
- Metrics：/api/metrics
- 策略：基本監控 + 單一通知通道，不建立正式值班制度

## 2. 上線前條件

- 最新 CI 成功（pytest + npm build + docker build）。
- APP_ENV=production。
- ADMIN_API_KEY 與 CORS_ORIGINS 通過 startup fail-fast。
- 部署回滾映像或前一版 artifact 已可用。

## 3. 部署步驟

1. 拉取最新主分支並確認 commit。
2. 建立映像：docker build -t nodus:<release-tag> .
3. 設定 production secrets 與 env。
4. 啟動新版本容器（或滾動更新）。
5. 執行健康檢查與 smoke 驗證。

## 4. 上線後 10 分鐘檢查

- GET /api/health 回傳 200。
- GET /api/metrics 可讀取，且包含：
  - nodus_http_requests_total
  - nodus_http_5xx_total
  - nodus_http_latency_p95_ms
  - nodus_admin_trigger_events
- 前端首頁與圖譜頁可正常載入。

## 5. 核心告警規則（初版）

原則：僅保留會直接影響可用性的最小通知集合。

1. API 5xx rate
- 條件：5 分鐘內 5xx 比例 > 2%
- 行動：先看 request_id 與最近部署變更，必要時回滾

2. API p95 latency
- 條件：10 分鐘內 p95 > 1500ms
- 行動：檢查 Neo4j 連線與查詢熱點

3. Admin trigger burst
- 條件：nodus_admin_trigger_events{window="minute"} 超過閾值
- 行動：檢查是否誤觸發或濫用，必要時旋轉 ADMIN_API_KEY

4. Neo4j 連線異常
- 條件：應用 log 出現連線失敗尖峰
- 行動：檢查 DB 狀態、網路 ACL、憑證

5. 通知處理方式
- 條件：以上任一告警命中
- 行動：發送到單一 Slack/Teams/Email 通道，由維護者在工作時段處理；若正在發版窗口則立即處理

## 6. 回滾流程

1. 判斷觸發條件
- 連續 10 分鐘健康檢查不穩定，或關鍵功能不可用。

2. 執行回滾
- 切回上一版穩定映像 nodus:<previous-tag>。
- 重啟服務並再次驗證 /api/health 與前端核心流程。

3. 回滾後處理
- 建立 incident 紀錄（時間、影響範圍、根因、修復方案）。
- 凍結新版本再次部署，直到修復完成。

## 7. 緊急聯絡模板

- Incident Commander：<填寫>
- Backend Owner：<填寫>
- Frontend Owner：<填寫>
- Infra Owner：<填寫>
- 通知頻道：<Slack/Teams channel>

## 8. 例行維護（可選）

1. baseline 校準（版本後）
- 先跑 load test 產生最新 benchmark。
- 執行 `python scripts/update_benchmark_baseline.py --reason "<release> calibration"`。
- 確認 docs/benchmarks/baseline_history.jsonl 有新增紀錄。

## 9. Release 當天檢查表

說明：以下分為 Lite 必做與 Advanced 可選。

1. 變更前
- [ ] (Lite 必做) CI 綠燈（pytest/build）。
- [ ] (Lite 必做) 上一版可回滾 artifact 已確認可用。
- [ ] (Lite 建議) `PERF_ALERT_WEBHOOK` 或等價通知通道已配置。

2. 發版動作
- [ ] (Lite 必做) 發版後手動 smoke：載入、搜尋、語言切換。
- [ ] (Advanced 可選) 產生 benchmark（requests=80, concurrency=16）。
- [ ] (Advanced 可選) guard 驗證通過（latest_guard.json status=pass）。
- [ ] (Advanced 可選) 執行 baseline promotion 並填寫 reason。

3. 發版後 10 分鐘
- [ ] (Lite 必做) `/api/health` 正常。
- [ ] (Lite 必做) 前端核心流程（載入、搜尋、語言切換）正常。
- [ ] (Advanced 可選) `/api/metrics` 指標可讀。

4. 收尾
- [ ] (Lite 必做) 紀錄本次 release tag 與負責人。
- [ ] (Advanced 可選) baseline_history 已新增紀錄。
- [ ] (Lite 建議) 確認通知通道可收到本次 release 視窗的異常訊息。
