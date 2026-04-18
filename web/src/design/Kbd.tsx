import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        padding: '1px 5px',
        minWidth: 18,
        textAlign: 'center',
        background: 'var(--bg-2)',
        border: '1px solid var(--hv-border)',
        borderRadius: 4,
        font: '500 11px/15px var(--mono)',
        color: 'var(--fg-3)',
      }}
    >
      {children}
    </kbd>
  )
}
