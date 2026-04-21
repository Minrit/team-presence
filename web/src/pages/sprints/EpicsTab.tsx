import { useState } from 'react'
import { Card } from '../../design/Card'
import { MarkdownEditor } from '../../design/MarkdownEditor'
import { createEpic, deleteEpic, patchEpic } from '../../epics'
import { useEpics, useStories } from '../../stories'
import type { Epic } from '../../types'

const COLORS = [
  '#c8392b', // signal red
  '#8a3a2a', // iron oxide
  '#3b6d80', // blueprint cyan
  '#2a2f3a', // cold steel
  '#5a7a3c', // olive ok
  '#b8801a', // brass warn
  '#4f8296', // pale cyan
  '#6b6358', // muted
]

export default function EpicsTab() {
  const { data: epics, isLoading } = useEpics()
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!draftName.trim() || busy) return
    setBusy(true)
    try {
      await createEpic({ name: draftName.trim(), color: draftColor })
      setDraftName('')
    } catch (err) {
      alert(`Create failed: ${msg(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: 12 }}>
        <form onSubmit={onCreate} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Epic name"
            style={{
              flex: '1 1 220px',
              padding: '6px 10px',
              background: 'var(--bg-2)',
              color: 'var(--hv-fg)',
              border: '1px solid var(--hv-border)',
              borderRadius: 'var(--radius-sm)',
              font: '400 13px/1.3 var(--font)',
            }}
          />
          <ColorSwatches value={draftColor} onChange={setDraftColor} />
          <button
            type="submit"
            disabled={busy || !draftName.trim()}
            style={{
              padding: '6px 14px',
              background: draftName.trim() ? 'var(--hv-accent)' : 'var(--bg-2)',
              color: draftName.trim() ? 'white' : 'var(--fg-4)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              font: '500 12.5px/1 var(--font)',
              cursor: draftName.trim() && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? 'Creating…' : 'Create epic'}
          </button>
        </form>
      </Card>

      {isLoading && <div style={{ color: 'var(--fg-3)' }}>Loading…</div>}
      {!isLoading && (epics ?? []).length === 0 && (
        <div style={{ color: 'var(--fg-3)', font: '400 13px/1.4 var(--font)' }}>
          No epics yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(epics ?? []).map((e) => (
          <EpicRow key={e.id} epic={e} />
        ))}
      </div>
    </div>
  )
}

function EpicRow({ epic }: { epic: Epic }) {
  const { data: stories } = useStories()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(epic.name)
  const [color, setColor] = useState(epic.color)
  const [description, setDescription] = useState(epic.description)

  const members = (stories ?? []).filter((s) => s.epic_id === epic.id)
  const done = members.filter((s) => s.status === 'done').length

  async function save() {
    try {
      await patchEpic(epic.id, {
        name: name.trim(),
        color,
        description,
      })
      setEditing(false)
    } catch (err) {
      alert(`Save failed: ${msg(err)}`)
    }
  }

  async function remove() {
    if (!confirm(`Delete epic "${epic.name}"? Stories keep their epic_id but it won't render.`)) return
    try {
      await deleteEpic(epic.id)
    } catch (err) {
      alert(`Delete failed: ${msg(err)}`)
    }
  }

  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: editing ? color : epic.color,
            flexShrink: 0,
          }}
        />
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: '4px 8px',
              background: 'var(--surface)',
              color: 'var(--hv-fg)',
              border: '1px solid var(--hv-accent)',
              borderRadius: 'var(--radius-sm)',
              font: '600 14px/1.2 var(--font)',
            }}
          />
        ) : (
          <div style={{ font: '600 14px/1.2 var(--font)', color: 'var(--hv-fg)' }}>
            {epic.name}
          </div>
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
          {done} / {members.length} done
        </span>
        {editing ? (
          <>
            <TextBtn onClick={save}>Save</TextBtn>
            <TextBtn
              onClick={() => {
                setEditing(false)
                setName(epic.name)
                setColor(epic.color)
                setDescription(epic.description)
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
          </>
        )}
      </div>
      {editing && <ColorSwatches value={color} onChange={setColor} />}
      {editing ? (
        <MarkdownEditor
          value={description}
          onChange={setDescription}
          placeholder="Describe this epic…"
        />
      ) : (
        epic.description && (
          <div
            style={{
              font: '400 12.5px/1.5 var(--font)',
              color: 'var(--fg-2)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {epic.description}
          </div>
        )
      )}
    </Card>
  )
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: c,
            border: value === c ? '2px solid var(--hv-fg)' : '2px solid transparent',
            cursor: 'pointer',
            padding: 0,
          }}
          title={c}
        />
      ))}
    </div>
  )
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
