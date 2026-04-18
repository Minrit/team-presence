import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RoomEntry } from '../hooks/useSseRoom'

export interface StdoutStreamProps {
  entries: RoomEntry[]
  /** Color/prefix role inside the feed. */
  showRole?: boolean
}

export default function StdoutStream({ entries, showRole = true }: StdoutStreamProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(true)
  const [, setLastLen] = useState(0)

  // Track user scroll — if they scroll away from bottom, stop auto-sticking.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
      setPinned(atBottom)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-stick scroll when pinned.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !pinned) return
    el.scrollTop = el.scrollHeight
    setLastLen(entries.length)
  }, [entries, pinned])

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto font-mono text-[12px] leading-5 p-4 bg-black/20 rounded-lg border border-border"
      >
        {entries.length === 0 ? (
          <p className="text-muted text-xs italic">waiting for frames…</p>
        ) : (
          entries.map((e) => renderEntry(e, showRole))
        )}
      </div>
      {!pinned && (
        <button
          type="button"
          className="absolute bottom-3 right-3 rounded-full bg-card border border-border px-3 py-1 text-[11px] text-muted hover:text-fg shadow"
          onClick={() => {
            const el = containerRef.current
            if (el) el.scrollTop = el.scrollHeight
            setPinned(true)
          }}
        >
          Paused — jump to latest
        </button>
      )}
    </div>
  )
}

function renderEntry(e: RoomEntry, showRole: boolean): React.ReactNode {
  const f = e.frame
  if (f.type === 'session_start') {
    return (
      <div key={e.id} className="text-accent/80">
        ⎸ started {shortTime(f.started_at)} · {f.cli} · {f.cwd}
        {f.git_branch ? ` · ${f.git_branch}` : ''}
      </div>
    )
  }
  if (f.type === 'session_end') {
    return (
      <div key={e.id} className="text-muted">
        ⎸ ended {shortTime(f.ended_at)}
        {f.exit_code != null ? ` · exit ${f.exit_code}` : ''}
      </div>
    )
  }
  if (f.type === 'session_content') {
    const cls = roleColor(f.role)
    return (
      <div key={e.id} className={cls}>
        {showRole && <span className="opacity-60 pr-2">[{f.role}]</span>}
        <span className="whitespace-pre-wrap break-words">{f.text}</span>
      </div>
    )
  }
  // heartbeat is not shown in stream
  return null
}

function roleColor(role: string): string {
  switch (role) {
    case 'user':
      return 'text-cyan-400'
    case 'assistant':
      return 'text-fg'
    case 'tool_use':
      return 'text-yellow-400'
    case 'tool_result':
      return 'text-emerald-400'
    default:
      return 'text-muted'
  }
}

function shortTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString()
  } catch {
    return ts
  }
}
