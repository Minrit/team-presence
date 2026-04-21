import { STATUS_META } from './meta'
import type { StoryStatus } from '../types'

/** Industrial square-infill status glyph. */
export function StatusIcon({
  status,
  size = 14,
}: {
  status: StoryStatus
  size?: number
}) {
  const m = STATUS_META[status]
  const stroke = 'var(--steel)'
  if (status === 'done') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <rect x="1" y="1" width="12" height="12" fill={m.dot} stroke={stroke} strokeWidth="1" />
        <polyline
          points="4,7.2 6.2,9.4 10.2,5"
          fill="none"
          stroke="var(--cream)"
          strokeWidth="1.8"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    )
  }
  if (status === 'in_progress') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <rect x="1" y="1" width="12" height="12" fill="none" stroke={m.dot} strokeWidth="1.5" />
        <rect x="1" y="1" width="6" height="12" fill={m.dot} />
      </svg>
    )
  }
  if (status === 'review') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <rect
          x="1"
          y="1"
          width="12"
          height="12"
          fill="none"
          stroke={m.dot}
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
      </svg>
    )
  }
  if (status === 'blocked') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <rect x="1" y="1" width="12" height="12" fill={m.dot} stroke={stroke} strokeWidth="1" />
        <line x1="3" y1="3" x2="11" y2="11" stroke="var(--cream)" strokeWidth="1.8" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14">
      <rect x="1" y="1" width="12" height="12" fill="none" stroke="var(--rule)" strokeWidth="1.5" />
    </svg>
  )
}
