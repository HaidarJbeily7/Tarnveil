import type Redis from "ioredis";

const TTL_SECONDS = 300;

function key(characterId: string): string {
  return `presence:${characterId}`;
}

export async function setPresence(
  redis: Redis,
  characterId: string,
  zoneId: string,
): Promise<void> {
  await redis.set(key(characterId), zoneId, "EX", TTL_SECONDS);
}

export async function clearPresence(redis: Redis, characterId: string): Promise<void> {
  await redis.del(key(characterId));
}

export async function getPresence(
  redis: Redis,
  characterId: string,
): Promise<string | null> {
  return redis.get(key(characterId));
}
