import { useState, type CSSProperties, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'
export type ButtonSize = 'default' | 'sm' | 'lg'

const VARIANTS: Record<
  ButtonVariant,
  { bg: string; fg: string; border: string; hover: string }
> = {
  primary:   { bg: 'var(--hv-accent)', fg: '#fff',         border: 'transparent',    hover: 'var(--accent-hover)' },
  secondary: { bg: 'var(--surface)',   fg: 'var(--hv-fg)', border: 'var(--hv-border)', hover: 'var(--bg-2)' },
  ghost:     { bg: 'transparent',      fg: 'var(--fg-2)',  border: 'transparent',    hover: 'var(--bg-2)' },
  soft:      { bg: 'var(--bg-2)',      fg: 'var(--hv-fg)', border: 'transparent',    hover: '#ebebef' },
  danger:    { bg: 'var(--danger)',    fg: '#fff',         border: 'transparent',    hover: '#dc2626' },
}

const SIZES: Record<ButtonSize, { h: number; px: number; fs: number }> = {
  default: { h: 30, px: 12, fs: 13 },
  sm:      { h: 26, px: 10, fs: 12.5 },
  lg:      { h: 36, px: 16, fs: 14 },
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
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        background: active ? 'var(--bg-2)' : hover ? v.hover : v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--radius-sm)',
        font: `500 ${s.fs}px/1 var(--font)`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        transition: 'background 120ms ease',
        boxShadow:
          variant === 'primary'
            ? '0 1px 2px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
            : 'var(--shadow-sm)',
        ...style,
      }}
    >
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
      {iconRight}
    </button>
  )
}
