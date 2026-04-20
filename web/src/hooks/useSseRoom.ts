// SSE hook for `/sse/room/:session_id`.
//
// Uses @microsoft/fetch-event-source because native `EventSource` cannot attach
// an `Authorization: Bearer` header. Protocol matches server crates/server/src/sse/room.rs:
//   - Each `data: ...` event carries an `id:` stream-id; we remember the last
//     one in Last-Event-ID on reconnect.
//   - `event: reset\n` → wipe buffer and refetch from beginning.
//   - `event: error\n` → server-side problem (redis_unavailable); surface once.

import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useEffect, useRef, useState } from 'react'
import { attemptSilentRefresh, getToken } from '../api'
import type { RoomFrame } from '../types'

export interface RoomEntry {
  id: string // Redis stream id
  frame: RoomFrame
}

const BUFFER_CAP = 10_000

export interface UseSseRoomResult {
  entries: RoomEntry[]
  connected: boolean
  error: string | null
}

/** Subscribe to a room's live stream, keeping a bounded ring buffer.
 *  The caller is responsible for rendering; the hook does not touch DOM. */
export function useSseRoom(sessionId: string | null): UseSseRoomResult {
  const [entries, setEntries] = useState<RoomEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastIdRef = useRef<string>('0')

  useEffect(() => {
    if (!sessionId) return
    let unmounted = false
    let ctrl = new AbortController()
    setEntries([])
    setError(null)
    lastIdRef.current = '0'

    let refreshedOnce = false
    const run = async () => {
      try {
        await fetchEventSource(`/sse/room/${sessionId}`, {
          signal: ctrl.signal,
          headers: {
            Authorization: `Bearer ${getToken() ?? ''}`,
            'Last-Event-ID': lastIdRef.current,
          },
          openWhenHidden: true,
          onopen: async (r) => {
            if (r.ok && r.headers.get('content-type')?.includes('text/event-stream')) {
              setConnected(true)
              refreshedOnce = false
              return
            }
            if (r.status === 401) {
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
              return
            }
            if (r.status === 404) {
              setError('session not found')
              ctrl.abort()
              return
            }
            setError(`server error ${r.status}`)
          },
          onmessage: (ev) => {
            if (ev.event === 'reset') {
              setEntries([])
              lastIdRef.current = '0'
              return
            }
            if (ev.event === 'error') {
              setError(ev.data || 'stream error')
              return
            }
            // default `data: ...` event
            if (!ev.data) return
            let frame: RoomFrame
            try {
              frame = JSON.parse(ev.data) as RoomFrame
            } catch {
              // Unknown shape — skip silently; log to console only, never the frame body.
              console.warn('malformed room frame')
              return
            }
            if (ev.id) lastIdRef.current = ev.id
            setEntries((prev) => {
              const next = prev.length >= BUFFER_CAP
                ? prev.slice(prev.length - BUFFER_CAP + 1)
                : prev.slice()
              next.push({ id: ev.id || String(next.length), frame })
              return next
            })
          },
          onerror: (e) => {
            setConnected(false)
            // fetch-event-source auto-retries unless we throw; let it retry on
            // transient errors. Only surface after ~3 failed attempts:
            setError((prev) => prev ?? `reconnecting…`)
            // returning void means auto-retry with exponential backoff built-in
            console.warn('sse room error', e)
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
      if (!unmounted && refreshedOnce) {
        refreshedOnce = false
        ctrl = new AbortController()
        run()
      }
    }
    run()

    return () => {
      unmounted = true
      ctrl.abort()
      setConnected(false)
    }
  }, [sessionId])

  return { entries, connected, error }
}
