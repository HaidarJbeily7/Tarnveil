import {
  bigint,
  bigserial,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  zone: text("zone").notNull().default("mainland"),
  col: integer("col").notNull().default(1),
  row: integer("row").notNull().default(1),
  hp: integer("hp").notNull().default(10),
  hpMax: integer("hp_max").notNull().default(10),
  gold: bigint("gold", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const characterSkills = pgTable(
  "character_skills",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    skillId: text("skill_id").notNull(),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.characterId, t.skillId] }),
  }),
);

export const characterInventory = pgTable(
  "character_inventory",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    itemKind: text("item_kind").notNull(),
    qty: integer("qty").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.characterId, t.itemKind] }),
  }),
);

export const bankItems = pgTable(
  "bank_items",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    page: integer("page").notNull().default(0),
    itemKind: text("item_kind").notNull(),
    qty: integer("qty").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.characterId, t.page, t.itemKind] }),
    byPage: index("bank_items_character_id_page_idx").on(t.characterId, t.page),
  }),
);

export const ledger = pgTable(
  "ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    subkind: text("subkind"),
    delta: bigint("delta", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCharTs: index("ledger_character_id_ts_idx").on(t.characterId, t.ts),
    byKind: index("ledger_kind_idx").on(t.kind),
  }),
);

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type InventoryRow = typeof characterInventory.$inferSelect;
export type LedgerEntry = typeof ledger.$inferSelect;
