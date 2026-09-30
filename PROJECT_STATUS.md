# Project status

Updated: 2026-09-30

## Implemented

- TypeScript Express API, React/TypeScript web app, shared package, Prisma, Docker Compose, and project documentation.
- Google OAuth login/logout with an HTTP-only signed session cookie that lasts seven days. The profile image falls back to user initials if the remote image cannot load.
- Tenant-scoped campaigns, SMTP senders, scheduled emails, image attachments, encrypted SMTP/Slack credentials, and PostgreSQL migrations.
- CSV/text recipient parsing and deduplication, rich-text email content, start time, inter-email delay, and hourly cap controls.
- BullMQ delayed jobs on Redis, configurable worker concurrency, retries, shutdown handling, deterministic job IDs, and database-to-queue reconciliation on startup. No cron scheduler is used.
- Atomic Redis per-sender spacing and hourly reservations. Capped jobs are moved to the next available hour instead of dropped.
- Ethereal test SMTP sending with stored preview links. Ethereal previews are not delivered to real Gmail inboxes.
- Elasticsearch indexing/search for scheduled and sent email data.
- Slack OAuth with encrypted stored token and rate-cap notification code using `chat.postMessage`.
- Bull Board at `/admin/queues`, protected by the same Google session as the app rather than a separate HTTP Basic Auth prompt.
- Scheduled/sent views, message details, image attachment download links, loading/empty/error states, and responsive compose UI.

## Verified

- Node.js, npm, TypeScript checks, lint, and production build completed successfully for the current workspace.
- The two recipient-parser unit tests passed in the previous verification run.
- Docker Compose PostgreSQL, Redis, and Elasticsearch are running healthy; Prisma reports all three migrations applied and the schema up to date.
- API health and web app return HTTP 200. The worker starts ready and reconciles pending emails.
- Google OAuth was configured and a successful sign-in created a user, tenant, and Ethereal sender.
- An authenticated API schedule flow produced a sent Ethereal test message; its preview page returned HTTP 200 and the message was indexed.
- The login screen was visually checked at the assignment reference viewport. A sent-list screenshot was also reviewed during the UI work.
- `/admin/queues` no longer returns a browser Basic Auth challenge; it requires the signed app session.
- A private repository exists at https://github.com/baibhav16/reachinbox-email-scheduler.

## Still needs end-to-end verification

- Sustained 1,000+ job load, cap behavior across worker instances, and ordering while jobs are rescheduled.
- A live rate-limit event that is visibly delivered to the connected Slack channel.
- Restart the API/worker with a future email pending and verify the same job is recovered and sent once.
- A live Elasticsearch search query and end-to-end image-attachment send/preview.
- Browser review of the authenticated compose and message-detail flows across desktop and mobile.
- Exactly-once SMTP delivery cannot be guaranteed across a crash after SMTP accepts a message but before PostgreSQL records `SENT`; the idempotency checks and Redis lock reduce that risk, and the boundary is documented in `docs/architecture.md`.

## Assignment handoff remaining

- Grant private-repository access to **Mitrajit** and **Yadav036** as requested in the assignment. The repository currently has no pending collaborator invitations.
- Record and submit a demo video of no more than five minutes. The run-through is in `docs/demo-script.md`.
- Do not describe the rate-limit/Slack notification, restart, search, or attachment flows as live-verified until they have been demonstrated.

\n