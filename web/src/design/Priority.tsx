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
      className="label"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: m.color,
        font: '700 10px/1 var(--font-label)',
        letterSpacing: '0.12em',
      }}
    >
      <svg width="14" height="12" viewBox="0 0 20 18" style={{ flexShrink: 0 }}>
        <rect x="0"  y={18 - m.heights[0]} width="5" height={m.heights[0]} fill={m.color} opacity={m.opacities[0]} />
        <rect x="7"  y={18 - m.heights[1]} width="5" height={m.heights[1]} fill={m.color} opacity={m.opacities[1]} />
        <rect x="14" y={18 - m.heights[2]} width="5" height={m.heights[2]} fill={m.color} opacity={m.opacities[2]} />
      </svg>
      {showLabel ? m.label : level}
    </span>
  )
}
