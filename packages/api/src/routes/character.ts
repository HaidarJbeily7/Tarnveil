import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { characters, ledger } from "@tarnveil/shared/db";
import type { DrizzleDB } from "../db.js";

export function registerCharacterRoutes(app: FastifyInstance, db: DrizzleDB): void {
  app.get<{ Params: { id: string } }>("/api/character/:id", async (req, reply) => {
    const [row] = await db
      .select({
        id: characters.id,
        name: characters.name,
        zone: characters.zone,
        gold: characters.gold,
      })
      .from(characters)
      .where(eq(characters.id, req.params.id));
    if (!row) { reply.code(404); return { error: "not-found" }; }

    // R5 cross-check: the sum of all gold-kind ledger deltas must equal
    // the character's live gold balance. Surfaced so clients (and ops) can
    // assert it without a SQL shell.
    const [agg] = await db
      .select({ sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::int` })
      .from(ledger)
      .where(sql`${ledger.characterId} = ${req.params.id} AND ${ledger.kind} = 'gold'`);
    const ledgerSum = Number(agg?.sum ?? 0);

    return {
      character: row,
      ledger: {
        goldSum: ledgerSum,
        matchesBalance: ledgerSum === row.gold,
      },
    };
  });
}
