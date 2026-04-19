import { useCallback, useEffect, useMemo, useState } from 'react'
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
 *  the latest server story. `baseline` is kept as state (not a ref) so
 *  markClean flips `dirty` through React's normal re-render path. */
export function useStoryDraft(story: Story | undefined) {
  const initial = story ? toDraft(story) : null
  const [draft, setDraft] = useState<StoryDraft | null>(initial)
  const [baseline, setBaseline] = useState<StoryDraft | null>(initial)

  // Reconcile upstream story changes:
  //  - first-time load: adopt.
  //  - draft pristine (== baseline) AND upstream is actually different:
  //    follow the server.
  //  - draft dirty: keep the user's edits, leave baseline frozen.
  useEffect(() => {
    if (!story) return
    const next = toDraft(story)
    if (!draft || !baseline) {
      setDraft(next)
      setBaseline(next)
      return
    }
    if (
      shallowEqualDraft(draft, baseline) &&
      !shallowEqualDraft(draft, next)
    ) {
      setDraft(next)
      setBaseline(next)
    }
  }, [story, draft, baseline])

  const patch = useCallback((p: Partial<StoryDraft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d))
  }, [])

  const reset = useCallback(() => {
    if (story) {
      const next = toDraft(story)
      setDraft(next)
      setBaseline(next)
    }
  }, [story])

  const dirty = useMemo(() => {
    if (!draft || !baseline) return false
    return !shallowEqualDraft(draft, baseline)
  }, [draft, baseline])

  const diff = useCallback((): Partial<StoryDraft> => {
    if (!draft || !baseline) return {}
    const out: Partial<StoryDraft> = {}
    if (draft.name !== baseline.name) out.name = draft.name
    if (draft.description !== baseline.description)
      out.description = draft.description
    if (draft.status !== baseline.status) out.status = draft.status
    if (draft.priority !== baseline.priority) out.priority = draft.priority
    if (draft.points !== baseline.points) out.points = draft.points
    if (draft.epic_id !== baseline.epic_id) out.epic_id = draft.epic_id
    if (draft.sprint_id !== baseline.sprint_id)
      out.sprint_id = draft.sprint_id
    if (draft.owner_id !== baseline.owner_id) out.owner_id = draft.owner_id
    if (draft.branch !== baseline.branch) out.branch = draft.branch
    if (draft.pr_ref !== baseline.pr_ref) out.pr_ref = draft.pr_ref
    if (!acEqual(draft.acceptance_criteria, baseline.acceptance_criteria)) {
      out.acceptance_criteria = draft.acceptance_criteria
    }
    return out
  }, [draft, baseline])

  /** Mark current draft as the new baseline — call after a successful save
   *  so the Save button disables and the dirty chip disappears. Optionally
   *  applies a last-moment override (used by Save to fold in the flushed
   *  markdown from the debounced editor whose setDraft hasn't committed). */
  const markClean = useCallback(
    (override?: Partial<StoryDraft>) => {
      if (!draft) return
      const next = override ? { ...draft, ...override } : draft
      if (override) setDraft(next)
      setBaseline(next)
    },
    [draft],
  )

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
