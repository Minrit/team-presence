import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip } from '../design/Chip'
import { Priority } from '../design/Priority'
import { ProgressBar } from '../design/ProgressBar'
import { StoryId } from '../design/StoryId'
import { useEpics, useStories } from '../stories'
import type { Priority as PriorityLevel } from '../types'

const PRIO_FILTERS: (PriorityLevel | 'all')[] = ['all', 'P1', 'P2', 'P3']

/** Read-only backlog. Claim happens via MCP (`tp.story.claim` /
 *  `/tp-dev-story`). Filter chips are pure client-side UI state. */
export default function Backlog() {
  const { data: stories } = useStories()
  const { data: epics } = useEpics()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<PriorityLevel | 'all'>('all')

  const epicsById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of epics ?? []) m[e.id] = e.color
    return m
  }, [epics])

  const eligible = useMemo(
    () => (stories ?? []).filter((s) => s.status === 'todo' && !s.owner_id),
    [stories],
  )
  const visible = useMemo(
    () =>
      filter === 'all' ? eligible : eligible.filter((s) => s.priority === filter),
    [eligible, filter],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: eligible.length }
    for (const s of eligible) {
      if (s.priority) c[s.priority] = (c[s.priority] ?? 0) + 1
    }
    return c
  }, [eligible])

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {PRIO_FILTERS.map((p) => {
          if (p !== 'all' && (counts[p] ?? 0) === 0) return null
          return (
            <Chip
              key={p}
              active={filter === p}
              onClick={() => setFilter(p)}
              color={p === 'all' ? undefined : priorityColor(p)}
            >
              {p === 'all' ? 'All' : p} · {counts[p] ?? 0}
            </Chip>
          )
        })}
        <div style={{ flex: 1 }} />
        <span
          style={{
            font: '400 11.5px/1 var(--font)',
            color: 'var(--fg-3)',
          }}
          title="Claim happens via the team-presence MCP server (/tp-dev-story or tp.story.claim)"
        >
          Claim via MCP · <span className="mono">/tp-dev-story</span>
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 12,
        }}
      >
        {visible.length === 0 && (
          <div
            style={{
              padding: 40,
              color: 'var(--fg-3)',
              textAlign: 'center',
              font: '400 13px/1.4 var(--font)',
              border: '1px dashed var(--hv-border)',
              borderRadius: 'var(--radius)',
            }}
          >
            Nothing to claim. All todo stories already have an owner.
          </div>
        )}
        {visible.map((s) => {
          const acDone = s.acceptance_criteria.filter((a) => a.done).length
          const acTotal = s.acceptance_criteria.length
          const epicColor = s.epic_id ? epicsById[s.epic_id] : undefined
          return (
            <div
              key={s.id}
              onClick={() => navigate(`/story/${s.id}`)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hv-border)',
                borderRadius: 'var(--radius)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StoryId id={s.id} />
                {epicColor && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: epicColor,
                    }}
                  />
                )}
                <div style={{ flex: 1 }} />
                {s.priority && <Priority level={s.priority} />}
              </div>
              <div style={{ font: '500 14px/1.35 var(--font)', color: 'var(--hv-fg)' }}>
                {s.name}
              </div>
              {acTotal > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ProgressBar value={acDone} total={acTotal} />
                  <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
                    {acDone} / {acTotal}
                  </div>
                </div>
              )}
              {s.points != null && (
                <span
                  style={{
                    font: '500 11px/1 var(--mono)',
                    color: 'var(--fg-3)',
                    alignSelf: 'flex-start',
                  }}
                >
                  {s.points} pt
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function priorityColor(p: PriorityLevel): string {
  return p === 'P1' ? '#ef4444' : p === 'P2' ? '#f59e0b' : p === 'P3' ? '#71717a' : '#a1a1aa'
}
