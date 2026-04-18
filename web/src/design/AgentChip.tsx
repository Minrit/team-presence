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
      ? { p: '3px 7px 3px 6px', fs: 11.5, dot: 7 }
      : { p: '4px 9px 4px 7px', fs: 12.5, dot: 8 }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: sz.p,
        background: 'var(--surface)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius-sm)',
        font: `500 ${sz.fs}px/1 var(--font)`,
        color: 'var(--fg-2)',
      }}
    >
      <span
        style={{
          width: sz.dot,
          height: sz.dot,
          borderRadius: 2,
          background: meta.color,
        }}
      />
      {meta.short}
    </span>
  )
}
