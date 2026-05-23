// KV-backed sliding-window rate limiter. Used by /api/ask to cap Groq usage.

import { kv } from './kv';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetSeconds: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const fullKey = `rate:${key}`;
  const count = await kv.incr(fullKey);
  if (count === 1) {
    await kv.expire(fullKey, windowSeconds);
  }
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
    resetSeconds: windowSeconds,
  };
}
