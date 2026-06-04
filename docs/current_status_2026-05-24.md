# Nodus Current Status (2026-05-24)

## 1. 本次已完成的重點

### Backend hardening
- 新增可配置 CORS：由 CORS_ORIGINS 控制，不再硬編碼萬用來源。
- 新增安全標頭中介層：X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy。
- 新增 request_id 與請求耗時日誌，所有請求可追蹤。
- 新增全域例外處理，錯誤回應會帶 request_id。
- 新增 shutdown 清理：關閉 Neo4j driver。

### Admin protection
- /api/admin/generate/trigger 新增每窗口速率限制（429）。
- 新增任務清理與容量上限，避免 in-memory 任務表失控增長。
- 新增 minute/day 觸發量告警閾值（logger warning）。
- 所有 guardrails 已環境變數化，可在不同環境調整。

### i18n security
- locale 格式驗證。
- locale 檔案路徑穿越防護。
- locale JSON 損毀時回傳可辨識錯誤。

### Frontend reliability/accessibility/perf quick fixes
- 圖譜載入失敗時顯示錯誤與 Retry，不再無提示空白頁。
- URL 參數與 localStorage 資料加入基本驗證。
- 搜尋結果補 aria 狀態與可見性同步。
- 語言切換、學習路徑按鈕補鍵盤可操作與 aria。
- 背景粒子動畫支援頁面不可見暫停與 reduced-motion。
- 提升弱對比色可讀性。

---

## 2. 主要變更檔案

- backend/config.py
- backend/main.py
- backend/routers/admin.py
- backend/routers/i18n.py
- frontend/app.html
- tests/test_api_integration.py
- pytest.ini
- .env.example
- README.md

---

## 3. 驗證結果摘要

### Automated tests
- python -m pytest tests -q
- 結果：32 passed, 1 skipped

### Frontend build
- npm run build
- 結果：success（dist/app.html, dist/index.html, dist/explorer.html）

### Integration smoke
- test_api_integration 已改為 pytest 形式。
- 當本地 API 未啟動時，測試自動 skip（避免整包測試在 collection 階段失敗）。

---

## 4. 當前已知事項

- 本工作區目前無 .git（git status / git diff 無法執行）。
- Admin trigger 告警目前寫入 application log，尚未接外部監控通道。
- FastAPI on_event(shutdown) 可用；後續若升級框架可考慮統一轉 lifespan。

---

## 5. 建議下一步（短期）

1. 補 .env 與部署環境變數清單到實際部署平台（含 CORS 與 Admin guardrails）。
2. 將 admin trigger warning 串接到單一通知通道（Slack, Teams 或 Email 即可）。
3. 針對 5xx、Neo4j 連線失敗補最小通知規則。
4. 追加 API 壓測腳本（特別是 graph/search 首查與快取命中行為）。
5. 規劃 frontend/app.html 模組化拆分，降低單檔維護成本。
