import { useMemo } from 'react'
import Tile, { tileState, type TileState } from '../components/Tile'
import TopNav from '../components/TopNav'
import { useSseGrid } from '../hooks/useSseGrid'
import type { GridTile } from '../types'

// MAX_VISIBLE matches "Grid at 3×2 on desktop" — origin doc R18. The 6-user
// scale is the invariant; if more tiles ever arrive we still render them but
// show a "+N more" line rather than layout-break.
const MAX_VISIBLE = 12

export default function Grid() {
  const { tiles, connected, error } = useSseGrid()

  const [active, unassigned] = useMemo(() => {
    // Active (linked to a story) first, unassigned tiles grouped separately.
    // Within each group, active > idle > muted > offline so the most
    // interesting tiles are always first.
    const rank: Record<TileState, number> = { active: 0, idle: 1, muted: 2, offline: 3 }
    const sortFn = (a: GridTile, b: GridTile) => rank[tileState(a)] - rank[tileState(b)]
    const live = tiles.filter((t) => t.detected_story_id).slice().sort(sortFn)
    const un = tiles.filter((t) => !t.detected_story_id).slice().sort(sortFn)
    return [live, un]
  }, [tiles])

  const visibleActive = active.slice(0, MAX_VISIBLE)
  const hiddenCount = active.length - visibleActive.length

  return (
    <div className="min-h-full flex flex-col">
      <TopNav current="live" />
      <main className="flex-1 p-6 space-y-6">
        {error && (
          <p className="text-red-500 text-sm">Live feed error: {error}</p>
        )}
        {!connected && !error && (
          <p className="text-muted text-sm">Connecting…</p>
        )}

        {tiles.length === 0 && connected && (
          <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-muted">
            <p className="text-sm">No one is live.</p>
            <p className="text-xs mt-1 text-muted/70">
              Start your collector with{' '}
              <code className="px-1 py-0.5 rounded bg-border/30 font-mono text-[11px]">
                team-presence start
              </code>
            </p>
          </div>
        )}

        {visibleActive.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wide text-muted mb-3">
              Active sessions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleActive.map((t) => (
                <Tile key={t.session_id} tile={t} />
              ))}
            </div>
            {hiddenCount > 0 && (
              <p className="text-xs text-muted mt-3">
                showing {visibleActive.length} of {active.length}
              </p>
            )}
          </section>
        )}

        {unassigned.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wide text-muted mb-3">
              未分类 — sessions without a linked story
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unassigned.map((t) => (
                <Tile key={t.session_id} tile={t} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
