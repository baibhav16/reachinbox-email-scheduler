import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { EMAIL_QUEUE, type EmailJobData } from '@reachinbox/shared';
import { config } from './config.js';
import { processEmail, closeProcessorResources } from './processor.js';

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();
const queue = new Queue(EMAIL_QUEUE, { connection });
const worker = new Worker<EmailJobData>(EMAIL_QUEUE, processEmail, { connection, concurrency: config.concurrency, lockDuration: 300_000, stalledInterval: 30_000, maxStalledCount: 2 });
worker.on('ready', () => console.info(JSON.stringify({ event: 'WORKER_READY', concurrency: config.concurrency })));
worker.on('completed', job => console.info(JSON.stringify({ event: 'JOB_COMPLETED', jobId: job.id, emailId: job.data.emailId })));
worker.on('failed', (job, error) => console.error(JSON.stringify({ event: 'JOB_FAILED', jobId: job?.id, emailId: job?.data.emailId, error: error.message })));
worker.on('error', error => console.error('Worker connection error:', error.message));

async function start() {
  await prisma.$connect();
  // PostgreSQL remains authoritative if a process stopped after commit but before queue.add.
  const pending = await prisma.scheduledEmail.findMany({ where: { status: { in: ['SCHEDULED','PROCESSING'] } }, select: { id: true, scheduledAt: true } });
  for (const email of pending) await queue.add('send-email', { emailId: email.id }, { jobId: email.id, delay: Math.max(0, email.scheduledAt.getTime() - Date.now()) });
  console.info(JSON.stringify({ event: 'QUEUE_RECONCILED', count: pending.length }));
}
void start().catch(error => { console.error('Worker startup failed:', error); process.exitCode = 1; });

let closing = false;
async function shutdown(signal: string) {
  if (closing) return; closing = true;
  console.info(JSON.stringify({ event: 'WORKER_SHUTDOWN', signal }));
  await worker.close();
  await queue.close();
  await prisma.$disconnect();
  await Promise.allSettled([connection.quit(), closeProcessorResources()]);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
