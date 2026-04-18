import { STATUS_META } from './meta'
import type { StoryStatus } from '../types'

export function StatusIcon({
  status,
  size = 14,
}: {
  status: StoryStatus
  size?: number
}) {
  const m = STATUS_META[status]
  if (status === 'done') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6.5" fill={m.dot} />
        <polyline
          points="4,7.2 6.2,9.4 10.2,5"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (status === 'in_progress') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" fill="none" stroke={m.dot} strokeWidth="1.5" />
        <path d="M 7 1 A 6 6 0 0 1 13 7 L 7 7 z" fill={m.dot} />
      </svg>
    )
  }
  if (status === 'review') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <circle
          cx="7"
          cy="7"
          r="6"
          fill="none"
          stroke={m.dot}
          strokeWidth="1.5"
          strokeDasharray="2.5 2"
        />
      </svg>
    )
  }
  if (status === 'blocked') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6.5" fill={m.dot} />
        <line x1="4" y1="4" x2="10" y2="10" stroke="#fff" strokeWidth="1.5" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="6" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" />
    </svg>
  )
}
