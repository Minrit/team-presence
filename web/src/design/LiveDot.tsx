export function LiveDot({
  color = 'var(--success)',
  size = 7,
}: {
  color?: string
  size?: number
}) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: '50%',
          background: color,
          opacity: 0.3,
          animation: 'tp-pulse 1.6s ease-out infinite',
        }}
      />
    </span>
  )
}
