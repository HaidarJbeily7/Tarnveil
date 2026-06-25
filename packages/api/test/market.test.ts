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

const createdNames: string[] = [];
const createdIds: string[] = [];

async function seedChar(name: string, gold = 0, inv: Record<string, number> = {}): Promise<string> {
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

describe("player marketplace", () => {
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

  it("listing escrows the item; buying transfers gold and item atomically", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`seller-${stamp}`, 0, { wood: 5 });
    const buyer = await seedChar(`buyer-${stamp}`, 100, {});

    const listRes = await app.inject({
      method: "POST",
      url: "/api/market/list",
      headers: { "x-character-id": seller },
      payload: { itemKind: "wood", qty: 5, totalPrice: 50 },
    });
    expect(listRes.statusCode).toBe(201);
    const { listingId } = JSON.parse(listRes.body) as { listingId: string };

    // Seller's inventory is fully escrowed.
    const db = getDb();
    const sellerInv = await db
      .select()
      .from(characterInventory)
      .where(eq(characterInventory.characterId, seller));
    expect(sellerInv.find((r) => r.itemKind === "wood")).toBeUndefined();

    const browseRes = await app.inject({ method: "GET", url: "/api/market" });
    expect(browseRes.headers["cache-control"]).toBe("public, max-age=2");
    const listings = JSON.parse(browseRes.body).listings as Array<{ id: string; qty: number }>;
    expect(listings.find((l) => l.id === listingId)?.qty).toBe(5);

    const buyRes = await app.inject({
      method: "POST",
      url: `/api/market/buy/${listingId}`,
      headers: { "x-character-id": buyer },
    });
    expect(buyRes.statusCode).toBe(200);

    // Buyer has +5 wood, -50 gold; seller has +50 gold.
    const [sellerRow] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, seller));
    const [buyerRow] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyer));
    expect(sellerRow?.gold).toBe(50);
    expect(buyerRow?.gold).toBe(50);

    const buyerInv = await db
      .select()
      .from(characterInventory)
      .where(eq(characterInventory.characterId, buyer));
    expect(buyerInv.find((r) => r.itemKind === "wood")?.qty).toBe(5);

    // R5: ledger sums match live balances for both parties.
    const [{ sum: sellerGoldSum }] = await db
      .select({ sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::int` })
      .from(ledger)
      .where(sql`${ledger.characterId} = ${seller} AND ${ledger.kind} = 'gold'`);
    const [{ sum: buyerGoldSum }] = await db
      .select({ sum: sql<number>`coalesce(sum(${ledger.delta}), 0)::int` })
      .from(ledger)
      .where(sql`${ledger.characterId} = ${buyer} AND ${ledger.kind} = 'gold'`);
    expect(Number(sellerGoldSum)).toBe(50);
    expect(Number(buyerGoldSum)).toBe(50);
  });

  it("a second buy on the same listing fails with 409 and leaves state untouched", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`s-dup-${stamp}`, 0, { wood: 1 });
    const buyer1 = await seedChar(`b1-dup-${stamp}`, 100, {});
    const buyer2 = await seedChar(`b2-dup-${stamp}`, 100, {});

    const listRes = await app.inject({
      method: "POST",
      url: "/api/market/list",
      headers: { "x-character-id": seller },
      payload: { itemKind: "wood", qty: 1, totalPrice: 10 },
    });
    const { listingId } = JSON.parse(listRes.body) as { listingId: string };

    const ok = await app.inject({
      method: "POST",
      url: `/api/market/buy/${listingId}`,
      headers: { "x-character-id": buyer1 },
    });
    expect(ok.statusCode).toBe(200);
    const dup = await app.inject({
      method: "POST",
      url: `/api/market/buy/${listingId}`,
      headers: { "x-character-id": buyer2 },
    });
    expect(dup.statusCode).toBe(409);

    // buyer2 is unchanged: still 100g and zero wood.
    const db = getDb();
    const [buyer2Row] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyer2));
    expect(buyer2Row?.gold).toBe(100);
    const buyer2Inv = await db
      .select()
      .from(characterInventory)
      .where(eq(characterInventory.characterId, buyer2));
    expect(buyer2Inv.find((r) => r.itemKind === "wood")).toBeUndefined();
  });

  it("insufficient gold rejects the buy with 402, leaving listing active", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`s-broke-${stamp}`, 0, { wood: 1 });
    const buyer = await seedChar(`b-broke-${stamp}`, 5, {});

    const listRes = await app.inject({
      method: "POST",
      url: "/api/market/list",
      headers: { "x-character-id": seller },
      payload: { itemKind: "wood", qty: 1, totalPrice: 100 },
    });
    const { listingId } = JSON.parse(listRes.body) as { listingId: string };
    const res = await app.inject({
      method: "POST",
      url: `/api/market/buy/${listingId}`,
      headers: { "x-character-id": buyer },
    });
    expect(res.statusCode).toBe(402);

    const db = getDb();
    const [listing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listingId));
    expect(listing?.status).toBe("active");
    const [buyerRow] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyer));
    expect(buyerRow?.gold).toBe(5);
  });
});
