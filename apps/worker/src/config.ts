import 'dotenv/config';
export const config = {
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  globalHourlyLimit: Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 200),
  minimumDelayMs: Math.max(1, Number(process.env.MIN_EMAIL_DELAY_MS ?? 2000)),
  elasticUrl: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  elasticIndex: process.env.ELASTICSEARCH_INDEX ?? 'scheduled-emails'
};
