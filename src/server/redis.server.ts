// src/server/redis.server.ts — Redis client (ioredis, TCP)
import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => console.error('[Redis] error:', err.message));