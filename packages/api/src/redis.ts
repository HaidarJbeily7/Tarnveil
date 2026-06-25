import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(connectionString?: string): Redis {
  if (client === null) {
    const url =
      connectionString ??
      process.env["REDIS_URL"] ??
      "redis://localhost:6380";
    client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client !== null) {
    client.disconnect();
    client = null;
  }
}
