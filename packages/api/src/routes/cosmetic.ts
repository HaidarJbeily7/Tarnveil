import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, sql } from "drizzle-orm";
import { characters, ledger } from "@tarnveil/shared/db";
import type { DrizzleDB } from "../db.js";

const AUTH_HEADER = "x-character-id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CosmeticBody {
  kind?: string;
  price?: number;
}

function authIdFrom(req: FastifyRequest): string | undefined {
  const v = req.headers[AUTH_HEADER];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

export function registerCosmeticRoute(app: FastifyInstance, db: DrizzleDB): void {
  app.post<{ Body: CosmeticBody }>("/api/cosmetic/buy", async (req, reply) => {
    const me = authIdFrom(req);
    if (me === undefined || !UUID_RE.test(me)) {
      reply.code(401); return { error: "missing-auth" };
    }
    const { kind, price } = req.body ?? {};
    if (
      typeof kind !== "string" ||
      kind.length === 0 ||
      !Number.isInteger(price) ||
      (price as number) <= 0
    ) {
      reply.code(400); return { error: "bad-input" };
    }
    try {
      const after = await db.transaction(async (tx) => {
        const [c] = await tx
          .select({ gold: characters.gold })
          .from(characters)
          .where(eq(characters.id, me))
          .for("update");
        if (!c) throw new Error("not-found");
        if (c.gold < (price as number)) throw new Error("insufficient-gold");
        const goldAfter = c.gold - (price as number);
        await tx
          .update(characters)
          .set({ gold: goldAfter, updatedAt: sql`now()` })
          .where(eq(characters.id, me));
        await tx.insert(ledger).values({
          characterId: me,
          kind: "gold",
          subkind: null,
          delta: -(price as number),
          balanceAfter: goldAfter,
          reason: `sink:cosmetic:${kind}`,
        });
        return goldAfter;
      });
      return { ok: true, gold: after };
    } catch (err) {
      if (err instanceof Error && err.message === "not-found") {
        reply.code(404); return { error: "not-found" };
      }
      reply.code(402);
      return { error: err instanceof Error ? err.message : "buy-failed" };
    }
  });
}
