import { STATUS_META } from './meta'
import type { StoryStatus } from '../types'

export function StatusPill({
  status,
  dense = false,
}: {
  status: StoryStatus
  dense?: boolean
}) {
  const m = STATUS_META[status] ?? STATUS_META.todo
  return (
    <span
      className="label"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: dense ? '2px 6px' : '3px 8px',
        background: m.bg,
        color: m.fg,
        border: `1.5px solid ${m.border}`,
        borderRadius: 0,
        font: `700 ${dense ? 9.5 : 10.5}px/1 var(--font-label)`,
        letterSpacing: '0.15em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          background: m.dot,
          display: 'inline-block',
        }}
      />
      {m.label}
    </span>
  )
}
