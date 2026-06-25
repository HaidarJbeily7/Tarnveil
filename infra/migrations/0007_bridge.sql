-- 0007_bridge.sql
-- Gold↔token bridge listings. The seller's gold is escrowed in the row at
-- list time; settlement requires a server-verified on-chain payment from the
-- buyer's wallet that splits 95 % to the seller wallet and 5 % to treasury.

CREATE TABLE bridge_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  gold_qty BIGINT NOT NULL CHECK (gold_qty > 0),
  total_token_amount BIGINT NOT NULL CHECK (total_token_amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending','settled','cancelled')) DEFAULT 'pending',
  listed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_to UUID REFERENCES characters(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ,
  tx_signature TEXT
);

CREATE INDEX bridge_active_idx ON bridge_listings(status) WHERE status = 'pending';
