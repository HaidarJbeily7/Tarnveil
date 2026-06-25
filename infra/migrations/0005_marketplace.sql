-- 0005_marketplace.sql
-- Player marketplace: gold-priced listings with system escrow.
-- A row in 'active' state is the item being held by the system on behalf
-- of the seller. Buying transitions it to 'sold' atomically.

CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  total_price BIGINT NOT NULL CHECK (total_price > 0),
  status TEXT NOT NULL CHECK (status IN ('active','sold','cancelled')) DEFAULT 'active',
  listed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_to UUID REFERENCES characters(id) ON DELETE SET NULL,
  sold_at TIMESTAMPTZ
);

CREATE INDEX market_active_idx ON marketplace_listings(item_kind) WHERE status = 'active';
CREATE INDEX market_seller_idx ON marketplace_listings(seller_id);
