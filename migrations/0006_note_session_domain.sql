-- One-way domain migration: boundary entries become first-class sessions and
-- NOTE entries become first-class notes. All rows receive this migration's
-- revision so clients with an old cursor fetch the complete canonical state.

INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at)
VALUES ('note-session-domain-v1', unixepoch() * 1000);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  timestamp INTEGER NOT NULL,
  session_id TEXT,
  category TEXT,
  content_type TEXT DEFAULT 'note',
  field_values TEXT,
  linked_items TEXT,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  end_content TEXT,
  category TEXT,
  content_type TEXT DEFAULT 'note',
  field_values TEXT,
  linked_items TEXT,
  tags TEXT,
  end_tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL
);

WITH mapped_notes AS (
  SELECT
    note.id,
    note.content,
    note.timestamp,
    CASE WHEN EXISTS (
      SELECT 1 FROM entries AS start
      WHERE start.type = 'SESSION_START'
        AND COALESCE(NULLIF(start.session_id, ''), start.id) = note.session_id
    ) THEN note.session_id END AS session_id,
    note.category,
    note.content_type,
    note.field_values,
    CASE WHEN json_valid(note.linked_entries) THEN (
      SELECT json_group_array(mapped_id)
      FROM (
        SELECT DISTINCT COALESCE(
          (SELECT boundary.session_id
           FROM entries AS boundary
           WHERE boundary.id = link.value
             AND boundary.type IN ('SESSION_START', 'SESSION_END')),
          link.value
        ) AS mapped_id
        FROM json_each(note.linked_entries) AS link
      )
    ) END AS linked_items,
    note.tags,
    note.created_at,
    note.updated_at
  FROM entries AS note
  WHERE note.type = 'NOTE'
     OR (
       note.type = 'SESSION_END'
       AND NOT EXISTS (
         SELECT 1
         FROM entries AS start
         WHERE start.type = 'SESSION_START'
           AND COALESCE(NULLIF(start.session_id, ''), start.id) = note.session_id
       )
     )
)
INSERT INTO notes
  (id, content, timestamp, session_id, category, content_type, field_values,
   linked_items, tags, created_at, updated_at, revision)
SELECT
  id, content, timestamp, session_id, category, content_type, field_values,
  linked_items, tags, created_at, updated_at,
  (SELECT revision FROM sync_commits WHERE mutation_id = 'note-session-domain-v1')
FROM mapped_notes;

WITH session_pairs AS (
  SELECT
    start.id AS start_id,
    COALESCE(NULLIF(start.session_id, ''), start.id) AS session_id,
    start.content,
    start.timestamp AS start_at,
    start.category,
    start.content_type,
    start.field_values,
    start.linked_entries AS start_links,
    start.tags,
    start.created_at,
    start.updated_at,
    (
      SELECT finish.id
      FROM entries AS finish
      WHERE finish.type = 'SESSION_END'
        AND finish.timestamp >= start.timestamp
        AND (
          finish.session_id = start.session_id
          OR (start.session_id IS NULL AND finish.session_id IS NULL)
        )
      ORDER BY finish.timestamp ASC
      LIMIT 1
    ) AS end_id
  FROM entries AS start
  WHERE start.type = 'SESSION_START'
),
session_rows AS (
  SELECT
    pair.*,
    finish.timestamp AS end_at,
    finish.content AS end_content,
    finish.linked_entries AS end_links,
    finish.tags AS end_tags,
    MAX(pair.updated_at, COALESCE(finish.updated_at, pair.updated_at)) AS final_updated_at
  FROM session_pairs AS pair
  LEFT JOIN entries AS finish ON finish.id = pair.end_id
),
links AS (
  SELECT
    session_id,
    CASE WHEN COUNT(mapped_id) > 0 THEN json_group_array(mapped_id) END AS linked_items
  FROM (
    SELECT
      row.session_id,
      COALESCE(
        (SELECT boundary.session_id
         FROM entries AS boundary
         WHERE boundary.id = link.value
           AND boundary.type IN ('SESSION_START', 'SESSION_END')),
        link.value
      ) AS mapped_id
    FROM session_rows AS row, json_each(
      CASE WHEN json_valid(row.start_links) THEN row.start_links ELSE '[]' END
    ) AS link
    UNION
    SELECT
      row.session_id,
      COALESCE(
        (SELECT boundary.session_id
         FROM entries AS boundary
         WHERE boundary.id = link.value
           AND boundary.type IN ('SESSION_START', 'SESSION_END')),
        link.value
      ) AS mapped_id
    FROM session_rows AS row, json_each(
      CASE WHEN json_valid(row.end_links) THEN row.end_links ELSE '[]' END
    ) AS link
  )
  GROUP BY session_id
)
INSERT INTO sessions
  (id, content, start_at, end_at, end_content, category, content_type,
   field_values, linked_items, tags, end_tags, created_at, updated_at, revision)
SELECT
  row.session_id,
  row.content,
  row.start_at,
  row.end_at,
  NULLIF(row.end_content, ''),
  row.category,
  row.content_type,
  row.field_values,
  links.linked_items,
  row.tags,
  row.end_tags,
  row.created_at,
  row.final_updated_at,
  (SELECT revision FROM sync_commits WHERE mutation_id = 'note-session-domain-v1')
FROM session_rows AS row
LEFT JOIN links ON links.session_id = row.session_id;

CREATE INDEX idx_notes_timestamp ON notes(timestamp);
CREATE INDEX idx_notes_session_id ON notes(session_id);
CREATE INDEX idx_notes_category ON notes(category);
CREATE INDEX idx_notes_content_type ON notes(content_type);
CREATE INDEX idx_notes_revision ON notes(revision);
CREATE INDEX idx_sessions_start_at ON sessions(start_at);
CREATE INDEX idx_sessions_end_at ON sessions(end_at);
CREATE INDEX idx_sessions_category ON sessions(category);
CREATE INDEX idx_sessions_content_type ON sessions(content_type);
CREATE INDEX idx_sessions_revision ON sessions(revision);

DROP INDEX idx_sync_tombstones_revision;
ALTER TABLE sync_tombstones RENAME TO sync_tombstones_entry_era;
CREATE TABLE sync_tombstones (
  entity_type TEXT NOT NULL CHECK(entity_type IN ('note', 'session', 'contentType', 'mediaItem')),
  entity_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);
INSERT INTO sync_tombstones (entity_type, entity_id, revision)
SELECT entity_type, entity_id, revision
FROM sync_tombstones_entry_era
WHERE entity_type IN ('contentType', 'mediaItem');
CREATE INDEX idx_sync_tombstones_revision ON sync_tombstones(revision);

DROP TABLE sync_tombstones_entry_era;
DROP TABLE deleted_entries;
DROP TABLE entries;
