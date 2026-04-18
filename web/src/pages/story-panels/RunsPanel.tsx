import { useSessionTools } from '../../hooks/useSessionTools'
import { Icon } from '../../design/Icon'
import { EmptyPanel } from './EmptyPanel'

const STATUS_COLOR: Record<string, string> = {
  passed: 'var(--success)',
  failed: 'var(--danger)',
  running: 'var(--warning)',
}

export function RunsPanel({ sessionId }: { sessionId: string | null }) {
  const { runs } = useSessionTools(sessionId)
  if (!sessionId) {
    return (
      <EmptyPanel
        title="No active session"
        hint="Shell / bash tool calls show up here once the agent starts running commands."
        icon="play"
      />
    )
  }
  if (runs.length === 0) {
    return (
      <EmptyPanel
        title="No runs yet"
        hint="Captured from tool=run / tool=bash frames in the collector stream."
        icon="play"
      />
    )
  }
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--surface)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div style={{ font: '600 13px/1 var(--font)' }}>Runs · {runs.length}</div>
      {runs.map((r) => (
        <div
          key={r.id}
          style={{
            padding: 10,
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="play" size={12} color={STATUS_COLOR[r.status] ?? 'var(--fg-3)'} />
            <span
              style={{
                font: '500 11.5px/1 var(--mono)',
                color: STATUS_COLOR[r.status] ?? 'var(--fg-2)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {r.status}
            </span>
            <span style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
              {shortTime(r.ts)}
            </span>
          </div>
          <div
            style={{
              font: '500 12.5px/1.3 var(--mono)',
              color: 'var(--hv-fg)',
              wordBreak: 'break-all',
            }}
          >
            {r.command}
          </div>
          {r.outputTail && (
            <pre
              style={{
                margin: 0,
                padding: 8,
                background: '#0b0b0f',
                color: '#d4d4d8',
                borderRadius: 'var(--radius-sm)',
                font: '400 11px/1.5 var(--mono)',
                maxHeight: 120,
                overflow: 'auto',
              }}
            >
              {r.outputTail}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

function shortTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString()
  } catch {
    return iso
  }
}
