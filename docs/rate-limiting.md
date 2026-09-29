# Rate limiting and spacing

Every send worker calls a Redis Lua reservation script with the email ID, sender ID, effective limit, and effective spacing. The script is atomic across worker processes: it reads the sender's last reserved timestamp, chooses `max(now, last + delay)`, increments a UTC hour counter only when that hour has capacity, and stores an email reservation so BullMQ retries/reschedules cannot claim the same slot twice.

The effective cap is `min(MAX_EMAILS_PER_HOUR_PER_SENDER, Sender.hourlyLimit when set, Campaign.hourlyLimit when set)`. A full hour bucket is not consumed; the script checks later hour buckets and reserves the first available slot. The processor moves the current BullMQ job to that time instead of failing it. It emits one Slack notification per sender/hour if Slack is connected and the OAuth installation has a channel.

Spacing is `max(MIN_EMAIL_DELAY_MS, campaign.delayMs)`. The shared sender timestamp is advanced inside the same Lua script that reserves the hourly slot. A transient SMTP failure releases only the email reservation marker, not its already counted cap slot, then the retry reserves a new timestamp. This conservative behavior may use quota for failed SMTP attempts, but cannot exceed the configured cap.
