import type { CSSProperties } from 'react'

export type LineKind =
  | 'system'
  | 'prompt'
  | 'think'
  | 'tool'
  | 'stdout'
  | 'file'
  | 'diff-add'
  | 'diff-del'
  | 'status'
  | 'error'

export interface TerminalLineT {
  kind: LineKind
  text: string
  time?: string
  attr?: string
}

const base: CSSProperties = {
  padding: '1px 14px',
  font: '400 12px/18px var(--mono)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

function Gutter({ t }: { t?: string }) {
  return (
    <span
      style={{ color: '#52525b', marginRight: 10, userSelect: 'none' }}
    >
      {t ?? '      '}
    </span>
  )
}

export function TerminalLine({ line }: { line: TerminalLineT }) {
  const { kind, text, time, attr } = line
  switch (kind) {
    case 'system':
      return (
        <div style={{ ...base, color: '#71717a' }}>
          <Gutter t={time} />
          <span style={{ color: '#a1a1aa' }}>{text}</span>
        </div>
      )
    case 'prompt':
      return (
        <div
          style={{
            ...base,
            background: 'rgba(99,102,241,0.06)',
            borderLeft: '2px solid #818cf8',
            paddingLeft: 12,
            color: '#e4e4e7',
          }}
        >
          <Gutter t={time} />
          <span style={{ color: '#818cf8', marginRight: 8, fontWeight: 500 }}>{'>'}</span>
          {text}
        </div>
      )
    case 'think':
      return (
        <div style={{ ...base, color: '#a78bfa', fontStyle: 'italic' }}>
          <Gutter t={time} />
          <span style={{ opacity: 0.7 }}>✦ </span>
          {text}
        </div>
      )
    case 'tool':
      return (
        <div style={{ ...base, color: '#d4d4d8' }}>
          <Gutter t={time} />
          <span style={{ color: '#10b981' }}>◉ {text}</span>
          {attr && (
            <span style={{ color: '#71717a' }}>
              {' '}
              · <span style={{ color: '#a1a1aa' }}>{attr}</span>
            </span>
          )}
        </div>
      )
    case 'stdout':
      return (
        <div style={{ ...base, color: '#d4d4d8' }}>
          <Gutter t={time} />
          {text}
        </div>
      )
    case 'file':
      return (
        <div style={{ ...base, color: '#60a5fa' }}>
          <Gutter t={time} />
          {text}
        </div>
      )
    case 'diff-add':
      return (
        <div style={{ ...base, background: 'rgba(16,185,129,0.08)', color: '#6ee7b7' }}>
          <Gutter />
          {text}
        </div>
      )
    case 'diff-del':
      return (
        <div style={{ ...base, background: 'rgba(239,68,68,0.08)', color: '#fca5a5' }}>
          <Gutter />
          {text}
        </div>
      )
    case 'status':
      return (
        <div style={{ ...base, color: '#fbbf24' }}>
          <Gutter t={time} />
          <span style={{ marginRight: 6 }}>●</span>
          {text}
        </div>
      )
    case 'error':
      return (
        <div style={{ ...base, color: '#f87171' }}>
          <Gutter t={time} />
          {text}
        </div>
      )
    default:
      return (
        <div style={base}>
          <Gutter t={time} />
          {text}
        </div>
      )
  }
}
