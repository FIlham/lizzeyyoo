// src/server/auth.ts — Better Auth instance (importable by auth route handler)
// Named auth.ts (not *.server.ts) so the /api/auth/$ route can import it.
// Server handlers are server-bundled, so better-auth stays off the client bundle.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db.server';
import * as schema from './schema';
import { redis } from './redis.server';
import {
  checkRateLimit,
  RateLimitError,
  AUTH_SIGNIN_LIMITS,
  AUTH_SIGNUP_LIMITS,
  getClientIP,
} from './ratelimit.server';

export const auth = betterAuth({
  appName: 'Lizzeyyoo',
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // ponytail: skip SMTP for local MVP
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60,           // refresh every hour
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,             // 5 min cookie cache for stateless reads
    },
  },
  // Better Auth built-in rate limiting (global, memory-based — our Redis layer below is stronger)
  rateLimit: {
    enabled: true,
    window: 60,  // 60-second window
    max: 20,     // max 20 auth requests per 60s per IP
  },
  secondaryStorage: {
    get: async (key) => (await redis.get(`ba:${key}`)) ?? null,
    set: async (key, value, ttl) => {
      if (typeof value !== 'string') return;
      await redis.call('SET', `ba:${key}`, value, 'EX', String(ttl));
    },
    delete: async (key) => {
      await redis.del(`ba:${key}`);
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Seed default budgets + goal for the new user (single row per user).
          // Explicitly pass timestamps — Postgres column DEFAULT may not be set if
          // the table was created from an older migration without defaultNow().
          const now = new Date();
          await Promise.all([
            db
              .insert(schema.budgets)
              .values(
                Object.entries(schema.DEFAULT_BUDGETS).map(([category, amount]) => ({
                  userId: user.id,
                  category,
                  amount,
                  createdAt: now,
                  updatedAt: now,
                })),
              ),
            db.insert(schema.goals).values({
              userId: user.id,
              name: 'Beli Laptop',
              target: 5_000_000,
              current: 0,
              createdAt: now,
              updatedAt: now,
            }),
          ]);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;

/**
 * Wrap auth.handler with custom Redis rate-limiting for sign-in and sign-up.
 * Call this in the route handler instead of auth.handler directly.
 */
export async function authHandlerWithRateLimit(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');
  const ip = getClientIP(request.headers);

  try {
    if (path === '/sign-in/email') {
      await checkRateLimit(`ip:${ip}`, AUTH_SIGNIN_LIMITS);
    } else if (path === '/sign-up/email') {
      await checkRateLimit(`ip:${ip}`, AUTH_SIGNUP_LIMITS);
    }
  } catch (err) {
    if (err instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED', message: err.message }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(err.retryAfterSec),
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + err.retryAfterSec),
          },
        },
      );
    }
    throw err;
  }

  return auth.handler(request);
}