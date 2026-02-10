-- ChronoLog D1 Schema
-- Entries table (core data)
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('SESSION_START', 'NOTE', 'SESSION_END')),
  content TEXT NOT NULL DEFAULT '',
  timestamp INTEGER NOT NULL,
  session_id TEXT,
  duration INTEGER,
  category TEXT,
  content_type TEXT DEFAULT 'note',
  field_values TEXT,          -- JSON string
  linked_entries TEXT,        -- JSON array string
  tags TEXT,                  -- JSON array string
  ai_comment TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_content_type ON entries(content_type);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);

-- Content types table
CREATE TABLE IF NOT EXISTS content_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  fields TEXT NOT NULL DEFAULT '[]',   -- JSON array of FieldDefinition
  built_in INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Media items table
CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_type TEXT NOT NULL,
  notion_url TEXT,
  created_at INTEGER NOT NULL
);

-- Deleted entries tracking (for incremental sync)
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
