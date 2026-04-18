import { PRIO_META } from './meta'
import type { Priority as PriorityLevel } from '../types'

export function Priority({
  level,
  showLabel = false,
}: {
  level: PriorityLevel
  showLabel?: boolean
}) {
  const m = PRIO_META[level]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        color: m.color,
        font: '500 12px/1 var(--font)',
      }}
    >
      <svg width="12" height="10" viewBox="0 0 12 10">
        <rect
          x="1"
          y={10 - m.heights[0]}
          width="2"
          height={m.heights[0]}
          rx="0.5"
          fill={m.color}
          opacity={m.opacity}
        />
        <rect
          x="5"
          y={10 - m.heights[1]}
          width="2"
          height={m.heights[1]}
          rx="0.5"
          fill={m.color}
          opacity={m.opacity}
        />
        <rect
          x="9"
          y={10 - m.heights[2]}
          width="2"
          height={m.heights[2]}
          rx="0.5"
          fill={m.color}
          opacity={m.opacity}
        />
      </svg>
      {showLabel ? m.label : level}
    </span>
  )
}
