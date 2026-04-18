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
      style={{
        padding: '4px 10px',
        background: active ? 'var(--hv-fg)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--fg-2)',
        border: `1px solid ${active ? 'var(--hv-fg)' : 'var(--hv-border)'}`,
        borderRadius: 999,
        font: '500 12px/1 var(--font)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 120ms ease',
      }}
    >
      {color && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
          }}
        />
      )}
      {children}
    </button>
  )
}
