import { useMemo, useState } from 'react'
import { Chip } from '../design/Chip'
import { AGENTS } from '../design/meta'
import { useSseGrid } from '../hooks/useSseGrid'
import { Terminal } from '../terminal/Terminal'
import type { AgentKind } from '../types'

type Filter = 'all' | AgentKind

export default function Stream() {
  const { tiles } = useSseGrid()
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 }
    for (const t of tiles) {
      if (t.ended_at) continue
      c.all++
      const k = t.agent_kind
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [tiles])

  const displayed = useMemo(() => tiles.filter((t) => !t.ended_at || endedRecently(t)), [tiles])

  const visibleIds = useMemo(() => {
    if (filter === 'all') return new Set(displayed.map((t) => t.session_id))
    return new Set(
      displayed.filter((t) => t.agent_kind === filter).map((t) => t.session_id),
    )
  }, [displayed, filter])

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All · {counts.all ?? 0}
        </Chip>
        {(Object.keys(AGENTS) as AgentKind[]).map((k) => {
          const n = counts[k] ?? 0
          if (n === 0) return null
          return (
            <Chip
              key={k}
              active={filter === k}
              color={AGENTS[k].color}
              onClick={() => setFilter(k)}
            >
              {AGENTS[k].short} · {n}
            </Chip>
          )
        })}
      </div>

      {displayed.length === 0 && (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--fg-3)',
            border: '1px dashed var(--hv-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          No live sessions yet. Start an agent and it will show up here.
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))',
          gridAutoRows: 'minmax(340px, 1fr)',
          gap: 12,
          overflow: 'auto',
        }}
      >
        {displayed.map((t) => (
          <div
            key={t.session_id}
            style={{ display: visibleIds.has(t.session_id) ? 'block' : 'none' }}
          >
            <Terminal
              sessionId={t.session_id}
              header={{
                agentKind: t.agent_kind,
                cwd: t.cwd,
                userLabel: t.user_id.slice(0, 6),
                storyId: t.detected_story_id
                  ? t.detected_story_id.slice(0, 6).toUpperCase()
                  : undefined,
              }}
              focused={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function endedRecently(t: { ended_at: string | null }): boolean {
  if (!t.ended_at) return true
  const ms = Date.parse(t.ended_at)
  if (Number.isNaN(ms)) return false
  return Date.now() - ms < 30_000
}
