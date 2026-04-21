// @ts-nocheck — legacy pre-Hive file; restyled or removed in Unit 15/16/26.
import { Link } from 'react-router-dom'
import type { GridTile } from '../types'

const IDLE_MS = 60_000

export interface TileProps {
  tile: GridTile
}

export default function Tile({ tile }: TileProps) {
  const state = tileState(tile)
  const cwdTail = tail(tile.cwd, 28)

  return (
    <Link
      to={`/room/${tile.session_id}`}
      className={`group block border-[1.5px] border-[var(--steel)] bg-[var(--cream)] p-4 hover:border-[var(--red)] transition-colors ${
        state === 'offline' ? 'opacity-60' : ''
      }`}
    >
      <header className="flex items-center justify-between mb-2">
        <span
          className="label inline-flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase"
          aria-label={`status ${state}`}
        >
          <StateDot state={state} />
          <span className="text-[var(--ink)]">{stateLabel(state)}</span>
        </span>
        <span className="label text-[9.5px] tracking-[0.15em] text-[var(--muted)]">
          {cliLabel(tile.cli)}
        </span>
      </header>
      <div className="font-mono text-xs text-[var(--ink)] break-all" title={tile.cwd}>
        {cwdTail}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10.5px] font-mono text-[var(--muted)]">
        {tile.detected_story_id ? (
          <span className="px-1.5 py-0.5 bg-[var(--steel)] text-[var(--cream)] truncate max-w-[140px]">
            {tile.detected_story_id.slice(0, 8)}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 bg-[var(--cream-3)] border border-[var(--rule)]">
            UNASSIGNED
          </span>
        )}
        <span className="ml-auto">{relative(tile.last_activity_at)}</span>
      </div>
    </Link>
  )
}

export type TileState = 'active' | 'idle' | 'muted' | 'offline'

export function tileState(tile: GridTile): TileState {
  if (tile.ended_at) return 'offline'
  if (tile.muted) return 'muted'
  const last = new Date(tile.last_activity_at).getTime()
  if (Date.now() - last > IDLE_MS) return 'idle'
  return 'active'
}

function stateLabel(s: TileState): string {
  switch (s) {
    case 'active':
      return 'live'
    case 'idle':
      return 'idle'
    case 'muted':
      return '私播中'
    case 'offline':
      return 'offline'
  }
}

function StateDot({ state }: { state: TileState }) {
  const cls = {
    active: 'bg-[var(--red)] z-pulse',
    idle: 'bg-[var(--warn)]',
    muted: 'bg-[var(--cyan)]',
    offline: 'bg-[var(--muted)]',
  }[state]
  return <span className={`inline-block size-2 ${cls}`} aria-hidden="true" />
}

function cliLabel(cli: string): string {
  if (cli === 'claude_code') return 'claude'
  return cli
}

function tail(s: string, n: number): string {
  if (s.length <= n) return s
  return '…' + s.slice(-n)
}

function relative(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const s = Math.floor(d / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
