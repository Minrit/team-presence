import type { CSSProperties } from 'react'

export interface AvatarUser {
  id: string
  name: string
  initial: string
  hue: number
  status?: 'active' | 'idle' | 'offline'
}

/** Stable hue derived from a UUID so avatars are deterministic across renders. */
export function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

/** Build an AvatarUser from raw backend user shape. */
export function userToAvatar(
  raw: { id: string; email?: string; display_name?: string; displayName?: string },
  status?: 'active' | 'idle' | 'offline',
): AvatarUser {
  const display =
    raw.display_name || raw.displayName || raw.email?.split('@')[0] || 'user'
  const initial = display.charAt(0).toUpperCase() || '?'
  return { id: raw.id, name: display, initial, hue: hueFromId(raw.id), status }
}

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
      ? 'var(--success)'
      : user.status === 'idle'
      ? 'var(--warning)'
      : '#d4d4d8'
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <div
        title={user.name}
        style={{
          width: size,
          height: size,
          borderRadius: size,
          background: `linear-gradient(135deg, hsl(${user.hue} 70% 55%), hsl(${user.hue + 20} 65% 45%))`,
          color: '#fff',
          font: `600 ${Math.max(9, size * 0.42)}px/1 var(--font)`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: 0.2,
          boxShadow: ring
            ? `0 0 0 2px var(--surface), 0 0 0 3.5px hsl(${user.hue} 70% 55%)`
            : 'none',
        }}
      >
        {user.initial}
      </div>
      {dot && (
        <span
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: Math.max(7, size * 0.28),
            height: Math.max(7, size * 0.28),
            borderRadius: '50%',
            background: dotColor,
            border: '2px solid var(--surface)',
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
            marginLeft: i === 0 ? 0 : -6,
            borderRadius: size + 4,
            boxShadow: '0 0 0 2px var(--surface)',
          }}
        >
          <Avatar user={u} size={size} />
        </div>
      ))}
      {rest > 0 && (
        <div
          style={{
            marginLeft: -6,
            width: size,
            height: size,
            borderRadius: size,
            background: 'var(--bg-2)',
            boxShadow: '0 0 0 2px var(--surface)',
            color: 'var(--fg-3)',
            font: '600 10px/1 var(--font)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  )
}
