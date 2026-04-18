import { Icon } from '../../design/Icon'

export function EmptyPanel({
  title,
  hint,
  icon = 'box',
}: {
  title: string
  hint?: string
  icon?: string
}) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 24,
        color: 'var(--fg-3)',
        background: 'var(--surface)',
        border: '1px dashed var(--hv-border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <Icon name={icon} size={28} color="var(--fg-4)" />
      <div style={{ font: '600 14px/1.2 var(--font)', color: 'var(--fg-2)' }}>
        {title}
      </div>
      {hint && (
        <div style={{ font: '400 12.5px/1.4 var(--font)', textAlign: 'center' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
