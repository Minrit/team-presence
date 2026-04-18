import { useSessionTools } from '../../hooks/useSessionTools'
import { Icon } from '../../design/Icon'
import { EmptyPanel } from './EmptyPanel'

export function ChangesPanel({ sessionId }: { sessionId: string | null }) {
  const { changes } = useSessionTools(sessionId)
  if (!sessionId) {
    return (
      <EmptyPanel
        title="No active session"
        hint="Once an agent starts editing files on this story, the touched paths will show up here."
        icon="branch"
      />
    )
  }
  if (changes.length === 0) {
    return (
      <EmptyPanel
        title="No edits yet"
        hint="Changes populate from edit_file / write_file tool calls."
        icon="branch"
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
        gap: 6,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div style={{ font: '600 13px/1 var(--font)', marginBottom: 6 }}>
        Changes · {changes.length}
      </div>
      {changes.map((c) => (
        <div
          key={c.path}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 6px',
            borderBottom: '1px solid var(--hv-border)',
            font: '400 12.5px/1.3 var(--mono)',
          }}
        >
          <Icon name="git" size={12} color="var(--fg-3)" />
          <span style={{ flex: 1, color: 'var(--hv-fg)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.path}
          </span>
          <span style={{ color: '#10b981' }}>+{c.add}</span>
          <span style={{ color: '#ef4444' }}>−{c.del}</span>
          <span style={{ color: 'var(--fg-4)', font: '400 10.5px/1 var(--font)' }}>est.</span>
        </div>
      ))}
    </div>
  )
}
