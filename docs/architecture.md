# Architecture notes

The API owns user-facing validation and writes tenant-scoped data to PostgreSQL. Each campaign key is a SHA-256 digest of tenant, sender, normalized recipient list, message, and requested schedule. Repeated API requests for the same campaign return the original rows through a database upsert. Each scheduled email gets a stable queue ID and a unique recipient key.

The API writes durable rows before creating queue jobs. Both API and worker startup reconcile the database's `SCHEDULED` rows to BullMQ using the email row ID as `jobId`; enqueue retries cannot create a second job with that ID. Redis AOF in Compose persists BullMQ's delayed set and worker state. The database remains the recovery source if queue insertion did not happen.

The worker loads the row and sender, acquires an expiring per-email Redis lock, reserves a sender timestamp/hour through one Redis Lua script, and sends with that sender's SMTP configuration. The reservation key makes the initial schedule claim idempotent. SMTP failure frees the per-email reservation key to allow the retry to book a later minimum-delay slot while retaining the hourly count for safety.

Elasticsearch is a query/index projection, not the source of truth. API startup creates the index when possible. Campaign scheduling and successful delivery refresh the projection. Index failures are logged and do not fail SMTP delivery. Search itself returns an error when Elasticsearch is down; it never switches to SQL search.

Google and Slack callbacks use signed, short-lived state plus same-site HTTP-only state cookies. The application cookie is HTTP-only, signed, and expires after seven days. SMTP passwords and Slack tokens are AES-256-GCM encrypted in the database using `SMTP_ENCRYPTION_KEY` (or, for local setup only, the JWT secret fallback).

## Delivery guarantee boundary

Database and queue idempotency prevent duplicate work from ordinary API retries, duplicate queue insertion, and completed-message retries. SMTP has no cross-system transaction shared with PostgreSQL. A process can lose its database update after the SMTP server accepts a message, so mathematical exactly-once delivery cannot be guaranteed for arbitrary SMTP servers. The implementation uses a stable `Message-ID`, status checks, and a Redis claim lock to narrow that window and documents the remaining ambiguity.
