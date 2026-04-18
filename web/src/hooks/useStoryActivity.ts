// Derive per-story active session counts from the /sse/grid stream.
// Reuses the existing pub/sub tile feed rather than opening a dedicated
// story-activity SSE connection — MVP 6-user scale doesn't need the split.

import { useMemo } from 'react'
import { useSseGrid } from './useSseGrid'

export interface StoryActivity {
  active_count: number
  session_ids: string[]
}

export function useStoryActivity(): Map<string, StoryActivity> {
  const { tiles } = useSseGrid()
  return useMemo(() => {
    const m = new Map<string, StoryActivity>()
    for (const t of tiles) {
      if (!t.detected_story_id) continue
      if (t.ended_at) continue
      const prev = m.get(t.detected_story_id) ?? { active_count: 0, session_ids: [] }
      prev.active_count += 1
      prev.session_ids.push(t.session_id)
      m.set(t.detected_story_id, prev)
    }
    return m
  }, [tiles])
}
