import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Icon } from '../design/Icon'
import { AgentChip } from '../design/AgentChip'
import { LiveDot } from '../design/LiveDot'
import { useSseRoom } from '../hooks/useSseRoom'
import type { AgentKind, ContentRole } from '../types'
import { TerminalLine, type TerminalLineT, type LineKind } from './TerminalLine'

export interface TerminalHeader {
  cwd?: string
  branch?: string
  storyId?: string
  agentKind: AgentKind | string
  userLabel?: string
  /** Optional right-side chip (e.g. session status). */
  rightSlot?: ReactNode
}

export function Terminal({
  sessionId,
  header,
  focused = true,
  onFocusClick,
  compact = false,
  staticLines,
}: {
  sessionId: string | null
  header: TerminalHeader
  focused?: boolean
  onFocusClick?: () => void
  compact?: boolean
  /** Bypass SSE; render a fixed set of lines (used for empty/static demos). */
  staticLines?: TerminalLineT[]
}) {
  const { entries, connected, error } = useSseRoom(staticLines ? null : sessionId)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const lines = useMemo<TerminalLineT[]>(() => {
    if (staticLines) return staticLines
    return entries.map((e) => roomFrameToLine(e.frame))
  }, [entries, staticLines])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines.length])

  return (
    <div
      onClick={onFocusClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--steel-2)',
        borderRadius: 0,
        overflow: 'hidden',
        border: `${focused ? '2px' : '1.5px'} solid ${focused ? 'var(--red)' : 'var(--steel)'}`,
        boxShadow: focused ? '2px 2px 0 var(--steel)' : 'none',
        transition: 'border-color 120ms, box-shadow 120ms',
        cursor: onFocusClick ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1.5px solid var(--steel)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          background: 'var(--steel)',
        }}
      >
        <AgentChip agentKind={header.agentKind} />
        {header.userLabel && (
          <span
            className="label"
            style={{
              color: 'var(--cream)',
              font: '700 10.5px/1 var(--font-label)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {header.userLabel}
          </span>
        )}
        {header.storyId && (
          <span
            className="mono"
            style={{
              color: 'var(--cream-3)',
              font: '500 10.5px/1 var(--mono)',
              letterSpacing: '0.05em',
            }}
          >
            {header.storyId}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {connected ? (
          <span
            title="Live"
            className="label"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--red)',
              font: '700 10px/1 var(--font-label)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            <LiveDot size={5} />
            Live
          </span>
        ) : (
          <span
            className="label"
            style={{
              color: 'var(--cream-3)',
              font: '500 10px/1 var(--font-label)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            {error || 'Offline'}
          </span>
        )}
        {header.rightSlot}
      </div>

      {/* Meta bar */}
      {(header.cwd || header.branch) && (
        <div
          style={{
            padding: '5px 12px',
            borderBottom: '1px solid var(--steel)',
            background: 'var(--steel-3)',
            font: '500 10.5px/1 var(--mono)',
            color: 'var(--cream-3)',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {header.cwd && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="box" size={11} color="var(--cream-3)" />
              {shorten(header.cwd, 48)}
            </span>
          )}
          {header.branch && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="branch" size={11} color="var(--cream-3)" />
              {header.branch}
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: compact ? 180 : 0,
          overflow: 'auto',
          padding: '8px 0',
        }}
      >
        {lines.length === 0 && (
          <div
            style={{
              padding: '24px 14px',
              color: '#52525b',
              font: '400 12px/1.5 var(--mono)',
            }}
          >
            Waiting for output…
          </div>
        )}
        {lines.map((l, i) => (
          <TerminalLine key={i} line={l} />
        ))}
      </div>

      {/* Input bar (display-only — collector captures the real input) */}
      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid var(--term-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          font: '400 11px/1 var(--mono)',
          color: '#52525b',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#818cf8' }}>$</span>
        <span>read-only view — input is captured by the collector on the owner's machine</span>
      </div>
    </div>
  )
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s
  return `…${s.slice(s.length - max + 1)}`
}

/** Heuristic mapping from the room SSE frame to a terminal line kind. */
export function roomFrameToLine(frame: import('../types').RoomFrame): TerminalLineT {
  if (frame.type === 'session_start') {
    return {
      kind: 'system',
      text: `session started · ${frame.cwd}${frame.git_branch ? ` · ${frame.git_branch}` : ''}`,
      time: shortTime(frame.started_at),
    }
  }
  if (frame.type === 'session_end') {
    return {
      kind: 'status',
      text: `session ended${frame.exit_code != null ? ` · exit ${frame.exit_code}` : ''}`,
      time: shortTime(frame.ended_at),
    }
  }
  if (frame.type === 'heartbeat') {
    return {
      kind: 'system',
      text: `heartbeat · ${frame.active_session_ids.length} active`,
      time: shortTime(frame.sent_at),
    }
  }
  const kind = roleToKind(frame.role)
  return {
    kind,
    text: frame.text,
    time: shortTime(frame.ts),
  }
}

function roleToKind(role: ContentRole): LineKind {
  switch (role) {
    case 'user':
      return 'prompt'
    case 'assistant':
      return 'stdout'
    case 'tool_use':
      return 'tool'
    case 'tool_result':
      return 'stdout'
    case 'meta':
      return 'system'
  }
}

function shortTime(iso: string): string {
  try {
    const d = new Date(iso)
    const hh = d.getHours().toString().padStart(2, '0')
    const mm = d.getMinutes().toString().padStart(2, '0')
    const ss = d.getSeconds().toString().padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  } catch {
    return '      '
  }
}
