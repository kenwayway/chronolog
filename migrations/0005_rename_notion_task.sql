-- Rename the user-facing built-in content type while keeping its stable ID.
INSERT OR IGNORE INTO sync_commits (mutation_id, committed_at)
VALUES ('rename-notion-task-v5', unixepoch() * 1000);

UPDATE content_types
SET name = 'Task',
    revision = (SELECT revision FROM sync_commits WHERE mutation_id = 'rename-notion-task-v5')
WHERE id = 'notion-task';
