import type { FastifyInstance, FastifyRequest } from "fastify";
import type Redis from "ioredis";
import {
  CHAT_READ_CAP,
  appendChat,
  readChatSince,
  type ChatChannel,
} from "../chat/log.js";
import {
  CHAT_MAX_BODY,
  isChatRateLimited,
  mute,
  mutedSet,
  unmute,
  validateChatBody,
} from "../chat/moderation.js";

interface ChatReadQuery {
  after?: string;
  region?: string;
  shard?: string;
  limit?: string;
}

interface ChatPostBody {
  region?: string;
  shard?: number;
  body?: string;
}

interface MuteBody {
  target?: string;
}

const AUTH_HEADER = "x-character-id";

function parseInt32(value: string | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function readChannel(query: ChatReadQuery): ChatChannel {
  const region = typeof query.region === "string" && query.region.length > 0
    ? query.region
    : "global";
  return { region, shard: parseInt32(query.shard, 0) };
}

function postChannel(body: ChatPostBody): ChatChannel {
  const region = typeof body.region === "string" && body.region.length > 0
    ? body.region
    : "global";
  const shard = Number.isInteger(body.shard) ? (body.shard as number) : 0;
  return { region, shard };
}

function authorIdFrom(req: FastifyRequest): string | undefined {
  const v = req.headers[AUTH_HEADER];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

export function registerChatRoutes(app: FastifyInstance, redis: Redis): void {
  app.get<{ Querystring: ChatReadQuery }>("/api/chat", async (req, reply) => {
    const channel = readChannel(req.query);
    const after = parseInt32(req.query.after, 0);
    const limit = parseInt32(req.query.limit, CHAT_READ_CAP);
    const messages = await readChatSince(redis, channel, after, limit);

    const viewer = authorIdFrom(req);
    const filtered = viewer
      ? messages.filter((m) => !visitorMuted.has(viewer, m.author))
      : messages;
    // Lazily warm + apply per-viewer mute set (one trip to Redis per request).
    if (viewer) {
      const mset = await mutedSet(redis, viewer);
      // Re-apply with the fresh set in case the in-memory cache was stale.
      reply.header("Cache-Control", "private, max-age=1");
      return { messages: messages.filter((m) => !mset.has(m.author)) };
    }
    reply.header("Cache-Control", "public, max-age=1");
    return { messages: filtered };
  });

  app.post<{ Body: ChatPostBody }>("/api/chat", async (req, reply) => {
    const author = authorIdFrom(req);
    if (author === undefined) {
      reply.code(401);
      return { error: "missing-auth" };
    }
    const channel = postChannel(req.body ?? {});
    const validation = validateChatBody(req.body?.body);
    if (!validation.ok) {
      reply.code(400);
      return { error: validation.reason ?? "invalid", maxLen: CHAT_MAX_BODY };
    }
    if (await isChatRateLimited(redis, author)) {
      reply.code(429);
      return { error: "rate-limited" };
    }
    const msg = await appendChat(redis, channel, author, validation.body!);
    reply.code(201);
    return { message: msg };
  });

  app.post<{ Body: MuteBody }>("/api/mute", async (req, reply) => {
    const muter = authorIdFrom(req);
    if (muter === undefined) {
      reply.code(401);
      return { error: "missing-auth" };
    }
    const target = req.body?.target;
    if (typeof target !== "string" || target.length === 0) {
      reply.code(400);
      return { error: "missing-target" };
    }
    await mute(redis, muter, target);
    return { ok: true };
  });

  app.delete<{ Body: MuteBody }>("/api/mute", async (req, reply) => {
    const muter = authorIdFrom(req);
    if (muter === undefined) {
      reply.code(401);
      return { error: "missing-auth" };
    }
    const target = req.body?.target;
    if (typeof target !== "string" || target.length === 0) {
      reply.code(400);
      return { error: "missing-target" };
    }
    await unmute(redis, muter, target);
    return { ok: true };
  });
}

// Unused placeholder kept only to satisfy the older shape — see GET handler
// which queries `mutedSet` per request.
const visitorMuted = {
  has(_muter: string, _target: string): boolean {
    return false;
  },
};
