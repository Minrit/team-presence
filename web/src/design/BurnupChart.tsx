export function BurnupChart({
  series,
  total,
  width = 320,
  height = 120,
  color = 'var(--hv-accent)',
}: {
  series: number[]
  total: number
  width?: number
  height?: number
  color?: string
}) {
  if (series.length === 0 || total <= 0) {
    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        <line
          x1="0"
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="var(--hv-border)"
        />
      </svg>
    )
  }

  const max = Math.max(total, ...series)
  const points = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * width
      const y = height - (v / max) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const totalY = height - (total / max) * height

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
    >
      <line
        x1="0"
        y1={totalY}
        x2={width}
        y2={totalY}
        stroke="var(--hv-border)"
        strokeDasharray="4 4"
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
