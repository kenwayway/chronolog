-- Keep zaddy-authored observations visibly separate from user-authored facts,
-- while preserving Note and Session as the only persisted timeline entities.
ALTER TABLE notes
ADD COLUMN origin TEXT CHECK(origin IS NULL OR origin = 'zaddy');

ALTER TABLE sessions
ADD COLUMN origin TEXT CHECK(origin IS NULL OR origin = 'zaddy');

-- Open topic buffers are private workflow state. They never synchronize to
-- clients or project directly into the timeline.
CREATE TABLE IF NOT EXISTS zaddy_topic_buffers (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  first_observed_at INTEGER NOT NULL,
  last_observed_at INTEGER NOT NULL,
  observation_count INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  entity_type TEXT CHECK(entity_type IS NULL OR entity_type IN ('note', 'session')),
  entity_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zaddy_topic_buffers_open
ON zaddy_topic_buffers(status, last_observed_at);
