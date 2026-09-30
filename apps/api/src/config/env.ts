import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const localEnv = resolve(process.cwd(), '.env');
dotenv.config({ path: existsSync(localEnv) ? localEnv : resolve(process.cwd(), '../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'), PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'), API_ORIGIN: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1), REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'), ELASTICSEARCH_INDEX: z.string().default('scheduled-emails'),
  JWT_SECRET: z.string().min(32), GOOGLE_CLIENT_ID: z.string().optional().default(''), GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:4000/api/auth/google/callback'),
  SLACK_CLIENT_ID: z.string().optional().default(''), SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_CALLBACK_URL: z.string().url().default('http://localhost:4000/api/slack/callback'),
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'), ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(''), ETHEREAL_PASSWORD: z.string().optional().default(''),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5), MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(200),
  MIN_EMAIL_DELAY_MS: z.coerce.number().int().positive().default(2000), SMTP_ENCRYPTION_KEY: z.string().optional().default('')
});
export const env = schema.parse(process.env);
