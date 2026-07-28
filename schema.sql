-- ChronoLog D1 Schema
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  timestamp INTEGER NOT NULL,
  session_id TEXT,
  category TEXT,
  content_type TEXT DEFAULT 'note',
  field_values TEXT,          -- JSON string
  linked_items TEXT,          -- JSON array of Note/Session IDs
  tags TEXT,                  -- JSON array string
  origin TEXT CHECK(origin IS NULL OR origin = 'zaddy'),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notes_timestamp ON notes(timestamp);
CREATE INDEX IF NOT EXISTS idx_notes_session_id ON notes(session_id);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
CREATE INDEX IF NOT EXISTS idx_notes_content_type ON notes(content_type);
CREATE INDEX IF NOT EXISTS idx_notes_revision ON notes(revision);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  end_content TEXT,
  category TEXT,
  content_type TEXT DEFAULT 'note',
  field_values TEXT,
  linked_items TEXT,          -- JSON array of Note/Session IDs
  tags TEXT,
  end_tags TEXT,
  origin TEXT CHECK(origin IS NULL OR origin = 'zaddy'),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_start_at ON sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_sessions_end_at ON sessions(end_at);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON sessions(category);
CREATE INDEX IF NOT EXISTS idx_sessions_content_type ON sessions(content_type);
CREATE INDEX IF NOT EXISTS idx_sessions_revision ON sessions(revision);

-- Short-lived ambient-journaling state. Buffers are workflow records, not
-- timeline entities; finalization materializes one canonical Note or Session.
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

-- Content types table
CREATE TABLE IF NOT EXISTS content_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  fields TEXT NOT NULL DEFAULT '[]',   -- JSON array of FieldDefinition
  built_in INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0
);

-- Media items table
CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_type TEXT NOT NULL,
  notion_url TEXT,
  cover_url TEXT,
  spotify_url TEXT,
  created_at INTEGER NOT NULL,
  rating INTEGER,
  status TEXT,
  date_finished TEXT,
  notes TEXT,
  metadata TEXT,               -- JSON string for per-type fields
  revision INTEGER NOT NULL DEFAULT 0
);

-- Sync metadata (version tracking)
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Every client mutation gets one immutable, monotonically increasing revision.
-- The mutation_id makes retries idempotent.
CREATE TABLE IF NOT EXISTS sync_commits (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_id TEXT NOT NULL UNIQUE,
  committed_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at)
VALUES ('schema-baseline-v2', unixepoch() * 1000);

CREATE TABLE IF NOT EXISTS sync_tombstones (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('note', 'session', 'contentType', 'mediaItem')),
  entity_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_content_types_revision ON content_types(revision);
CREATE INDEX IF NOT EXISTS idx_media_items_revision ON media_items(revision);
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_revision ON sync_tombstones(revision);

-- Recompute-and-write queue for Notion task duration synchronization.
CREATE TABLE IF NOT EXISTS notion_sync_jobs (
  page_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notion_sync_jobs_due
ON notion_sync_jobs(next_attempt_at, updated_at);

INSERT OR IGNORE INTO content_types
  (id, name, icon, color, fields, built_in, sort_order, revision)
VALUES (
  'notion-task',
  'Task',
  '☑️',
  NULL,
  '[{"id":"notionPageId","name":"Task URL / ID","type":"text","required":true}]',
  1,
  9,
  0
);

-- Full-text search (see migrations/0007_fts_search.sql for rationale)

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  content, tags, field_values,
  content='notes', content_rowid='rowid', tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, content, tags, field_values)
  VALUES (new.rowid, new.content, new.tags, new.field_values);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content, tags, field_values)
  VALUES ('delete', old.rowid, old.content, old.tags, old.field_values);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content, tags, field_values)
  VALUES ('delete', old.rowid, old.content, old.tags, old.field_values);
  INSERT INTO notes_fts(rowid, content, tags, field_values)
  VALUES (new.rowid, new.content, new.tags, new.field_values);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
  content, end_content, tags, end_tags, field_values,
  content='sessions', content_rowid='rowid', tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS sessions_fts_insert AFTER INSERT ON sessions BEGIN
  INSERT INTO sessions_fts(rowid, content, end_content, tags, end_tags, field_values)
  VALUES (new.rowid, new.content, new.end_content, new.tags, new.end_tags, new.field_values);
END;

CREATE TRIGGER IF NOT EXISTS sessions_fts_delete AFTER DELETE ON sessions BEGIN
  INSERT INTO sessions_fts(sessions_fts, rowid, content, end_content, tags, end_tags, field_values)
  VALUES ('delete', old.rowid, old.content, old.end_content, old.tags, old.end_tags, old.field_values);
END;

CREATE TRIGGER IF NOT EXISTS sessions_fts_update AFTER UPDATE ON sessions BEGIN
  INSERT INTO sessions_fts(sessions_fts, rowid, content, end_content, tags, end_tags, field_values)
  VALUES ('delete', old.rowid, old.content, old.end_content, old.tags, old.end_tags, old.field_values);
  INSERT INTO sessions_fts(rowid, content, end_content, tags, end_tags, field_values)
  VALUES (new.rowid, new.content, new.end_content, new.tags, new.end_tags, new.field_values);
END;

-- Idempotent backfill from the content tables.
INSERT INTO notes_fts(notes_fts) VALUES ('rebuild');
INSERT INTO sessions_fts(sessions_fts) VALUES ('rebuild');
