-- 0004_social.sql
-- Friends graph. Insert (requester, target, 'pending') on /friends/request,
-- update to 'accepted' on /friends/accept. Friend lists union both directions.

CREATE TABLE friends (
  requester_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, target_id),
  CHECK (requester_id <> target_id)
);

CREATE INDEX friends_target_status_idx ON friends(target_id, status);
