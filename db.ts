// server/db.ts
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { drizzle as pgliteDrizzle } from 'drizzle-orm/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@shared/schema';

type Schema = typeof schema;
type NeonDb = NeonHttpDatabase<Schema>;
type PgliteDb = PgliteDatabase<Schema>;
type DbType = NeonDb | PgliteDb;

let db: DbType;

if (!process.env.DATABASE_URL) {
  console.log('No DATABASE_URL provided → using in-memory PGlite');
  
  // Always use PGlite when no URL is set (dev or test)
  const client = new PGlite();  // in-memory PostgreSQL
  const localDb = pgliteDrizzle(client, { schema });
  db = localDb;

  // Optional: log which mode we're in
  if (process.env.NODE_ENV === 'test') {
    console.log('Using in-memory PostgreSQL (PGlite) for tests');
  } else {
    console.log('Using in-memory PostgreSQL (PGlite) for development');
  }
} else {
  // DATABASE_URL is set → connect to Neon
  const sql = neon(process.env.DATABASE_URL);
  db = neonDrizzle(sql, { schema });
}

export { db };
export { migrate };