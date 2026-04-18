---
name: tp-plan-sprint
description: Create a new sprint, set its window, and assign stories to it. Use when the user says "plan sprint", "start sprint N", "规划 sprint", "roll over to next sprint", or during the end-of-sprint handoff. Wraps tp_sprint_* + tp_story_edit for bulk assignment.
---

# tp-plan-sprint

## Create

1. Ask for sprint **name** (default: "S<N+1>" where N comes from the
   latest `tp_sprint_list` name pattern).
2. Ask for **start_date** (default: next Monday).
3. Ask for **end_date** (default: start + 2 weeks - 1 day, i.e. a
   Sunday).
4. Call `tp_sprint_create`.

## Assign stories

5. Show the candidate pool: call `tp_story_list(sprint="", status="todo")`
   (unassigned-to-sprint todos) or `tp_story_list(sprint="<prev>",
   status!="done")` to carry over incomplete items.
6. Let the user pick by index / id / "all P1" / "top 5 by priority".
7. For each selected story, call `tp_story_edit(id, sprint=<new sprint>)`.

## Capacity check

8. Sum points across assigned stories. If the team capacity hint is
   provided (historical: use ~400 SP like the previous Q2-S01 sprint),
   show the delta: `assigned=XXX / capacity=YYY (±Z%)`.
9. If > 120% of capacity, warn and offer to defer P3/P4 items.

## Confirm + recap

10. Call `tp_sprint_list` again to show the new sprint with
    `{story_count, total_pts}`.

## Guardrails

- Do not move `status=done` stories into a new sprint — they stay in
  the old sprint for history.
- Do not assign stories already owned by another member without
  checking — they may be mid-flight elsewhere.
