import { useEffect, useRef, useState } from 'react'
import { Priority } from '../../design/Priority'
import { deleteStory, patchStory, useEpics } from '../../stories'
import type { Priority as PriorityLevel, Story } from '../../types'

const PRIORITIES: PriorityLevel[] = ['P1', 'P2', 'P3', 'P4']

/** `⋯` popover menu attached to each BoardCard. Stops propagation so the
 *  trigger button doesn't open the story detail. */
export function CardActionMenu({ story }: { story: Story }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function update(fn: () => Promise<unknown>) {
    setOpen(false)
    try {
      await fn()
    } catch (err) {
      alert(`Action failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--fg-3)',
          cursor: 'pointer',
          padding: '2px 5px',
          font: '600 14px/1 var(--mono)',
          borderRadius: 4,
        }}
        title="Actions"
      >
        ⋯
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 180,
            background: 'var(--surface)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            padding: 4,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <MenuSection label="Priority" />
          {PRIORITIES.map((p) => (
            <MenuButton
              key={p}
              active={story.priority === p}
              onClick={() =>
                update(() => patchStory(story.id, { priority: p }))
              }
            >
              <Priority level={p} showLabel />
            </MenuButton>
          ))}
          <MenuButton
            onClick={() => update(() => patchStory(story.id, { priority: null }))}
          >
            <span style={{ color: 'var(--fg-4)' }}>Clear priority</span>
          </MenuButton>
          <MenuDivider />
          <EpicSubmenu story={story} onUpdate={update} />
          <MenuDivider />
          <MenuButton
            danger
            onClick={() => {
              if (
                confirm(`Delete story "${story.name}"? This cannot be undone.`)
              ) {
                void update(() => deleteStory(story.id))
              }
            }}
          >
            Delete story
          </MenuButton>
        </div>
      )}
    </div>
  )
}

function EpicSubmenu({
  story,
  onUpdate,
}: {
  story: Story
  onUpdate: (fn: () => Promise<unknown>) => void
}) {
  const { data: epics } = useEpics()
  return (
    <>
      <MenuSection label="Epic" />
      {(epics ?? []).map((e) => (
        <MenuButton
          key={e.id}
          active={story.epic_id === e.id}
          onClick={() => onUpdate(() => patchStory(story.id, { epic_id: e.id }))}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
        </MenuButton>
      ))}
      {(epics ?? []).length === 0 && (
        <div
          style={{
            padding: '4px 10px',
            font: '400 12px/1.3 var(--font)',
            color: 'var(--fg-4)',
          }}
        >
          No epics yet.
        </div>
      )}
      <MenuButton
        onClick={() => onUpdate(() => patchStory(story.id, { epic_id: null }))}
      >
        <span style={{ color: 'var(--fg-4)' }}>Clear epic</span>
      </MenuButton>
    </>
  )
}

function MenuButton({
  children,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '5px 10px',
        background: active ? 'var(--bg-2)' : 'transparent',
        color: danger ? 'var(--danger)' : 'var(--hv-fg)',
        border: 'none',
        borderRadius: 4,
        font: '400 12.5px/1.3 var(--font)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  )
}

function MenuSection({ label }: { label: string }) {
  return (
    <div
      style={{
        font: '500 10px/1 var(--font)',
        color: 'var(--fg-4)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: '6px 10px 2px',
      }}
    >
      {label}
    </div>
  )
}

function MenuDivider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--hv-border)',
        margin: '4px 0',
      }}
    />
  )
}
