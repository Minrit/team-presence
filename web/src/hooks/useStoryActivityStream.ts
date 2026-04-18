/** Per-story activity SSE hook — subscribes to `/sse/story/:id/activity`.
 *  Initial page comes from REST (useStoryActivity); this hook only tails
 *  new rows. Merged downstream with the REST page by id. */

import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useEffect, useState } from 'react'
import { getToken } from '../api'
import type { StoryActivity } from '../types'

export function useStoryActivityStream(storyId: string | null | undefined): {
  live: StoryActivity[]
  connected: boolean
  error: string | null
} {
  const [live, setLive] = useState<StoryActivity[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!storyId) return
    setLive([])
    setError(null)
    const ctrl = new AbortController()

    ;(async () => {
      try {
        await fetchEventSource(`/sse/story/${storyId}/activity`, {
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${getToken() ?? ''}` },
          openWhenHidden: true,
          onopen: async (r) => {
            if (r.ok) setConnected(true)
            else if (r.status === 401 || r.status === 403) {
              setError('unauthorized')
              ctrl.abort()
            } else if (r.status === 404) {
              setError('story not found')
              ctrl.abort()
            }
          },
          onmessage: (ev) => {
            if (ev.event !== 'activity' || !ev.data) return
            try {
              const row = JSON.parse(ev.data) as StoryActivity
              setLive((prev) =>
                prev.some((p) => p.id === row.id) ? prev : [row, ...prev],
              )
            } catch {
              /* ignore malformed frame */
            }
          },
          onerror: () => setConnected(false),
          onclose: () => setConnected(false),
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message)
        }
      }
    })()

    return () => ctrl.abort()
  }, [storyId])

  return { live, connected, error }
}
