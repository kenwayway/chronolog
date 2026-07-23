-- Apply to an existing Chronolog D1 database with:
--   npx wrangler d1 migrations apply chronolog --remote

ALTER TABLE entries ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_types ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_items ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sync_commits (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_id TEXT NOT NULL UNIQUE,
  committed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_tombstones (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('entry', 'contentType', 'mediaItem')),
  entity_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_content_types_revision ON content_types(revision);
CREATE INDEX IF NOT EXISTS idx_media_items_revision ON media_items(revision);
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_revision ON sync_tombstones(revision);
CREATE INDEX IF NOT EXISTS idx_entries_revision ON entries(revision);

-- Give pre-existing rows a committed baseline so revision=0 can request a full snapshot.
INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at)
VALUES ('schema-migration-v2', unixepoch() * 1000);

UPDATE entries
SET revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'schema-migration-v2')
WHERE revision = 0;

UPDATE content_types
SET revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'schema-migration-v2')
WHERE revision = 0;

UPDATE media_items
SET revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'schema-migration-v2')
WHERE revision = 0;
