import { useLocation } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { useCreateStoryDialog } from '../components/CreateStoryDialog'
import { AvatarStack, userToAvatar } from '../design/Avatar'
import { LiveDot } from '../design/LiveDot'
import type { SessionMetaLite, User } from '../types'
import { activeNavLabel } from './nav'

const sessionsFetcher = (k: string) => api.get<SessionMetaLite[]>(k)

/** Status strip with breadcrumb, live-session count, online avatars, and a
 *  global "New" button (also bound to ⌘N) that opens the shared
 *  CreateStoryDialog from anywhere in the app. */
export function TopMeta() {
  const { pathname } = useLocation()
  const { open: openCreateStory } = useCreateStoryDialog()
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

      <button
        type="button"
        onClick={() => openCreateStory()}
        title="New story (⌘N)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 11px',
          background: 'var(--hv-accent)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          font: '500 12px/1 var(--font)',
          cursor: 'pointer',
        }}
      >
        <span style={{ font: '500 13px/1 var(--mono)' }}>+</span>
        New
      </button>

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
