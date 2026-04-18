---
name: tp-dev-story
description: "做故事" — drive a story from backlog to done. Claims the story, moves todo → in_progress, checks AC items as they're completed, moves to review, then done. Use when the user says "dev this story", "做这个故事", "start working on STORY-X", "let's ship X", or when choosing work from the Backlog. This is the primary daily workflow skill.
---

# tp-dev-story

The end-to-end "作故事" loop. Think of this as a lightweight Scrum-style
scaffold that keeps the board honest without dragging the user through
click-ops.

## Pre-flight

1. Confirm the MCP tools respond (`tp_whoami`).
2. Confirm a story is selected. Accept id / URL / "the top backlog one"
   → in which case call `tp_story_list(sprint="latest", status="todo")`
   and pick the highest priority (P1 > P2 > P3 > P4).

## Claim

3. If the story has no owner, call `tp_story_claim` (owner=me,
   status=in_progress). If it's owned by someone else, **ask** before
   overriding.
4. Show:

    ```
    ➤ STORY-<8> "<name>"
      priority=P? points=? epic=<name>
      sprint=<name> branch=<branch or —>
      owner=<me>  status=in_progress
    ```

## Execute loop

5. Load the AC via `tp_story_get` and show `done / total`.
6. For each AC item the user says they've finished, call
   `tp_ac_check`. Accept phrases like "done with 2", "first two are
   done", "✓ 3,5".
7. If the user describes a finding / decision / blocker, offer to
   `tp_comment_create` with that text.
8. If they hit a true blocker, transition to `blocked` via
   `tp_story_move_status` + optional `tp_relation_block`.

## Ship

9. When `done` count == total AC, suggest review. On user confirmation,
   call `tp_story_move_status(review)`.
10. Once the PR is merged (human signal), call
    `tp_story_move_status(done)`. Also offer to update `pr_ref` via
    `/tp-edit-story` if still blank.

## Recap

11. After shipping, render a 3-line wrap-up:
    - what was delivered
    - PR link (if known)
    - next suggested story (from Backlog latest sprint P1 → P2 → …)

## Guardrails

- Never check an AC the user didn't explicitly confirm. Ambiguity →
  ask.
- Never move to `done` without AC fully ticked; if they insist, still
  surface the gap once and move.
- Every write is already audit-tagged `agent` via MCP. Don't add
  redundant prose like "I'm now doing X" before tool calls — the
  activity log is the canonical record.
