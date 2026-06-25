import type { FastifyInstance } from "fastify";
import { sql, eq } from "drizzle-orm";
import { characters, ledger, marketplaceListings } from "@tarnveil/shared/db";
import type { DrizzleDB } from "../db.js";

const BOOTED_AT = Date.now();
const REQUEST_COUNTS = new Map<string, number>();
const ERROR_COUNTS = new Map<string, number>();

export function bumpRequestCount(route: string): void {
  REQUEST_COUNTS.set(route, (REQUEST_COUNTS.get(route) ?? 0) + 1);
}

export function bumpErrorCount(route: string): void {
  ERROR_COUNTS.set(route, (ERROR_COUNTS.get(route) ?? 0) + 1);
}

export function registerAdminRoutes(app: FastifyInstance, db: DrizzleDB): void {
  app.get("/api/admin/economy", async () => {
    const [supplyRow] = await db
      .select({ sum: sql<number>`coalesce(sum(${characters.gold}), 0)::bigint` })
      .from(characters);
    const [ledgerRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::bigint`,
      })
      .from(ledger)
      .where(sql`${ledger.kind} = 'gold'`);
    const [inflowRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::bigint`,
      })
      .from(ledger)
      .where(sql`${ledger.kind} = 'gold' AND ${ledger.delta} > 0 AND ${ledger.ts} > now() - interval '24 hours'`);
    const [outflowRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::bigint`,
      })
      .from(ledger)
      .where(sql`${ledger.kind} = 'gold' AND ${ledger.delta} < 0 AND ${ledger.ts} > now() - interval '24 hours'`);

    const totalSupply = Number(supplyRow?.sum ?? 0);
    const ledgerSum = Number(ledgerRow?.sum ?? 0);
    const last24hIn = Number(inflowRow?.sum ?? 0);
    const last24hOut = Number(outflowRow?.sum ?? 0);

    return {
      totalSupply,
      ledgerSum,
      reconciles: totalSupply === ledgerSum,
      last24h: {
        in: last24hIn,
        out: last24hOut,
        net: last24hIn + last24hOut, // out is already negative
      },
    };
  });

  app.get("/api/admin/metrics", async () => {
    const [charCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(characters);
    const [activeListings] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.status, "active"));
    return {
      uptimeMs: Date.now() - BOOTED_AT,
      characters: Number(charCount?.n ?? 0),
      activeListings: Number(activeListings?.n ?? 0),
      requests: Object.fromEntries(REQUEST_COUNTS),
      errors: Object.fromEntries(ERROR_COUNTS),
    };
  });
}
