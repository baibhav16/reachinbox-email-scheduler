import { Queue } from 'bullmq';
import { EMAIL_QUEUE, type EmailJobData } from '@reachinbox/shared';
import { redis } from '../config/redis.js';
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, { connection: redis, defaultJobOptions: {
  attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 }
} });
