import { and, eq, sql } from "drizzle-orm";
import {
  characterInventory,
  characters,
  ledger,
  marketplaceListings,
} from "@tarnveil/shared/db";
import type { DrizzleDB } from "./db.js";

export interface ListInput {
  sellerId: string;
  itemKind: string;
  qty: number;
  totalPrice: number;
}

/** Listing fee in gold deducted from the seller at list time (R-sink). */
export const MARKET_LISTING_FEE_GOLD = 5;

export async function createListing(
  db: DrizzleDB,
  input: ListInput,
): Promise<{ id: string }> {
  const { sellerId, itemKind, qty, totalPrice } = input;
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("qty must be > 0");
  if (!Number.isInteger(totalPrice) || totalPrice <= 0) {
    throw new Error("totalPrice must be > 0");
  }
  return db.transaction(async (tx) => {
    // Sink: listing fee. Lock the seller's row and deduct before escrow.
    const [c] = await tx
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, sellerId))
      .for("update");
    if (!c) throw new Error("seller not found");
    if (c.gold < MARKET_LISTING_FEE_GOLD) {
      throw new Error("insufficient gold for listing fee");
    }
    const goldAfter = c.gold - MARKET_LISTING_FEE_GOLD;
    await tx
      .update(characters)
      .set({ gold: goldAfter, updatedAt: sql`now()` })
      .where(eq(characters.id, sellerId));
    await tx.insert(ledger).values({
      characterId: sellerId,
      kind: "gold",
      subkind: null,
      delta: -MARKET_LISTING_FEE_GOLD,
      balanceAfter: goldAfter,
      reason: "sink:market-listing-fee",
    });

    const [inv] = await tx
      .select()
      .from(characterInventory)
      .where(
        and(
          eq(characterInventory.characterId, sellerId),
          eq(characterInventory.itemKind, itemKind),
        ),
      )
      .for("update");
    const have = inv?.qty ?? 0;
    if (have < qty) throw new Error(`insufficient ${itemKind}: have ${have}, need ${qty}`);
    const after = have - qty;
    if (after === 0 && inv) {
      await tx
        .delete(characterInventory)
        .where(
          and(
            eq(characterInventory.characterId, sellerId),
            eq(characterInventory.itemKind, itemKind),
          ),
        );
    } else if (inv) {
      await tx
        .update(characterInventory)
        .set({ qty: after })
        .where(
          and(
            eq(characterInventory.characterId, sellerId),
            eq(characterInventory.itemKind, itemKind),
          ),
        );
    }
    await tx.insert(ledger).values({
      characterId: sellerId,
      kind: "item",
      subkind: itemKind,
      delta: -qty,
      balanceAfter: after,
      reason: "market-list",
    });
    const [listing] = await tx
      .insert(marketplaceListings)
      .values({ sellerId, itemKind, qty, totalPrice })
      .returning({ id: marketplaceListings.id });
    if (!listing) throw new Error("listing insert failed");
    return { id: listing.id };
  });
}

export async function buyListing(
  db: DrizzleDB,
  listingId: string,
  buyerId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listingId))
      .for("update");
    if (!listing) return { ok: false as const, reason: "not-found" };
    if (listing.status !== "active") {
      return { ok: false as const, reason: "not-active" };
    }
    if (listing.sellerId === buyerId) {
      return { ok: false as const, reason: "self-buy" };
    }

    // Move gold from buyer -> seller.
    const [buyer] = await tx
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyerId))
      .for("update");
    if (!buyer) return { ok: false as const, reason: "no-buyer" };
    if (buyer.gold < listing.totalPrice) {
      return { ok: false as const, reason: "insufficient-gold" };
    }
    const buyerGoldAfter = buyer.gold - listing.totalPrice;
    await tx
      .update(characters)
      .set({ gold: buyerGoldAfter, updatedAt: sql`now()` })
      .where(eq(characters.id, buyerId));
    await tx.insert(ledger).values({
      characterId: buyerId,
      kind: "gold",
      subkind: null,
      delta: -listing.totalPrice,
      balanceAfter: buyerGoldAfter,
      reason: `market-buy:${listing.id}`,
    });

    const [seller] = await tx
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, listing.sellerId))
      .for("update");
    if (!seller) return { ok: false as const, reason: "no-seller" };
    const sellerGoldAfter = seller.gold + listing.totalPrice;
    await tx
      .update(characters)
      .set({ gold: sellerGoldAfter, updatedAt: sql`now()` })
      .where(eq(characters.id, listing.sellerId));
    await tx.insert(ledger).values({
      characterId: listing.sellerId,
      kind: "gold",
      subkind: null,
      delta: listing.totalPrice,
      balanceAfter: sellerGoldAfter,
      reason: `market-sale:${listing.id}`,
    });

    // Move escrowed item to buyer's inventory.
    const [invRow] = await tx
      .select()
      .from(characterInventory)
      .where(
        and(
          eq(characterInventory.characterId, buyerId),
          eq(characterInventory.itemKind, listing.itemKind),
        ),
      )
      .for("update");
    const invAfter = (invRow?.qty ?? 0) + listing.qty;
    if (invRow) {
      await tx
        .update(characterInventory)
        .set({ qty: invAfter })
        .where(
          and(
            eq(characterInventory.characterId, buyerId),
            eq(characterInventory.itemKind, listing.itemKind),
          ),
        );
    } else {
      await tx
        .insert(characterInventory)
        .values({ characterId: buyerId, itemKind: listing.itemKind, qty: invAfter });
    }
    await tx.insert(ledger).values({
      characterId: buyerId,
      kind: "item",
      subkind: listing.itemKind,
      delta: listing.qty,
      balanceAfter: invAfter,
      reason: `market-buy:${listing.id}`,
    });

    // Finalize listing.
    await tx
      .update(marketplaceListings)
      .set({ status: "sold", soldTo: buyerId, soldAt: sql`now()` })
      .where(eq(marketplaceListings.id, listing.id));
    return { ok: true as const };
  });
}
