import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarkdownEditor } from '../design/MarkdownEditor'
import { createStory, useEpics } from '../stories'
import { useSprints } from '../sprints'
import type { AcceptanceCriterion, Priority as PriorityLevel, Story } from '../types'

interface DialogContextValue {
  open: (opts?: OpenOpts) => void
}

interface OpenOpts {
  /** Prefill sprint_id so stories created from the Sprints page land in
   *  the right bucket. */
  sprintId?: string | null
  /** Navigate to /story/:id after creation. Defaults to true. */
  navigateOnCreate?: boolean
}

const CreateStoryDialogContext = createContext<DialogContextValue | null>(null)

export function useCreateStoryDialog(): DialogContextValue {
  const ctx = useContext(CreateStoryDialogContext)
  if (!ctx) {
    throw new Error(
      'useCreateStoryDialog: no provider — wrap your tree in <CreateStoryDialogProvider>',
    )
  }
  return ctx
}

export function CreateStoryDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [opts, setOpts] = useState<OpenOpts>({})
  const navigate = useNavigate()

  const open = useCallback((o: OpenOpts = {}) => {
    setOpts(o)
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  // Global ⌘N / Ctrl-N to open. Skip when typing in an editable field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'n') return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (t && t.isContentEditable)
      if (editable) return
      e.preventDefault()
      open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function handleCreated(s: Story) {
    close()
    if (opts.navigateOnCreate !== false) {
      navigate(`/story/${s.id}`)
    }
  }

  return (
    <CreateStoryDialogContext.Provider value={{ open }}>
      {children}
      {isOpen && (
        <CreateStoryDialog
          defaultSprintId={opts.sprintId ?? null}
          onClose={close}
          onCreated={handleCreated}
        />
      )}
    </CreateStoryDialogContext.Provider>
  )
}

const PRIORITIES: PriorityLevel[] = ['P1', 'P2', 'P3', 'P4']

function CreateStoryDialog({
  defaultSprintId,
  onClose,
  onCreated,
}: {
  defaultSprintId: string | null
  onClose: () => void
  onCreated: (s: Story) => void
}) {
  const { data: epics } = useEpics()
  const { data: sprints } = useSprints()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<PriorityLevel | ''>('')
  const [points, setPoints] = useState<string>('')
  const [epicId, setEpicId] = useState<string>('')
  const [sprintId, setSprintId] = useState<string>(defaultSprintId ?? '')
  const [branch, setBranch] = useState('')
  const [acDraft, setAcDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const acceptance: AcceptanceCriterion[] = acDraft
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => ({ text, done: false }))

  async function handleSubmit() {
    if (!name.trim() || busy) return
    setBusy(true)
    setErr(null)
    try {
      const s = await createStory({
        name: name.trim(),
        description,
        acceptance_criteria: acceptance.length > 0 ? acceptance : undefined,
        priority: priority === '' ? null : priority,
        points: points === '' ? null : Number(points) || null,
        epic_id: epicId === '' ? null : epicId,
        sprint_id: sprintId === '' ? null : sprintId,
        branch: branch.trim() === '' ? null : branch.trim(),
      })
      onCreated(s)
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
        paddingTop: 60,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius)',
          width: 640,
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 100px)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: 'var(--shadow-md)',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ font: '600 15px/1 var(--font)', color: 'var(--hv-fg)' }}>
            New story
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={closeBtn}>
            ✕
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Title"
          autoFocus
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          style={input(true)}
        />

        <MarkdownEditor
          value={description}
          onChange={setDescription}
          placeholder="Describe the work… (optional)"
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <LabeledSelect
            label="Priority"
            value={priority}
            onChange={(v) => setPriority(v as PriorityLevel | '')}
            options={[
              { value: '', label: '— none —' },
              ...PRIORITIES.map((p) => ({ value: p, label: p })),
            ]}
          />
          <LabeledInput
            label="Points"
            value={points}
            onChange={setPoints}
            type="number"
            width={70}
          />
          <LabeledSelect
            label="Epic"
            value={epicId}
            onChange={setEpicId}
            options={[
              { value: '', label: '— none —' },
              ...(epics ?? []).map((e) => ({ value: e.id, label: e.name })),
            ]}
          />
          <LabeledSelect
            label="Sprint"
            value={sprintId}
            onChange={setSprintId}
            options={[
              { value: '', label: '— backlog —' },
              ...(sprints ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <LabeledInput
            label="Branch"
            value={branch}
            onChange={setBranch}
            placeholder="feat/..."
            width={160}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Acceptance criteria (one per line)</label>
          <textarea
            value={acDraft}
            onChange={(e) => setAcDraft(e.target.value)}
            rows={4}
            placeholder={'User can sign up\nEmail validation rejects duplicates'}
            style={{
              ...input(false),
              resize: 'vertical',
              fontFamily: 'var(--mono)',
              font: '400 12.5px/1.5 var(--mono)',
            }}
          />
        </div>

        {err && <div style={{ color: 'var(--danger)', font: '400 12.5px/1.4 var(--font)' }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || busy}
            style={btnPrimary(!name.trim() || busy)}
          >
            {busy ? 'Creating…' : 'Create story'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '5px 8px',
          background: 'var(--bg-2)',
          color: 'var(--hv-fg)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius-sm)',
          font: '400 13px/1.3 var(--font)',
          minWidth: 120,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  width?: number
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type ?? 'text'}
        placeholder={placeholder}
        style={{ ...input(false), width: width ?? 160 }}
      />
    </label>
  )
}

const labelStyle: React.CSSProperties = {
  font: '500 10.5px/1 var(--font)',
  color: 'var(--fg-4)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

function input(title: boolean): React.CSSProperties {
  return {
    padding: title ? '8px 10px' : '5px 8px',
    background: title ? 'var(--surface)' : 'var(--bg-2)',
    color: 'var(--hv-fg)',
    border: `1px solid var(--hv-border)`,
    borderRadius: 'var(--radius-sm)',
    font: title ? '600 16px/1.3 var(--font)' : '400 13px/1.3 var(--font)',
    outline: 'none',
  }
}

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--fg-3)',
  font: '500 14px/1 var(--font)',
  cursor: 'pointer',
  padding: 2,
}

const btnSecondary: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: 'var(--fg-2)',
  border: '1px solid var(--hv-border)',
  borderRadius: 'var(--radius-sm)',
  font: '500 12.5px/1 var(--font)',
  cursor: 'pointer',
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    background: disabled ? 'var(--bg-2)' : 'var(--hv-accent)',
    color: disabled ? 'var(--fg-4)' : 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    font: '500 12.5px/1 var(--font)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
