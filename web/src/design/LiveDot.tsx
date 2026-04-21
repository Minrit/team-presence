export function LiveDot({
  color = 'var(--red)',
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
        className="z-pulse"
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
        }}
      />
    </span>
  )
}
