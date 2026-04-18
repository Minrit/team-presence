-- Unit 10: Hive modern-SaaS schema extension
--   * 5-state status (todo | in_progress | blocked | review | done):
--     rename existing `doing` rows to `in_progress`, widen CHECK constraint.
--     `can_transition_to` stays permissive at the Rust layer.
--   * Add priority (P1..P4 nullable), points (int nullable), branch, pr_ref.
--   * Epics as first-class table with color + description.
--   * stories.epic_id FK → epics(id).
--   * Structured acceptance_criteria (JSONB array of {text, done}).
--     Legacy TEXT value cast as a single unchecked item so no content is
--     lost; empty strings become [].
--   * story_relations edge table for blocks/blocked_by (derived from reverse).
--   * story_activity append-only log for timeline (user|agent|system actors).
--   * 8 seed epic rows with off-indigo colors so the accent never clashes.
--
-- Migration note: single statement per change keeps it idempotent-friendly.
-- No schema rollback is supported post-apply (the `doing` rename is one-way).

-- --- epics ----------------------------------------------------------------
CREATE TABLE epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#64748b',
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO epics (name, color, description) VALUES
    ('Platform',      '#ef4444', 'Core platform + infrastructure work'),
    ('Frontend',      '#22c55e', 'UI surface + design system'),
    ('Backend',       '#f59e0b', 'APIs + data model evolution'),
    ('Agents',        '#06b6d4', 'Agent runtime + tool integration'),
    ('Observability', '#a855f7', 'Tracing, metrics, dashboards'),
    ('Onboarding',    '#ec4899', 'First-run + invite flows'),
    ('Performance',   '#eab308', 'Latency, throughput, capacity'),
    ('Docs',          '#14b8a6', 'Product + developer documentation')
ON CONFLICT (name) DO NOTHING;

-- --- stories new columns --------------------------------------------------
ALTER TABLE stories
    ADD COLUMN priority TEXT NULL
        CHECK (priority IS NULL OR priority IN ('P1','P2','P3','P4')),
    ADD COLUMN points   INT  NULL CHECK (points IS NULL OR points >= 0),
    ADD COLUMN epic_id  UUID NULL REFERENCES epics(id) ON DELETE SET NULL,
    ADD COLUMN branch   TEXT NULL,
    ADD COLUMN pr_ref   TEXT NULL;

CREATE INDEX idx_stories_epic     ON stories(epic_id);
CREATE INDEX idx_stories_priority ON stories(priority);

-- --- 5-state status -------------------------------------------------------
-- Drop the 3-state CHECK first so the UPDATE that introduces 'in_progress'
-- doesn't run against a constraint that still only permits 'todo|doing|done'.
ALTER TABLE stories DROP CONSTRAINT stories_status_check;
UPDATE stories SET status = 'in_progress' WHERE status = 'doing';
ALTER TABLE stories
    ADD CONSTRAINT stories_status_check
    CHECK (status IN ('todo','in_progress','blocked','review','done'));

-- --- acceptance_criteria TEXT → JSONB -------------------------------------
-- Preserve existing markdown bodies as a single unchecked checklist row.
-- Empty strings become `[]` so the frontend's counter reads `0 / 0` cleanly.
ALTER TABLE stories
    ALTER COLUMN acceptance_criteria DROP DEFAULT;
ALTER TABLE stories
    ALTER COLUMN acceptance_criteria TYPE JSONB
    USING (
        CASE
            WHEN acceptance_criteria IS NULL OR acceptance_criteria = ''
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object('text', acceptance_criteria, 'done', FALSE)
            )
        END
    );
ALTER TABLE stories
    ALTER COLUMN acceptance_criteria SET DEFAULT '[]'::JSONB;
ALTER TABLE stories
    ALTER COLUMN acceptance_criteria SET NOT NULL;

-- --- story_relations ------------------------------------------------------
CREATE TABLE story_relations (
    from_story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    to_story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('blocks')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (from_story_id, to_story_id, kind),
    CHECK (from_story_id <> to_story_id)
);

CREATE INDEX idx_story_relations_to ON story_relations(to_story_id, kind);

-- --- story_activity (append-only) -----------------------------------------
CREATE TABLE story_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user','agent','system')),
    actor_ref  TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    ref  TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_activity_story_time
    ON story_activity(story_id, created_at DESC);
