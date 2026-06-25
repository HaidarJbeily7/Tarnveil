import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray, eq, sql } from "drizzle-orm";
import { characters, ledger } from "@tarnveil/shared/db";
import { buildApp } from "../src/server.js";
import { closeDb, getDb } from "../src/db.js";
import { closeRedis } from "../src/redis.js";

const createdNames: string[] = [];

async function createCharWithGold(name: string, gold: number): Promise<string> {
  const db = getDb();
  createdNames.push(name);
  return await db.transaction(async (tx) => {
    const [char] = await tx.insert(characters).values({ name }).returning();
    if (!char) throw new Error("char insert failed");
    // Treat the seed as a single ledger row so totals match.
    await tx
      .update(characters)
      .set({ gold, updatedAt: sql`now()` })
      .where(eq(characters.id, char.id));
    await tx.insert(ledger).values({
      characterId: char.id,
      kind: "gold",
      subkind: null,
      delta: gold,
      balanceAfter: gold,
      reason: "seed",
    });
    return char.id;
  });
}

describe("GET /api/character/:id", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    const db = getDb();
    if (createdNames.length > 0) {
      await db.delete(characters).where(inArray(characters.name, createdNames));
    }
    await closeDb();
    await closeRedis();
  });

  it("returns the character with a ledger cross-check", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const id = await createCharWithGold(`gold-${stamp}`, 137);

    const res = await app.inject({ method: "GET", url: `/api/character/${id}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      character: { gold: number };
      ledger: { goldSum: number; matchesBalance: boolean };
    };
    expect(body.character.gold).toBe(137);
    expect(body.ledger.goldSum).toBe(137);
    expect(body.ledger.matchesBalance).toBe(true);
  });

  it("404s for an unknown character id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/character/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });
});
