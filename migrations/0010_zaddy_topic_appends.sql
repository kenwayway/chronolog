-- Observation buffers used to hold one rewritten summary that grew with every
-- call. Keep the running log instead, and write the summary once at the end:
-- an entry's span then comes from when things happened, not from when the
-- summary was composed.
CREATE TABLE IF NOT EXISTS zaddy_topic_appends (
  id TEXT PRIMARY KEY,
  buffer_id TEXT NOT NULL,
  content TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zaddy_topic_appends_buffer
ON zaddy_topic_appends(buffer_id, observed_at);

-- In-flight buffers carry text that is now log material, not a summary.
INSERT INTO zaddy_topic_appends (id, buffer_id, content, observed_at, created_at)
SELECT 'migrated:' || id, id, content, last_observed_at, updated_at
FROM zaddy_topic_buffers
WHERE status = 'open' AND TRIM(content) <> '';

UPDATE zaddy_topic_buffers SET content = '' WHERE status = 'open';

-- `content` is now the summary slot, empty until the topic is finalized.
-- `last_append_at` only mirrors the newest append so the staleness sweep can
-- use an index; the appends table is the source of truth for time.
ALTER TABLE zaddy_topic_buffers RENAME COLUMN last_observed_at TO last_append_at;

-- Both are derivable from the appends table: MIN(observed_at) and COUNT(*).
ALTER TABLE zaddy_topic_buffers DROP COLUMN first_observed_at;
ALTER TABLE zaddy_topic_buffers DROP COLUMN observation_count;
