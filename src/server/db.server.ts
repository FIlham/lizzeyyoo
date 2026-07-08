// src/server/db.server.ts — Drizzle instance via postgres-js (server-only)
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
export const db = drizzle(connectionString, { schema });
export { schema };