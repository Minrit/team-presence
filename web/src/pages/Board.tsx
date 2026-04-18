import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { useAuth } from '../auth'
import { Avatar, userToAvatar } from '../design/Avatar'
import { Chip } from '../design/Chip'
import { StatusIcon } from '../design/StatusIcon'
import { useSseGrid } from '../hooks/useSseGrid'
import { useEpics, useStories } from '../stories'
import type { Epic, GridTile, Story, StoryStatus, User } from '../types'
import { BoardColumn } from './board/BoardColumn'

const PRIMARY: StoryStatus[] = ['todo', 'in_progress', 'review', 'done']

/** Read-only board. Drag-and-drop was removed — status moves now flow
 *  through MCP (`tp.story.move_status` / the /tp-move-status skill) so
 *  the audit log carries actor_type='agent'. Cards still click into
 *  /story/:id.
 *
 *  Owner filter: `?owner=all|me|<user_id>` filters the visible stories.
 *  Useful for "只做我的" — set a session to mine-only then hand the
 *  board to /tp-dev-story. */
export default function Board() {
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const { data: stories, error, isLoading } = useStories()
  const { data: epics } = useEpics()
  const { data: users } = useSWR<User[]>(
    '/api/v1/auth/users',
    (k) => api.get<User[]>(k),
    { refreshInterval: 60_000 },
  )
  const { tiles } = useSseGrid()
  const [blockedOpen, setBlockedOpen] = useState(false)

  const ownerFilter = params.get('owner') ?? 'all'
  const setOwnerFilter = (v: string) => {
    const p = new URLSearchParams(params)
    if (v === 'all') p.delete('owner')
    else p.set('owner', v)
    setParams(p, { replace: true })
  }

  const epicsById = useMemo<Record<string, Epic>>(() => {
    const m: Record<string, Epic> = {}
    for (const e of epics ?? []) m[e.id] = e
    return m
  }, [epics])

  const usersById = useMemo<Record<string, User>>(() => {
    const m: Record<string, User> = {}
    for (const u of users ?? []) m[u.id] = u
    return m
  }, [users])

  const tilesByStory = useMemo<Record<string, GridTile[]>>(() => {
    const m: Record<string, GridTile[]> = {}
    for (const t of tiles) {
      if (!t.detected_story_id) continue
      ;(m[t.detected_story_id] ??= []).push(t)
    }
    return m
  }, [tiles])

  // Owners who actually own at least one story — used to drive chips.
  const ownerCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of stories ?? []) {
      if (s.owner_id) c[s.owner_id] = (c[s.owner_id] ?? 0) + 1
    }
    return c
  }, [stories])

  const visibleStories = useMemo<Story[]>(() => {
    const base = stories ?? []
    if (ownerFilter === 'all') return base
    if (ownerFilter === 'mine') {
      return user ? base.filter((s) => s.owner_id === user.id) : base
    }
    return base.filter((s) => s.owner_id === ownerFilter)
  }, [stories, ownerFilter, user])

  const grouped = useMemo(() => {
    const g: Record<StoryStatus, Story[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      review: [],
      done: [],
    }
    for (const s of visibleStories) g[s.status].push(s)
    return g
  }, [visibleStories])

  const blocked = grouped.blocked
  const hasBlocked = blocked.length > 0

  if (isLoading) {
    return <div style={{ padding: 32, color: 'var(--fg-3)' }}>Loading stories…</div>
  }
  if (error) {
    return (
      <div style={{ padding: 32, color: 'var(--danger)' }}>
        Failed to load stories: {String(error)}
      </div>
    )
  }

  const totalCount = stories?.length ?? 0
  const mineCount = user ? (ownerCounts[user.id] ?? 0) : 0
  const otherOwners = Object.entries(ownerCounts)
    .filter(([id]) => (!user || id !== user.id))
    .sort((a, b) => b[1] - a[1])

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 18,
        minHeight: 0,
      }}
    >
      {/* Owner filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <Chip active={ownerFilter === 'all'} onClick={() => setOwnerFilter('all')}>
          All · {totalCount}
        </Chip>
        {user && (
          <Chip active={ownerFilter === 'mine'} onClick={() => setOwnerFilter('mine')}>
            Mine · {mineCount}
          </Chip>
        )}
        {otherOwners.map(([uid, n]) => {
          const u = usersById[uid]
          const label = u?.display_name ?? `${uid.slice(0, 6)}…`
          return (
            <Chip
              key={uid}
              active={ownerFilter === uid}
              onClick={() => setOwnerFilter(uid)}
            >
              {u && (
                <Avatar
                  user={userToAvatar(u, 'active')}
                  size={16}
                  style={{ marginRight: 4 }}
                />
              )}
              {label} · {n}
            </Chip>
          )
        })}
      </div>

      {/* Columns */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 12,
          minHeight: 0,
        }}
      >
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
    </div>
  )
}
