import type Redis from "ioredis";

export const CHAT_MAX_BODY = 240;
export const CHAT_RATE_LIMIT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;

// Tiny stoplist; real deployments would load a curated dictionary.
const PROFANITY = ["badword", "anothbadword"];

export interface ValidationResult {
  ok: boolean;
  reason?: "empty" | "too-long" | "profanity";
  body?: string;
}

export function validateChatBody(raw: unknown): ValidationResult {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty" };
  if (trimmed.length > CHAT_MAX_BODY) return { ok: false, reason: "too-long" };
  const lower = trimmed.toLowerCase();
  for (const word of PROFANITY) {
    if (lower.includes(word)) return { ok: false, reason: "profanity" };
  }
  return { ok: true, body: trimmed };
}

/**
 * Returns true when the author has exceeded CHAT_RATE_LIMIT in the rolling
 * CHAT_RATE_WINDOW_MS window. Counter resets via TTL.
 */
export async function isChatRateLimited(redis: Redis, authorId: string): Promise<boolean> {
  const key = `chat:rate:${authorId}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.pexpire(key, CHAT_RATE_WINDOW_MS);
  return n > CHAT_RATE_LIMIT;
}

function muteKey(muterId: string): string {
  return `chat:mute:${muterId}`;
}

export async function mute(redis: Redis, muterId: string, targetId: string): Promise<void> {
  await redis.sadd(muteKey(muterId), targetId);
}

export async function unmute(redis: Redis, muterId: string, targetId: string): Promise<void> {
  await redis.srem(muteKey(muterId), targetId);
}

export async function mutedSet(redis: Redis, muterId: string): Promise<Set<string>> {
  const list = await redis.smembers(muteKey(muterId));
  return new Set(list);
}
