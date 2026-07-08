// src/server/auth.fn.ts — session-check RPC for route beforeLoad guards.
import { createServerFn } from '@tanstack/react-start';
import { maybeAuthContext } from './session.server';

export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await maybeAuthContext();
  if (!ctx) return null;
  return { user: ctx.user };
});

export interface SessionInfo {
  user: { id: string; name: string; email: string };
}