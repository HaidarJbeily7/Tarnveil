-- 0006_quests.sql
-- Per-character daily quest progress. Resets when last_reset_at is more
-- than 24 hours behind now() (server-side check, not a cron).

CREATE TABLE character_quests (
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, quest_id)
);
