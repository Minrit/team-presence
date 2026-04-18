---
name: tp-edit-story
description: Edit fields on an existing team-presence story (name, description, priority, points, epic, sprint, branch, pr_ref). Use when the user says "edit story", "change priority", "update points", "move to epic", or "修改故事", or when a conversation determines a tracked story needs a metadata tweak.
---

# tp-edit-story

Guided wrapper over `tp_story_edit`. Only PATCHes the fields the user
changes — every unchanged field stays.

## Steps

1. Ask for the story id (or accept a URL like
   `http://localhost:5173/story/<uuid>` and extract the uuid).
2. Call `tp_story_get` to load current values; echo them compactly:

    ```
    current: "<name>" pri=P? pts=? epic=<name> sprint=<uuid-8> branch=? pr=?
    ```

3. Ask "what should change?" Accept natural text; parse into:
   - `name`, `description`
   - `priority` (P1–P4)
   - `points` (int)
   - `epic` (name or UUID — use `tp_epic_list` if ambiguous)
   - `sprint` (name, UUID, or `latest`)
   - `branch`, `pr_ref`
4. Build one call to `tp_story_edit` with only the changed fields.
5. On success, show the diff you applied + the new story shape.

## Guardrails

- If the user says "move to sprint X", NOT "current sprint", and X
  doesn't match a sprint name → run `tp_sprint_list` and disambiguate.
- If priority is invalid → ask again; do not silently coerce.
- Do not edit `status` here. Use `/tp-move-status`.
- Do not edit AC here. Use `/tp-groom-ac`.
