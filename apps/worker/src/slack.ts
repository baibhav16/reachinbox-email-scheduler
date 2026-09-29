import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { decryptSecret } from './crypto.js';
export async function notifyRateLimit(prisma: PrismaClient, redis: Redis, tenantId: string, senderId: string, senderEmail: string) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const connection = await prisma.slackConnection.findUnique({ where: { tenantId } });
  if (!connection?.channelId) return;
  const fresh = await redis.set(`slack-notified:${senderId}:${hour}`, '1', 'EX', 7200, 'NX');
  if (!fresh) return;
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST', headers: { authorization: `Bearer ${decryptSecret(connection.accessToken)}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel: connection.channelId, text: `Hourly email limit reached for ${senderEmail}. Remaining scheduled messages will resume in the next available hour.` })
    });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!result.ok) console.warn('Slack notification failed:', result.error);
    else console.info(JSON.stringify({ event: 'SLACK_NOTIFICATION_SENT', tenantId, senderId }));
  } catch (error) { console.warn('Slack notification unavailable:', error instanceof Error ? error.message : error); }
}
