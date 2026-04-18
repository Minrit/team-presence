-- Unit 3: tasks table — thin sub-entity of stories.
-- A task is either done (done_at IS NOT NULL) or open. No status enum by design.
-- On task mutation the handler bumps the parent story's last_modified_by + updated_at
-- in the same transaction (trigger-free; easier to reason about in tests).

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done_at TIMESTAMPTZ NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_story ON tasks(story_id, position);
