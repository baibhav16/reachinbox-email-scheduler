import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { elastic, ensureEmailIndex } from './config/elasticsearch.js';
import { emailQueue } from './queues/email.queue.js';
import { logger } from './utils/logger.js';

async function start() {
  await prisma.$connect();
  await redis.ping();
  await ensureEmailIndex();
  // Reconcile PostgreSQL as the source of truth with Redis using stable BullMQ IDs.
  const pending = await prisma.scheduledEmail.findMany({ where: { status: 'SCHEDULED' }, select: { id: true, scheduledAt: true } });
  for (const email of pending) await emailQueue.add('send-email', { emailId: email.id }, { jobId: email.id, delay: Math.max(0, email.scheduledAt.getTime() - Date.now()) });
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT, pending: pending.length }, 'API listening'));
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return; closing = true; logger.info({ signal }, 'Shutting down API');
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await Promise.allSettled([emailQueue.close(), prisma.$disconnect(), redis.quit(), elastic.close()]);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
start().catch(error => { logger.fatal({ err: error }, 'API startup failed'); process.exitCode = 1; });
