import { useMemo } from 'react'
import useSWR from 'swr'
import { api } from '../api'
import { BurnupChart } from '../design/BurnupChart'
import { Card } from '../design/Card'
import { ProgressBar } from '../design/ProgressBar'
import { useEpics, useStories } from '../stories'
import type { Epic, SessionMetaLite, Sprint, Story } from '../types'

const sessionsFetcher = (k: string) => api.get<SessionMetaLite[]>(k)
const sprintsFetcher = (k: string) => api.get<Sprint[]>(k)

export default function Overview() {
  const { data: stories } = useStories()
  const { data: epics } = useEpics()
  const { data: sprints } = useSWR<Sprint[]>('/api/v1/sprints', sprintsFetcher)
  const { data: sessions } = useSWR<SessionMetaLite[]>(
    '/api/v1/sessions',
    sessionsFetcher,
    { refreshInterval: 15_000 },
  )

  const current = useMemo(
    () =>
      (sprints ?? [])
        .slice()
        .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0] ?? null,
    [sprints],
  )

  const inSprint = useMemo<Story[]>(() => {
    if (!current) return stories ?? []
    return (stories ?? []).filter((s) => s.sprint_id === current.id)
  }, [stories, current])

  const total = inSprint.reduce((a, s) => a + (s.points ?? 0), 0)
  const done = inSprint
    .filter((s) => s.status === 'done')
    .reduce((a, s) => a + (s.points ?? 0), 0)
  const inProg = inSprint.filter((s) => s.status === 'in_progress').length
  const blocked = inSprint.filter((s) => s.status === 'blocked').length
  const active = (sessions ?? []).filter((s) => !s.ended_at).length

  const kpis = [
    { label: 'Points done', value: `${done} / ${total}` },
    { label: 'In progress', value: String(inProg) },
    { label: 'Blocked', value: String(blocked) },
    { label: 'Live sessions', value: String(active) },
  ]

  // Dummy burnup series: linear ramp from 0 → done over 10 days; swap to a
  // per-day DB aggregation in Phase B.
  const series = useMemo<number[]>(() => {
    const points = Math.max(2, 10)
    return Array.from({ length: points }, (_, i) => Math.round((done * (i + 1)) / points))
  }, [done])

  return (
    <div
      style={{
        padding: 18,
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 14,
        alignContent: 'start',
      }}
    >
      {/* KPIs */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        {kpis.map((k) => (
          <Card key={k.label} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ font: '400 11px/1 var(--font)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {k.label}
            </span>
            <span style={{ font: '600 22px/1 var(--font)', color: 'var(--hv-fg)' }}>
              {k.value}
            </span>
          </Card>
        ))}
      </div>

      {/* Burnup */}
      <Card style={{ padding: 16 }}>
        <div style={{ font: '600 13px/1 var(--font)', marginBottom: 10 }}>
          {current ? `Burnup · ${current.name}` : 'Burnup (no active sprint)'}
        </div>
        <BurnupChart series={series} total={total} height={180} />
      </Card>

      {/* Epics progress */}
      <Card style={{ padding: 16 }}>
        <div style={{ font: '600 13px/1 var(--font)', marginBottom: 10 }}>Epics progress</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(epics ?? []).map((e) => (
            <EpicRow key={e.id} epic={e} stories={stories ?? []} />
          ))}
        </div>
      </Card>

      {/* Team load */}
      <Card style={{ padding: 16, gridColumn: '1 / -1' }}>
        <div style={{ font: '600 13px/1 var(--font)', marginBottom: 10 }}>Team load</div>
        <TeamLoad stories={inSprint} sessions={sessions ?? []} />
      </Card>
    </div>
  )
}

function EpicRow({ epic, stories }: { epic: Epic; stories: Story[] }) {
  const mine = stories.filter((s) => s.epic_id === epic.id)
  const total = mine.reduce((a, s) => a + (s.points ?? 0), 0)
  const done = mine
    .filter((s) => s.status === 'done')
    .reduce((a, s) => a + (s.points ?? 0), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: epic.color,
          }}
        />
        <span style={{ font: '500 12.5px/1 var(--font)', color: 'var(--hv-fg)' }}>
          {epic.name}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
          {done} / {total || '—'} pt
        </span>
      </div>
      <ProgressBar value={done} total={Math.max(total, 1)} color={epic.color} />
    </div>
  )
}

function TeamLoad({
  stories,
  sessions,
}: {
  stories: Story[]
  sessions: SessionMetaLite[]
}) {
  const byUser = new Map<string, { stories: Story[]; sessions: number }>()
  for (const s of stories) {
    if (!s.owner_id) continue
    const bucket = byUser.get(s.owner_id) ?? { stories: [], sessions: 0 }
    bucket.stories.push(s)
    byUser.set(s.owner_id, bucket)
  }
  for (const sess of sessions) {
    if (sess.ended_at) continue
    const b = byUser.get(sess.user_id) ?? { stories: [], sessions: 0 }
    b.sessions++
    byUser.set(sess.user_id, b)
  }
  const rows = Array.from(byUser.entries())
  if (rows.length === 0) {
    return (
      <div style={{ color: 'var(--fg-3)', font: '400 12.5px/1.4 var(--font)' }}>
        No active owners yet.
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 10,
      }}
    >
      {rows.map(([userId, b]) => {
        const pts = b.stories.reduce((a, s) => a + (s.points ?? 0), 0)
        return (
          <div
            key={userId}
            style={{
              padding: 10,
              border: '1px solid var(--hv-border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ font: '500 12.5px/1 var(--font)' }}>{userId.slice(0, 8)}…</div>
            <ProgressBar value={Math.min(pts, 10)} total={10} height={6} />
            <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
              {b.stories.length} stories · {pts} pt · {b.sessions} live
            </div>
          </div>
        )
      })}
    </div>
  )
}
