import type { CSSProperties, ReactNode } from 'react'

type PanelVariant = 'cream' | 'dark' | 'paper'

const V: Record<PanelVariant, { bg: string; border: string; fg: string; headBg: string; codeBg: string }> = {
  cream: { bg: 'var(--cream)', border: 'var(--steel)',   fg: 'var(--ink)',   headBg: 'var(--cream-2)', codeBg: 'var(--cream-3)' },
  paper: { bg: 'var(--paper)', border: 'var(--steel)',   fg: 'var(--ink)',   headBg: 'var(--cream-2)', codeBg: 'var(--cream-3)' },
  dark:  { bg: 'var(--steel)', border: 'var(--steel-2)', fg: 'var(--cream)', headBg: 'var(--steel-2)', codeBg: 'var(--steel)'   },
}

/** Industrial container — riveted corners, optional titled head with serial code,
 *  optional striped divider beneath the head.
 *  Ported from ZiraUI.jsx ZPanel(). */
export function Panel({
  children,
  title,
  code,
  corner,
  stripe = true,
  style,
  bodyStyle,
  inset = false,
  variant = 'cream',
  rivets = true,
}: {
  children?: ReactNode
  title?: ReactNode
  code?: ReactNode
  corner?: ReactNode
  stripe?: boolean
  style?: CSSProperties
  bodyStyle?: CSSProperties
  inset?: boolean
  variant?: PanelVariant
  rivets?: boolean
}) {
  const v = V[variant]
  return (
    <div
      style={{
        background: v.bg,
        border: `2px solid ${v.border}`,
        color: v.fg,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...style,
      }}
    >
      {rivets && (
        <>
          <span className="rivet rivet-xs" style={{ position: 'absolute', top: 4, left: 4 }} />
          <span className="rivet rivet-xs" style={{ position: 'absolute', top: 4, right: 4 }} />
          <span className="rivet rivet-xs" style={{ position: 'absolute', bottom: 4, left: 4 }} />
          <span className="rivet rivet-xs" style={{ position: 'absolute', bottom: 4, right: 4 }} />
        </>
      )}

      {(title || code) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            borderBottom: `2px solid ${v.border}`,
            background: v.headBg,
          }}
        >
          <div
            className="label"
            style={{
              padding: '8px 14px',
              font: `700 11px/1 var(--font-label)`,
              letterSpacing: '0.15em',
              color: v.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
            }}
          >
            {title && (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title}
              </span>
            )}
            {corner && <span style={{ marginLeft: 'auto' }}>{corner}</span>}
          </div>
          {code && (
            <div
              className="mono"
              style={{
                padding: '8px 12px',
                font: '500 10px/1 var(--mono)',
                letterSpacing: '0.05em',
                color: variant === 'dark' ? 'var(--cream-3)' : 'var(--muted)',
                borderLeft: `1.5px solid ${v.border}`,
                background: v.codeBg,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {code}
            </div>
          )}
        </div>
      )}

      {stripe && (title || code) && (
        <div
          className="tick-stripe"
          style={{
            background: `repeating-linear-gradient(90deg, var(--steel) 0 8px, ${v.bg} 8px 16px)`,
          }}
        />
      )}

      <div style={{ flex: 1, minHeight: 0, padding: inset ? '14px 16px' : 0, ...bodyStyle }}>
        {children}
      </div>
    </div>
  )
}

/** Short divider band inside a Panel — label + dashed ticks + optional right slot. */
export function TickDivider({
  label,
  right,
}: {
  label: ReactNode
  right?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        borderTop: '1.5px solid var(--steel)',
        borderBottom: '1px solid var(--rule)',
        background: 'var(--cream-2)',
      }}
    >
      <span
        className="label"
        style={{
          font: '700 10px/1 var(--font-label)',
          color: 'var(--ink)',
          letterSpacing: '0.15em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 5,
          borderTop: '1px solid var(--rule)',
          backgroundImage:
            'repeating-linear-gradient(90deg, var(--rule) 0 1px, transparent 1px 5px)',
        }}
      />
      {right}
    </div>
  )
}

/** Engraved oswald-uppercase stamp, optionally rotated. */
export function Stamp({
  children,
  color = 'var(--red-ink)',
  rotate = 0,
  style,
}: {
  children: ReactNode
  color?: string
  rotate?: number
  style?: CSSProperties
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        border: `2px solid ${color}`,
        color,
        font: '800 10.5px/1.1 var(--font-label)',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        background: 'transparent',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
