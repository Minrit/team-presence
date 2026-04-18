-- Unit 11: story comments.
--   * REST-only for MVP (no realtime composer surface).
--   * Every insert also writes a `story_activity` row with kind='comment'
--     so the timeline reflects comments without dual-fetch on the client.
--   * 6-user workspace → no attachment / threading yet.

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 10000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_story_time
    ON comments(story_id, created_at DESC);
