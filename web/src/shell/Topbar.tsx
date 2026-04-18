import { NavLink } from 'react-router-dom'
import { Icon } from '../design/Icon'
import { Kbd } from '../design/Kbd'
import { LiveDot } from '../design/LiveDot'
import { NAV_ITEMS } from './nav'

export function Topbar({ onOpenCmd }: { onOpenCmd: () => void }) {
  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--hv-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'linear-gradient(135deg,var(--hv-accent),#8b5cf6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="#fff">
            <path d="M7 1 2 4v6l5 3 5-3V4L7 1Zm0 2 3 1.8v3.4L7 10 4 8.2V4.8L7 3Z" />
          </svg>
        </div>
        <div style={{ font: '600 13.5px/1 var(--font)' }}>team-presence</div>
      </div>

      <nav style={{ display: 'flex', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              padding: '6px 10px',
              background: isActive ? 'var(--bg-2)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: isActive ? 'var(--hv-fg)' : 'var(--fg-2)',
              font: `${isActive ? '500' : '400'} 12.5px/1 var(--font)`,
              textDecoration: 'none',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.icon}
                  size={13}
                  color={isActive ? 'var(--hv-accent)' : 'var(--fg-3)'}
                />
                {item.label}
                {item.live && <LiveDot size={5} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onOpenCmd}
        style={{
          padding: '6px 10px',
          background: 'var(--bg-2)',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--fg-3)',
          font: '400 12.5px/1 var(--font)',
        }}
      >
        <Icon name="search" size={12} />
        Jump…
        <Kbd>⌘K</Kbd>
      </button>
    </header>
  )
}
