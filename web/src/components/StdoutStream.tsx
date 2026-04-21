// @ts-nocheck — legacy pre-Hive file; restyled or removed in Unit 15/16/26.
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
        className="absolute inset-0 overflow-y-auto font-mono text-[12px] leading-5 p-4 bg-[var(--steel-2)] text-[var(--cream)] border-[1.5px] border-[var(--steel)]"
      >
        {entries.length === 0 ? (
          <p className="label text-[10px] tracking-[0.15em] text-[var(--cream-3)]">— AWAITING FRAMES —</p>
        ) : (
          entries.map((e) => renderEntry(e, showRole))
        )}
      </div>
      {!pinned && (
        <button
          type="button"
          className="label absolute bottom-3 right-3 bg-[var(--red)] text-[var(--cream)] border-[1.5px] border-[var(--steel)] px-3 py-1 text-[10px] tracking-[0.12em] uppercase hover:bg-[var(--red-ink)]"
          onClick={() => {
            const el = containerRef.current
            if (el) el.scrollTop = el.scrollHeight
            setPinned(true)
          }}
        >
          Paused · Resume
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
      return 'text-[var(--cyan-2)]'
    case 'assistant':
      return 'text-[var(--cream)]'
    case 'tool_use':
      return 'text-[var(--warn)]'
    case 'tool_result':
      return 'text-[var(--ok)]'
    default:
      return 'text-[var(--cream-3)]'
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
