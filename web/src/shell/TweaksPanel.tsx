import { Icon } from '../design/Icon'
import { ACCENT_CHOICES, type Tweaks } from './useTweaks'

export function TweaksPanel({
  tweaks,
  update,
  onClose,
}: {
  tweaks: Tweaks
  update: (patch: Partial<Tweaks>) => void
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 14,
        right: 14,
        width: 300,
        background: 'var(--surface)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 55,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ font: '600 13px/1 var(--font)', flex: 1 }}>Tweaks</div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--fg-3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <Row label="Accent">
        <div style={{ display: 'flex', gap: 6 }}>
          {ACCENT_CHOICES.map((c) => {
            const active = tweaks.accent === c.color
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => update({ accent: c.color })}
                title={c.id}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: active ? '2px solid var(--hv-fg)' : '2px solid transparent',
                  background: c.color,
                  cursor: 'pointer',
                }}
              />
            )
          })}
        </div>
      </Row>

      <Row label="Density">
        <ToggleGroup
          value={tweaks.density}
          options={[
            { id: 'cozy', label: 'Cozy' },
            { id: 'compact', label: 'Compact' },
          ]}
          onChange={(v) => update({ density: v as Tweaks['density'] })}
        />
      </Row>

      <Row label="Nav">
        <ToggleGroup
          value={tweaks.nav}
          options={[
            { id: 'sidebar', label: 'Sidebar' },
            { id: 'topbar', label: 'Topbar' },
          ]}
          onChange={(v) => update({ nav: v as Tweaks['nav'] })}
        />
      </Row>

      <Row label="Visual style">
        <ToggleGroup
          value={tweaks.style}
          options={[
            { id: 'modern', label: 'Modern' },
            { id: 'terminal', label: 'Preview', disabled: true },
            { id: 'enterprise', label: 'Preview', disabled: true },
          ]}
          onChange={(v) => update({ style: v as Tweaks['style'] })}
        />
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ font: '500 11px/1 var(--font)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

interface Opt {
  id: string
  label: string
  disabled?: boolean
}

function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string
  options: Opt[]
  onChange: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 2, background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)' }}>
      {options.map((o) => {
        const active = value === o.id && !o.disabled
        return (
          <button
            key={o.id}
            type="button"
            disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.id)}
            style={{
              flex: 1,
              padding: '5px 8px',
              background: active ? 'var(--surface)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              font: `${active ? '500' : '400'} 12px/1 var(--font)`,
              color: o.disabled ? 'var(--fg-4)' : active ? 'var(--hv-fg)' : 'var(--fg-2)',
              cursor: o.disabled ? 'not-allowed' : 'pointer',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
