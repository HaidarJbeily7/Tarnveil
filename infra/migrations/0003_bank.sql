-- 0003_bank.sql
-- Multi-page bank storage. Each (character, page, item_kind) is a slot.

CREATE TABLE bank_items (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  page INT NOT NULL DEFAULT 0 CHECK (page >= 0),
  item_kind TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (character_id, page, item_kind)
);

CREATE INDEX bank_items_character_id_page_idx ON bank_items(character_id, page);
