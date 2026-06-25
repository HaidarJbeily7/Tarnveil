import { eq, sql } from "drizzle-orm";
import { bridgeListings, characters, ledger } from "@tarnveil/shared/db";
import type { DrizzleDB } from "../db.js";

export const TREASURY_BPS = 500; // 5.00 %
export const TOTAL_BPS = 10_000;

export interface BridgeTxResult {
  confirmed: boolean;
  sellerReceived: number;
  treasuryReceived: number;
}

export type BridgeVerifier = (txSignature: string) => Promise<BridgeTxResult>;

let verifier: BridgeVerifier = async () => ({
  confirmed: false,
  sellerReceived: 0,
  treasuryReceived: 0,
});

export function setBridgeVerifier(fn: BridgeVerifier): void {
  verifier = fn;
}

export type SettleResult =
  | { ok: true; goldCredited: number }
  | { ok: false; reason: string };

export async function settleBridgeListing(
  db: DrizzleDB,
  listingId: string,
  buyerId: string,
  txSignature: string,
): Promise<SettleResult> {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(bridgeListings)
      .where(eq(bridgeListings.id, listingId))
      .for("update");
    if (!listing) return { ok: false as const, reason: "not-found" };
    if (listing.status !== "pending") {
      return { ok: false as const, reason: "not-pending" };
    }

    // Server-verified on-chain confirmation. Verifier returns the parsed
    // split observed in the transaction — failing any check rolls back.
    const verified = await verifier(txSignature);
    if (!verified.confirmed) {
      return { ok: false as const, reason: "tx-not-confirmed" };
    }
    const expectedTreasury = Math.floor(
      (listing.totalTokenAmount * TREASURY_BPS) / TOTAL_BPS,
    );
    const expectedSeller = listing.totalTokenAmount - expectedTreasury;
    if (verified.treasuryReceived !== expectedTreasury) {
      return { ok: false as const, reason: "bad-treasury-split" };
    }
    if (verified.sellerReceived !== expectedSeller) {
      return { ok: false as const, reason: "bad-seller-split" };
    }

    // On-chain checks all passed. Credit the buyer's gold balance off-chain.
    const [buyer] = await tx
      .select({ gold: characters.gold })
      .from(characters)
      .where(eq(characters.id, buyerId))
      .for("update");
    if (!buyer) return { ok: false as const, reason: "no-buyer" };
    const buyerGoldAfter = buyer.gold + listing.goldQty;
    await tx
      .update(characters)
      .set({ gold: buyerGoldAfter, updatedAt: sql`now()` })
      .where(eq(characters.id, buyerId));
    await tx.insert(ledger).values({
      characterId: buyerId,
      kind: "gold",
      subkind: null,
      delta: listing.goldQty,
      balanceAfter: buyerGoldAfter,
      reason: `bridge-buy:${listing.id}`,
    });

    await tx
      .update(bridgeListings)
      .set({
        status: "settled",
        settledTo: buyerId,
        settledAt: sql`now()`,
        txSignature,
      })
      .where(eq(bridgeListings.id, listing.id));

    return { ok: true as const, goldCredited: listing.goldQty };
  });
}
