-- Unit 3: stories table — 6-field model + audit-lite (last_modified_by, updated_at).
-- CHECK enum matches StoryStatus Rust FSM (Rust .can_transition_to() is MVP-permissive).
-- Hard-forbid adding estimate/sp/priority/sprint columns for 6 months per SC7.

CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
    owner_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    repo TEXT NULL,
    last_modified_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_owner ON stories(owner_id);
CREATE INDEX idx_stories_updated_at ON stories(updated_at DESC);
