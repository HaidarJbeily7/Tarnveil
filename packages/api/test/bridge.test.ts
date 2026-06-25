import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { inArray, eq } from "drizzle-orm";
import { bridgeListings, characters } from "@tarnveil/shared/db";
import { closeDb, getDb } from "../src/db.js";
import {
  settleBridgeListing,
  setBridgeVerifier,
  TREASURY_BPS,
  TOTAL_BPS,
} from "../src/crypto/bridge.js";

const createdNames: string[] = [];
const createdIds: string[] = [];

async function seedChar(name: string, gold = 0): Promise<string> {
  const db = getDb();
  createdNames.push(name);
  const [c] = await db.insert(characters).values({ name, gold }).returning();
  if (!c) throw new Error("char insert failed");
  createdIds.push(c.id);
  return c.id;
}

async function seedListing(sellerId: string, goldQty: number, totalToken: number): Promise<string> {
  const db = getDb();
  const [l] = await db
    .insert(bridgeListings)
    .values({ sellerId, goldQty, totalTokenAmount: totalToken })
    .returning();
  if (!l) throw new Error("listing insert failed");
  return l.id;
}

describe("bridge settlement (6.3, devnet/mock)", () => {
  beforeAll(async () => {
    // Reset to a default verifier; tests override per case.
    setBridgeVerifier(async () => ({
      confirmed: false,
      sellerReceived: 0,
      treasuryReceived: 0,
    }));
  });

  afterAll(async () => {
    const db = getDb();
    if (createdIds.length > 0) {
      await db.delete(bridgeListings).where(inArray(bridgeListings.sellerId, createdIds));
    }
    if (createdNames.length > 0) {
      await db.delete(characters).where(inArray(characters.name, createdNames));
    }
    await closeDb();
  });

  beforeEach(() => {
    setBridgeVerifier(async () => ({
      confirmed: false,
      sellerReceived: 0,
      treasuryReceived: 0,
    }));
  });

  it("does not credit gold when the on-chain tx isn't confirmed", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`br-seller-${stamp}`, 0);
    const buyer = await seedChar(`br-buyer-${stamp}`, 0);
    const total = 1000;
    const listingId = await seedListing(seller, 100, total);

    setBridgeVerifier(async () => ({
      confirmed: false,
      sellerReceived: 0,
      treasuryReceived: 0,
    }));

    const result = await settleBridgeListing(getDb(), listingId, buyer, "fake-sig");
    expect(result).toEqual({ ok: false, reason: "tx-not-confirmed" });

    const db = getDb();
    const [buyerRow] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyer));
    expect(buyerRow?.gold).toBe(0);
    const [l] = await db
      .select()
      .from(bridgeListings)
      .where(eq(bridgeListings.id, listingId));
    expect(l?.status).toBe("pending");
  });

  it("rejects a confirmed tx with the wrong split", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`br-bad-${stamp}`, 0);
    const buyer = await seedChar(`br-bad-b-${stamp}`, 0);
    const total = 1000;
    const listingId = await seedListing(seller, 100, total);

    setBridgeVerifier(async () => ({
      confirmed: true,
      sellerReceived: 900, // missing 50 to seller
      treasuryReceived: 50,
    }));
    const result = await settleBridgeListing(getDb(), listingId, buyer, "fake-sig");
    expect(result.ok).toBe(false);
    expect("reason" in result && result.reason).toBe("bad-seller-split");

    const db = getDb();
    const [buyerRow] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyer));
    expect(buyerRow?.gold).toBe(0);
  });

  it("credits gold only after on-chain confirmation with the exact 95/5 split", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seller = await seedChar(`br-ok-${stamp}`, 0);
    const buyer = await seedChar(`br-ok-b-${stamp}`, 0);
    const total = 1000;
    const expectedTreasury = Math.floor((total * TREASURY_BPS) / TOTAL_BPS);
    const expectedSeller = total - expectedTreasury;
    const listingId = await seedListing(seller, 100, total);

    setBridgeVerifier(async () => ({
      confirmed: true,
      sellerReceived: expectedSeller,
      treasuryReceived: expectedTreasury,
    }));

    const result = await settleBridgeListing(getDb(), listingId, buyer, "real-sig");
    expect(result).toEqual({ ok: true, goldCredited: 100 });

    const db = getDb();
    const [buyerRow] = await db
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyer));
    expect(buyerRow?.gold).toBe(100);
    const [l] = await db
      .select()
      .from(bridgeListings)
      .where(eq(bridgeListings.id, listingId));
    expect(l?.status).toBe("settled");
    expect(l?.txSignature).toBe("real-sig");
  });
});
