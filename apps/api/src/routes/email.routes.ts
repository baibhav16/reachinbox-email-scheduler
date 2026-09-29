import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { emailQueue } from '../queues/email.queue.js';
import { elastic, EMAIL_INDEX } from '../config/elasticsearch.js';
import { extractEmails } from '../utils/csv-parser.js';
import { createHash } from 'node:crypto';

export const emailRoutes = Router();
async function enqueueEmails(emails: { id: string; scheduledAt: Date; tenantId: string; [key: string]: unknown }[]) {
  for (let offset = 0; offset < emails.length; offset += 250) {
    const batch = emails.slice(offset, offset + 250);
    await emailQueue.addBulk(batch.map(email => ({ name: 'send-email', data: { emailId: email.id }, opts: { jobId: email.id, delay: Math.max(0, email.scheduledAt.getTime() - Date.now()) } })));
    const operations = batch.flatMap(email => [
      { index: { _index: EMAIL_INDEX, _id: email.id } },
      { ...email, scheduledAt: email.scheduledAt.toISOString(), tenantId: email.tenantId }
    ]);
    await elastic.bulk({ operations }).catch(() => undefined);
  }
}
const scheduleSchema = z.object({
  recipients: z.array(z.string().email()).optional(), recipientText: z.string().optional(), subject: z.string().min(1).max(998),
  body: z.string().min(1).max(100_000), startTime: z.string().datetime(), delayMs: z.coerce.number().int().min(0).max(86_400_000),
  hourlyLimit: z.coerce.number().int().positive().optional(), senderId: z.string().min(1)
});
emailRoutes.get('/', async (_req, res, next) => {
  try {
    const status = typeof _req.query.status === 'string' ? _req.query.status.toUpperCase() : undefined;
    const emails = await prisma.scheduledEmail.findMany({ where: { tenantId: res.locals.tenantId, ...(status && ['SCHEDULED','PROCESSING','SENT','FAILED'].includes(status) ? { status: status as 'SCHEDULED'|'PROCESSING'|'SENT'|'FAILED' } : {}) }, orderBy: [{ scheduledAt: 'desc' }], take: 500 });
    res.json({ emails });
  } catch (error) { next(error); }
});
emailRoutes.post('/parse', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  res.json({ recipients: extractEmails(text) });
});
emailRoutes.post('/schedule', async (req, res, next) => {
  try {
    const input = scheduleSchema.parse(req.body);
    const recipients = [...new Set([...(input.recipients ?? []), ...extractEmails(input.recipientText ?? '')].map(address => address.toLowerCase()))];
    if (!recipients.length) { res.status(400).json({ error: 'Add at least one valid email address.' }); return; }
    if (recipients.length > 5_000) { res.status(400).json({ error: 'A campaign can contain at most 5,000 recipients.' }); return; }
    const sender = await prisma.sender.findFirst({ where: { id: input.senderId, tenantId: res.locals.tenantId, isActive: true } });
    if (!sender) { res.status(400).json({ error: 'Select an active sender in this workspace.' }); return; }
    const startTime = new Date(input.startTime);
    const payloadKey = createHash('sha256').update(JSON.stringify({ tenantId: res.locals.tenantId, senderId: input.senderId, recipients: [...recipients].sort(), subject: input.subject, body: input.body, startTime: startTime.toISOString(), delayMs: input.delayMs, hourlyLimit: input.hourlyLimit ?? null })).digest('hex');
    const campaign = await prisma.emailCampaign.upsert({ where: { idempotencyKey: payloadKey }, update: {}, create: {
      idempotencyKey: payloadKey, tenantId: res.locals.tenantId, subject: input.subject, body: input.body, startTime, delayMs: input.delayMs,
      hourlyLimit: input.hourlyLimit, senderId: sender.id, createdBy: res.locals.userId,
      emails: { create: recipients.map((recipient, index) => ({
        tenantId: res.locals.tenantId, senderId: sender.id, recipient, subject: input.subject, body: input.body,
        scheduledAt: new Date(startTime.getTime() + index * input.delayMs), idempotencyKey: `${payloadKey}:${createHash('sha256').update(recipient).digest('hex')}`
      })) }
    }, include: { emails: true } });
    // Persist first, then enqueue. A startup reconciliation pass recreates any queue entry
    // interrupted between these operations using the stable email ID as BullMQ job ID.
    await enqueueEmails(campaign.emails.filter(email => email.status === 'SCHEDULED'));
    res.status(201).json({ campaignId: campaign.id, count: recipients.length, emails: campaign.emails });
  } catch (error) { next(error); }
});
