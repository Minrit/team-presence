import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StoryId } from '../design/StoryId'
import { addRelation, removeRelation, useStories } from '../stories'
import type { Story, StoryRelations } from '../types'

/** Edit a story's `blocks` / `blocked_by` relations. Add flow: type to
 *  filter, Enter picks the first match. Remove flow: click ✕ next to a
 *  linked story id. `blocked_by` is a read-only mirror of another story's
 *  `blocks` — so removal there uses `removeRelation(otherStory, thisStory)`. */
export function RelationsEditor({
  storyId,
  relations,
}: {
  storyId: string
  relations: StoryRelations | undefined
}) {
  const { data: allStories } = useStories()
  const [query, setQuery] = useState('')

  const blocks = relations?.blocks ?? []
  const blockedBy = relations?.blocked_by ?? []

  const candidates = useMemo<Story[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const excluded = new Set<string>([storyId, ...blocks, ...blockedBy])
    return (allStories ?? [])
      .filter((s) => !excluded.has(s.id))
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().startsWith(q),
      )
      .slice(0, 6)
  }, [allStories, query, storyId, blocks, blockedBy])

  async function handleAdd(target: string) {
    try {
      await addRelation(storyId, 'blocks', target)
      setQuery('')
    } catch (err) {
      alert(`Add relation failed: ${msg(err)}`)
    }
  }

  async function handleRemoveBlocks(target: string) {
    try {
      await removeRelation(storyId, target)
    } catch (err) {
      alert(`Remove failed: ${msg(err)}`)
    }
  }

  async function handleRemoveBlockedBy(other: string) {
    try {
      await removeRelation(other, storyId)
    } catch (err) {
      alert(`Remove failed: ${msg(err)}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ font: '600 13px/1 var(--font)' }}>Relations</div>

      <RelationRow
        label="blocked by"
        ids={blockedBy}
        color="var(--danger)"
        onRemove={handleRemoveBlockedBy}
      />
      <RelationRow
        label="blocks"
        ids={blocks}
        color="var(--warning)"
        onRemove={handleRemoveBlocks}
      />

      {blocks.length === 0 && blockedBy.length === 0 && (
        <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-4)' }}>
          No relations yet.
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && candidates[0]) {
              e.preventDefault()
              void handleAdd(candidates[0].id)
            }
          }}
          placeholder="Add 'blocks' relation: search story by id or title…"
          style={{
            width: '100%',
            padding: '5px 8px',
            background: 'var(--surface)',
            color: 'var(--hv-fg)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius-sm)',
            font: '400 12.5px/1.45 var(--font)',
          }}
        />
        {candidates.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 2,
              background: 'var(--surface)',
              border: '1px solid var(--hv-border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-sm)',
              zIndex: 10,
            }}
          >
            {candidates.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleAdd(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  font: '400 12.5px/1.3 var(--font)',
                  color: 'var(--hv-fg)',
                }}
              >
                <StoryId id={s.id} />
                <span style={{ color: 'var(--fg-2)' }}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RelationRow({
  label,
  ids,
  color,
  onRemove,
}: {
  label: string
  ids: string[]
  color: string
  onRemove: (id: string) => void
}) {
  if (ids.length === 0) return null
  return (
    <div
      style={{
        font: '400 12.5px/1.4 var(--font)',
        color: 'var(--fg-2)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <span style={{ color, marginRight: 2 }}>{label}</span>
      {ids.map((id) => (
        <span
          key={id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            background: 'var(--bg-2)',
            border: '1px solid var(--hv-border)',
            borderRadius: 4,
          }}
        >
          <Link
            to={`/story/${id}`}
            style={{ color: 'var(--hv-accent)', textDecoration: 'none' }}
          >
            <StoryId id={id} />
          </Link>
          <button
            type="button"
            onClick={() => onRemove(id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg-3)',
              cursor: 'pointer',
              padding: 0,
              font: '500 11px/1 var(--font)',
            }}
            title="Remove"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
