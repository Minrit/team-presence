/** Caliper meter — N steel-ruled segments that fill left-to-right.
 *  Preserves the {value, total, color, height} API used across pages. */
export function ProgressBar({
  value,
  total,
  color = 'var(--red)',
  height = 8,
  segments = 20,
}: {
  value: number
  total: number
  color?: string
  height?: number
  segments?: number
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0
  const filled = Math.round(segments * pct)
  return (
    <div style={{ display: 'flex', gap: 2, height, alignItems: 'stretch', width: '100%' }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: i < filled ? color : 'var(--cream-3)',
            borderTop: '1px solid var(--steel)',
            borderBottom: '1px solid var(--steel)',
            borderLeft: i === 0 ? '1px solid var(--steel)' : 'none',
            borderRight: i === segments - 1 ? '1px solid var(--steel)' : 'none',
          }}
        />
      ))}
    </div>
  )
}
