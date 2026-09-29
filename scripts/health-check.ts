import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 1, connectTimeout: 3000, retryStrategy: () => null });
const checks: Record<string, 'ok' | 'failed'> = {};
try { await prisma.$connect(); await prisma.$queryRaw`SELECT 1`; checks.postgres = 'ok'; } catch { checks.postgres = 'failed'; }
try { await redis.ping(); checks.redis = 'ok'; } catch { checks.redis = 'failed'; }
try { const response = await fetch(`${process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200'}/_cluster/health`, { signal: AbortSignal.timeout(3000) }); checks.elasticsearch = response.ok ? 'ok' : 'failed'; } catch { checks.elasticsearch = 'failed'; }
console.log(JSON.stringify(checks, null, 2));
await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
if (Object.values(checks).some(value => value !== 'ok')) process.exitCode = 1;
