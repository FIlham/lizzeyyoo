import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}

const migrationClient = postgres(databaseUrl, { max: 1 });
const db = drizzle(migrationClient);

async function main() {
  console.log('[Drizzle] Menjalankan migrasi database...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[Drizzle] Migrasi database berhasil diterapkan!');
  await migrationClient.end();
}

main().catch((err) => {
  console.error('[Drizzle] Migrasi database gagal:', err);
  process.exit(1);
});
