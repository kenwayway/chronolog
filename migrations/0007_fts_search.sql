-- Full-text search for MCP search tools.
--
-- External-content FTS5 tables backed by notes/sessions, kept in sync by
-- triggers. The trigram tokenizer indexes CJK and Latin text alike and gives
-- substring-match semantics, which fits the journal's mixed Chinese/English
-- content (the default unicode61 tokenizer cannot segment CJK).
--
-- Trigger discipline: always pass raw column values (no COALESCE) so the
-- 'delete' commands tokenize exactly what was originally indexed, matching
-- what the 'rebuild' command reads from the content tables.

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
