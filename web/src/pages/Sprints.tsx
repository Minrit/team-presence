import { useState } from 'react'
import { useCreateStoryDialog } from '../components/CreateStoryDialog'
import { Card } from '../design/Card'
import { StoryId } from '../design/StoryId'
import {
  createSprint,
  deleteSprint,
  patchSprint,
  useSprints,
} from '../sprints'
import { patchStory, useStories } from '../stories'
import type { Sprint, Story } from '../types'
import EpicsTab from './sprints/EpicsTab'

type Tab = 'sprints' | 'epics'

/** Sprints + Epics management page. Lives inside AppShell (no TopNav wrapper).
 *  Stories are assigned to sprints via the in-row dropdown which fires a
 *  single-field patchStory({ sprint_id }). */
export default function Sprints() {
  const [tab, setTab] = useState<Tab>('sprints')
  return (
    <div
      style={{
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        height: '100%',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 2,
          background: 'var(--bg-2)',
          borderRadius: 'var(--radius-sm)',
          width: 'fit-content',
        }}
      >
        {(['sprints', 'epics'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '5px 14px',
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--hv-fg)' : 'var(--fg-3)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              font: `${tab === t ? '500' : '400'} 12.5px/1 var(--font)`,
              cursor: 'pointer',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'sprints' ? <SprintsTab /> : <EpicsTab />}
      </div>
    </div>
  )
}

function SprintsTab() {
  const { data: sprints, isLoading, error } = useSprints()
  const { data: stories } = useStories()
  const [name, setName] = useState('')
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(addDays(today(), 14))
  const [busy, setBusy] = useState(false)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await createSprint({ name: name.trim(), start_date: start, end_date: end })
      setName('')
    } catch (err) {
      alert(`Create failed: ${msg(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: 12 }}>
        <form
          onSubmit={onCreate}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          <LabeledInput label="Name" value={name} onChange={setName} placeholder="Sprint 1" width={220} />
          <LabeledInput label="Start" value={start} onChange={setStart} type="date" width={160} />
          <LabeledInput label="End" value={end} onChange={setEnd} type="date" width={160} />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            style={{
              padding: '6px 14px',
              background: name.trim() ? 'var(--hv-accent)' : 'var(--bg-2)',
              color: name.trim() ? 'white' : 'var(--fg-4)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              font: '500 12.5px/1 var(--font)',
              cursor: name.trim() && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? 'Creating…' : 'Create sprint'}
          </button>
        </form>
      </Card>

      {isLoading && <div style={{ color: 'var(--fg-3)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>Failed: {String(error)}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(sprints ?? []).length === 0 && !isLoading && (
          <div style={{ color: 'var(--fg-3)', font: '400 13px/1.4 var(--font)' }}>
            No sprints yet — create one above.
          </div>
        )}
        {(sprints ?? []).map((s) => (
          <SprintCard
            key={s.id}
            sprint={s}
            stories={(stories ?? []).filter((st) => st.sprint_id === s.id)}
            allSprints={sprints ?? []}
          />
        ))}
      </div>
    </div>
  )
}

function SprintCard({
  sprint,
  stories,
  allSprints,
}: {
  sprint: Sprint
  stories: Story[]
  allSprints: Sprint[]
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sprint.name)
  const [start, setStart] = useState(sprint.start_date)
  const [end, setEnd] = useState(sprint.end_date)
  const { open: openCreate } = useCreateStoryDialog()

  async function save() {
    try {
      await patchSprint(sprint.id, { name: name.trim(), start_date: start, end_date: end })
      setEditing(false)
    } catch (err) {
      alert(`Save failed: ${msg(err)}`)
    }
  }

  async function remove() {
    if (!confirm(`Delete sprint "${sprint.name}"? Assigned stories stay but lose the link.`)) return
    try {
      await deleteSprint(sprint.id)
    } catch (err) {
      alert(`Delete failed: ${msg(err)}`)
    }
  }

  const done = stories.filter((s) => s.status === 'done').length
  const total = stories.length

  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inlineInput(200)}
          />
        ) : (
          <div style={{ font: '600 14px/1.2 var(--font)', color: 'var(--hv-fg)' }}>
            {sprint.name}
          </div>
        )}
        {editing ? (
          <>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inlineInput(140)} />
            <span style={{ color: 'var(--fg-4)' }}>→</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inlineInput(140)} />
          </>
        ) : (
          <span style={{ font: '400 12px/1 var(--mono)', color: 'var(--fg-3)' }}>
            {sprint.start_date} → {sprint.end_date}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span
          style={{
            font: '500 11.5px/1 var(--mono)',
            color: 'var(--fg-3)',
            padding: '2px 7px',
            background: 'var(--bg-2)',
            borderRadius: 10,
          }}
        >
          {done} / {total} done
        </span>
        {editing ? (
          <>
            <TextBtn onClick={save}>Save</TextBtn>
            <TextBtn
              onClick={() => {
                setEditing(false)
                setName(sprint.name)
                setStart(sprint.start_date)
                setEnd(sprint.end_date)
              }}
            >
              Cancel
            </TextBtn>
          </>
        ) : (
          <>
            <TextBtn onClick={() => setEditing(true)}>Edit</TextBtn>
            <TextBtn onClick={remove} danger>
              Delete
            </TextBtn>
            <TextBtn onClick={() => openCreate({ sprintId: sprint.id })}>
              + Story
            </TextBtn>
          </>
        )}
      </div>

      <SprintStoryList sprintId={sprint.id} stories={stories} allSprints={allSprints} />
    </Card>
  )
}

function SprintStoryList({
  sprintId,
  stories,
  allSprints,
}: {
  sprintId: string
  stories: Story[]
  allSprints: Sprint[]
}) {
  if (stories.length === 0) {
    return (
      <div style={{ font: '400 12px/1.4 var(--font)', color: 'var(--fg-4)' }}>
        No stories assigned yet.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stories.map((s) => (
        <SprintStoryRow
          key={s.id}
          story={s}
          currentSprintId={sprintId}
          allSprints={allSprints}
        />
      ))}
    </div>
  )
}

function SprintStoryRow({
  story,
  currentSprintId,
  allSprints,
}: {
  story: Story
  currentSprintId: string
  allSprints: Sprint[]
}) {
  async function reassign(next: string) {
    try {
      await patchStory(story.id, { sprint_id: next === '' ? null : next })
    } catch (err) {
      alert(`Reassign failed: ${msg(err)}`)
    }
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        borderTop: '1px solid var(--hv-border)',
        font: '400 12.5px/1.3 var(--font)',
      }}
    >
      <StoryId id={story.id} />
      <span style={{ flex: 1, color: 'var(--hv-fg)' }}>{story.name}</span>
      <span style={{ color: 'var(--fg-3)', font: '400 11px/1 var(--mono)' }}>
        {story.status}
      </span>
      <select
        value={currentSprintId}
        onChange={(e) => reassign(e.target.value)}
        style={{
          padding: '2px 6px',
          background: 'var(--bg-2)',
          color: 'var(--fg-2)',
          border: '1px solid var(--hv-border)',
          borderRadius: 4,
          font: '400 11.5px/1 var(--font)',
        }}
      >
        <option value="">— backlog —</option>
        {allSprints.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type,
  placeholder,
  width,
}: {
  label: string
  value: string
  onChange: (s: string) => void
  type?: string
  placeholder?: string
  width: number
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
        placeholder={placeholder}
        style={{ ...inlineInput(width) }}
      />
    </label>
  )
}

function inlineInput(width: number): React.CSSProperties {
  return {
    width,
    padding: '5px 8px',
    background: 'var(--bg-2)',
    color: 'var(--hv-fg)',
    border: '1px solid var(--hv-border)',
    borderRadius: 'var(--radius-sm)',
    font: '400 13px/1.3 var(--font)',
    outline: 'none',
  }
}

function TextBtn({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: danger ? 'var(--danger)' : 'var(--hv-accent)',
        font: '500 11.5px/1 var(--font)',
        cursor: 'pointer',
        padding: 2,
      }}
    >
      {children}
    </button>
  )
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
