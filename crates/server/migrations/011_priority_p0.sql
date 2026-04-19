-- Allow P0 as the highest (critical) priority level.
-- Previous CHECK constraint lived on stories.priority in migration 008.

ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_priority_check;

ALTER TABLE stories
    ADD CONSTRAINT stories_priority_check
    CHECK (priority IS NULL OR priority IN ('P0','P1','P2','P3','P4'));
