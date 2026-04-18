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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: dense ? '2px 7px' : '3px 9px 3px 7px',
        background: m.bg,
        color: m.fg,
        borderRadius: 'var(--radius-sm)',
        font: `500 ${dense ? 11.5 : 12}px/1 var(--font)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: m.dot,
        }}
      />
      {m.label}
    </span>
  )
}
