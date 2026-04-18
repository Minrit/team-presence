import { useLocation } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { AvatarStack, userToAvatar } from '../design/Avatar'
import { Button } from '../design/Button'
import { Icon } from '../design/Icon'
import { LiveDot } from '../design/LiveDot'
import type { SessionMetaLite, User } from '../types'
import { activeNavLabel } from './nav'

const sessionsFetcher = (k: string) => api.get<SessionMetaLite[]>(k)

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
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          style={{
            font: '500 12.5px/1 var(--font)',
            color: 'var(--fg-2)',
            whiteSpace: 'nowrap',
          }}
        >
          {crumb}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Live session count */}
      <div
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

      {/* Online avatar stack */}
      {avatars.length > 0 && <AvatarStack users={avatars} size={22} max={4} />}

      {/* Notifications (placeholder) */}
      <button
        type="button"
        title="Notifications"
        style={{
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--hv-border)',
          background: 'var(--surface)',
          cursor: 'pointer',
          color: 'var(--fg-2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="bell" size={14} />
      </button>

      {/* New */}
      <Button variant="primary" size="sm" icon={<Icon name="plus" size={12} color="#fff" />}>
        New
      </Button>
    </div>
  )
}
