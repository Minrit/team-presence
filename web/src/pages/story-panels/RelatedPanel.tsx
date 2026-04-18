import { Icon } from '../../design/Icon'
import type { Story } from '../../types'

export function RelatedPanel({ story }: { story: Story }) {
  const rows: Array<{ icon: string; label: string; value: string }> = []
  if (story.branch) rows.push({ icon: 'branch', label: 'Branch', value: story.branch })
  if (story.pr_ref) rows.push({ icon: 'pr', label: 'PR', value: story.pr_ref })
  if (story.repo) rows.push({ icon: 'git', label: 'Repo', value: story.repo })
  rows.push({ icon: 'git', label: 'Base', value: 'main' })

  return (
    <div
      style={{
        padding: 18,
        background: 'var(--surface)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 0',
            borderBottom: '1px solid var(--hv-border)',
          }}
        >
          <Icon name={r.icon} size={14} color="var(--fg-3)" />
          <div style={{ font: '500 12.5px/1 var(--font)', color: 'var(--fg-2)' }}>
            {r.label}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              font: '400 12.5px/1 var(--mono)',
              color: 'var(--fg-2)',
            }}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  )
}
