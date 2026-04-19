import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AcceptanceCriterion,
  Priority,
  Story,
  StoryStatus,
} from '../types'

/** The subset of Story fields that a user can edit from the detail page. */
export interface StoryDraft {
  name: string
  description: string
  status: StoryStatus
  priority: Priority | null
  points: number | null
  epic_id: string | null
  sprint_id: string | null
  owner_id: string | null
  branch: string | null
  pr_ref: string | null
  acceptance_criteria: AcceptanceCriterion[]
}

function toDraft(s: Story): StoryDraft {
  return {
    name: s.name,
    description: s.description,
    status: s.status,
    priority: s.priority,
    points: s.points,
    epic_id: s.epic_id,
    sprint_id: s.sprint_id,
    owner_id: s.owner_id,
    branch: s.branch,
    pr_ref: s.pr_ref,
    acceptance_criteria: s.acceptance_criteria,
  }
}

/** Returns a draft mirror of the story plus a `patch(partial)` setter, a
 *  `dirty` flag, and a `diff()` function that produces the patchStory
 *  payload — only fields that actually changed. Reset snaps draft back to
 *  the latest server story. */
export function useStoryDraft(story: Story | undefined) {
  const [draft, setDraft] = useState<StoryDraft | null>(
    story ? toDraft(story) : null,
  )
  // Track the server baseline we compare against for dirty / diff. Updated
  // on reset and on a fresh story fetch when the user has no pending edits.
  const baseline = useRef<StoryDraft | null>(draft)

  // When the upstream story changes (fresh fetch, SSE), reconcile:
  // — if draft is pristine (== baseline), follow the server.
  // — if draft is dirty, leave it alone (don't clobber the user's edits).
  useEffect(() => {
    if (!story) return
    const next = toDraft(story)
    if (!draft) {
      setDraft(next)
      baseline.current = next
      return
    }
    if (baseline.current && shallowEqualDraft(draft, baseline.current)) {
      setDraft(next)
      baseline.current = next
    } else {
      // User has edits; keep baseline frozen at whatever we last synced to
      // so Save's diff is still correct.
    }
  }, [story, draft])

  const patch = useCallback((p: Partial<StoryDraft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d))
  }, [])

  const reset = useCallback(() => {
    if (story) {
      const next = toDraft(story)
      setDraft(next)
      baseline.current = next
    }
  }, [story])

  const dirty = useMemo(() => {
    if (!draft || !baseline.current) return false
    return !shallowEqualDraft(draft, baseline.current)
  }, [draft])

  /** Diff draft against baseline. Omits unchanged fields so the PATCH
   *  body contains only real changes. AC array is compared structurally. */
  const diff = useCallback((): Partial<StoryDraft> => {
    if (!draft || !baseline.current) return {}
    const base = baseline.current
    const out: Partial<StoryDraft> = {}
    if (draft.name !== base.name) out.name = draft.name
    if (draft.description !== base.description)
      out.description = draft.description
    if (draft.status !== base.status) out.status = draft.status
    if (draft.priority !== base.priority) out.priority = draft.priority
    if (draft.points !== base.points) out.points = draft.points
    if (draft.epic_id !== base.epic_id) out.epic_id = draft.epic_id
    if (draft.sprint_id !== base.sprint_id) out.sprint_id = draft.sprint_id
    if (draft.owner_id !== base.owner_id) out.owner_id = draft.owner_id
    if (draft.branch !== base.branch) out.branch = draft.branch
    if (draft.pr_ref !== base.pr_ref) out.pr_ref = draft.pr_ref
    if (!acEqual(draft.acceptance_criteria, base.acceptance_criteria)) {
      out.acceptance_criteria = draft.acceptance_criteria
    }
    return out
  }, [draft])

  /** Mark current draft as the new baseline — call after a successful save
   *  to preserve the user's diff-free state until the next change. */
  const markClean = useCallback(() => {
    if (draft) baseline.current = draft
  }, [draft])

  return { draft, patch, reset, dirty, diff, markClean }
}

function shallowEqualDraft(a: StoryDraft, b: StoryDraft): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.points === b.points &&
    a.epic_id === b.epic_id &&
    a.sprint_id === b.sprint_id &&
    a.owner_id === b.owner_id &&
    a.branch === b.branch &&
    a.pr_ref === b.pr_ref &&
    acEqual(a.acceptance_criteria, b.acceptance_criteria)
  )
}

function acEqual(
  a: AcceptanceCriterion[],
  b: AcceptanceCriterion[],
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].text !== b[i].text || a[i].done !== b[i].done) return false
  }
  return true
}
