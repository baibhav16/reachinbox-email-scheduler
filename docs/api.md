# API

All app routes except OAuth entry/callback, `GET /api/auth/status`, health, and Bull Board require the HTTP-only `session` cookie.

| Method | Route | Description |
|---|---|---|
| GET | `/health` | API liveness |
| GET | `/api/auth/google` | Begin Google OAuth |
| GET | `/api/auth/google/callback` | Exchange code and create session |
| GET | `/api/auth/me` | Current user and workspace |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/emails?status=SCHEDULED` | Tenant's email rows |
| POST | `/api/emails/parse` | Extract unique addresses from `{ "text": "..." }` |
| POST | `/api/emails/schedule` | Create campaign and delayed email jobs |
| GET/POST/PATCH | `/api/senders` | List, add, and activate/deactivate senders |
| GET | `/api/search?q=...` | Tenant-filtered Elasticsearch query |
| GET | `/api/slack/status` | OAuth readiness and connected workspace |
| GET | `/api/slack/connect` | Begin Slack OAuth |
| DELETE | `/api/slack` | Disconnect current workspace |
| GET | `/admin/queues` | Basic Auth protected Bull Board |

Schedule JSON example:

```json
{
  "recipients": ["person@example.net"],
  "subject": "A short update",
  "body": "Hello",
  "startTime": "2026-10-01T13:00:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 50,
  "senderId": "sender_id"
}
```
