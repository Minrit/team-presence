import type { ReactNode } from 'react'

export function Chip({
  children,
  active,
  onClick,
  color,
  title,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  color?: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="label"
      style={{
        padding: '4px 10px',
        background: active ? 'var(--steel)' : 'var(--cream-2)',
        color: active ? 'var(--cream)' : 'var(--ink)',
        border: `1.5px solid ${active ? 'var(--steel-2)' : 'var(--steel)'}`,
        borderRadius: 0,
        font: '700 10.5px/1 var(--font-label)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 80ms ease',
      }}
    >
      {color && (
        <span
          style={{
            width: 8,
            height: 8,
            background: color,
          }}
        />
      )}
      {children}
    </button>
  )
}
