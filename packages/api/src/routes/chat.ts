import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { CHAT_READ_CAP, readChatSince } from "../chat/log.js";

interface ChatReadQuery {
  after?: string;
  region?: string;
  shard?: string;
  limit?: string;
}

function parseInt32(value: string | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function registerChatRoutes(app: FastifyInstance, redis: Redis): void {
  app.get<{ Querystring: ChatReadQuery }>("/api/chat", async (req, reply) => {
    const region = typeof req.query.region === "string" && req.query.region.length > 0
      ? req.query.region
      : "global";
    const shard = parseInt32(req.query.shard, 0);
    const after = parseInt32(req.query.after, 0);
    const limit = parseInt32(req.query.limit, CHAT_READ_CAP);

    const messages = await readChatSince(redis, { region, shard }, after, limit);
    // Appendix B: CDN-cacheable read path. 1 second is invisible for chat
    // and lets the edge collapse identical "after=X" requests.
    reply.header("Cache-Control", "public, max-age=1");
    return { messages };
  });
}
