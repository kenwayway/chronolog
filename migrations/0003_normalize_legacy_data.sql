-- Normalize legacy Chronolog data after the revision-sync rollout.
--
-- This migration deliberately publishes every changed entity at one new
-- revision so already-connected clients receive the cleanup incrementally.

INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at)
VALUES ('normalize-legacy-data-v3', unixepoch() * 1000);

-- Old SESSION_START rows without an ID get a deterministic ID. Using the
-- boundary entry ID keeps retries stable and cannot collide with another
-- session because entry IDs are unique.
UPDATE entries
SET session_id = id,
    updated_at = (SELECT committed_at FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3'),
    revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3')
WHERE type = 'SESSION_START'
  AND (session_id IS NULL OR session_id = '');

-- Historical sessions never overlap (verified before this migration), so the
-- Nth START and Nth END are the same pair. Copy the START's stable session ID
-- to every END, replacing the chronological fallback with explicit pairing.
WITH ordered_starts AS (
  SELECT id, session_id, ROW_NUMBER() OVER (ORDER BY timestamp, id) AS pair_number
  FROM entries
  WHERE type = 'SESSION_START'
),
ordered_ends AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY timestamp, id) AS pair_number
  FROM entries
  WHERE type = 'SESSION_END'
),
pairs AS (
  SELECT ordered_ends.id AS end_id, ordered_starts.session_id
  FROM ordered_starts
  JOIN ordered_ends USING (pair_number)
)
UPDATE entries
SET session_id = (SELECT pairs.session_id FROM pairs WHERE pairs.end_id = entries.id),
    updated_at = (SELECT committed_at FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3'),
    revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3')
WHERE id IN (SELECT end_id FROM pairs)
  AND COALESCE(session_id, '') != COALESCE(
    (SELECT pairs.session_id FROM pairs WHERE pairs.end_id = entries.id),
    ''
  );

-- Notes created while a legacy session was active belong to that session.
-- New clients already write this membership explicitly.
WITH ordered_starts AS (
  SELECT id, timestamp AS start_at, session_id,
         ROW_NUMBER() OVER (ORDER BY timestamp, id) AS pair_number
  FROM entries
  WHERE type = 'SESSION_START'
),
ordered_ends AS (
  SELECT timestamp AS end_at, ROW_NUMBER() OVER (ORDER BY timestamp, id) AS pair_number
  FROM entries
  WHERE type = 'SESSION_END'
),
spans AS (
  SELECT ordered_starts.start_at, ordered_ends.end_at, ordered_starts.session_id
  FROM ordered_starts
  JOIN ordered_ends USING (pair_number)
)
UPDATE entries
SET session_id = (
      SELECT spans.session_id
      FROM spans
      WHERE entries.timestamp > spans.start_at AND entries.timestamp < spans.end_at
      ORDER BY spans.start_at DESC
      LIMIT 1
    ),
    updated_at = (SELECT committed_at FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3'),
    revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3')
WHERE type = 'NOTE'
  AND (session_id IS NULL OR session_id = '')
  AND EXISTS (
    SELECT 1 FROM spans
    WHERE entries.timestamp > spans.start_at AND entries.timestamp < spans.end_at
  );

-- beans/wonder were categories in an older taxonomy. Categories now represent
-- fixed life areas, so retaining these values would violate the current model.
-- Leave them uncategorized instead of guessing a life area.
UPDATE entries
SET category = NULL,
    updated_at = (SELECT committed_at FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3'),
    revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3')
WHERE category IN ('beans', 'wonder');

-- The removed task schema only contained { done: false }. Preserve the note
-- text/tags/category, normalize its type, and discard the orphaned field blob.
UPDATE entries
SET content_type = 'note',
    field_values = NULL,
    updated_at = (SELECT committed_at FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3'),
    revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'normalize-legacy-data-v3')
WHERE content_type = 'task';

-- Vault is still a current built-in type. The remote registry was missing it,
-- so restore the schema instead of degrading the Obsidian entry to a note.
INSERT INTO content_types
  (id, name, icon, color, fields, built_in, sort_order, revision)
SELECT
  'vault',
  'Vault',
  '🗄️',
  NULL,
  '[{"id":"title","name":"Note Title","type":"text"},{"id":"obsidianUrl","name":"Obsidian URL","type":"text"}]',
  1,
  5,
  revision
FROM sync_commits
WHERE mutation_id = 'normalize-legacy-data-v3'
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  icon = excluded.icon,
  color = excluded.color,
  fields = excluded.fields,
  built_in = excluded.built_in,
  sort_order = excluded.sort_order,
  revision = excluded.revision;

-- Convert timestamp-era deletion records into revision tombstones before
-- clearing the retired table. This prevents a stale device from resurrecting
-- an old deletion while removing the legacy rows themselves.
INSERT INTO sync_tombstones (entity_type, entity_id, revision)
SELECT 'entry', deleted_entries.entry_id, sync_commits.revision
FROM deleted_entries
JOIN sync_commits ON sync_commits.mutation_id = 'normalize-legacy-data-v3'
ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision
WHERE excluded.revision >= sync_tombstones.revision;

DELETE FROM deleted_entries;

INSERT OR REPLACE INTO sync_meta (key, value)
SELECT 'last_modified', CAST(committed_at AS TEXT)
FROM sync_commits
WHERE mutation_id = 'normalize-legacy-data-v3';
