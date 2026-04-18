import { useLocation } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { AvatarStack, userToAvatar } from '../design/Avatar'
import { LiveDot } from '../design/LiveDot'
import type { SessionMetaLite, User } from '../types'
import { activeNavLabel } from './nav'

const sessionsFetcher = (k: string) => api.get<SessionMetaLite[]>(k)

/** Read-only status strip. AI-native posture: no write buttons (New / Bell
 *  were removed because they either did nothing or only existed as UI hooks
 *  for features now driven by the MCP toolchain). */
export function TopMeta() {
  const { pathname } = useLocation()
  const { data: sessions } = useSWR<SessionMetaLite[]>(
    '/api/v1/sessions',
    sessionsFetcher,
    { refreshInterval: 15_000 },
  )

  const activeSessions = (sessions ?? []).filter((s) => !s.ended_at)
  const onlineUserIds = Array.from(new Set(activeSessions.map((s) => s.user_id)))

  const avatars = onlineUserIds.map((id) =>
    userToAvatar(
      { id, display_name: id.slice(0, 2).toUpperCase() } as Partial<User> as User,
      'active',
    ),
  )

  const crumb = activeNavLabel(pathname) || 'Workspace'

  return (
    <div
      style={{
        height: 44,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--hv-border)',
      }}
    >
      <span
        style={{
          font: '500 12.5px/1 var(--font)',
          color: 'var(--fg-2)',
          whiteSpace: 'nowrap',
        }}
      >
        {crumb}
      </span>

      <div style={{ flex: 1 }} />

      <div
        title="Active collector sessions"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 9px',
          background: 'var(--bg-2)',
          borderRadius: 'var(--radius-sm)',
          font: '500 12px/1 var(--font)',
          color: 'var(--fg-2)',
        }}
      >
        <LiveDot size={6} />
        {activeSessions.length} live
      </div>

      {avatars.length > 0 && <AvatarStack users={avatars} size={22} max={4} />}
    </div>
  )
}
