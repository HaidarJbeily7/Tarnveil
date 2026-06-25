import { and, eq, sql } from "drizzle-orm";
import {
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

  async savePosition(characterId: string, col: number, row: number, zone: string): Promise<void> {
    await this.db
      .update(characters)
      .set({ col, row, zone, updatedAt: sql`now()` })
      .where(eq(characters.id, characterId));
  }

  async countLedgerEntries(characterId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(ledger)
      .where(eq(ledger.characterId, characterId));
    return row?.n ?? 0;
  }
}
