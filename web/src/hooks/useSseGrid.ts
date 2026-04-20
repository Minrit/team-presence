// SSE hook for `/sse/grid`. Server first emits the currently-active sessions
// from Postgres (bootstrap), then streams pub/sub updates. We upsert by
// session_id and evict tiles that stay ended for > 5 min (plan Unit 8
// "tile greys out; disappears after 5 min").

import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useEffect, useRef, useState } from 'react'
import { attemptSilentRefresh, getToken } from '../api'
import type { GridTile } from '../types'

const EVICT_AFTER_ENDED_MS = 5 * 60_000

export interface UseSseGridResult {
  tiles: GridTile[]
  connected: boolean
  error: string | null
}

export function useSseGrid(): UseSseGridResult {
  const [tiles, setTiles] = useState<GridTile[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // session_id → time ended first observed. Used to evict stale ended tiles.
  const endedAtRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    let unmounted = false
    let ctrl = new AbortController()
    setTiles([])
    setError(null)

    let refreshedOnce = false
    const run = async () => {
      try {
        await fetchEventSource('/sse/grid', {
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${getToken() ?? ''}` },
          openWhenHidden: true,
          onopen: async (r) => {
            if (r.ok) {
              setConnected(true)
              refreshedOnce = false
              return
            }
            if (r.status === 401) {
              // access token likely expired — try a silent refresh, then
              // reconnect once. If that still 401s, the user really is
              // logged out; surface the error.
              if (!refreshedOnce && (await attemptSilentRefresh())) {
                refreshedOnce = true
                ctrl.abort()
                return
              }
              setError('unauthorized')
              ctrl.abort()
              return
            }
            if (r.status === 403) {
              setError('unauthorized')
              ctrl.abort()
            }
          },
          onmessage: (ev) => {
            if (ev.event !== 'tile' || !ev.data) return
            let tile: GridTile
            try {
              tile = JSON.parse(ev.data) as GridTile
            } catch {
              return
            }
            if (tile.ended_at && !endedAtRef.current.has(tile.session_id)) {
              endedAtRef.current.set(tile.session_id, Date.now())
            }
            setTiles((prev) => {
              const idx = prev.findIndex((t) => t.session_id === tile.session_id)
              if (idx < 0) return [...prev, tile]
              const next = prev.slice()
              next[idx] = tile
              return next
            })
          },
          onerror: (e) => {
            setConnected(false)
            console.warn('sse grid error', e)
          },
          onclose: () => {
            setConnected(false)
          },
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message)
        }
      }
      // If we aborted intentionally to reconnect with a freshly refreshed
      // access token, spin up a new AbortController and re-enter the loop.
      if (!unmounted && refreshedOnce) {
        refreshedOnce = false
        ctrl = new AbortController()
        run()
      }
    }
    run()

    // Eviction loop for ended tiles.
    const interval = setInterval(() => {
      const now = Date.now()
      setTiles((prev) => {
        const keep = prev.filter((t) => {
          if (!t.ended_at) return true
          const since = endedAtRef.current.get(t.session_id)
          if (since == null) {
            endedAtRef.current.set(t.session_id, now)
            return true
          }
          return now - since < EVICT_AFTER_ENDED_MS
        })
        return keep.length === prev.length ? prev : keep
      })
    }, 30_000)

    return () => {
      unmounted = true
      ctrl.abort()
      clearInterval(interval)
      setConnected(false)
    }
  }, [])

  return { tiles, connected, error }
}
