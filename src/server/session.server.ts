// src/server/session.server.ts — resolve the authenticated userId inside server functions.
// Named *.server.ts so it cannot leak into the client bundle; .fn.ts files may import it.
import { getRequest, getRequestHeaders } from '@tanstack/start-server-core';
import { auth } from './auth';

export interface AuthContext {
  userId: string;
  user: { id: string; name: string; email: string };
}

export async function getAuthContext(): Promise<AuthContext> {
  const headers = getRequestHeaders() as unknown as Headers;
  if (!(headers instanceof Headers)) {
    // getRequestHeaders returns a TypedHeaders; coerce to plain Headers for better-auth
    const plain = new Headers();
    for (const [k, v] of Object.entries(headers as Record<string, string>)) {
      plain.set(k, v);
    }
    const session = await auth.api.getSession({ headers: plain });
    if (!session) throw new Error('UNAUTHENTICATED');
    return { userId: session.user.id, user: session.user as AuthContext['user'] };
  }
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error('UNAUTHENTICATED');
  return { userId: session.user.id, user: session.user as AuthContext['user'] };
}

export async function maybeAuthContext(): Promise<AuthContext | null> {
  try {
    return await getAuthContext();
  } catch {
    return null;
  }
}

export { getRequest };