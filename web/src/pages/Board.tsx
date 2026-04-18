import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Icon } from '../design/Icon'
import { Priority } from '../design/Priority'
import { StatusIcon } from '../design/StatusIcon'
import { useSseGrid } from '../hooks/useSseGrid'
import { patchStory, useEpics, useStories } from '../stories'
import type { Epic, GridTile, Story, StoryStatus, User } from '../types'
import { BoardColumn } from './board/BoardColumn'

const PRIMARY: StoryStatus[] = ['todo', 'in_progress', 'review', 'done']

export default function Board() {
  const { data: stories, mutate, error, isLoading } = useStories()
  const { data: epics } = useEpics()
  const { tiles } = useSseGrid()
  const [blockedOpen, setBlockedOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const epicsById = useMemo<Record<string, Epic>>(() => {
    const m: Record<string, Epic> = {}
    for (const e of epics ?? []) m[e.id] = e
    return m
  }, [epics])

  const tilesByStory = useMemo<Record<string, GridTile[]>>(() => {
    const m: Record<string, GridTile[]> = {}
    for (const t of tiles) {
      if (!t.detected_story_id) continue
      ;(m[t.detected_story_id] ??= []).push(t)
    }
    return m
  }, [tiles])

  // TODO: wire a real /api/v1/users endpoint. Today the best we have is
  // the owner_id itself — render an avatar from the id hash in the card.
  const usersById: Record<string, User> = useMemo(() => ({}), [])

  const grouped = useMemo(() => {
    const g: Record<StoryStatus, Story[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      review: [],
      done: [],
    }
    for (const s of stories ?? []) g[s.status].push(s)
    return g
  }, [stories])

  const onDragEnd = async (e: DragEndEvent) => {
    if (!stories) return
    const storyId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (!overId) return

    let target: StoryStatus | null = null
    if (overId.startsWith('col:')) {
      target = overId.slice(4) as StoryStatus
    } else {
      const overStory = stories.find((s) => s.id === overId)
      if (overStory) target = overStory.status
    }
    if (!target) return

    const moving = stories.find((s) => s.id === storyId)
    if (!moving || moving.status === target) return

    const next = stories.map((s) => (s.id === storyId ? { ...s, status: target! } : s))
    mutate(next, { revalidate: false })

    try {
      await patchStory(storyId, { status: target })
    } catch (err) {
      mutate(stories, { revalidate: false })
      alert(`Update failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const blocked = grouped.blocked
  const hasBlocked = blocked.length > 0

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: 'var(--fg-3)' }}>Loading stories…</div>
    )
  }
  if (error) {
    return (
      <div style={{ padding: 32, color: 'var(--danger)' }}>
        Failed to load stories: {String(error)}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div
        style={{
          height: '100%',
          display: 'flex',
          gap: 12,
          padding: 18,
          minHeight: 0,
        }}
      >
        {/* Blocked rail */}
        {hasBlocked && (
          <div
            onClick={() => setBlockedOpen((v) => !v)}
            style={{
              width: blockedOpen ? 260 : 34,
              flexShrink: 0,
              background: 'var(--surface)',
              border: '1px solid var(--hv-border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: blockedOpen ? 'stretch' : 'center',
              padding: blockedOpen ? 10 : '12px 4px',
              gap: 8,
              transition: 'width 160ms ease',
            }}
            title={blockedOpen ? undefined : 'Blocked — click to expand'}
          >
            {!blockedOpen ? (
              <>
                <StatusIcon status="blocked" size={14} />
                <div
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    font: '600 12px/1 var(--font)',
                    color: 'var(--danger)',
                    letterSpacing: 0.3,
                  }}
                >
                  Blocked · {blocked.length}
                </div>
              </>
            ) : (
              <BoardColumn
                status="blocked"
                stories={blocked}
                epics={epicsById}
                tilesByStory={tilesByStory}
                usersById={usersById}
              />
            )}
          </div>
        )}

        {/* 4 primary columns */}
        {PRIMARY.map((s) => (
          <BoardColumn
            key={s}
            status={s}
            stories={grouped[s]}
            epics={epicsById}
            tilesByStory={tilesByStory}
            usersById={usersById}
          />
        ))}
      </div>
      {/* Tiny legend row (dev hint while priority + icon library are new) */}
      <div
        style={{
          position: 'fixed',
          bottom: 10,
          right: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          borderRadius: 999,
          font: '400 11px/1 var(--font)',
          color: 'var(--fg-3)',
          boxShadow: 'var(--shadow-sm)',
          pointerEvents: 'none',
        }}
      >
        <Icon name="columns" size={12} /> Board
        <span style={{ color: 'var(--fg-4)' }}>·</span>
        <Priority level="P1" />
      </div>
    </DndContext>
  )
}
