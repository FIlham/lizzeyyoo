// src/server/cache.server.ts — minimal cache helper around Redis
import { redis } from './redis.server';

export async function cacheGetOrSet<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit != null) return JSON.parse(hit) as T;
  const fresh = await fn();
  await redis.call('SET', key, JSON.stringify(fresh), 'EX', String(ttlSec));
  return fresh;
}

export async function cacheInvalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redis.del(...keys);
}

export async function cacheInvalidateUser(userId: string): Promise<void> {
  // ponytail: KEYS scan fine for single-user MVP; switch to SCAN cursor if throughput matters
  const keys = await redis.keys(`u:${userId}:*`);
  if (keys.length > 0) await redis.del(...keys);
}