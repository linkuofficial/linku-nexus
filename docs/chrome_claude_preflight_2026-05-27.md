# Nodus Production Preflight for Chrome Claude (2026-05-27)

## A. Completed Today (Verified)

- Frontend production build: PASS
  - Command: npm run build
  - Output includes dist/index.html, dist/app.html, dist/explorer.html
- Backend unit/integration test suite: PASS
  - Command: .venv/Scripts/python.exe -m pytest tests -q
  - Result: 72 passed
- Smoke notification flow: PASS
  - Command: npm run smoke:notify
  - Health: ok
  - Metrics: ok
  - Admin trigger metric: present
  - Webhook probe: skipped (ALERT_WEBHOOK_URL not set)
- Live app route check (served by backend at port 8000): PASS
  - Home: / loaded
  - Graph page: /app.html loaded
  - Search interaction: query "Black Holes" returned a result

## B. Required Before Public Upload

1. Environment values
- Set APP_ENV=production
- Set CORS_ORIGINS to your real frontend domain (must not be *)
- Set ADMIN_API_KEY (required)
- Set ADMIN_ALLOWED_IPS (recommended strongly)
- If behind reverse proxy, set:
  - ADMIN_TRUST_FORWARDED_FOR=true
  - ADMIN_TRUSTED_PROXIES=<proxy CIDR/IP list>
- Keep ADMIN_ENABLE_GENERATION_IN_PRODUCTION=false unless intentionally needed

2. Data and dependency readiness
- Ensure NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD are valid for production
- Confirm data/i18n files are present in deployment artifact

3. Runtime observability
- Configure ALERT_WEBHOOK_URL for Slack/Teams/email-compatible endpoint
- Verify /api/metrics is reachable from monitoring side

4. Release safety
- Confirm previous stable image/tag exists for rollback
- Confirm rollback command is executable in target environment

## C. Deploy Commands (Reference)

1. Build image
- docker build -t nodus:<release-tag> .

2. Run container
- docker run --name nodus -p 8000:8000 --env-file .env -d nodus:<release-tag>

3. Health checks
- GET /api/health returns 200
- GET /api/metrics returns metrics text

## D. Chrome Claude Test Readiness Gate

Mark as READY only when all checks pass:

- [ ] Production URL is publicly reachable over HTTPS
- [ ] Home page and /app.html load without 5xx
- [ ] Search works for at least 3 terms
- [ ] Language switch EN/ZH/JA updates labels and descriptions
- [ ] Learning Path mode can be toggled and used
- [ ] /api/health is stable for 10+ minutes
- [ ] No sustained 5xx spike in logs/metrics

## E. Known Non-Blocking Warning

- Tailwind CDN warning appears in browser console. It is not a release blocker for functional testing, but should be replaced with a build-time Tailwind setup before long-term production hardening.
