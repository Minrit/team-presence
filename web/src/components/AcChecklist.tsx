import { useState } from 'react'
import type { AcceptanceCriterion } from '../types'

/** Controlled AC checklist. Parent holds the AC array as part of the story
 *  draft; this component only reports intent back via onChange. */
export function AcChecklist({
  items,
  onChange,
}: {
  items: AcceptanceCriterion[]
  onChange: (next: AcceptanceCriterion[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const total = items.length
  const done = items.filter((a) => a.done).length

  function handleAdd() {
    const text = draft.trim()
    if (!text) return
    onChange([...items, { text, done: false }])
    setDraft('')
  }

  function handleToggle(i: number) {
    onChange(items.map((a, k) => (k === i ? { ...a, done: !a.done } : a)))
  }

  function handleDelete(i: number) {
    onChange(items.filter((_, k) => k !== i))
  }

  function handleSaveEdit(i: number) {
    const text = editText.trim()
    if (!text) return
    onChange(items.map((a, k) => (k === i ? { ...a, text } : a)))
    setEditIdx(null)
    setEditText('')
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ font: '600 13px/1 var(--font)' }}>Acceptance criteria</div>
        {total > 0 && (
          <div
            style={{
              font: '500 11px/1 var(--mono)',
              color: 'var(--fg-3)',
              padding: '1px 6px',
              borderRadius: 10,
              background: 'var(--bg-2)',
            }}
          >
            {done} / {total}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((a, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '4px 0',
              font: '400 13px/1.45 var(--font)',
              color: a.done ? 'var(--fg-3)' : 'var(--hv-fg)',
            }}
          >
            <button
              type="button"
              onClick={() => handleToggle(i)}
              style={{
                marginTop: 2,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title={a.done ? 'Mark unchecked' : 'Mark done'}
            >
              <AcGlyph done={a.done} />
            </button>
            {editIdx === i ? (
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveEdit(i)
                  } else if (e.key === 'Escape') {
                    setEditIdx(null)
                    setEditText('')
                  }
                }}
                onBlur={() => handleSaveEdit(i)}
                autoFocus
                style={{
                  flex: 1,
                  padding: '2px 6px',
                  background: 'var(--surface)',
                  color: 'var(--hv-fg)',
                  border: '1px solid var(--hv-accent)',
                  borderRadius: 4,
                  font: '400 13px/1.45 var(--font)',
                }}
              />
            ) : (
              <>
                <span
                  style={{
                    flex: 1,
                    whiteSpace: 'pre-wrap',
                    textDecoration: a.done ? 'line-through' : 'none',
                    cursor: 'text',
                  }}
                  onDoubleClick={() => {
                    setEditIdx(i)
                    setEditText(a.text)
                  }}
                >
                  {a.text}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditIdx(i)
                    setEditText(a.text)
                  }}
                  style={rowBtn('var(--hv-accent)')}
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(i)}
                  style={rowBtn('var(--danger)')}
                  title="Delete"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
        {total === 0 && (
          <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-4)' }}>
            No acceptance criteria yet.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Add a criterion…"
          style={{
            flex: 1,
            padding: '5px 8px',
            background: 'var(--surface)',
            color: 'var(--hv-fg)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius-sm)',
            font: '400 13px/1.45 var(--font)',
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim()}
          style={{
            padding: '6px 10px',
            background: draft.trim() ? 'var(--hv-accent)' : 'var(--bg-2)',
            color: draft.trim() ? 'white' : 'var(--fg-4)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            font: '500 12px/1 var(--font)',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

function AcGlyph({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6.5" fill="var(--success)" />
        <polyline
          points="4,7.2 6.2,9.4 10.2,5"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="6" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" />
    </svg>
  )
}

function rowBtn(color: string): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color,
    cursor: 'pointer',
    font: '500 12px/1 var(--font)',
    padding: '2px 4px',
  }
}
