import { env } from './env.js';

/**
 * One small database interface with two engines behind it:
 *  - PostgreSQL (Neon in production) when DATABASE_URL is set;
 *  - PGlite (PostgreSQL compiled to run inside Node) otherwise, so local development
 *    and tests need no install and no account.
 * Only features both engines share are used: plain SQL with $n parameters.
 */
export type Query = <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;

export interface Db {
  query: Query;
  /** Runs fn inside one transaction; rolls back when fn throws. */
  tx<T>(fn: (query: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS banks (
     id            text PRIMARY KEY,
     display_name  text NOT NULL,
     status        text NOT NULL,
     status_reason text,
     admin_email   text NOT NULL,
     profile       json NOT NULL,
     created_at    timestamptz NOT NULL DEFAULT now(),
     updated_at    timestamptz NOT NULL DEFAULT now(),
     decided_at    timestamptz
   )`,
  `CREATE TABLE IF NOT EXISTS bank_domains (
     domain  text NOT NULL,
     bank_id text NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
     PRIMARY KEY (domain, bank_id)
   )`,
  `CREATE TABLE IF NOT EXISTS bank_assets (
     bank_id    text NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
     kind       text NOT NULL,
     mime       text NOT NULL,
     data_b64   text NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (bank_id, kind)
   )`,
  `CREATE TABLE IF NOT EXISTS platform_admins (
     id            text PRIMARY KEY,
     email         text NOT NULL UNIQUE,
     name          text NOT NULL,
     password_hash text NOT NULL
   )`,
  // Every CRM record of every bank. bank_id is part of the key, and every statement
  // that touches this table filters on it. `seq` keeps list order (highest first).
  `CREATE TABLE IF NOT EXISTS records (
     bank_id    text NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
     collection text NOT NULL,
     id         text NOT NULL,
     data       json NOT NULL,
     seq        bigint NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (bank_id, collection, id)
   )`,
];

async function openPostgres(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  // int8 (bigint) comes back as a string by default; counts and seq fit in a number.
  pg.types.setTypeParser(20, (value: string) => Number(value));
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return {
    query: (sql, params) => pool.query(sql, params as any[]) as any,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn((sql, params) => client.query(sql, params as any[]) as any);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function openPglite(dataDir: string | undefined): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  // PGlite creates only the last folder of the path; make the ones above it first.
  if (dataDir) (await import('node:fs')).mkdirSync(dataDir, { recursive: true });
  const lite = dataDir ? new PGlite(dataDir) : new PGlite();
  await lite.waitReady;
  return {
    query: (sql, params) => lite.query(sql, params as any[]) as any,
    tx: (fn) => lite.transaction((tx) => fn((sql, params) => tx.query(sql, params as any[]) as any)) as any,
    close: () => lite.close(),
  };
}

let dbPromise: Promise<Db> | undefined;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // On the hosted service a missing connection string must stop the start-up:
      // falling back to PGlite there would keep data on a disk that is wiped on every deploy.
      if (!env.databaseUrl && process.env.REQUIRE_DATABASE_URL === 'true') {
        throw new Error('DATABASE_URL is not set. Add the PostgreSQL connection string to this service.');
      }
      const db = env.databaseUrl ? await openPostgres(env.databaseUrl) : await openPglite(env.pgliteDir);
      for (const statement of SCHEMA) await db.query(statement);
      return db;
    })();
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  dbPromise = undefined;
  await db.close();
}
