# Project status

Updated: 2026-09-29

## Done in source

- Monorepo structure for API, worker, React web app, shared package boundary, Prisma, docs, and Compose infrastructure.
- Prisma entities, PostgreSQL migration, tenant relationships, sender/campaign/email state, and unique idempotency keys.
- OAuth code flows for Google and Slack; token/session configuration is environment-based.
- API routes for auth, campaign scheduling, email lists, SMTP senders, search, Slack, and Bull Board.
- BullMQ delayed jobs, database-to-queue startup reconciliation, worker concurrency, retries, graceful shutdown, Redis rate reservations, and minimum sender spacing.
- Ethereal test-account provisioning, encrypted stored SMTP/Slack secrets, Elasticsearch mapping/index/search, and responsive dashboard UI.
- Clickable sent/scheduled message details; Ethereal preview URLs are stored with sent email records.
- README, API and rate-limit docs, demo guide, and parser unit test.

## Verified (PASS)

- Read the complete 11-page assignment PDF and viewed all seven supplied screenshots.
- Node v22.14.0, npm 10.9.2, Python 3.11.5, and Git 2.43.0 detected.
- `npm install` completed; `npm audit` reports zero vulnerabilities.
- Prisma Client generation and schema validation passed.
- The initial PostgreSQL migration deployed successfully to an isolated PostgreSQL 17 cluster, and `prisma migrate status` reports the schema up to date. A create/delete Prisma smoke check passed.
- `npm run typecheck`, `npm run lint`, `npm test` (2 parser tests), and `npm run build` passed.
- Docker CLI and Compose v5 were installed. `docker compose config -q` validates the Compose file without connecting to a daemon.
- After WSL 2 installation and restart, Docker Desktop started successfully and `docker info` reports a live Linux engine.
- `docker compose up -d` started PostgreSQL, Redis, and Elasticsearch; all three containers report healthy. PostgreSQL and Redis readiness checks passed, and Elasticsearch returned a green single-node cluster health status.
- The Prisma migration deployed successfully against the Compose PostgreSQL database on port 5433.
- A local `.env` was created with distinct random JWT, encryption, and Bull Board secrets; Git ignores it.
- API, worker, and web development servers started; API `/health` returns `ok`.
- The API and worker now locate the project-root `.env` when launched by the npm workspace scripts.
- After the environment-loading fix, `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Google OAuth credentials are now loaded by the restarted API. API health returns `ok`; auth status reports Google configured, and the OAuth start route redirects to Google with the configured client ID and expected callback URI.
- Slack credentials are now loaded. The authenticated connect route redirects to Slack with the configured client ID, callback URI, and required `chat:write` and `incoming-webhook` scopes.
- A successful Google login created a user, tenant, and Ethereal test sender in PostgreSQL.
- An authenticated API schedule request queued one synthetic test message; the worker sent it on the first attempt, PostgreSQL recorded `SENT`, and Elasticsearch indexed the sent document.
- The worker emitted an Ethereal preview URL for the test message; the preview page returned HTTP 200.
- The preview URL migration deployed; existing Ethereal message previews were backfilled. The authenticated sent-list API returns them for the UI detail view.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass after adding the message detail view.
- `npm audit --audit-level=low` reports zero vulnerabilities.
- The login screen was rendered in Edge at the supplied reference viewport and visually checked against the login screenshot.

## Blocked external runtime verification

- Throughput/rate-limit behavior, restart reconciliation, and live search queries have not yet been exercised end to end against the running services.
- The pre-existing PostgreSQL service requires a password unavailable to this task; migration verification used a separate temporary local cluster instead.
- The authenticated browser compose flow has not been visually exercised; scheduling and delivery were verified through the authenticated API.
- Live Slack notifications still need you to approve the app in your workspace and select the destination channel.
- The authenticated dashboard and email compose flow have not yet been visually checked in a browser. The login view was checked visually.

No implementation work remains in progress; only external service and credential-dependent verification is blocked.

## Remaining setup

Complete Slack authorization from the app’s **Connect Slack** button and select a channel. The remaining runtime checks are rate-cap behavior, queue recovery after restart, and visual verification of the authenticated compose flow.
