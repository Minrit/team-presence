export function BurnupChart({
  series,
  total,
  width = 720,
  height = 120,
  color = 'var(--hv-accent)',
  labels,
}: {
  series: number[]
  total: number
  width?: number
  height?: number
  color?: string
  labels?: string[]
}) {
  const pad = { top: 16, right: 18, bottom: 28, left: 44 }
  const plotW = Math.max(1, width - pad.left - pad.right)
  const plotH = Math.max(1, height - pad.top - pad.bottom)
  const rawMax = Math.max(total, ...series, 1)
  const max = niceMax(rawMax)
  const y = (value: number) => pad.top + plotH - (value / max) * plotH
  const x = (index: number) =>
    pad.left + (index / Math.max(1, series.length - 1)) * plotW

  if (series.length === 0 || total <= 0) {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--fg-3)',
          font: '400 12px/1 var(--font)',
        }}
        role="img"
        aria-label="Burnup chart has no sprint points yet"
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ display: 'block', position: 'absolute', inset: 0 }}
          aria-hidden="true"
        >
          <line
            x1={pad.left}
            y1={height - pad.bottom}
            x2={width - pad.right}
            y2={height - pad.bottom}
            stroke="var(--hv-border-2)"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span>No sprint points yet</span>
      </div>
    )
  }

  const points = series
    .map((v, i) => {
      return `${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    .join(' ')

  const area = `${pad.left},${height - pad.bottom} ${points} ${width - pad.right},${height - pad.bottom}`
  const totalY = y(total)
  const ticks = [0, max / 2, max]
  const firstLabel = labels?.[0]
  const lastLabel = labels?.[labels.length - 1]
  const percentX = (value: number) => `${(value / width) * 100}%`
  const percentY = (value: number) => `${(value / height) * 100}%`

  return (
    <div
      style={{ position: 'relative', width: '100%', height }}
      role="img"
      aria-label={`Burnup chart: ${series[series.length - 1]} of ${total} points complete`}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block', position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        {ticks.map((tick) => {
          const ty = y(tick)
          return (
            <line
              key={tick}
              x1={pad.left}
              y1={ty}
              x2={width - pad.right}
              y2={ty}
              stroke="var(--hv-border-2)"
              strokeDasharray={tick === 0 ? undefined : '3 5'}
              opacity={tick === 0 ? 1 : 0.7}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
        <line
          x1={pad.left}
          y1={totalY}
          x2={width - pad.right}
          y2={totalY}
          stroke="var(--steel)"
          strokeDasharray="6 5"
          opacity="0.72"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          fill={color}
          opacity="0.09"
          points={area}
        />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {ticks.map((tick) => (
        <span
          key={`label-${tick}`}
          style={{
            position: 'absolute',
            left: 0,
            top: percentY(y(tick)),
            transform: 'translateY(-50%)',
            width: pad.left - 10,
            color: 'var(--fg-3)',
            font: '400 10.5px/1 var(--mono)',
            textAlign: 'right',
            pointerEvents: 'none',
          }}
        >
          {Math.round(tick)}
        </span>
      ))}
      {series.map((v, i) => (
        <span
          key={`${i}-${v}`}
          style={{
            position: 'absolute',
            left: percentX(x(i)),
            top: percentY(y(v)),
            width: i === series.length - 1 ? 8 : 5,
            height: i === series.length - 1 ? 8 : 5,
            borderRadius: 999,
            background: color,
            border: '2px solid var(--cream)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      ))}
      {firstLabel ? (
        <span
          style={{
            position: 'absolute',
            left: percentX(pad.left),
            bottom: 0,
            color: 'var(--fg-3)',
            font: '400 10.5px/1 var(--mono)',
            pointerEvents: 'none',
          }}
        >
          {firstLabel}
        </span>
      ) : null}
      {lastLabel && lastLabel !== firstLabel ? (
        <span
          style={{
            position: 'absolute',
            right: percentX(pad.right),
            bottom: 0,
            color: 'var(--fg-3)',
            font: '400 10.5px/1 var(--mono)',
            pointerEvents: 'none',
          }}
        >
          {lastLabel}
        </span>
      ) : null}
    </div>
  )
}

function niceMax(value: number): number {
  if (value <= 5) return 5
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const nice =
    scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * magnitude
}
