import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@tarnveil/shared/db";

const { Pool } = pg;

export type DrizzleDB = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let db: DrizzleDB | null = null;

export function getDb(connectionString?: string): DrizzleDB {
  if (db === null) {
    pool = new Pool({
      connectionString:
        connectionString ??
        process.env["DATABASE_URL"] ??
        "postgres://tarnveil:tarnveil@localhost:5433/tarnveil",
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool !== null) {
    await pool.end();
    pool = null;
    db = null;
  }
}
