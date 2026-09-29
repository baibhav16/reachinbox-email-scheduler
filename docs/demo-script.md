# Five-minute demo script

1. Start Compose, API, worker, and web. Show `/health` and Bull Board (0:00–0:30).
2. Sign in through the configured Google OAuth flow; point out the real account name, email, and avatar (0:30–1:00).
3. Show the sender list and connected Slack status. Upload a short recipient CSV, check the detected count, set subject/body/start/delay/hourly cap, and schedule (1:00–2:00).
4. Show the PostgreSQL campaign/email records and Bull Board delayed jobs. Show scheduled rows in the dashboard (2:00–2:45).
5. Let a near-term email run, open its Ethereal preview URL, then show the `SENT` record and an Elasticsearch search result (2:45–3:30).
6. Set a low per-campaign hourly cap for a small batch, show a job delayed to the next UTC hour and a Slack channel notice (3:30–4:15).
7. Stop API and worker while a future job remains, restart both, show the same job ID remains and the message sends once (4:15–5:00).

Use disposable test recipients and keep the demo within Ethereal's preview mailbox. Do not present any step as passed until it has been shown live.
