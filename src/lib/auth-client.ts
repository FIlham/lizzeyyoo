// src/lib/auth-client.ts — Better Auth React client (importable by route components)
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;