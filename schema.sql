-- ChronoLog D1 Schema
-- Entries table (core data)
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('SESSION_START', 'NOTE', 'SESSION_END')),
  content TEXT NOT NULL DEFAULT '',
  timestamp INTEGER NOT NULL,
  session_id TEXT,
  category TEXT,
  content_type TEXT DEFAULT 'note',
  field_values TEXT,          -- JSON string
  linked_entries TEXT,        -- JSON array string
  tags TEXT,                  -- JSON array string
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_content_type ON entries(content_type);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);
CREATE INDEX IF NOT EXISTS idx_entries_revision ON entries(revision);

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

-- Retired timestamp-sync deletion log. Kept empty temporarily so timestamp-era
-- GET clients fail soft during the revision-sync rollout; new deletes use
-- sync_tombstones exclusively.
CREATE TABLE IF NOT EXISTS deleted_entries (
  entry_id TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_entries_deleted_at ON deleted_entries(deleted_at);

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
  entity_type TEXT NOT NULL CHECK(entity_type IN ('entry', 'contentType', 'mediaItem')),
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
