import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { characters, ledger } from "@tarnveil/shared/db";
import type { DrizzleDB } from "../db.js";

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
}
