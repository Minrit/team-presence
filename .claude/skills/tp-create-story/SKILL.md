---
name: tp-create-story
description: Create a new team-presence story end-to-end. Use when the user says "create story", "新故事", "add story", "log a new story", or when a conversation naturally produces a new work item that should be tracked on the board. Wraps the `tp_story_create` MCP tool with guided AC collection.
---

# tp-create-story

You are driving the **team-presence** board via the `team-presence` MCP
server. Goal: produce one well-formed story that's immediately actionable.

## Pre-flight

1. Ensure the MCP server is loaded (tools prefixed `tp_*` visible).
2. Silently call `tp_whoami` to confirm login. If it errors with
   "NotLoggedIn", ask the user to run `team-presence login --server <url>
   --email <them>` and stop this skill.

## Gather story fields

Ask the user for each field below. **Batch related questions** — don't
drag them through 8 single-question turns. If they sound hurried, infer
sensible defaults and confirm.

- **Name** (required, one line, imperative). Reject empty / > 200 chars.
- **Description** (optional, markdown). Suggest one paragraph + a short
  bullet list; you can also paste a chat-derived rationale.
- **Priority** — P1 (urgent) / P2 (high) / P3 (medium, default) / P4 (low).
- **Points** — 1 / 2 / 3 / 5 / 8 / 13 / 21 (Fibonacci). Guess from scope
  if the user shrugs.
- **Epic** — resolve by name:
    - Call `tp_epic_list` once; show the user their options.
    - Accept either the epic **name** or its UUID.
- **Sprint** — default to `latest` unless the user names a specific sprint.
- **Branch** (optional), **PR ref** (optional).
- **Acceptance criteria** — loop:
    - "Add an AC line?"
    - Accept text until the user says `done` / `no more` / presses enter.
    - Each line should name the input, action, and expected outcome.

## Create + confirm

1. Call `tp_story_create` with the collected fields.
2. Read the returned `id` and show a compact summary:

    ```
    ✓ Created STORY-<8> "<name>"
      priority=P? points=? epic=? sprint=?
      board: http://localhost:5173/story/<id>
    ```

3. If AC were collected, call `tp_ac_add` for each one **in order**.
4. Finally call `tp_activity_list` with `limit=3` to confirm rows landed
   with `actor_type='agent'`.

## Failure modes

- `tp_story_create` returns `bad_request` → surface the server error;
  suggest the fix (trim name, remove illegal priority, etc.).
- Epic resolution fails → retry with `tp_epic_list` and ask the user to
  pick a real epic name.
- Sprint is "latest" but no sprints exist → offer to run `/tp-plan-sprint`
  first.

## Don'ts

- Do not skip the confirmation summary.
- Do not invent priority / points if the user is present — ask them.
- Do not PATCH the story again just to add AC. AC flows through
  `tp_ac_add`, which keeps the activity log clean.
