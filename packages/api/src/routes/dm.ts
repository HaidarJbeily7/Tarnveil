import type { FastifyInstance, FastifyRequest } from "fastify";
import type Redis from "ioredis";

const AUTH_HEADER = "x-character-id";
const DM_MAX_BODY = 240;
const DM_READ_CAP = 50;
const DM_MAX_LOG = 200;

function authIdFrom(req: FastifyRequest): string | undefined {
  const v = req.headers[AUTH_HEADER];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

function pairKey(a: string, b: string): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `dm:${lo}:${hi}`;
}

function seqKey(a: string, b: string): string {
  return `${pairKey(a, b)}:seq`;
}

interface DmBody {
  body?: string;
}

interface DmMessage {
  id: number;
  from: string;
  to: string;
  body: string;
  ts: number;
}

export function registerDmRoutes(app: FastifyInstance, redis: Redis): void {
  app.post<{ Params: { peer: string }; Body: DmBody }>(
    "/api/dm/:peer",
    async (req, reply) => {
      const me = authIdFrom(req);
      if (me === undefined) { reply.code(401); return { error: "missing-auth" }; }
      const peer = req.params.peer;
      if (peer === me) { reply.code(400); return { error: "self-dm" }; }
      const body = req.body?.body;
      if (typeof body !== "string" || body.trim().length === 0) {
        reply.code(400); return { error: "empty" };
      }
      if (body.length > DM_MAX_BODY) {
        reply.code(400); return { error: "too-long" };
      }
      const id = await redis.incr(seqKey(me, peer));
      const msg: DmMessage = { id, from: me, to: peer, body, ts: Date.now() };
      await redis.zadd(pairKey(me, peer), id, JSON.stringify(msg));
      await redis.zremrangebyrank(pairKey(me, peer), 0, -(DM_MAX_LOG + 1));
      reply.code(201);
      return { message: msg };
    },
  );

  app.get<{ Params: { peer: string }; Querystring: { after?: string } }>(
    "/api/dm/:peer",
    async (req, reply) => {
      const me = authIdFrom(req);
      if (me === undefined) { reply.code(401); return { error: "missing-auth" }; }
      const peer = req.params.peer;
      const after = Number.parseInt(req.query.after ?? "0", 10);
      const min = Number.isFinite(after) ? `(${after}` : "-inf";
      const raw = await redis.zrangebyscore(
        pairKey(me, peer),
        min,
        "+inf",
        "LIMIT",
        0,
        DM_READ_CAP,
      );
      const messages: DmMessage[] = raw.map((s) => JSON.parse(s) as DmMessage);
      return { messages };
    },
  );
}
