import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = resolve(__dirname, "../../../infra/migrations");

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://tarnveil:tarnveil@localhost:5433/tarnveil";

async function main(): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  for (const name of files) {
    const { rowCount } = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [name]);
    if (rowCount && rowCount > 0) {
      console.log(`migrate: skip ${name} (already applied)`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, name), "utf8");
    console.log(`migrate: apply ${name}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations(name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("migrate: done");
}

main().catch((err: unknown) => {
  console.error("migrate: failed", err);
  process.exit(1);
});
