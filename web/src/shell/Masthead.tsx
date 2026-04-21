import useSWR from 'swr'
import { api } from '../api'
import { Avatar, AvatarStack, userToAvatar } from '../design/Avatar'
import { LiveDot } from '../design/LiveDot'
import { useAuth } from '../auth'
import { USERS_KEY } from '../users'
import type { SessionMetaLite, User } from '../types'

const sessionsFetcher = (k: string) => api.get<SessionMetaLite[]>(k)
const usersFetcher = (k: string) => api.get<User[]>(k)

const BRAND = 'ZIRA'
const SERIAL = 'SER. 001 · v0.7.3'

function fmtSprintWindow(): string {
  // Ships as a lightweight label. Real sprint data is on the Sprints page.
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  return `024 · DAY ${day}/10`
}

/** v2 Masthead — steel top bar with brand plate, brigade/sprint/live blocks,
 *  online operators, current user. Red top-border tick strip. */
export function Masthead() {
  const { user, signOut } = useAuth()
  const { data: sessions } = useSWR<SessionMetaLite[]>('/api/v1/sessions', sessionsFetcher, {
    refreshInterval: 15_000,
  })
  const { data: users } = useSWR<User[]>(USERS_KEY, usersFetcher)

  const sessionList = Array.isArray(sessions) ? sessions : []
  const userList = Array.isArray(users) ? users : []
  const activeSessions = sessionList.filter((s) => !s.ended_at)
  const activeUserIds = Array.from(new Set(activeSessions.map((s) => s.user_id)))
  const onlineUsers = userList.filter((u) => activeUserIds.includes(u.id))
  const onlineAvatars = onlineUsers.map((u) => userToAvatar(u, 'active'))

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--steel)',
        color: 'var(--cream)',
        borderBottom: '3px solid var(--red)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Brand plate */}
      <div
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderRight: '2px solid var(--steel-2)',
          background: 'var(--steel-2)',
          flexShrink: 0,
        }}
      >
        <img
          src="/zira-192.png"
          alt="ZIRA"
          width={40}
          height={40}
          style={{ display: 'block', flexShrink: 0, imageRendering: 'crisp-edges' }}
        />
        <div>
          <div
            className="display"
            style={{
              font: '900 22px/1 var(--font-display)',
              letterSpacing: '0.02em',
              color: 'var(--cream)',
            }}
          >
            {BRAND}
          </div>
          <div
            className="mono"
            style={{
              font: '500 9.5px/1 var(--mono)',
              color: 'var(--cream-3)',
              letterSpacing: '0.15em',
              marginTop: 3,
              textTransform: 'uppercase',
            }}
          >
            {SERIAL}
          </div>
        </div>
      </div>

      {/* Context blocks — Brigade / Sprint / Live */}
      <div
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          flex: 1,
          minWidth: 0,
        }}
      >
        <ContextBlock label="Brigade" value="Team · Presence" />
        <VSep />
        <ContextBlock label="Sprint" value={fmtSprintWindow()} mono />
        <VSep />
        <ContextBlock
          label="Live"
          value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LiveDot size={7} color={activeSessions.length > 0 ? 'var(--red)' : 'var(--cream-3)'} />
              {activeSessions.length} Agents
            </span>
          }
          mono
        />
      </div>

      {/* Online operators */}
      {onlineAvatars.length > 0 && (
        <div
          style={{
            padding: '10px 14px',
            borderLeft: '2px solid var(--steel-2)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <AvatarStack users={onlineAvatars} size={24} max={5} />
        </div>
      )}

      {/* Current operator */}
      {user && (
        <div
          style={{
            padding: '10px 14px',
            borderLeft: '2px solid var(--steel-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--steel-2)',
            flexShrink: 0,
          }}
        >
          <Avatar user={userToAvatar(user, 'active')} size={30} dot />
          <button
            type="button"
            onClick={() => void signOut()}
            className="label"
            title="Sign out"
            style={{
              padding: '4px 8px',
              background: 'transparent',
              color: 'var(--cream-3)',
              border: '1.5px solid var(--steel-3)',
              borderRadius: 0,
              font: '700 9.5px/1 var(--font-label)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Exit
          </button>
        </div>
      )}
    </header>
  )
}

function ContextBlock({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        className="label"
        style={{
          font: '700 10px/1 var(--font-label)',
          letterSpacing: '0.18em',
          color: 'var(--cream-3)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        className={mono ? 'mono' : 'display'}
        style={{
          font: mono ? '600 12px/1 var(--mono)' : '800 14px/1 var(--font-display)',
          letterSpacing: mono ? '0.04em' : '-0.005em',
          marginTop: 4,
          color: 'var(--cream)',
          whiteSpace: 'nowrap',
          textTransform: mono ? 'none' : 'uppercase',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function VSep() {
  return <div style={{ width: 1.5, height: 30, background: 'var(--steel-3)' }} />
}
