import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../design/Button'
import { Icon } from '../design/Icon'
import { LiveDot } from '../design/LiveDot'
import { useSseGrid } from '../hooks/useSseGrid'
import type { GridTile } from '../types'

interface NodeCard {
  userId: string
  tiles: GridTile[]
  online: boolean
  lastHeartbeatMs: number | null
}

export default function Compute() {
  const { tiles } = useSseGrid()
  const navigate = useNavigate()

  const nodes = useMemo<NodeCard[]>(() => {
    const byUser = new Map<string, GridTile[]>()
    for (const t of tiles) {
      const arr = byUser.get(t.user_id) ?? []
      arr.push(t)
      byUser.set(t.user_id, arr)
    }
    return Array.from(byUser.entries()).map(([userId, uTiles]) => {
      const active = uTiles.filter((t) => !t.ended_at)
      const last = uTiles
        .map((t) => Date.parse(t.last_heartbeat_at))
        .filter((n) => !Number.isNaN(n))
        .reduce((a, b) => (a > b ? a : b), 0)
      const online = active.length > 0 && Date.now() - last < 90_000
      return { userId, tiles: uTiles, online, lastHeartbeatMs: last || null }
    })
  }, [tiles])

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <Icon name="cpu" size={16} color="var(--hv-accent)" />
        <div style={{ font: '500 13px/1 var(--font)' }}>
          {nodes.filter((n) => n.online).length} machine{nodes.length === 1 ? '' : 's'} online
        </div>
        <div style={{ flex: 1 }} />
        <Button
          variant="primary"
          size="sm"
          icon={<Icon name="plug" size={12} color="#fff" />}
          onClick={() => navigate('/connect')}
        >
          Connect my machine
        </Button>
      </div>

      {nodes.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--fg-3)',
            border: '1px dashed var(--hv-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          No machines have connected yet. Click “Connect my machine” to walk a teammate through
          onboarding.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}
      >
        {nodes.map((n) => (
          <NodeCardView key={n.userId} node={n} />
        ))}
      </div>
    </div>
  )
}

function NodeCardView({ node }: { node: NodeCard }) {
  const active = node.tiles.filter((t) => !t.ended_at).length
  const rtt =
    node.lastHeartbeatMs && Date.now() - node.lastHeartbeatMs < 90_000
      ? `${Math.max(0, Math.min(99, Math.round((Date.now() - node.lastHeartbeatMs) / 1000)))}s`
      : '—'
  const est = active === 0 ? 5 : Math.min(80, 20 + active * 12)
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: node.online ? 1 : 0.65,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LiveDot color={node.online ? 'var(--success)' : 'var(--fg-4)'} size={7} />
        <div style={{ font: '600 13px/1.2 var(--font)' }}>{node.userId.slice(0, 8)}…</div>
        <div style={{ flex: 1 }} />
        <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
          RTT {rtt}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          font: '400 12px/1.3 var(--font)',
          color: 'var(--fg-2)',
        }}
      >
        <Cell label="Sessions" value={String(active)} />
        <Cell label="Accelerator" value="Metal (est.)" />
        <Cell label="CPU est." value={`${est}%`} />
        <Cell label="RAM est." value={`${Math.min(85, est + 10)}%`} />
      </div>
      <div
        style={{
          font: '400 10.5px/1 var(--mono)',
          color: 'var(--fg-4)',
          marginTop: 2,
        }}
      >
        CPU / RAM / Accelerator are heuristic; Phase B ships real telemetry.
      </div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ font: '400 10.5px/1 var(--font)', color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ font: '500 12.5px/1 var(--font)', color: 'var(--hv-fg)' }}>{value}</span>
    </div>
  )
}
