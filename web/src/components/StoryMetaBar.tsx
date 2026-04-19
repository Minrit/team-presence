import { useAuth } from '../auth'
import { Priority } from '../design/Priority'
import { StatusPill } from '../design/StatusPill'
import { useSprints } from '../sprints'
import { patchStory, useEpics } from '../stories'
import { STATUSES, STATUS_LABEL } from '../types'
import type {
  Priority as PriorityLevel,
  Story,
  StoryStatus,
  User,
} from '../types'
import useSWR from 'swr'
import { api } from '../api'

const PRIORITIES: PriorityLevel[] = ['P1', 'P2', 'P3', 'P4']

/** Editable metadata row shown at the top of CurrentStory. Each field is
 *  an inline dropdown or short text input that fires a single-field
 *  patchStory() on change. Clearing a nullable field sends explicit null. */
export function StoryMetaBar({ story }: { story: Story }) {
  const { data: epics } = useEpics()
  const { data: sprints } = useSprints()
  const { data: users } = useSWR<User[]>(
    '/api/v1/auth/users',
    (k) => api.get<User[]>(k),
    { refreshInterval: 60_000 },
  )
  const { user } = useAuth()

  async function update<K extends keyof Story>(
    field: K,
    value: Story[K] | null,
  ) {
    try {
      await patchStory(story.id, { [field]: value } as Record<string, unknown>)
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        font: '400 12.5px/1 var(--font)',
        color: 'var(--fg-3)',
      }}
    >
      <Field label="Status">
        <SelectPill
          value={story.status}
          onChange={(v) => update('status', v as StoryStatus)}
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          render={(v) => <StatusPill status={v as StoryStatus} dense />}
        />
      </Field>
      <Field label="Priority">
        <SelectPill
          value={story.priority ?? ''}
          onChange={(v) =>
            update('priority', (v === '' ? null : v) as PriorityLevel | null)
          }
          options={[
            { value: '', label: '— none —' },
            ...PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
          render={(v) =>
            v ? <Priority level={v as PriorityLevel} showLabel /> : <Muted>—</Muted>
          }
        />
      </Field>
      <Field label="Points">
        <NumberInput
          value={story.points}
          onChange={(n) => update('points', n)}
        />
      </Field>
      <Field label="Epic">
        <SelectPill
          value={story.epic_id ?? ''}
          onChange={(v) => update('epic_id', v === '' ? null : v)}
          options={[
            { value: '', label: '— none —' },
            ...(epics ?? []).map((e) => ({ value: e.id, label: e.name })),
          ]}
          render={(v) => {
            const e = (epics ?? []).find((x) => x.id === v)
            if (!e) return <Muted>—</Muted>
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: e.color,
                  }}
                />
                {e.name}
              </span>
            )
          }}
        />
      </Field>
      <Field label="Sprint">
        <SelectPill
          value={story.sprint_id ?? ''}
          onChange={(v) => update('sprint_id', v === '' ? null : v)}
          options={[
            { value: '', label: '— backlog —' },
            ...(sprints ?? []).map((s) => ({ value: s.id, label: s.name })),
          ]}
          render={(v) => {
            const s = (sprints ?? []).find((x) => x.id === v)
            return s ? <span>{s.name}</span> : <Muted>backlog</Muted>
          }}
        />
      </Field>
      <Field label="Owner">
        <SelectPill
          value={story.owner_id ?? ''}
          onChange={(v) => update('owner_id', v === '' ? null : v)}
          options={[
            { value: '', label: '— unassigned —' },
            ...(users ?? []).map((u) => ({
              value: u.id,
              label:
                u.display_name + (u.id === user?.id ? ' (me)' : ''),
            })),
          ]}
          render={(v) => {
            const u = (users ?? []).find((x) => x.id === v)
            return u ? <span>{u.display_name}</span> : <Muted>unassigned</Muted>
          }}
        />
      </Field>
      <Field label="Branch">
        <TextInput
          value={story.branch ?? ''}
          onChange={(s) => update('branch', s === '' ? null : s)}
          placeholder="feat/..."
          width={160}
        />
      </Field>
      <Field label="PR">
        <TextInput
          value={story.pr_ref ?? ''}
          onChange={(s) => update('pr_ref', s === '' ? null : s)}
          placeholder="#123"
          width={90}
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 0',
      }}
    >
      <span style={{ color: 'var(--fg-4)', font: '500 11px/1 var(--font)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--fg-4)' }}>{children}</span>
}

function SelectPill<T extends string>({
  value,
  onChange,
  options,
  render,
}: {
  value: T | ''
  onChange: (v: T | '') => void
  options: { value: T | ''; label: string }[]
  render: (v: T | '') => React.ReactNode
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          background: 'var(--bg-2)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}
      >
        {render(value)}
        <span style={{ color: 'var(--fg-4)', font: '400 10px/1 var(--mono)' }}>▾</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  )
}

function NumberInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (n: number | null) => void
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      placeholder="—"
      onChange={(e) => {
        const v = e.target.value
        if (v === '') onChange(null)
        else {
          const n = Number(v)
          if (Number.isFinite(n)) onChange(n)
        }
      }}
      style={{
        width: 54,
        padding: '2px 6px',
        background: 'var(--bg-2)',
        color: 'var(--hv-fg)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius-sm)',
        font: '500 12px/1 var(--mono)',
      }}
    />
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string
  onChange: (s: string) => void
  placeholder?: string
  width: number
}) {
  return (
    <input
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(e) => {
        if (e.target.value !== value) onChange(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      style={{
        width,
        padding: '2px 6px',
        background: 'var(--bg-2)',
        color: 'var(--hv-fg)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius-sm)',
        font: '400 12px/1.3 var(--mono)',
      }}
    />
  )
}
