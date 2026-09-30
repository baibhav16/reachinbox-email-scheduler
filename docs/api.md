# API

Health and OAuth entry/callback/status routes are public. App API routes and Bull Board require the HTTP-only `session` cookie created by Google sign-in.

| Method | Route | Description |
|---|---|---|
| GET | `/health` | API liveness |
| GET | `/api/auth/google` | Begin Google OAuth |
| GET | `/api/auth/google/callback` | Exchange code and create session |
| GET | `/api/auth/me` | Current user and workspace |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/emails?status=SCHEDULED` | Tenant's email rows |
| GET | `/api/emails/:id/attachments` | Tenant-scoped image attachment data for one email |
| POST | `/api/emails/parse` | Extract unique addresses from `{ "text": "..." }` |
| POST | `/api/emails/schedule` | Create campaign and delayed email jobs |
| GET/POST/PATCH | `/api/senders` | List, add, and activate/deactivate senders |
| GET | `/api/search?q=...` | Tenant-filtered Elasticsearch query |
| GET | `/api/slack/status` | OAuth readiness and connected workspace |
| GET | `/api/slack/connect` | Begin Slack OAuth |
| DELETE | `/api/slack` | Disconnect current workspace |
| GET | `/admin/queues` | Bull Board protected by the signed Google session |

Schedule JSON example:

```json
{
  "recipients": ["person@example.net"],
  "subject": "A short update",
  "body": "Hello",
  "htmlBody": "<p>Hello</p>",
  "attachments": [],
  "startTime": "2026-10-01T13:00:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 50,
  "senderId": "sender_id"
}
```
