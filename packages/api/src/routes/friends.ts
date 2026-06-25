import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq, or } from "drizzle-orm";
import { friends } from "@tarnveil/shared/db";
import type { DrizzleDB } from "../db.js";

const AUTH_HEADER = "x-character-id";

interface FriendBody {
  target?: string;
  from?: string;
}

function authIdFrom(req: FastifyRequest): string | undefined {
  const v = req.headers[AUTH_HEADER];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerFriendsRoutes(app: FastifyInstance, db: DrizzleDB): void {
  app.post<{ Body: FriendBody }>("/api/friends/request", async (req, reply) => {
    const me = authIdFrom(req);
    const target = req.body?.target;
    if (me === undefined) { reply.code(401); return { error: "missing-auth" }; }
    if (typeof target !== "string" || !UUID_RE.test(target) || target === me) {
      reply.code(400); return { error: "bad-target" };
    }
    await db
      .insert(friends)
      .values({ requesterId: me, targetId: target, status: "pending" })
      .onConflictDoNothing();
    return { ok: true, status: "pending" };
  });

  app.post<{ Body: FriendBody }>("/api/friends/accept", async (req, reply) => {
    const me = authIdFrom(req);
    const from = req.body?.from;
    if (me === undefined) { reply.code(401); return { error: "missing-auth" }; }
    if (typeof from !== "string" || !UUID_RE.test(from)) {
      reply.code(400); return { error: "bad-from" };
    }
    // Only the target of the request can accept it.
    const updated = await db
      .update(friends)
      .set({ status: "accepted" })
      .where(
        and(
          eq(friends.requesterId, from),
          eq(friends.targetId, me),
          eq(friends.status, "pending"),
        ),
      )
      .returning();
    if (updated.length === 0) { reply.code(404); return { error: "no-pending-request" }; }
    return { ok: true, status: "accepted" };
  });

  app.get("/api/friends", async (req, reply) => {
    const me = authIdFrom(req);
    if (me === undefined) { reply.code(401); return { error: "missing-auth" }; }
    const rows = await db
      .select()
      .from(friends)
      .where(or(eq(friends.requesterId, me), eq(friends.targetId, me)));
    return {
      friends: rows.map((r) => ({
        requesterId: r.requesterId,
        targetId: r.targetId,
        status: r.status,
        peer: r.requesterId === me ? r.targetId : r.requesterId,
        direction: r.requesterId === me ? "outgoing" : "incoming",
      })),
    };
  });
}
