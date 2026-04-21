import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="mono"
      style={{
        display: 'inline-block',
        padding: '1px 5px',
        minWidth: 16,
        textAlign: 'center',
        background: 'var(--cream-3)',
        border: '1.5px solid var(--steel)',
        borderRadius: 0,
        font: '600 10px/15px var(--mono)',
        color: 'var(--ink)',
      }}
    >
      {children}
    </kbd>
  )
}
