import { and, eq, sql } from "drizzle-orm";
import {
  bankItems,
  characterInventory,
  characterSkills,
  characters,
  ledger,
  type Character,
  type InventoryRow,
} from "@tarnveil/shared/db";
import { ALL_SKILLS, xpToLevel, type SkillId } from "@tarnveil/shared";
import type { DrizzleDB } from "./db.js";

export interface InventoryItem {
  kind: string;
  qty: number;
}

export interface SkillState {
  xp: number;
  level: number;
}

export class CharacterStore {
  constructor(private readonly db: DrizzleDB) {}

  async loadOrCreateByName(name: string): Promise<Character> {
    const existing = await this.db
      .select()
      .from(characters)
      .where(eq(characters.name, name))
      .limit(1);
    if (existing[0]) return existing[0];
    const [row] = await this.db.insert(characters).values({ name }).returning();
    if (!row) throw new Error("failed to insert character");
    return row;
  }

  async getInventory(characterId: string): Promise<InventoryItem[]> {
    const rows: InventoryRow[] = await this.db
      .select()
      .from(characterInventory)
      .where(eq(characterInventory.characterId, characterId));
    return rows.map((r) => ({ kind: r.itemKind, qty: r.qty }));
  }

  /**
   * Add `delta` of `kind` to the character's inventory and record a single
   * ledger row for the change. Use a negative `delta` to remove. Throws if
   * the result would go negative (we never let qty drop below zero).
   */
  async addItem(
    characterId: string,
    kind: string,
    delta: number,
    reason: string,
  ): Promise<number> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error("delta must be a non-zero integer");
    }
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(characterInventory)
        .where(
          and(
            eq(characterInventory.characterId, characterId),
            eq(characterInventory.itemKind, kind),
          ),
        )
        .for("update");

      const before = existing?.qty ?? 0;
      const after = before + delta;
      if (after < 0) throw new Error(`inventory underflow on ${kind}`);

      if (existing) {
        await tx
          .update(characterInventory)
          .set({ qty: after })
          .where(
            and(
              eq(characterInventory.characterId, characterId),
              eq(characterInventory.itemKind, kind),
            ),
          );
      } else {
        await tx
          .insert(characterInventory)
          .values({ characterId, itemKind: kind, qty: after });
      }

      await tx.insert(ledger).values({
        characterId,
        kind: "item",
        subkind: kind,
        delta,
        balanceAfter: after,
        reason,
      });

      return after;
    });
  }

  async getSkills(characterId: string): Promise<Record<SkillId, SkillState>> {
    const rows = await this.db
      .select()
      .from(characterSkills)
      .where(eq(characterSkills.characterId, characterId));
    const result: Record<SkillId, SkillState> = {
      combat: { xp: 0, level: 1 },
      woodcutting: { xp: 0, level: 1 },
      mining: { xp: 0, level: 1 },
      fishing: { xp: 0, level: 1 },
      cooking: { xp: 0, level: 1 },
    };
    for (const r of rows) {
      if ((ALL_SKILLS as readonly string[]).includes(r.skillId)) {
        result[r.skillId as SkillId] = { xp: r.xp, level: r.level };
      }
    }
    return result;
  }

  /**
   * Award (or remove) XP for a skill. XP is server-side only (R1/R7).
   * Returns the new {xp, level} after applying the delta and the level cap.
   * Writes one ledger row per call (R5).
   */
  async addXp(
    characterId: string,
    skillId: SkillId,
    delta: number,
    reason: string,
  ): Promise<SkillState> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error("xp delta must be a non-zero integer");
    }
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(characterSkills)
        .where(
          and(
            eq(characterSkills.characterId, characterId),
            eq(characterSkills.skillId, skillId),
          ),
        )
        .for("update");

      const beforeXp = existing?.xp ?? 0;
      const afterXp = Math.max(0, beforeXp + delta);
      const afterLevel = xpToLevel(afterXp);

      if (existing) {
        await tx
          .update(characterSkills)
          .set({ xp: afterXp, level: afterLevel })
          .where(
            and(
              eq(characterSkills.characterId, characterId),
              eq(characterSkills.skillId, skillId),
            ),
          );
      } else {
        await tx.insert(characterSkills).values({
          characterId,
          skillId,
          xp: afterXp,
          level: afterLevel,
        });
      }

      await tx.insert(ledger).values({
        characterId,
        kind: "xp",
        subkind: skillId,
        delta,
        balanceAfter: afterXp,
        reason,
      });

      return { xp: afterXp, level: afterLevel };
    });
  }

  async getBankPage(characterId: string, page: number): Promise<InventoryItem[]> {
    const rows = await this.db
      .select()
      .from(bankItems)
      .where(
        and(eq(bankItems.characterId, characterId), eq(bankItems.page, page)),
      );
    return rows.map((r) => ({ kind: r.itemKind, qty: r.qty }));
  }

  /**
   * Move `qty` of `kind` from inventory to the given bank page. Runs as a
   * single transaction so a failure leaves both sides untouched (no dup,
   * no loss). Writes two ledger rows: an item-out from inventory and an
   * item-in to the bank.
   */
  async depositToBank(
    characterId: string,
    kind: string,
    qty: number,
    page: number,
    reason: string,
  ): Promise<{ inventoryQty: number; bankQty: number }> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("deposit qty must be a positive integer");
    }
    if (!Number.isInteger(page) || page < 0) {
      throw new Error("page must be a non-negative integer");
    }
    return this.db.transaction(async (tx) => {
      const [invRow] = await tx
        .select()
        .from(characterInventory)
        .where(
          and(
            eq(characterInventory.characterId, characterId),
            eq(characterInventory.itemKind, kind),
          ),
        )
        .for("update");
      const have = invRow?.qty ?? 0;
      if (have < qty) throw new Error(`insufficient inventory: have ${have}, need ${qty}`);
      const invAfter = have - qty;
      if (invAfter === 0 && invRow) {
        await tx
          .delete(characterInventory)
          .where(
            and(
              eq(characterInventory.characterId, characterId),
              eq(characterInventory.itemKind, kind),
            ),
          );
      } else if (invRow) {
        await tx
          .update(characterInventory)
          .set({ qty: invAfter })
          .where(
            and(
              eq(characterInventory.characterId, characterId),
              eq(characterInventory.itemKind, kind),
            ),
          );
      }

      const [bankRow] = await tx
        .select()
        .from(bankItems)
        .where(
          and(
            eq(bankItems.characterId, characterId),
            eq(bankItems.page, page),
            eq(bankItems.itemKind, kind),
          ),
        )
        .for("update");
      const bankBefore = bankRow?.qty ?? 0;
      const bankAfter = bankBefore + qty;
      if (bankRow) {
        await tx
          .update(bankItems)
          .set({ qty: bankAfter })
          .where(
            and(
              eq(bankItems.characterId, characterId),
              eq(bankItems.page, page),
              eq(bankItems.itemKind, kind),
            ),
          );
      } else {
        await tx
          .insert(bankItems)
          .values({ characterId, page, itemKind: kind, qty: bankAfter });
      }

      // Two ledger rows: out of inventory and into bank.
      await tx.insert(ledger).values([
        {
          characterId,
          kind: "item",
          subkind: kind,
          delta: -qty,
          balanceAfter: invAfter,
          reason: `bank-deposit:inv:${reason}`,
        },
        {
          characterId,
          kind: "item",
          subkind: kind,
          delta: qty,
          balanceAfter: bankAfter,
          reason: `bank-deposit:bank:page=${page}:${reason}`,
        },
      ]);

      return { inventoryQty: invAfter, bankQty: bankAfter };
    });
  }

  async withdrawFromBank(
    characterId: string,
    kind: string,
    qty: number,
    page: number,
    reason: string,
  ): Promise<{ inventoryQty: number; bankQty: number }> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("withdraw qty must be a positive integer");
    }
    if (!Number.isInteger(page) || page < 0) {
      throw new Error("page must be a non-negative integer");
    }
    return this.db.transaction(async (tx) => {
      const [bankRow] = await tx
        .select()
        .from(bankItems)
        .where(
          and(
            eq(bankItems.characterId, characterId),
            eq(bankItems.page, page),
            eq(bankItems.itemKind, kind),
          ),
        )
        .for("update");
      const have = bankRow?.qty ?? 0;
      if (have < qty) throw new Error(`insufficient bank: have ${have}, need ${qty}`);
      const bankAfter = have - qty;
      if (bankAfter === 0 && bankRow) {
        await tx
          .delete(bankItems)
          .where(
            and(
              eq(bankItems.characterId, characterId),
              eq(bankItems.page, page),
              eq(bankItems.itemKind, kind),
            ),
          );
      } else if (bankRow) {
        await tx
          .update(bankItems)
          .set({ qty: bankAfter })
          .where(
            and(
              eq(bankItems.characterId, characterId),
              eq(bankItems.page, page),
              eq(bankItems.itemKind, kind),
            ),
          );
      }

      const [invRow] = await tx
        .select()
        .from(characterInventory)
        .where(
          and(
            eq(characterInventory.characterId, characterId),
            eq(characterInventory.itemKind, kind),
          ),
        )
        .for("update");
      const invBefore = invRow?.qty ?? 0;
      const invAfter = invBefore + qty;
      if (invRow) {
        await tx
          .update(characterInventory)
          .set({ qty: invAfter })
          .where(
            and(
              eq(characterInventory.characterId, characterId),
              eq(characterInventory.itemKind, kind),
            ),
          );
      } else {
        await tx
          .insert(characterInventory)
          .values({ characterId, itemKind: kind, qty: invAfter });
      }

      await tx.insert(ledger).values([
        {
          characterId,
          kind: "item",
          subkind: kind,
          delta: -qty,
          balanceAfter: bankAfter,
          reason: `bank-withdraw:bank:page=${page}:${reason}`,
        },
        {
          characterId,
          kind: "item",
          subkind: kind,
          delta: qty,
          balanceAfter: invAfter,
          reason: `bank-withdraw:inv:${reason}`,
        },
      ]);

      return { inventoryQty: invAfter, bankQty: bankAfter };
    });
  }

  async savePosition(characterId: string, col: number, row: number, zone: string): Promise<void> {
    await this.db
      .update(characters)
      .set({ col, row, zone, updatedAt: sql`now()` })
      .where(eq(characters.id, characterId));
  }

  /**
   * Atomic merchant buy: pay `totalCost` gold, receive `qty` of `kind`.
   * One transaction, two ledger rows (gold out + item in). Throws if the
   * player can't afford it; state is untouched on failure.
   */
  async buyFromMerchant(
    characterId: string,
    kind: string,
    qty: number,
    totalCost: number,
    reason: string,
  ): Promise<{ gold: number; inventoryQty: number }> {
    if (!Number.isInteger(qty) || qty <= 0) throw new Error("qty must be > 0");
    if (!Number.isInteger(totalCost) || totalCost < 0) {
      throw new Error("totalCost must be a non-negative integer");
    }
    return this.db.transaction(async (tx) => {
      const [c] = await tx
        .select({ gold: characters.gold })
        .from(characters)
        .where(eq(characters.id, characterId))
        .for("update");
      if (!c) throw new Error("character not found");
      if (c.gold < totalCost) throw new Error("insufficient gold");
      const goldAfter = c.gold - totalCost;
      await tx
        .update(characters)
        .set({ gold: goldAfter, updatedAt: sql`now()` })
        .where(eq(characters.id, characterId));
      await tx.insert(ledger).values({
        characterId,
        kind: "gold",
        subkind: null,
        delta: -totalCost,
        balanceAfter: goldAfter,
        reason: `merchant-buy:${reason}`,
      });

      const [inv] = await tx
        .select()
        .from(characterInventory)
        .where(
          and(
            eq(characterInventory.characterId, characterId),
            eq(characterInventory.itemKind, kind),
          ),
        )
        .for("update");
      const after = (inv?.qty ?? 0) + qty;
      if (inv) {
        await tx
          .update(characterInventory)
          .set({ qty: after })
          .where(
            and(
              eq(characterInventory.characterId, characterId),
              eq(characterInventory.itemKind, kind),
            ),
          );
      } else {
        await tx
          .insert(characterInventory)
          .values({ characterId, itemKind: kind, qty: after });
      }
      await tx.insert(ledger).values({
        characterId,
        kind: "item",
        subkind: kind,
        delta: qty,
        balanceAfter: after,
        reason: `merchant-buy:${reason}`,
      });

      return { gold: goldAfter, inventoryQty: after };
    });
  }

  /**
   * Atomic merchant sell: hand over `qty` of `kind`, receive `totalRevenue`
   * gold. Throws if the player doesn't have enough of the item; state is
   * untouched on failure.
   */
  async sellToMerchant(
    characterId: string,
    kind: string,
    qty: number,
    totalRevenue: number,
    reason: string,
  ): Promise<{ gold: number; inventoryQty: number }> {
    if (!Number.isInteger(qty) || qty <= 0) throw new Error("qty must be > 0");
    if (!Number.isInteger(totalRevenue) || totalRevenue < 0) {
      throw new Error("totalRevenue must be a non-negative integer");
    }
    return this.db.transaction(async (tx) => {
      const [inv] = await tx
        .select()
        .from(characterInventory)
        .where(
          and(
            eq(characterInventory.characterId, characterId),
            eq(characterInventory.itemKind, kind),
          ),
        )
        .for("update");
      const have = inv?.qty ?? 0;
      if (have < qty) throw new Error(`insufficient ${kind}`);
      const after = have - qty;
      if (after === 0 && inv) {
        await tx
          .delete(characterInventory)
          .where(
            and(
              eq(characterInventory.characterId, characterId),
              eq(characterInventory.itemKind, kind),
            ),
          );
      } else if (inv) {
        await tx
          .update(characterInventory)
          .set({ qty: after })
          .where(
            and(
              eq(characterInventory.characterId, characterId),
              eq(characterInventory.itemKind, kind),
            ),
          );
      }
      await tx.insert(ledger).values({
        characterId,
        kind: "item",
        subkind: kind,
        delta: -qty,
        balanceAfter: after,
        reason: `merchant-sell:${reason}`,
      });

      const [c] = await tx
        .select({ gold: characters.gold })
        .from(characters)
        .where(eq(characters.id, characterId))
        .for("update");
      if (!c) throw new Error("character not found");
      const goldAfter = c.gold + totalRevenue;
      await tx
        .update(characters)
        .set({ gold: goldAfter, updatedAt: sql`now()` })
        .where(eq(characters.id, characterId));
      await tx.insert(ledger).values({
        characterId,
        kind: "gold",
        subkind: null,
        delta: totalRevenue,
        balanceAfter: goldAfter,
        reason: `merchant-sell:${reason}`,
      });

      return { gold: goldAfter, inventoryQty: after };
    });
  }

  async addGold(
    characterId: string,
    delta: number,
    reason: string,
  ): Promise<number> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error("gold delta must be a non-zero integer");
    }
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ gold: characters.gold })
        .from(characters)
        .where(eq(characters.id, characterId))
        .for("update");
      if (!row) throw new Error("character not found");
      const after = row.gold + delta;
      if (after < 0) throw new Error("gold underflow");
      await tx
        .update(characters)
        .set({ gold: after, updatedAt: sql`now()` })
        .where(eq(characters.id, characterId));
      await tx.insert(ledger).values({
        characterId,
        kind: "gold",
        subkind: null,
        delta,
        balanceAfter: after,
        reason,
      });
      return after;
    });
  }

  async countLedgerEntries(characterId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(ledger)
      .where(eq(ledger.characterId, characterId));
    return row?.n ?? 0;
  }
}
