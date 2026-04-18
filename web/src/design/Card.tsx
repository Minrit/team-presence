import type { CSSProperties, ReactNode } from 'react'

export function Card({
  children,
  style,
  interactive,
  onClick,
}: {
  children: ReactNode
  style?: CSSProperties
  interactive?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      className={interactive ? 'tp-fade-in' : undefined}
    >
      {children}
    </div>
  )
}
