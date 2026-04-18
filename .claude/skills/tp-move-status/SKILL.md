---
name: tp-move-status
description: Move a story between the 5 workflow statuses (todo / in_progress / blocked / review / done). Use when the user says "move to review", "mark done", "unblock", "start this story", "移状态", or during agent-driven workflow transitions. Wraps `tp_story_move_status`.
---

# tp-move-status

## Steps

1. Identify the story (id, URL, or "this one" referring to the current
   /story/:id context).
2. Present the current status and the 5 options:
   - `todo` — not started
   - `in_progress` — active work
   - `blocked` — waiting on an upstream
   - `review` — in PR / awaiting approval
   - `done` — merged / shipped
3. Ask the user to pick. Validate strictly — MCP will reject anything
   else.
4. Call `tp_story_move_status`.
5. Show:

    ```
    ✓ STORY-<8>: <old> → <new>
       activity: status_change (actor=agent)
    ```

## Companion flows

- If the target is `blocked`, **ask** for a blocker story id and, if
  given, also run `tp_relation_block(from_id=this, to_id=blocker)`.
- If the target is `done`, call `tp_story_get` first and warn if any
  AC is still `done=false`; ask whether to proceed anyway.
- If the target is `review` and `branch` is empty, suggest setting it
  now via `/tp-edit-story`.
