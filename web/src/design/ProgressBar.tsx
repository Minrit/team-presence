export function ProgressBar({
  value,
  total,
  color = 'var(--hv-accent)',
  height = 4,
}: {
  value: number
  total: number
  color?: string
  height?: number
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div
      style={{
        width: '100%',
        height,
        background: 'var(--bg-2)',
        borderRadius: height,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: height,
          transition: 'width 300ms ease',
        }}
      />
    </div>
  )
}
