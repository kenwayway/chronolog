-- A unique index over open buffers with the same topic slug was meant to stop
-- one topic being recorded twice. It never could: it is partial on
-- status = 'open', and duplicates came from a buffer being closed too eagerly
-- and reopened minutes later, when the index no longer applies. Both
-- hindsight-install and hindsight-remote-access got in past it.
--
-- Premature closing is now gone — a quiet buffer waits to be summarized
-- instead of finalizing itself — so remove the guarantee that was never true.
-- Real deduplication, if it turns out to still be needed, belongs in
-- application logic that can look at recently closed buffers.
DROP INDEX IF EXISTS idx_zaddy_topic_buffers_open_topic;

ALTER TABLE zaddy_topic_buffers DROP COLUMN topic;
