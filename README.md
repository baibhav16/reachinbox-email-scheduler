# ReachInbox Email Job Scheduler

A full stack scheduled email application built around persistent BullMQ delayed jobs. PostgreSQL is the durable application record, Redis stores queue state and atomic sender limits, and a separate worker sends through SMTP. The web app follows the supplied ReachInbox mail dashboard references.

## Features

- Google OAuth login with signed, HTTP-only session cookies.
- Campaign scheduling with recipient paste or CSV/text upload, start time, per-campaign spacing, and hourly cap.
- Rich-text message content and image attachments (JPEG, PNG, GIF, and WebP) with downloadable previews in the sent-message view.
- Tenant-scoped SMTP senders. SMTP passwords and Slack bot tokens are encrypted at rest with AES-256-GCM.
- PostgreSQL campaign and message records with deterministic idempotency keys.
- BullMQ delayed jobs, separate configurable worker concurrency, restart reconciliation, retries, and graceful shutdown.
- Redis atomic sender rate reservations and minimum inter-send spacing across concurrent workers.
- Elasticsearch-backed email search; the API does not silently substitute SQL search when Elasticsearch is unavailable.
- Slack OAuth connection and live rate-limit messages when a channel is available.
- Authenticated Bull Board at `/admin/queues`.
- Scheduled and sent/failed lists, loading and empty states, sender setup, and responsive compose UI.

## Architecture

```text
Browser (React / Vite)
   | Google session cookie + JSON API
   v
Express API ---- PostgreSQL (users, tenants, senders, campaigns, emails)
   |                         |
   | enqueue stable job IDs  | startup reconciliation
   v                         v
BullMQ delayed queue <------ Redis (AOF queue + atomic hourly/delay reservations)
   |
   v
Worker -- SMTP sender --> Ethereal (preview URL)
   |                 \--> Slack chat.postMessage on rate cap
   +----> Elasticsearch index/search
```

PostgreSQL is the source of truth for campaign and email records. Queue IDs equal the durable email IDs. The API and worker reconcile pending database records into BullMQ on startup, so a process stopping between a database commit and queue insertion does not silently lose that scheduled message. Redis persistence is enabled in Compose with append-only mode.

## Tech stack

Node.js 22, TypeScript 5, Express 4, Prisma 6, PostgreSQL 16, BullMQ 5, Redis 7 / ioredis, Nodemailer, Elasticsearch 8, React 19, Vite 6, React Query, and custom responsive CSS.

## Project structure

```text
apps/api/       Express OAuth, REST API, Bull Board, Elasticsearch client
apps/worker/    BullMQ consumer, SMTP delivery, Redis rate reservation
apps/web/       React dashboard and compose UI
packages/shared Shared package boundary for future DTO reuse
prisma/         PostgreSQL schema and initial SQL migration
infrastructure/ Compose and Elasticsearch mapping support
docs/           Architecture, API, rate limit, demo notes
reference/      Supplied assignment PDF and UI screenshots
```

## Prerequisites

- Node.js 22+ and npm 10+.
- Docker Desktop or Docker Engine with Compose for local PostgreSQL, Redis, and Elasticsearch.
- Google OAuth web application credentials for the real login flow.
- Slack app OAuth credentials to connect a workspace and receive live cap notifications.
- Internet access to create an Ethereal test account automatically, or Ethereal SMTP credentials.

## Installation

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d
npx prisma generate
npx prisma migrate dev
```

Edit `.env` before logging in. Replace the Google and Slack OAuth placeholders with your own credentials and callback URLs. If Ethereal credentials are omitted, the first Google-authenticated user provisions a real Ethereal test account through Nodemailer; if account creation cannot reach Ethereal, add a sender from the UI.

## Deployment (Vercel + Render)

The repository includes a free-tier Render Blueprint in [`render.yaml`](render.yaml) for the API, PostgreSQL, and Redis, plus [`vercel.ts`](vercel.ts) for the Vite web app and same-origin forwarding to the API. The free Blueprint omits the background worker, so it does not send queued emails. Deploy Vercel first to get its URL, then Render, then redeploy Vercel with the Render URL:

1. Import the repository in Vercel with the repository root as the project root and deploy once without `RENDER_API_ORIGIN`. Copy the assigned Vercel URL.
2. In Render, create a new Blueprint from this GitHub repository. The API, database, and Redis use free demo plans. The Blueprint generates separate `JWT_SECRET` and `SMTP_ENCRYPTION_KEY` values and runs Prisma migrations when the API starts. When prompted, set `WEB_ORIGIN` to the Vercel origin, set Google client ID and secret, and set `GOOGLE_CALLBACK_URL` to `https://your-project.vercel.app/api/auth/google/callback`.
3. In Vercel project settings, set `RENDER_API_ORIGIN` to the Render API origin, such as `https://reachinbox-api.onrender.com`, then redeploy. The Vercel rewrite keeps API, OAuth callback, session cookies, and Bull Board on the web origin.
4. In Google Cloud Console, add the Vercel callback URL above to the OAuth client's authorized redirect URIs. If Slack is enabled, set the API's `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_CALLBACK_URL` to `https://your-project.vercel.app/api/slack/callback`, then add that callback in Slack's app settings.
5. `ELASTICSEARCH_URL` defaults to localhost in the Blueprint. Set it on both Render API and worker to a reachable Elasticsearch deployment to enable search and email indexing; those features remain unavailable until then.

The Blueprint's free Render API, PostgreSQL, and Key Value services are for a short demo: the API can sleep, free PostgreSQL expires after 30 days, free Key Value has no persistence, and there is no background worker to process queued emails. Render does not provision Elasticsearch in this Blueprint; connect a hosted Elasticsearch endpoint or leave search unavailable. Do not copy local `.env` values into source control; enter secrets in the provider dashboards.

For local development, Vite now forwards `/api` and `/admin` requests to `http://localhost:4000`; no `VITE_API_URL` setting is needed.

## Environment variables

See [.env.example](.env.example). The important settings are `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`, `JWT_SECRET`, `SMTP_ENCRYPTION_KEY`, Google and Slack OAuth values, `WORKER_CONCURRENCY`, `MAX_EMAILS_PER_HOUR_PER_SENDER`, and `MIN_EMAIL_DELAY_MS`. Use independent randomly generated secrets for the JWT and encryption key outside local development.

## Database, Redis, and Elasticsearch

Compose starts PostgreSQL with a named volume, Redis 7 with append-only persistence, and single-node Elasticsearch 8 without security for local development. Do not expose this local Elasticsearch configuration to an untrusted network. Prisma migrations live under `prisma/migrations`. Elasticsearch creates its index and mappings on API startup; a temporary Elasticsearch outage is logged and does not prevent API startup or email delivery.

## Ethereal SMTP

No Gmail SMTP is used. A workspace receives an automatically provisioned Ethereal sender when the OAuth callback can reach Ethereal. Alternatively configure `ETHEREAL_USER` and `ETHEREAL_PASSWORD`, or add another SMTP sender in the UI. Successful sends log the Ethereal preview link; delivery is a test mailbox preview, not real recipient delivery.

## Google OAuth setup

Create a Google OAuth web application and set:

- Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
- Authorized JavaScript origin: `http://localhost:5173`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

The implementation uses Google's OAuth authorization code flow and UserInfo endpoint. There is no local or mock login path.

## Slack OAuth setup

Create a Slack app, add the redirect URI `http://localhost:4000/api/slack/callback`, and configure `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and the matching callback in `.env`. The app requests `chat:write` and `incoming-webhook`; grant a channel during installation so Slack returns the destination channel. The token is encrypted before it is stored. Disconnecting removes the tenant connection; a later OAuth reconnect takes effect without restarting the worker.

## Running the application

Use three terminals from the repository root:

```powershell
npm run dev:api
npm run dev:worker
npm run dev:web
```

The web UI is at `http://localhost:5173`, API health at `http://localhost:4000/health`, and Bull Board at `http://localhost:4000/admin/queues`. Bull Board uses the same signed Google session as the web app; open it in a browser where you are signed in (the session lasts seven days).

## Scheduling flow

The API validates and deduplicates recipients, creates one campaign and one scheduled-email row per recipient in a PostgreSQL transaction, then inserts BullMQ delayed jobs using each row's stable ID. Initial timestamps are `startTime + recipientIndex * delayMs`. The worker rechecks sender and campaign limits, reserves the global sender spacing and hourly slot atomically in Redis, then sends via the selected sender's SMTP settings. Rate-capped jobs move to the next available hour using BullMQ delayed state; no cron service or periodic polling scheduler is used.

## Restart persistence and idempotency

BullMQ stores delayed state in Redis and Compose enables Redis AOF. API and worker startup scan scheduled database rows and re-add deterministic job IDs, covering a process failure between database commit and Redis enqueue. A unique campaign idempotency key derives from its tenant, sender, recipients, content, and schedule; each email row also has a unique idempotency key. The worker claims a per-email Redis lock and checks the durable status before sending. SMTP itself does not offer a universal exactly-once transaction: a process crash after SMTP accepts a message but before PostgreSQL records `SENT` leaves an unavoidable delivery ambiguity. A stable `Message-ID` and claim reduce duplicates, but cannot prove exactly-once behavior for every SMTP server.

## Rate limiting, concurrency, and minimum delay

`WORKER_CONCURRENCY` controls BullMQ concurrency. Redis Lua serializes sender slot reservations across all worker processes. It increments an hourly sender bucket only when a slot is available, and reserves the next timestamp after the sender's previous slot. The effective hourly cap is the minimum of the configured global cap, sender cap, and campaign cap. When full, jobs are retained and moved to the next available hour; a Slack message is sent once per sender/hour where a connected destination exists. The effective spacing is `max(MIN_EMAIL_DELAY_MS, campaign.delayMs)`. SMTP retry attempts release their previous time reservation and reserve a fresh spacing slot.

## Elasticsearch search

`GET /api/search?q=...` queries the tenant-filtered Elasticsearch index over recipient, subject, and body. Optional `status`, `from`, and `to` filters are supported. New scheduled records and sent records are indexed. Search returns an API error when Elasticsearch is unavailable instead of falling back to database substring matching.

## API overview

See [docs/api.md](docs/api.md) for routes and request shape. Main endpoints: `/api/auth/google`, `/api/auth/me`, `/api/auth/logout`, `/api/emails`, `/api/emails/parse`, `/api/emails/schedule`, `/api/senders`, `/api/search`, and `/api/slack`.

## CSV upload

The compose screen accepts `.csv` and `.txt` files and extracts unique email addresses. The browser shows detected recipients before scheduling; the API independently parses and validates addresses. Files are read in the browser and are not persisted or uploaded as attachments.

## Testing and quality checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

The test suite contains focused recipient-parser tests. Typecheck, lint, and production build pass in the current workspace. Runtime verification has confirmed the Compose services, database migrations, Google sign-in, and an Ethereal test send with a working preview link. Throughput/rate-cap behavior, a live Slack rate-limit alert, restart recovery with a pending email, live Elasticsearch queries, and the authenticated compose flow still need end-to-end demonstration; do not claim those checks passed until they are shown.

## Troubleshooting

- **Database connection refused:** ensure `docker compose up -d` is healthy and `DATABASE_URL` matches Compose.
- **Redis unavailable:** check port 6379 and `REDIS_URL`; queued database rows are reconciled when services return.
- **Elasticsearch unavailable:** API continues, but search is not available until Elasticsearch comes up. Restart API to create/check the index.
- **Google sign-in configuration message:** set a valid OAuth client ID/secret and exact callback URL.
- **No sender after sign-in:** Ethereal provisioning needs outbound access. Add a sender using SMTP credentials in the sidebar profile menu.
- **Slack cap notice absent:** ensure Slack was connected with a channel granted and `chat:write` permission.

## Demo instructions

Follow the five-minute run-through in [docs/demo-script.md](docs/demo-script.md). In particular, demonstrate a real Ethereal preview, the Bull Board delayed job, and an API/worker restart. A restart claim should be shown with the database row and queue state, not inferred from the UI.

## Assignment requirement mapping

| Requirement | Implementation | File/location |
|---|---|---|
| TypeScript Express API | REST routes and middleware | `apps/api/src` |
| PostgreSQL persistence | Prisma schema and SQL migration | `prisma/schema.prisma`, `prisma/migrations` |
| BullMQ + Redis delayed scheduling | Stable IDs, delayed jobs, startup reconciliation | `apps/api/src/routes/email.routes.ts`, `apps/worker/src/index.ts` |
| No cron | No cron package or periodic scheduler | API and worker startup paths |
| Ethereal SMTP | Nodemailer account provisioning and per-sender transport | `apps/api/src/routes/auth.routes.ts`, `apps/worker/src/processor.ts` |
| Sender concurrency, spacing, hourly caps | Redis atomic reservation Lua | `apps/worker/src/rate-limit.ts` |
| Idempotency | Campaign key, unique email key, status checks, lock | `prisma/schema.prisma`, `apps/worker/src/processor.ts` |
| Elasticsearch search | Tenant-filtered search API and index mappings | `apps/api/src/config/elasticsearch.ts`, `apps/api/src/routes/search.routes.ts` |
| Live queue dashboard | Bull Board with the signed Google session | `/admin/queues`, `apps/api/src/app.ts` |
| Google OAuth and logout | Authorization code flow, secure cookie | `apps/api/src/routes/auth.routes.ts` |
| Slack OAuth notification | Workspace install, encrypted token, cap alert | `apps/api/src/routes/slack.routes.ts`, `apps/worker/src/slack.ts` |
| Compose, recipient import, scheduled/sent lists | React dashboard and form | `apps/web/src/App.tsx` |
| UI reference matching | White mail layout, rail, rows, green states, compose | `apps/web/src/index.css` |

## Submission note

The private repository is [github.com/baibhav16/reachinbox-email-scheduler](https://github.com/baibhav16/reachinbox-email-scheduler). Before handing it in, grant repository access to **Mitrajit** and **Yadav036** as required by the assignment, and include a demo video no longer than five minutes. A suggested run-through is in [docs/demo-script.md](docs/demo-script.md).
