// src/server/ratelimit.server.ts — Generic Redis sliding window rate limiter
// Strategy: fixed-window counter using INCR + EXPIRE (atomic, low-overhead)
// All limits are per-user (userId) or per-IP depending on context.
import { redis } from './redis.server';

export class RateLimitError extends Error {
  public readonly retryAfterSec: number;
  public readonly limitType: string;

  constructor(message: string, retryAfterSec: number, limitType: string) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
    this.limitType = limitType;
  }
}

export interface RateLimitRule {
  /** Human-readable label, e.g. "ai_chat_per_minute" */
  key: string;
  /** Max allowed hits in the window */
  max: number;
  /** Window duration in seconds */
  windowSec: number;
}

/**
 * Check a single rule.
 * Throws RateLimitError if the limit is exceeded.
 * Returns { count, remaining } on success.
 */
export async function checkRateLimit(
  scope: string,
  rules: RateLimitRule[],
): Promise<{ counts: Record<string, number> }> {
  const now = Math.floor(Date.now() / 1000);
  const results: Record<string, number> = {};

  for (const rule of rules) {
    // Bucket key: rl:{rule.key}:{scope}:{window_bucket}
    const bucket = Math.floor(now / rule.windowSec);
    const redisKey = `rl:${rule.key}:${scope}:${bucket}`;

    // Atomically increment and set TTL
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First hit in this window — set expiry
      await redis.expire(redisKey, rule.windowSec);
    }

    results[rule.key] = count;

    if (count > rule.max) {
      // How many seconds until the current window expires
      const ttl = await redis.ttl(redisKey);
      const retryAfter = ttl > 0 ? ttl : rule.windowSec;

      throw new RateLimitError(
        `Rate limit tercapai: ${rule.key}. Maksimum ${rule.max} request per ${formatDuration(rule.windowSec)}. Coba lagi dalam ${retryAfter} detik.`,
        retryAfter,
        rule.key,
      );
    }
  }

  return { counts: results };
}

// --- Pre-defined limit profiles ---

/** AI chat: 10 msg/min + 60 msg/hour per user (protect free AI quota) */
export const AI_CHAT_LIMITS: RateLimitRule[] = [
  { key: 'ai_chat_min', max: 10, windowSec: 60 },
  { key: 'ai_chat_hour', max: 60, windowSec: 3600 },
];

/** Finance write mutations: 30/min per user */
export const FINANCE_WRITE_LIMITS: RateLimitRule[] = [
  { key: 'finance_write_min', max: 30, windowSec: 60 },
];

/** Auth sign-in: 5 attempts/15 min per IP */
export const AUTH_SIGNIN_LIMITS: RateLimitRule[] = [
  { key: 'auth_signin_15min', max: 5, windowSec: 900 },
];

/** Auth sign-up: 3 attempts/hour per IP */
export const AUTH_SIGNUP_LIMITS: RateLimitRule[] = [
  { key: 'auth_signup_hour', max: 3, windowSec: 3600 },
];

// --- Helpers ---

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} detik`;
  if (sec < 3600) return `${sec / 60} menit`;
  return `${sec / 3600} jam`;
}

/**
 * Extract client IP from request headers.
 * Checks X-Forwarded-For (reverse proxy) first, then x-real-ip, then 'unknown'.
 */
export function getClientIP(headers: Headers | Record<string, string>): string {
  const get = (key: string): string | null => {
    if (headers instanceof Headers) return headers.get(key);
    return (headers as Record<string, string>)[key] ?? null;
  };

  const forwarded = get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}
