import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { Avatar, userToAvatar } from '../design/Avatar'
import { Card } from '../design/Card'
import { LiveDot } from '../design/LiveDot'
import { StoryId } from '../design/StoryId'
import { useSseGrid } from '../hooks/useSseGrid'
import { useStories } from '../stories'
import { Terminal } from '../terminal/Terminal'
import { createUser, USERS_KEY } from '../users'
import type { SessionMetaLite, Story, User } from '../types'

const sessionsFetcher = (k: string) => api.get<SessionMetaLite[]>(k)

/** Working member derived from session activity — backend doesn't yet expose
 *  a /users list endpoint so we scaffold from user_ids seen in sessions /
 *  stories and the auth user. */
interface MemberLite {
  id: string
  display_name: string
  active: boolean
  sessions: SessionMetaLite[]
}

export default function Members() {
  const [params, setParams] = useSearchParams()
  const { data: sessions } = useSWR<SessionMetaLite[]>(
    '/api/v1/sessions',
    sessionsFetcher,
    { refreshInterval: 15_000 },
  )
  const { data: stories } = useStories()
  const { data: users } = useSWR<User[]>(USERS_KEY, (k: string) => api.get<User[]>(k))
  const { tiles } = useSseGrid()
  const [inviteOpen, setInviteOpen] = useState(false)

  const usersById = useMemo<Record<string, User>>(() => {
    const m: Record<string, User> = {}
    for (const u of users ?? []) m[u.id] = u
    return m
  }, [users])

  const members = useMemo<MemberLite[]>(() => {
    const known = new Map<string, MemberLite>()
    for (const u of users ?? []) {
      known.set(u.id, {
        id: u.id,
        display_name: u.display_name,
        active: false,
        sessions: [],
      })
    }
    for (const s of sessions ?? []) {
      const m = known.get(s.user_id) ?? {
        id: s.user_id,
        display_name: usersById[s.user_id]?.display_name ?? s.user_id.slice(0, 6),
        active: false,
        sessions: [],
      }
      m.sessions.push(s)
      if (!s.ended_at) m.active = true
      known.set(s.user_id, m)
    }
    for (const st of stories ?? []) {
      if (st.owner_id && !known.has(st.owner_id)) {
        known.set(st.owner_id, {
          id: st.owner_id,
          display_name: usersById[st.owner_id]?.display_name ?? st.owner_id.slice(0, 6),
          active: false,
          sessions: [],
        })
      }
    }
    return Array.from(known.values()).sort((a, b) => Number(b.active) - Number(a.active))
  }, [users, sessions, stories, usersById])

  const selected =
    members.find((m) => m.id === params.get('selected')) ?? members[0] ?? null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, height: '100%', padding: 18, minHeight: 0 }}>
      {/* Left list */}
      <Card style={{ padding: 6, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          style={{
            margin: 6,
            padding: '6px 10px',
            background: 'var(--hv-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            font: '500 12px/1 var(--font)',
            cursor: 'pointer',
          }}
        >
          + Invite user
        </button>
        {members.length === 0 && (
          <div style={{ padding: 18, color: 'var(--fg-3)' }}>
            No members have emitted sessions yet.
          </div>
        )}
        {members.map((m) => {
          const active = m.sessions.filter((s) => !s.ended_at).length
          const isSel = selected?.id === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                const p = new URLSearchParams(params)
                p.set('selected', m.id)
                setParams(p)
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: isSel ? 'var(--bg-2)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Avatar
                user={userToAvatar({ id: m.id, display_name: m.display_name } as User, m.active ? 'active' : 'offline')}
                size={28}
                dot
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '500 12.5px/1.2 var(--font)' }}>{m.display_name}</div>
                <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
                  {m.id.slice(0, 8)}…
                </div>
              </div>
              {active > 0 && (
                <span
                  style={{
                    padding: '1px 6px',
                    background: 'var(--bg-2)',
                    borderRadius: 10,
                    font: '500 10.5px/1.5 var(--mono)',
                    color: 'var(--fg-3)',
                  }}
                >
                  {active}
                </span>
              )}
            </button>
          )
        })}
      </Card>

      {/* Right detail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', minWidth: 0, minHeight: 0 }}>
        {!selected && (
          <Card style={{ padding: 24, color: 'var(--fg-3)' }}>
            Select a member on the left.
          </Card>
        )}
        {selected && (
          <>
            <MemberHeader member={selected} stories={stories ?? []} />
            <SessionsGrid member={selected} tiles={tiles} />
            <AssignedStories member={selected} stories={stories ?? []} />
          </>
        )}
      </div>

      {inviteOpen && <InviteUserDialog onClose={() => setInviteOpen(false)} />}
    </div>
  )
}

function InviteUserDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!email.trim() || !password.trim() || !displayName.trim() || busy) return
    setBusy(true)
    setErr(null)
    try {
      await createUser({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius)',
          width: 420,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ font: '600 15px/1 var(--font)' }}>Invite user</div>
        <LabeledInput label="Display name" value={displayName} onChange={setDisplayName} />
        <LabeledInput label="Email" value={email} onChange={setEmail} type="email" />
        <LabeledInput
          label="Initial password"
          value={password}
          onChange={setPassword}
          type="password"
        />
        {err && (
          <div style={{ color: 'var(--danger)', font: '400 12.5px/1.4 var(--font)' }}>{err}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--fg-2)',
              border: '1px solid var(--hv-border)',
              borderRadius: 'var(--radius-sm)',
              font: '500 12.5px/1 var(--font)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            style={{
              padding: '6px 14px',
              background: busy ? 'var(--bg-2)' : 'var(--hv-accent)',
              color: busy ? 'var(--fg-4)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              font: '500 12.5px/1 var(--font)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Inviting…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          font: '500 10.5px/1 var(--font)',
          color: 'var(--fg-4)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '6px 10px',
          background: 'var(--bg-2)',
          color: 'var(--hv-fg)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius-sm)',
          font: '400 13px/1.3 var(--font)',
        }}
      />
    </label>
  )
}

function MemberHeader({ member, stories }: { member: MemberLite; stories: Story[] }) {
  const live = member.sessions.filter((s) => !s.ended_at).length
  const assigned = stories.filter((s) => s.owner_id === member.id).length
  const doneWeek = stories.filter(
    (s) =>
      s.owner_id === member.id &&
      s.status === 'done' &&
      Date.now() - Date.parse(s.updated_at) < 7 * 24 * 3600_000,
  ).length
  const pts = stories
    .filter((s) => s.owner_id === member.id && s.status !== 'done')
    .reduce((a, s) => a + (s.points ?? 0), 0)
  const kpis = [
    { label: 'Live', value: String(live) },
    { label: 'Assigned', value: String(assigned) },
    { label: 'Done (week)', value: String(doneWeek) },
    { label: 'Pt in flight', value: String(pts) },
  ]
  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar user={userToAvatar({ id: member.id, display_name: member.display_name } as User, member.active ? 'active' : 'offline')} size={44} dot />
        <div style={{ flex: 1 }}>
          <div style={{ font: '600 16px/1.2 var(--font)' }}>{member.display_name}</div>
          <div
            style={{
              font: '400 12px/1 var(--mono)',
              color: 'var(--fg-3)',
              marginTop: 3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <LiveDot color={member.active ? 'var(--success)' : 'var(--fg-4)'} size={5} />
            {member.active ? 'Online' : 'Offline'} · {member.id.slice(0, 12)}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ font: '400 10.5px/1 var(--font)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {k.label}
            </div>
            <div style={{ font: '600 18px/1.1 var(--font)', marginTop: 3 }}>{k.value}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function SessionsGrid({
  member,
  tiles,
}: {
  member: MemberLite
  tiles: import('../types').GridTile[]
}) {
  const active = tiles.filter((t) => t.user_id === member.id && !t.ended_at)
  if (active.length === 0) {
    return (
      <Card style={{ padding: 18, color: 'var(--fg-3)' }}>No live sessions right now.</Card>
    )
  }
  // Cap how much vertical space the live-sessions grid eats so the
  // AssignedStories card below always remains visible / reachable. With many
  // sessions the grid scrolls internally instead of pushing assigned-stories
  // off the page.
  const cols = active.length >= 3 ? 3 : Math.max(1, active.length)
  const rows = Math.ceil(active.length / cols)
  const tileH = active.length >= 4 ? 240 : 300
  const naturalH = rows * tileH + (rows - 1) * 12
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 12,
        flexShrink: 0,
        maxHeight: `min(${naturalH}px, 60vh)`,
        overflow: 'auto',
      }}
    >
      {active.map((t) => (
        <div key={t.session_id} style={{ height: tileH }}>
          <Terminal
            sessionId={t.session_id}
            header={{
              agentKind: t.agent_kind,
              cwd: t.cwd,
              storyId: t.detected_story_id?.slice(0, 6).toUpperCase(),
            }}
            focused={false}
          />
        </div>
      ))}
    </div>
  )
}

function AssignedStories({ member, stories }: { member: MemberLite; stories: Story[] }) {
  const mine = stories.filter((s) => s.owner_id === member.id)
  if (mine.length === 0) {
    return <Card style={{ padding: 18, color: 'var(--fg-3)' }}>No assigned stories.</Card>
  }
  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ font: '600 13px/1 var(--font)', marginBottom: 6 }}>Assigned stories</div>
      {mine.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 4px',
            borderBottom: '1px solid var(--hv-border)',
            font: '400 12.5px/1.3 var(--font)',
          }}
        >
          <StoryId id={s.id} />
          <span style={{ flex: 1, color: 'var(--hv-fg)' }}>{s.name}</span>
          <span style={{ color: 'var(--fg-3)', font: '400 11.5px/1 var(--mono)' }}>{s.status}</span>
        </div>
      ))}
    </Card>
  )
}
