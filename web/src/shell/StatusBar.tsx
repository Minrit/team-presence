import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** v2 bottom status bar — thin mono strip showing system indicators. */
export function StatusBar() {
  const { pathname } = useLocation()
  const [clock, setClock] = useState(() => utcStamp())

  useEffect(() => {
    const id = setInterval(() => setClock(utcStamp()), 30_000)
    return () => clearInterval(id)
  }, [])

  const view = pathname === '/' ? 'CURRENT' : pathname.replace(/^\//, '').toUpperCase()

  return (
    <div
      className="mono"
      style={{
        height: 22,
        background: 'var(--steel)',
        color: 'var(--cream)',
        borderTop: '2px solid var(--red)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 12px',
        font: '500 10px/1 var(--mono)',
        letterSpacing: '0.08em',
        flexShrink: 0,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            background: 'var(--ok)',
          }}
        />
        System OK
      </span>
      <Sep />
      <span>
        TX <span style={{ color: 'var(--ok)' }}>OK</span>
      </span>
      <Sep />
      <span>
        RX <span style={{ color: 'var(--ok)' }}>OK</span>
      </span>
      <Sep />
      <span>
        View · <span style={{ color: 'var(--red)' }}>{view}</span>
      </span>
      <Sep />
      <span>
        Route · <span style={{ color: 'var(--cyan-2)' }}>{pathname}</span>
      </span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 14 }}>
        <span>Clock · {clock}</span>
        <span>Build · 2026.04.19</span>
        <span style={{ color: 'var(--red)' }}>SER. 001</span>
      </span>
    </div>
  )
}

function Sep() {
  return <span style={{ color: 'var(--cream-3)' }}>·</span>
}

function utcStamp(): string {
  const d = new Date()
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}Z`
}
