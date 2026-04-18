-- Post-MVP schema refresh:
--   * Drop `tasks` table — user decided story granularity is the working unit
--     (no sub-task split). Session↔story many-to-one already covers "who is
--     working on what" so tasks were the abstraction that didn't pay rent.
--   * Rename `stories.title` → `stories.name` — matches the user's vocabulary
--     and keeps the 6-field model aligned with how humans talk about stories.
--   * Add `stories.acceptance_criteria TEXT` — markdown body next to description.
--   * Introduce `sprints` table (name + start_date + end_date) and
--     `stories.sprint_id` FK so stories can be grouped + filtered by sprint.
--
-- No bmad contract impact: import-bmad already writes title via API, which
-- we keep accepting server-side (handler maps either `name` or `title`).

DROP TABLE IF EXISTS tasks;

CREATE TABLE sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_sprints_dates ON sprints(start_date, end_date);

ALTER TABLE stories RENAME COLUMN title TO name;
ALTER TABLE stories ADD COLUMN acceptance_criteria TEXT NOT NULL DEFAULT '';
ALTER TABLE stories
    ADD COLUMN sprint_id UUID NULL REFERENCES sprints(id) ON DELETE SET NULL;

CREATE INDEX idx_stories_sprint ON stories(sprint_id);
