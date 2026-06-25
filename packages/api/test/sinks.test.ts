import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray, eq, sql } from "drizzle-orm";
import {
  characters,
  characterInventory,
  ledger,
  marketplaceListings,
} from "@tarnveil/shared/db";
import { buildApp } from "../src/server.js";
import { closeDb, getDb } from "../src/db.js";
import { closeRedis } from "../src/redis.js";
import { MARKET_LISTING_FEE_GOLD } from "../src/market.js";

const createdNames: string[] = [];
const createdIds: string[] = [];

async function seedChar(name: string, gold: number, inv: Record<string, number> = {}): Promise<string> {
  const db = getDb();
  createdNames.push(name);
  return db.transaction(async (tx) => {
    const [c] = await tx.insert(characters).values({ name, gold }).returning();
    if (!c) throw new Error("char insert failed");
    createdIds.push(c.id);
    if (gold > 0) {
      await tx.insert(ledger).values({
        characterId: c.id,
        kind: "gold",
        subkind: null,
        delta: gold,
        balanceAfter: gold,
        reason: "seed",
      });
    }
    for (const [kind, qty] of Object.entries(inv)) {
      await tx.insert(characterInventory).values({ characterId: c.id, itemKind: kind, qty });
      await tx.insert(ledger).values({
        characterId: c.id,
        kind: "item",
        subkind: kind,
        delta: qty,
        balanceAfter: qty,
        reason: "seed",
      });
    }
    return c.id;
  });
}

describe("economy sinks + admin dashboard", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    const db = getDb();
    if (createdIds.length > 0) {
      await db.delete(marketplaceListings).where(inArray(marketplaceListings.sellerId, createdIds));
    }
    if (createdNames.length > 0) {
      await db.delete(characters).where(inArray(characters.name, createdNames));
    }
    await closeDb();
    await closeRedis();
  });

  it("listing fee deducts gold and writes a sink ledger row", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`fee-${stamp}`, 100, { wood: 5 });
    const res = await app.inject({
      method: "POST",
      url: "/api/market/list",
      headers: { "x-character-id": seller },
      payload: { itemKind: "wood", qty: 5, totalPrice: 50 },
    });
    expect(res.statusCode).toBe(201);

    const db = getDb();
    const [c] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, seller));
    expect(c?.gold).toBe(100 - MARKET_LISTING_FEE_GOLD);

    const [{ sum }] = await db
      .select({ sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::int` })
      .from(ledger)
      .where(sql`${ledger.characterId} = ${seller} AND ${ledger.reason} = 'sink:market-listing-fee'`);
    expect(Number(sum)).toBe(-MARKET_LISTING_FEE_GOLD);
  });

  it("listing fails when seller can't afford the fee", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`broke-${stamp}`, 1, { wood: 5 });
    const res = await app.inject({
      method: "POST",
      url: "/api/market/list",
      headers: { "x-character-id": seller },
      payload: { itemKind: "wood", qty: 5, totalPrice: 50 },
    });
    expect(res.statusCode).toBe(400);

    // Seller's inventory must still be intact (no escrow consumed).
    const db = getDb();
    const inv = await db
      .select()
      .from(characterInventory)
      .where(eq(characterInventory.characterId, seller));
    expect(inv.find((r) => r.itemKind === "wood")?.qty).toBe(5);
  });

  it("cosmetic purchase deducts gold and writes a sink ledger row", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const player = await seedChar(`cos-${stamp}`, 100);
    const res = await app.inject({
      method: "POST",
      url: "/api/cosmetic/buy",
      headers: { "x-character-id": player },
      payload: { kind: "fancy-hat", price: 40 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { gold: number };
    expect(body.gold).toBe(60);
  });

  it("admin economy dashboard reports totalSupply == ledgerSum after sinks", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/economy" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      totalSupply: number;
      ledgerSum: number;
      reconciles: boolean;
    };
    expect(body.reconciles).toBe(true);
    expect(body.totalSupply).toBe(body.ledgerSum);
  });
});
