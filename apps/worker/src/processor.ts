import nodemailer, { createTransport } from 'nodemailer';
import { DelayedError, type Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Client } from '@elastic/elasticsearch';
import { config } from './config.js';
import type { EmailJobData } from '@reachinbox/shared';
import { decryptSecret } from './crypto.js';
import { reserveSenderSlot } from './rate-limit.js';
import { notifyRateLimit } from './slack.js';

const releaseScript = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
const prisma = new PrismaClient();
const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const elastic = new Client({ node: config.elasticUrl });

export async function processEmail(job: Job<EmailJobData>, token?: string) {
  const email = await prisma.scheduledEmail.findUnique({ where: { id: job.data.emailId }, include: { sender: true, campaign: true } });
  if (!email || email.status === 'SENT' || email.status === 'FAILED') return;
  const lockToken = `${job.id}:${Date.now()}:${Math.random()}`;
  const locked = await redis.set(`email-lock:${email.id}`, lockToken, 'EX', 300, 'NX');
  if (!locked) return;
  try {
    if (!email.sender.isActive) throw new Error('Sender is inactive.');
    await prisma.scheduledEmail.updateMany({ where: { id: email.id, status: { in: ['SCHEDULED','PROCESSING'] } }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });
    const limits = [config.globalHourlyLimit, email.sender.hourlyLimit ?? Infinity, email.campaign.hourlyLimit ?? Infinity];
    const limit = Math.min(...limits);
    const delay = Math.max(config.minimumDelayMs, email.campaign.delayMs);
    const reservation = await reserveSenderSlot(redis, email.id, email.senderId, limit, delay);
    if (reservation.code === 3) throw new Error('Unable to reserve an email rate-limit slot.');
    if ((reservation.code === 2 || reservation.code === 4) && reservation.at > Date.now()) {
      if (reservation.code === 4) await notifyRateLimit(prisma, redis, email.tenantId, email.senderId, email.sender.email);
      await prisma.scheduledEmail.update({ where: { id: email.id }, data: { status: 'SCHEDULED' } });
      if (!token) throw new Error('BullMQ job token unavailable for safe rescheduling.');
      await job.moveToDelayed(reservation.at, token);
      throw new DelayedError();
    }
    const transporter = createTransport({ host: email.sender.smtpHost, port: email.sender.smtpPort, secure: email.sender.smtpPort === 465, auth: { user: email.sender.smtpUser, pass: decryptSecret(email.sender.smtpPassword) } });
    const info = await transporter.sendMail({
      from: { name: email.sender.name, address: email.sender.email }, to: email.recipient, subject: email.subject, text: email.body,
      messageId: `<${email.id}@reachinbox.local>`
    });
    const sentAt = new Date();
    await prisma.scheduledEmail.update({ where: { id: email.id }, data: { status: 'SENT', sentAt, failureReason: null } });
    console.info(JSON.stringify({ event: 'EMAIL_SENT', jobId: job.id, emailId: email.id, campaignId: email.campaignId, senderId: email.senderId, recipient: email.recipient }));
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.info(`Ethereal preview: ${preview}`);
    await elastic.index({ index: config.elasticIndex, id: email.id, document: { id: email.id, tenantId: email.tenantId, recipient: email.recipient, subject: email.subject, body: email.body, status: 'SENT', scheduledAt: email.scheduledAt.toISOString(), sentAt: sentAt.toISOString(), senderId: email.senderId, campaignId: email.campaignId } }).catch(error => console.warn('Elasticsearch indexing deferred:', error instanceof Error ? error.message : error));
    await prisma.emailCampaign.updateMany({ where: { id: email.campaignId, emails: { none: { status: { in: ['SCHEDULED','PROCESSING'] } } } }, data: { status: 'COMPLETED' } });
  } catch (error) {
    if (error instanceof DelayedError) throw error;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade + 1 >= maxAttempts) {
      await prisma.scheduledEmail.update({ where: { id: email.id }, data: { status: 'FAILED', failedAt: new Date(), failureReason: error instanceof Error ? error.message.slice(0, 1000) : 'SMTP send failed.' } });
      await prisma.emailCampaign.updateMany({ where: { id: email.campaignId, emails: { none: { status: { in: ['SCHEDULED','PROCESSING'] } } } }, data: { status: 'COMPLETED' } });
    }
    else {
      await redis.del(`email-reservation:${email.id}`);
      await prisma.scheduledEmail.update({ where: { id: email.id }, data: { status: 'SCHEDULED', failureReason: error instanceof Error ? error.message.slice(0, 1000) : 'SMTP send failed; retrying.' } });
    }
    console.error(JSON.stringify({ event: 'EMAIL_FAILED', jobId: job.id, emailId: email.id, campaignId: email.campaignId, senderId: email.senderId, attempt: job.attemptsMade + 1, error: error instanceof Error ? error.message : String(error) }));
    throw error;
  } finally {
    await redis.eval(releaseScript, 1, `email-lock:${email.id}`, lockToken);
  }
}

export async function closeProcessorResources() {
  await Promise.allSettled([prisma.$disconnect(), redis.quit(), elastic.close()]);
}
