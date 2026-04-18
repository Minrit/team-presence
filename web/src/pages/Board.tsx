import { useMemo, useState } from 'react'
import { StatusIcon } from '../design/StatusIcon'
import { useSseGrid } from '../hooks/useSseGrid'
import { useEpics, useStories } from '../stories'
import type { Epic, GridTile, Story, StoryStatus, User } from '../types'
import { BoardColumn } from './board/BoardColumn'

const PRIMARY: StoryStatus[] = ['todo', 'in_progress', 'review', 'done']

/** Read-only board. Drag-and-drop was removed — status moves now flow
 *  through MCP (`tp.story.move_status` / the /tp-move-status skill) so the
 *  audit log carries actor_type='agent'. Cards still click into /story/:id. */
export default function Board() {
  const { data: stories, error, isLoading } = useStories()
  const { data: epics } = useEpics()
  const { tiles } = useSseGrid()
  const [blockedOpen, setBlockedOpen] = useState(false)

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
  )
}
