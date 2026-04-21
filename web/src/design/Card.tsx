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
        background: 'var(--cream)',
        border: '1.5px solid var(--steel)',
        borderRadius: 0,
        boxShadow: 'none',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      className={interactive ? 'tp-fade-in' : undefined}
    >
      {children}
    </div>
  )
}
