# Nodus 正式上線手冊（nodus.linku.tech）

更新日期：2026-05-28

## 1. 本次上線採用方案

- 平台：Fly.io
- 部署區域：nrt（Tokyo）
- 應用名稱：nodus-linku
- 正式網域：nodus.linku.tech
- 備用網域：nodus-linku.fly.dev
- DNS 管理：Cloudflare（DNS only）

## 2. 準備條件

1. DNS 設定
- A 記錄：nodus.linku.tech -> 66.241.124.42
- AAAA 記錄：nodus.linku.tech -> 2a09:8280:1::11c:a15:0
- Proxy 狀態：DNS only（灰色雲），不要啟用 Cloudflare Proxy

2. Fly.io 帳號與 CLI
- `fly auth whoami` 可正常回傳登入帳號
- 專案根目錄已有 `fly.toml`

3. 必要 secrets
- `ADMIN_API_KEY`
- 其他非敏感值由 `fly.toml` 管理

## 3. 必填檔案

專案根目錄：
- `fly.toml`

目前線上設定重點：
- `APP_ENV=production`
- `CORS_ORIGINS=https://nodus.linku.tech,https://nodus-linku.fly.dev`
- `ADMIN_API_KEY` 以 Fly secret 管理
- `ADMIN_ENABLE_GENERATION_IN_PRODUCTION=false`

## 4. 伺服器部署指令（在專案根目錄執行）

1. 驗證配置
`fly status --app nodus-linku`

2. 設定或更新 secrets
`fly secrets set ADMIN_API_KEY=<value> --app nodus-linku`

3. 重新部署
`fly deploy --app nodus-linku`

4. 檢查機器與健康狀態
`fly status --app nodus-linku`
`fly checks list --app nodus-linku`

## 5. 驗證清單

1. 健康檢查
- 打開 https://nodus.linku.tech/api/health
- 預期 HTTP 200

2. 指標檢查
- 打開 https://nodus.linku.tech/api/metrics
- 預期可讀取文字指標

3. 前端核心流程
- 首頁可載入
- 圖譜頁可載入
- 搜尋可用
- 語言切換可用

## 6. 常用維運命令

- 重新部署（拉新代碼後）
fly deploy --app nodus-linku

- 查看日誌
fly logs --app nodus-linku
fly status --app nodus-linku
fly checks list --app nodus-linku

- 回滾（使用既有 runbook）
fly releases --app nodus-linku
fly deploy --app nodus-linku --image registry.fly.io/nodus-linku:<previous-tag>

## 7. 故障排查

1. 網域無法簽發憑證
- 先確認 DNS 已生效
- 確認 Cloudflare 為 DNS only，而不是 Proxy
- 執行 `fly certs check nodus.linku.tech`

2. 啟動即失敗
- 檢查 Fly secret 是否缺少 `ADMIN_API_KEY`
- 檢查 CORS_ORIGINS 不是單一 *
- 執行 `fly logs --app nodus-linku`

3. /api/health 正常但功能異常
- 先看 Fly logs
- 再跑 smoke:notify 檢查整體狀態
