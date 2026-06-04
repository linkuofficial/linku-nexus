# Verification Runbook

此文件用於快速確認 Nodus 專案在本機是否處於可交付狀態。

## 1. Python tests

Command:

d:/Code_Space/Nodus/.venv/Scripts/python.exe -m pytest

Expected:
- 結果含 48 passed
- test_api_integration 在 API 未啟動時可能為 1 skipped（屬正常）

## 2. Frontend production build

Command:

npm run build

Expected:
- Vite build success
- dist 產出 app.html, index.html, explorer.html

## 3. Optional API integration smoke

先啟動 API：

d:/Code_Space/Nodus/.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

再執行：

d:/Code_Space/Nodus/.venv/Scripts/python.exe -m pytest tests/test_api_integration.py -q

Expected:
- test_api_integration pass
- /api/learning-path, /api/admin, /api/graph, /api/search 皆可回應 200

## 4. Environment sanity

建議至少確認：
- ADMIN_API_KEY（生產環境務必設定）
- CORS_ORIGINS（生產環境避免使用 *）
- ADMIN_TRIGGER_MAX_REQUESTS / ADMIN_TRIGGER_WINDOW_SECONDS
- ADMIN_ALERT_PER_MINUTE / ADMIN_ALERT_PER_DAY
- NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD

## 5. Notification smoke (release pre-check)

Command:

npm run smoke:notify

Expected:
- 顯示 `[smoke] result=PASS`
- 包含 health/metrics/admin trigger 檢查結果
- 若 `ALERT_WEBHOOK_URL` 已設定，回傳 webhook probe 2xx

## 6. Common issues

1. No module named pytest/uvicorn
- 先安裝 requirements 或最小必要套件。

2. Integration test connect error
- 確認 API 正在 127.0.0.1:8000 運行。

3. 測試裡 integration 被 skip
- 代表 API 未啟動，非失敗。

## 7. Baseline snapshot (Wave planning)

Command:

d:/LINKU/Nodus/.venv/Scripts/python.exe scripts/baseline_report.py

Expected:
- 在 `docs/baselines/` 產生 timestamped JSON/MD
- 同步更新 `latest_baseline.json` 與 `latest_baseline.md`
- 包含：A/B/C 分佈、診斷分佈、EN/ZH/JA i18n coverage

## 8. Wave gate runner (Balanced execution)

Command:

d:/LINKU/Nodus/.venv/Scripts/python.exe scripts/wave_gate_runner.py --run-tests

Expected:
- 終端顯示 `wave_gate_overall: pass`
- 產生 `docs/gates/latest_wave_gate.json`
- 若任何 gate 失敗，腳本以非 0 結束並列出 failing checks

Optional benchmark gate:

d:/LINKU/Nodus/.venv/Scripts/python.exe scripts/wave_gate_runner.py --run-tests --benchmark-current docs/benchmarks/latest.json --benchmark-baseline docs/benchmarks/baseline.json
