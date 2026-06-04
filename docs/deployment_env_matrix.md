# Nodus Deployment Environment Matrix

更新日期：2026-05-24

## 1. 環境分層

- development：本機開發，允許較寬鬆設定。
- staging：預上線驗證，設定應接近 production。
- production：正式環境，啟用 fail-fast 安全檢查。

使用環境變數 APP_ENV 切換，建議值：development / staging / production。

## 2. 變數矩陣

| Variable | Development | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| APP_ENV | development | staging | production | 影響啟動安全檢查 |
| HOST | 127.0.0.1 或 0.0.0.0 | 0.0.0.0 | 0.0.0.0 | API 綁定位址 |
| PORT | 8000 | 8000 | 8000 | API 埠 |
| DEBUG | true/false | false | false | production 禁用 |
| CORS_ORIGINS | 可用 *（僅本機） | 明確網域清單 | 明確網域清單 | production 不可為 * |
| ADMIN_API_KEY | 可空（僅本機） | 必填 | 必填 | staging/production 必填 |
| ADMIN_ALLOWED_IPS | 可空 | 建議設定 | 建議設定 | `/api/admin/*` 來源 IP/CIDR 白名單 |
| ADMIN_TRUST_FORWARDED_FOR | false | 視代理配置 | 視代理配置 | 僅在受信任反向代理下啟用 |
| ADMIN_TRUSTED_PROXIES | 可空 | 建議設定 | 建議設定 | 允許注入 `X-Forwarded-For` 的代理 IP/CIDR |
| ADMIN_ENABLE_GENERATION_IN_PRODUCTION | true | false（建議） | false（預設） | 避免上線後誤觸發付費生成 |
| NEO4J_URI | 必填 | 必填 | 必填 | 資料庫連線 |
| NEO4J_USER | 必填 | 必填 | 必填 | 資料庫帳號 |
| NEO4J_PASSWORD | 建議填 | 必填 | 必填 | secrets manager 管理 |
| ADMIN_TRIGGER_WINDOW_SECONDS | 調整 | 調整 | 調整 | 管理端限流窗口 |
| ADMIN_TRIGGER_MAX_REQUESTS | 調整 | 調整 | 調整 | 管理端限流上限 |
| ADMIN_ALERT_PER_MINUTE | 調整 | 調整 | 調整 | 告警閾值 |
| ADMIN_ALERT_PER_DAY | 調整 | 調整 | 調整 | 告警閾值 |

## 3. Production fail-fast 規則

當 APP_ENV=staging/production 時，啟動前強制檢查：
- ADMIN_API_KEY 不能為空字串。
- CORS_ORIGINS 不能解析為單一 *。

執行期防護建議：
- ADMIN_ALLOWED_IPS 限制管理端來源。
- ADMIN_ENABLE_GENERATION_IN_PRODUCTION 預設維持 false，僅在必要維運時暫時開啟。

任一條件不符合，服務應在啟動階段直接拒絕啟動。

## 4. Secrets 管理建議

- 不要把 .env 提交到版本控制。
- ADMIN_API_KEY、NEO4J_PASSWORD 優先存放在部署平台 secret store。
- 所有輪替操作要有紀錄（時間、操作者、變更理由）。

## 5. 部署前檢查清單

- APP_ENV 已設為 production。
- CORS_ORIGINS 已填寫前端正式網域。
- ADMIN_API_KEY 已設定且完成輪替紀錄。
- NEO4J 憑證已驗證可連線。
- CI 最新主分支為綠燈。
