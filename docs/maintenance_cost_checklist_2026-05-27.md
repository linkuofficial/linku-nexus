# Nodus 上線後維護費用檢核清單 (2026-05-27)

## 1) 直接 API 成本 (最主要)

- 來源：Anthropic Claude API（節點生成與描述增強腳本）
- 觸發條件：執行 scripts/generate_nodes.py、scripts/enhance_descriptions.py、scripts/batch_enhance_descriptions.py，或透過 /api/admin/generate/trigger 觸發生成
- 成本已在專案內有追蹤欄位：input_tokens、output_tokens、cost_usd、budget_warning_usd

成本控制建議：
- 正式環境維持 ADMIN_ENABLE_GENERATION_IN_PRODUCTION=false
- 需要生成時優先使用低成本模型（例如 critique 使用 Haiku）
- 定期查看 /api/admin/costs 與 data/generation_log.jsonl

## 2) 資料庫成本 (可能固定月費 + 流量)

- 來源：Neo4j（若使用託管版或雲主機）
- 現況：圖譜與搜尋有 JSON fallback，非所有功能都強制依賴 Neo4j
- 需要 Neo4j 的核心能力：/api/graph/path（最短路徑）

成本控制建議：
- 若暫不需要 path 功能，可先以 JSON fallback 形態上線
- Neo4j 只在需要高階查詢時開啟，可降低初期成本

## 3) 通知與告警成本 (通常低)

- 來源：ALERT_WEBHOOK_URL 指向的外部通知服務（Slack/Teams/Email gateway）
- 觸發條件：錯誤或告警事件觸發 webhook 發送
- 現況：未設定 ALERT_WEBHOOK_URL 時不會送出外部通知

成本控制建議：
- 上線初期可保留 webhook，但提高節流間隔避免訊息風暴
- 先用單一通道，避免多通道重複通知

## 4) CI/CD 與排程成本 (依平台計費)

- 來源：GitHub Actions（CI + nightly performance）
- 觸發條件：push/PR、nightly schedule、手動 workflow_dispatch
- 風險：repo 若為 private，Actions minutes 可能計費

成本控制建議：
- nightly 壓測改成每週或只在 release 週期啟用
- 非必要時關閉 simulate_failure drill

## 5) 基礎設施固定成本 (一定會有)

- API 主機/容器執行環境
- 網域與 TLS 憑證
- 儲存與備份（data 與審計 log）

成本控制建議：
- 先用單機規模 + 基本監控
- 流量成長後再加 autoscaling

## 6) 立即執行的控費動作 (建議)

1. 保持 ADMIN_ENABLE_GENERATION_IN_PRODUCTION=false
2. 僅在必要維運窗口開啟生成
3. 設定 ALERT_WEBHOOK_URL 並確認告警節流
4. 設定每週檢視 /api/admin/costs
5. 將 nightly performance 改為較低頻率
