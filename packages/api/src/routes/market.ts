import type { FastifyInstance, FastifyRequest } from "fastify";
import { desc, eq } from "drizzle-orm";
import { marketplaceListings } from "@tarnveil/shared/db";
import type { DrizzleDB } from "../db.js";
import { buyListing, createListing } from "../market.js";

const AUTH_HEADER = "x-character-id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authIdFrom(req: FastifyRequest): string | undefined {
  const v = req.headers[AUTH_HEADER];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

interface ListBody {
  itemKind?: string;
  qty?: number;
  totalPrice?: number;
}

export function registerMarketRoutes(app: FastifyInstance, db: DrizzleDB): void {
  app.get("/api/market", async (_req, reply) => {
    const rows = await db
      .select({
        id: marketplaceListings.id,
        sellerId: marketplaceListings.sellerId,
        itemKind: marketplaceListings.itemKind,
        qty: marketplaceListings.qty,
        totalPrice: marketplaceListings.totalPrice,
        listedAt: marketplaceListings.listedAt,
      })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.status, "active"))
      .orderBy(desc(marketplaceListings.listedAt))
      .limit(100);
    // Cacheable browse path per R2/R3.
    reply.header("Cache-Control", "public, max-age=2");
    return { listings: rows };
  });

  app.post<{ Body: ListBody }>("/api/market/list", async (req, reply) => {
    const me = authIdFrom(req);
    if (me === undefined || !UUID_RE.test(me)) {
      reply.code(401); return { error: "missing-auth" };
    }
    const { itemKind, qty, totalPrice } = req.body ?? {};
    if (
      typeof itemKind !== "string" ||
      !Number.isInteger(qty) ||
      (qty as number) <= 0 ||
      !Number.isInteger(totalPrice) ||
      (totalPrice as number) <= 0
    ) {
      reply.code(400); return { error: "bad-input" };
    }
    try {
      const result = await createListing(db, {
        sellerId: me,
        itemKind,
        qty: qty as number,
        totalPrice: totalPrice as number,
      });
      reply.code(201);
      return { listingId: result.id };
    } catch (err) {
      reply.code(400);
      return { error: err instanceof Error ? err.message : "list-failed" };
    }
  });

  app.post<{ Params: { id: string } }>("/api/market/buy/:id", async (req, reply) => {
    const me = authIdFrom(req);
    if (me === undefined || !UUID_RE.test(me)) {
      reply.code(401); return { error: "missing-auth" };
    }
    const id = req.params.id;
    if (!UUID_RE.test(id)) { reply.code(400); return { error: "bad-id" }; }
    const result = await buyListing(db, id, me);
    if (result.ok) return { ok: true };
    if (result.reason === "not-found") reply.code(404);
    else if (result.reason === "not-active") reply.code(409);
    else if (result.reason === "insufficient-gold") reply.code(402);
    else reply.code(400);
    return { error: result.reason };
  });
}
