import { useState, type CSSProperties, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'
export type ButtonSize = 'default' | 'sm' | 'lg'

const VARIANTS: Record<
  ButtonVariant,
  { bg: string; fg: string; border: string; hover: string; activeBg: string; activeFg: string; shadow: string }
> = {
  primary: {
    bg: 'var(--red)',
    fg: 'var(--cream)',
    border: 'var(--red-ink)',
    hover: 'var(--red-ink)',
    activeBg: 'var(--steel)',
    activeFg: 'var(--cream)',
    shadow: '2px 2px 0 var(--steel)',
  },
  secondary: {
    bg: 'var(--cream-2)',
    fg: 'var(--ink)',
    border: 'var(--steel)',
    hover: 'var(--cream-3)',
    activeBg: 'var(--steel)',
    activeFg: 'var(--cream)',
    shadow: 'none',
  },
  ghost: {
    bg: 'transparent',
    fg: 'var(--ink)',
    border: 'transparent',
    hover: 'var(--cream-2)',
    activeBg: 'var(--cream-3)',
    activeFg: 'var(--ink)',
    shadow: 'none',
  },
  soft: {
    bg: 'var(--cream-2)',
    fg: 'var(--fg-2)',
    border: 'var(--rule)',
    hover: 'var(--cream-3)',
    activeBg: 'var(--steel)',
    activeFg: 'var(--cream)',
    shadow: 'none',
  },
  danger: {
    bg: 'var(--iron)',
    fg: 'var(--cream)',
    border: 'var(--steel)',
    hover: 'var(--red-ink)',
    activeBg: 'var(--steel)',
    activeFg: 'var(--cream)',
    shadow: '2px 2px 0 var(--steel)',
  },
}

const SIZES: Record<ButtonSize, { h: number; px: number; fs: number }> = {
  default: { h: 30, px: 14, fs: 11 },
  sm:      { h: 24, px: 10, fs: 10 },
  lg:      { h: 36, px: 18, fs: 12 },
}

export function Button({
  variant = 'primary',
  size = 'default',
  icon,
  iconRight,
  children,
  onClick,
  disabled,
  active,
  type = 'button',
  style,
  title,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  active?: boolean
  type?: 'button' | 'submit' | 'reset'
  style?: CSSProperties
  title?: string
}) {
  const v = VARIANTS[variant]
  const s = SIZES[size]
  const [hover, setHover] = useState(false)
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      className="label"
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        background: active ? v.activeBg : hover ? v.hover : v.bg,
        color: active ? v.activeFg : v.fg,
        border: `1.5px solid ${v.border === 'transparent' ? 'transparent' : v.border}`,
        borderRadius: 0,
        font: `700 ${s.fs}px/1 var(--font-label)`,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        transition: 'background 80ms',
        boxShadow: active ? 'none' : v.shadow,
        ...style,
      }}
    >
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
      {iconRight}
    </button>
  )
}
