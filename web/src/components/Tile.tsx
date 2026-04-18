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
      className={`group block rounded-xl border border-border bg-card/60 p-4 hover:border-accent/50 transition-colors ${
        state === 'offline' ? 'opacity-60' : ''
      }`}
    >
      <header className="flex items-center justify-between mb-2">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium"
          aria-label={`status ${state}`}
        >
          <StateDot state={state} />
          <span className="text-muted">{stateLabel(state)}</span>
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted/70">
          {cliLabel(tile.cli)}
        </span>
      </header>
      <div className="font-mono text-xs text-fg break-all" title={tile.cwd}>
        {cwdTail}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[11px] text-muted">
        {tile.detected_story_id ? (
          <span className="px-1.5 py-0.5 rounded bg-border/40 truncate max-w-[140px]">
            story {tile.detected_story_id.slice(0, 8)}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded bg-border/20 text-muted/70">
            unassigned
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
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    muted: 'bg-blue-500',
    offline: 'bg-muted/50',
  }[state]
  return <span className={`inline-block size-2 rounded-full ${cls}`} aria-hidden="true" />
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
