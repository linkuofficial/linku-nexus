# Nodus Current Status Candidate (2026-05-25)

> 這是「目前狀態候補檔」，用於在正式更新 `current_status_*.md` 前先追蹤當前真實狀態與待確認事項。

## 1. 今日快照（可執行狀態）

- Backend + Frontend 可本機啟動（依 README 流程）。
- Frontend production build 成功。
- 測試整體健康：pytest 全套通過（含 1 skip）。
- VS Code 問題面板目前無錯誤。

## 2. 今日驗證結果（2026-05-25）

### 2.1 Python tests

指令：

```bash
python -m pytest tests -q
```

結果：

- `58 passed, 1 skipped in 10.88s`

### 2.2 Frontend build

指令：

```bash
npm run build
```

結果：

- Vite `8.0.14` build success
- 產出：
  - `dist/app.html`
  - `dist/index.html`
  - `dist/explorer.html`

## 3. 與前版狀態檔差異（相對 2026-05-24）

- 前版檔案：`docs/current_status_2026-05-24.md`
- 差異重點：
  1. pytest 通過數已由舊值（文件記錄 32）提升為目前實測 58。
  2. 前端 build 依舊穩定可通過，輸出檔一致。
  3. 目前 workspace 仍非 git repository（`.git` 不存在），需注意追溯與發布流程。

## 4. 相關證據檔案

- 專案入口與驗證命令：`README.md`
- 最近 benchmark 摘要：`docs/benchmarks/latest.md`
- 最近 e2e 記錄：`test-results/.last-run.json`
- 現行正式狀態檔：`docs/current_status_2026-05-24.md`

## 5. 待確認 / 待補齊

1. README 的 pytest 預期值仍為舊數字，建議同步更新為最新實測區間。
2. 若要進入正式交付版 status，建議新增：
   - 當日 API 健康檢查結果（`/api/health`）
   - 當日 smoke（`npm run smoke:notify`）
   - 當日 benchmark guard 結果（若有跑）
3. 建議確認版本控管策略（目前無 `.git`）。

## 6. 建議升級為正式版的條件

符合以下條件即可把本候補檔升級為正式 status：

1. 當日 smoke 測試成功。
2. 當日 health endpoint 回應 200。
3. README 測試數據與現況一致。
4. 版本追蹤方式（git 或替代流程）有明確紀錄。
