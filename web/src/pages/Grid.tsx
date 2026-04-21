// @ts-nocheck — legacy pre-Hive file; restyled or removed in Unit 15/16/26.
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
          <div className="border-[1.5px] border-dashed border-[var(--steel)] p-10 text-center bg-[var(--cream-2)]">
            <p className="label text-[12px] tracking-[0.15em] text-[var(--ink)] uppercase">— No live operators —</p>
            <p className="text-[11px] mt-2 text-[var(--muted)] font-mono">
              Run{' '}
              <code className="px-1.5 py-0.5 bg-[var(--steel)] text-[var(--cream)] font-mono text-[11px]">
                team-presence start
              </code>
              {' '}to connect
            </p>
          </div>
        )}

        {visibleActive.length > 0 && (
          <section>
            <h2 className="label text-[11px] uppercase tracking-[0.15em] text-[var(--ink)] mb-3 pb-2 border-b-[1.5px] border-[var(--steel)]">
              Active sessions · {visibleActive.length}
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
            <h2 className="label text-[11px] uppercase tracking-[0.15em] text-[var(--ink)] mb-3 pb-2 border-b-[1.5px] border-[var(--steel)]">
              Unassigned · {unassigned.length}
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
