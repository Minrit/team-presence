---
name: tp-groom-ac
description: Review, check off, edit, add, or remove acceptance criteria on a story. Use when the user says "对 AC", "groom AC", "check off criteria", "AC 梳理", or during `/tp-dev-story` when a criterion is completed. Wraps `tp_ac_*` MCP tools.
---

# tp-groom-ac

## Steps

1. Resolve the target story (id / URL / "this one").
2. `tp_story_get` to pull the current AC array. Present them with
   1-based numbering for humans (MCP uses 0-based indexes):

    ```
     1. [x] AC done
     2. [ ] AC not yet done
     3. [ ] Another one
    (done 1 / 3)
    ```

3. Ask what the user wants to do. Accept one or more of:
   - **check N** → `tp_ac_check(index=N-1)`
   - **uncheck N** → `tp_ac_uncheck(index=N-1)`
   - **edit N "new text"** → `tp_ac_edit(index=N-1, text=...)`
   - **add "text"** → `tp_ac_add(text=...)`
   - **remove N** → `tp_ac_remove(index=N-1)`
   - **done** → exit the loop

4. After each operation, show the updated counter (done/total). If the
   counter hits 100%, congratulate + suggest `/tp-move-status` → review.

## Bulk operations

If the user pastes a full markdown checklist, offer to replace AC
wholesale. In that case:
- Parse `- [x] ...` and `- [ ] ...` lines into `{text, done}`.
- Call `tp_story_edit` (not ac.*) with `acceptance_criteria=<array>`.
  Explicit whole-array replace is allowed as long as you warn the user
  that this discards any manual edits in-flight.

## Guardrails

- Indexes must be 0-based at the MCP boundary. Translate from the
  1-based display consistently.
- If the AC list is empty, explain and offer to add the first one.
- Never commit AC changes silently — always show the new state.
