-- 0002_characters.sql
-- Characters, their skills, their inventory, and the append-only ledger
-- that backs every gold/XP/item mutation (Rule R5).

CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  zone TEXT NOT NULL DEFAULT 'mainland',
  col INT NOT NULL DEFAULT 1,
  "row" INT NOT NULL DEFAULT 1,
  hp INT NOT NULL DEFAULT 10,
  hp_max INT NOT NULL DEFAULT 10,
  gold BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE character_skills (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  PRIMARY KEY (character_id, skill_id)
);

CREATE TABLE character_inventory (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (character_id, item_kind)
);

CREATE TABLE ledger (
  id BIGSERIAL PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,            -- 'gold' | 'xp' | 'item'
  subkind TEXT,                  -- skill_id for 'xp', item_kind for 'item', NULL for 'gold'
  delta BIGINT NOT NULL,         -- change applied (can be negative)
  balance_after BIGINT NOT NULL, -- for 'gold' this is gold balance, for 'xp' it's xp total, for 'item' it's the new qty
  reason TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ledger_character_id_ts_idx ON ledger(character_id, ts DESC);
CREATE INDEX ledger_kind_idx ON ledger(kind);
