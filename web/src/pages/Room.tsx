import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReassignStoryDropdown from '../components/ReassignStoryDropdown'
import StdoutStream from '../components/StdoutStream'
import TopNav from '../components/TopNav'
import { api } from '../api'
import { useSseRoom } from '../hooks/useSseRoom'

interface SessionMetaLite {
  id: string
  cli: string
  cwd: string
  detected_story_id: string | null
  started_at: string
  ended_at: string | null
}

export default function Room() {
  const { id = '' } = useParams()
  const { entries, connected, error } = useSseRoom(id || null)
  const [meta, setMeta] = useState<SessionMetaLite | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // Sessions list is admin-shared; pluck this id from the active list.
    api
      .get<SessionMetaLite[]>('/api/v1/sessions')
      .then((rows) => {
        if (cancelled) return
        const hit = rows.find((r) => r.id === id) ?? null
        setMeta(hit)
      })
      .catch(() => {
        if (!cancelled) setMeta(null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="min-h-full flex flex-col">
      <TopNav current="live" />
      <main className="flex-1 flex flex-col p-6 min-h-0">
        <header className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <Link to="/live" className="text-xs text-muted hover:text-fg">
              ← back to live
            </Link>
            <h1 className="font-mono text-sm mt-1">room · {id.slice(0, 8)}</h1>
            {meta && (
              <p className="text-xs text-muted mt-1" title={meta.cwd}>
                {meta.cli} · {meta.cwd}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
            {meta && (
              <ReassignStoryDropdown
                sessionId={meta.id}
                currentStoryId={meta.detected_story_id}
                onReassigned={(next) =>
                  setMeta((m) => (m ? { ...m, detected_story_id: next } : m))
                }
              />
            )}
            <span
              className={`inline-flex items-center gap-1.5 ${
                connected ? 'text-emerald-500' : 'text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block size-2 rounded-full ${
                  connected ? 'bg-emerald-500' : 'bg-muted/50'
                }`}
              />
              {connected ? 'connected' : 'reconnecting…'}
            </span>
            {error && <span className="text-red-500">{error}</span>}
          </div>
        </header>
        <StdoutStream entries={entries} />
      </main>
    </div>
  )
}
