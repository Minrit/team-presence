import type { CSSProperties } from 'react'

export interface AvatarUser {
  id: string
  name: string
  initial: string
  hue: number
  status?: 'active' | 'idle' | 'offline'
}

/** Stable hue derived from a UUID (unused in ZIRA but kept for API parity). */
export function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

export function userToAvatar(
  raw: { id: string; email?: string; display_name?: string; displayName?: string },
  status?: 'active' | 'idle' | 'offline',
): AvatarUser {
  const display =
    raw.display_name || raw.displayName || raw.email?.split('@')[0] || 'user'
  const initial = display.charAt(0).toUpperCase() || '?'
  return { id: raw.id, name: display, initial, hue: hueFromId(raw.id), status }
}

/** ZIRA avatar — square steel tag with Oswald initial and optional status dot. */
export function Avatar({
  user,
  size = 24,
  ring = false,
  dot = false,
  style,
}: {
  user: AvatarUser | null | undefined
  size?: number
  ring?: boolean
  dot?: boolean
  style?: CSSProperties
}) {
  if (!user) return null
  const dotColor =
    user.status === 'active'
      ? 'var(--red)'
      : user.status === 'idle'
      ? 'var(--warn)'
      : 'var(--muted)'
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <div
        title={user.name}
        style={{
          width: size,
          height: size,
          background: 'var(--steel)',
          color: 'var(--cream)',
          font: `700 ${Math.max(10, size * 0.42)}px/1 var(--font-label)`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          border: '1.5px solid var(--steel-2)',
          boxShadow: ring ? '0 0 0 2px var(--cream), 0 0 0 3.5px var(--red)' : 'none',
        }}
      >
        {user.initial}
      </div>
      {dot && (
        <span
          style={{
            position: 'absolute',
            right: -2,
            top: -2,
            width: Math.max(7, size * 0.3),
            height: Math.max(7, size * 0.3),
            background: dotColor,
            border: '1.5px solid var(--cream)',
          }}
        />
      )}
    </div>
  )
}

export function AvatarStack({
  users,
  size = 22,
  max = 4,
}: {
  users: AvatarUser[]
  size?: number
  max?: number
}) {
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  return (
    <div style={{ display: 'inline-flex' }}>
      {shown.map((u, i) => (
        <div
          key={u.id}
          style={{
            marginLeft: i === 0 ? 0 : -4,
            zIndex: shown.length - i,
            boxShadow: '-1px 0 0 var(--cream)',
          }}
        >
          <Avatar user={u} size={size} />
        </div>
      ))}
      {rest > 0 && (
        <div
          style={{
            marginLeft: -4,
            width: size,
            height: size,
            background: 'var(--cream-3)',
            color: 'var(--ink)',
            font: `700 ${Math.max(9, size * 0.4)}px/1 var(--font-label)`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid var(--steel)',
            letterSpacing: '0.05em',
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  )
}
