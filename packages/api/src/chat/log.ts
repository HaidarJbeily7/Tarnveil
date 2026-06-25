import type Redis from "ioredis";

export interface ChatMessage {
  id: number;
  region: string;
  shard: number;
  author: string;
  body: string;
  ts: number;
}

export interface ChatChannel {
  region: string;
  shard: number;
}

const MAX_LOG_LEN = 500;
const READ_CAP = 50;

function streamKey(c: ChatChannel): string {
  return `chat:${c.region}:${c.shard}`;
}

function seqKey(c: ChatChannel): string {
  return `chat:seq:${c.region}:${c.shard}`;
}

/**
 * Append a message to the per-channel Redis log. Returns the assigned
 * monotonic id (per region+shard). Trims to the last MAX_LOG_LEN entries.
 */
export async function appendChat(
  redis: Redis,
  channel: ChatChannel,
  author: string,
  body: string,
  now: number = Date.now(),
): Promise<ChatMessage> {
  const id = await redis.incr(seqKey(channel));
  const msg: ChatMessage = {
    id,
    region: channel.region,
    shard: channel.shard,
    author,
    body,
    ts: now,
  };
  await redis.zadd(streamKey(channel), id, JSON.stringify(msg));
  // Keep only the most recent MAX_LOG_LEN messages.
  await redis.zremrangebyrank(streamKey(channel), 0, -(MAX_LOG_LEN + 1));
  return msg;
}

/**
 * Read messages with id > after, capped to `limit` (max READ_CAP) and
 * returned in monotonic id order.
 */
export async function readChatSince(
  redis: Redis,
  channel: ChatChannel,
  after: number,
  limit: number = READ_CAP,
): Promise<ChatMessage[]> {
  const cap = Math.max(1, Math.min(READ_CAP, Math.floor(limit)));
  const min = Number.isFinite(after) ? `(${Math.floor(after)}` : "-inf";
  const raw = await redis.zrangebyscore(streamKey(channel), min, "+inf", "LIMIT", 0, cap);
  return raw.map((s) => JSON.parse(s) as ChatMessage);
}

/** Clear a channel's stream + sequence. Test-only helper. */
export async function resetChat(redis: Redis, channel: ChatChannel): Promise<void> {
  await redis.del(streamKey(channel), seqKey(channel));
}

export { READ_CAP as CHAT_READ_CAP, MAX_LOG_LEN as CHAT_MAX_LOG_LEN };
