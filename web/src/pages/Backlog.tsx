import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useCreateStoryDialog } from '../components/CreateStoryDialog'
import { Chip } from '../design/Chip'
import { Priority } from '../design/Priority'
import { ProgressBar } from '../design/ProgressBar'
import { StoryId } from '../design/StoryId'
import { claimStory, patchStory, useEpics, useStories } from '../stories'
import type { Priority as PriorityLevel, Story } from '../types'

const PRIO_FILTERS: (PriorityLevel | 'all')[] = ['all', 'P1', 'P2', 'P3']
const PRIORITIES: PriorityLevel[] = ['P1', 'P2', 'P3', 'P4']

/** Backlog = todo stories without an owner. Cards support Claim (assigns
 *  current user + moves to in_progress) and inline priority edit. */
export default function Backlog() {
  const { data: stories } = useStories()
  const { data: epics } = useEpics()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { open: openCreate } = useCreateStoryDialog()
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

  async function handleClaim(s: Story) {
    if (!user) return
    try {
      await claimStory(s.id, user.id)
      navigate(`/story/${s.id}`)
    } catch (err) {
      alert(`Claim failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleSetPriority(s: Story, p: PriorityLevel | null) {
    try {
      await patchStory(s.id, { priority: p })
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

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
        <button
          type="button"
          onClick={() => openCreate()}
          style={{
            padding: '5px 12px',
            background: 'var(--hv-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            font: '500 12.5px/1 var(--font)',
            cursor: 'pointer',
          }}
        >
          + New story
        </button>
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
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hv-border)',
                borderRadius: 'var(--radius)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => navigate(`/story/${s.id}`)}
                  style={linkBtn}
                >
                  <StoryId id={s.id} />
                </button>
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
                <PrioritySelect
                  value={s.priority}
                  onChange={(p) => handleSetPriority(s, p)}
                />
              </div>
              <button
                type="button"
                onClick={() => navigate(`/story/${s.id}`)}
                style={{
                  ...linkBtn,
                  font: '500 14px/1.35 var(--font)',
                  color: 'var(--hv-fg)',
                  textAlign: 'left',
                }}
              >
                {s.name}
              </button>
              {acTotal > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ProgressBar value={acDone} total={acTotal} />
                  <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
                    {acDone} / {acTotal}
                  </div>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                {s.points != null && (
                  <span
                    style={{
                      font: '500 11px/1 var(--mono)',
                      color: 'var(--fg-3)',
                    }}
                  >
                    {s.points} pt
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => handleClaim(s)}
                  disabled={!user}
                  style={{
                    padding: '5px 12px',
                    background: 'var(--hv-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    font: '500 12px/1 var(--font)',
                    cursor: user ? 'pointer' : 'not-allowed',
                  }}
                >
                  Claim
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: PriorityLevel | null
  onChange: (p: PriorityLevel | null) => void
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 6px',
          background: 'var(--bg-2)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}
      >
        {value ? (
          <Priority level={value} />
        ) : (
          <span style={{ font: '400 11.5px/1 var(--font)', color: 'var(--fg-4)' }}>
            — no prio —
          </span>
        )}
        <span style={{ color: 'var(--fg-4)', font: '400 10px/1 var(--mono)' }}>▾</span>
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? null : (v as PriorityLevel))
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
        }}
      >
        <option value="">— none —</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </span>
  )
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
}

function priorityColor(p: PriorityLevel): string {
  return p === 'P1' ? '#ef4444' : p === 'P2' ? '#f59e0b' : p === 'P3' ? '#71717a' : '#a1a1aa'
}
