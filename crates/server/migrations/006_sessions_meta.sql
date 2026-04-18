-- Unit 7: sessions_meta — metadata-only persistence for live session tiles + history.
-- Content frames live in Redis Streams (24 h TTL per R16); this table is the
-- forever-retained skeleton so R19 "who advanced STORY-X last week" style queries
-- work after the 24 h Redis window rolls.

CREATE TABLE sessions_meta (
    -- session_id is produced by the collector (Claude Code's own session UUID),
    -- so we trust its uniqueness rather than generating server-side.
    id UUID PRIMARY KEY,
    collector_token_id UUID NOT NULL REFERENCES collector_tokens(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cli TEXT NOT NULL CHECK (cli IN ('claude_code')),
    cwd TEXT NOT NULL DEFAULT '',
    git_remote TEXT NULL,
    git_branch TEXT NULL,
    detected_story_id UUID NULL REFERENCES stories(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ NULL,
    exit_code INT NULL
);

CREATE INDEX idx_sessions_meta_user ON sessions_meta(user_id);
CREATE INDEX idx_sessions_meta_story ON sessions_meta(detected_story_id);
CREATE INDEX idx_sessions_meta_active ON sessions_meta(ended_at)
    WHERE ended_at IS NULL;
CREATE INDEX idx_sessions_meta_last_heartbeat ON sessions_meta(last_heartbeat_at)
    WHERE ended_at IS NULL;
