import { AGENTS } from './meta'
import type { AgentKind } from '../types'

export function AgentChip({
  agentKind,
  size = 'sm',
}: {
  agentKind: AgentKind | string
  size?: 'sm' | 'md'
}) {
  const meta = AGENTS[agentKind as AgentKind]
  if (!meta) return null
  const sz =
    size === 'sm'
      ? { p: '2px 6px', fs: 9.5, dot: 3 }
      : { p: '3px 7px', fs: 10, dot: 3 }
  return (
    <span
      className="label"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: sz.p,
        background: 'var(--steel)',
        color: 'var(--cream)',
        border: '1.5px solid var(--steel-2)',
        borderRadius: 0,
        font: `700 ${sz.fs}px/1 var(--font-label)`,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      <span
        className="mono"
        style={{
          color: meta.color,
          font: '500 9px/1 var(--mono)',
          letterSpacing: '0.05em',
        }}
      >
        {meta.code}
      </span>
      <span
        style={{
          width: sz.dot,
          height: sz.dot,
          background: 'var(--cream-3)',
        }}
      />
      {meta.short}
    </span>
  )
}
