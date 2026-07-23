-- Durable, idempotent queue for syncing recomputed task durations to Notion.
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

-- Publish the fixed built-in schema to API/MCP consumers as a revisioned row.
INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at)
VALUES ('add-notion-task-content-type-v4', unixepoch() * 1000);

INSERT INTO content_types
  (id, name, icon, color, fields, built_in, sort_order, revision)
SELECT
  'notion-task',
  'Notion Task',
  '☑️',
  NULL,
  '[{"id":"notionPageId","name":"Task URL / ID","type":"text","required":true}]',
  1,
  9,
  revision
FROM sync_commits
WHERE mutation_id = 'add-notion-task-content-type-v4'
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  icon = excluded.icon,
  fields = excluded.fields,
  built_in = excluded.built_in,
  sort_order = excluded.sort_order,
  revision = excluded.revision;
