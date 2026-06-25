import "dotenv/config";
import pg from "pg";
import Redis from "ioredis";

const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://tarnveil:tarnveil@localhost:5433/tarnveil";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6380";

async function pingPostgres(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ ok: number }>("SELECT 1 AS ok");
  if (rows[0]?.ok !== 1) throw new Error("postgres: unexpected SELECT 1 result");
  await client.end();
  console.log("postgres: ok");
}

async function pingRedis(): Promise<void> {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  await redis.connect();
  const pong = await redis.ping();
  if (pong !== "PONG") throw new Error(`redis: unexpected PING response: ${pong}`);
  redis.disconnect();
  console.log("redis: ok");
}

async function main(): Promise<void> {
  await pingPostgres();
  await pingRedis();
  console.log("smoke: all services reachable");
}

main().catch((err: unknown) => {
  console.error("smoke: failed", err);
  process.exit(1);
});
