import type { CSSProperties } from 'react'

/** Constructivist Z on a milled-aluminum hex bezel.
 *  Ported from /tmp/zira/nb/project/src/ZiraUI.jsx ZiraLogo(). */
export function ZiraLogo({
  size = 28,
  style,
}: {
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden
    >
      {/* Outer hex bezel — milled aluminum */}
      <polygon
        points="32,3 57,17 57,47 32,61 7,47 7,17"
        fill="var(--cream-2)"
        stroke="var(--steel)"
        strokeWidth="2"
      />
      <polygon
        points="32,7 53,19 53,45 32,57 11,45 11,19"
        fill="none"
        stroke="var(--steel)"
        strokeWidth="0.8"
      />
      {/* Caliper tick marks */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2
        const r1 = 22
        const r2 = i % 3 === 0 ? 25 : 23.5
        return (
          <line
            key={i}
            x1={32 + Math.cos(a) * r1}
            y1={32 + Math.sin(a) * r1}
            x2={32 + Math.cos(a) * r2}
            y2={32 + Math.sin(a) * r2}
            stroke="var(--steel)"
            strokeWidth={i % 3 === 0 ? 1.2 : 0.6}
          />
        )
      })}
      {/* Four flush hex bolts at 0/90/180/270 */}
      {[
        [32, 7],
        [57, 32],
        [32, 57],
        [7, 32],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2.4" fill="var(--steel)" />
          <circle cx={x} cy={y} r="1.4" fill="var(--steel-3)" />
          <line
            x1={x - 1.2}
            y1={y}
            x2={x + 1.2}
            y2={y}
            stroke="var(--steel-2)"
            strokeWidth="0.6"
          />
        </g>
      ))}
      {/* Red Z — constructivist, welded crossbar */}
      <g>
        <rect x="14" y="18" width="30" height="8" fill="var(--red)" />
        <polygon points="44,18 50,18 22,48 16,48" fill="var(--red)" />
        <rect x="16" y="42" width="30" height="8" fill="var(--red)" />
        <circle cx="33" cy="33" r="2" fill="var(--steel)" />
        <circle cx="33" cy="33" r="1" fill="var(--cream-2)" />
      </g>
    </svg>
  )
}
