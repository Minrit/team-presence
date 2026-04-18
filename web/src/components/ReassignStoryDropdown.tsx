// One-click 改派 dropdown. Reassigns a session to a different (or no) story.
// PATCH backend: /api/v1/sessions/:id { detected_story_id: uuid | null }

import { useState } from 'react'
import { api } from '../api'
import { useStories } from '../stories'

export interface ReassignStoryDropdownProps {
  sessionId: string
  currentStoryId: string | null
  onReassigned?: (newStoryId: string | null) => void
}

export default function ReassignStoryDropdown({
  sessionId,
  currentStoryId,
  onReassigned,
}: ReassignStoryDropdownProps) {
  const { data: stories, isLoading } = useStories()
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState(currentStoryId ?? '')

  const apply = async (nextRaw: string) => {
    setBusy(true)
    try {
      const next = nextRaw === '' ? null : nextRaw
      await api.patch(`/api/v1/sessions/${sessionId}`, { detected_story_id: next })
      setValue(nextRaw)
      onReassigned?.(next)
    } catch (err) {
      alert(`Reassign failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <span className="text-xs text-muted">loading stories…</span>

  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted">Story</span>
      <select
        disabled={busy}
        value={value}
        onChange={(e) => void apply(e.target.value)}
        className="bg-card border border-border rounded px-2 py-1 text-xs"
      >
        <option value="">— unassigned —</option>
        {stories?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </label>
  )
}
