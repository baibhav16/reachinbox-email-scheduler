import type { Redis } from 'ioredis';

const reserveScript = `
local held = redis.call('GET', KEYS[1])
if held then return {1, tonumber(held)} end
local now = tonumber(ARGV[1]); local delay = tonumber(ARGV[2]); local limit = tonumber(ARGV[3]); local prefix = ARGV[4]
local last = tonumber(redis.call('GET', KEYS[2]) or '0')
local candidate = math.max(now, last + delay); local hitLimit = false
for i = 1, 100000 do
  local hour = math.floor(candidate / 3600000)
  local bucket = prefix .. hour
  local count = tonumber(redis.call('GET', bucket) or '0')
  if count < limit then
    local expiry = math.ceil((candidate - now) / 1000) + 604800
    redis.call('INCR', bucket); redis.call('EXPIRE', bucket, expiry)
    redis.call('SET', KEYS[1], candidate, 'EX', expiry)
    redis.call('SET', KEYS[2], candidate, 'EX', expiry)
    if hitLimit then return {4, candidate} end
    return {candidate > now and 2 or 1, candidate}
  end
  hitLimit = true
  candidate = (hour + 1) * 3600000
  last = tonumber(redis.call('GET', KEYS[2]) or '0')
  candidate = math.max(candidate, last + delay)
end
return {3, candidate}
`;

export async function reserveSenderSlot(redis: Redis, emailId: string, senderId: string, hourlyLimit: number, delayMs: number) {
  const result = await redis.eval(reserveScript, 2, `email-reservation:${emailId}`, `sender-last:${senderId}`, Date.now(), delayMs, hourlyLimit, `rate:${senderId}:`);
  const [code, at] = (result as [number, number]).map(Number);
  return { code, at };
}
