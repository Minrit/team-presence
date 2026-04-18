import { NavLink } from 'react-router-dom'
import { Icon } from '../design/Icon'
import { Avatar, userToAvatar } from '../design/Avatar'
import { Kbd } from '../design/Kbd'
import { LiveDot } from '../design/LiveDot'
import { useAuth } from '../auth'
import { useStories } from '../stories'
import { NAV_ITEMS } from './nav'

export function Sidebar({ onOpenCmd }: { onOpenCmd: () => void }) {
  const { user } = useAuth()
  const { data: stories } = useStories()
  const unclaimed = (stories ?? []).filter(
    (s) => s.status === 'todo' && !s.owner_id,
  ).length

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--hv-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 0',
      }}
    >
      {/* Brand — read-only badge. AI-native posture: no workspace switcher. */}
      <div
        style={{
          padding: '6px 18px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'linear-gradient(135deg,var(--hv-accent),#8b5cf6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="#fff">
            <path d="M7 1 2 4v6l5 3 5-3V4L7 1Zm0 2 3 1.8v3.4L7 10 4 8.2V4.8L7 3Z" />
          </svg>
        </div>
        <div style={{ font: '600 13px/1.2 var(--font)' }}>team-presence</div>
      </div>

      {/* Search / ⌘K */}
      <div style={{ padding: '0 14px 10px' }}>
        <button
          type="button"
          onClick={onOpenCmd}
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'var(--bg-2)',
            border: '1px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--fg-3)',
            font: '400 12.5px/1 var(--font)',
          }}
        >
          <Icon name="search" size={13} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search or jump…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: '4px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflow: 'auto',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              padding: '7px 10px',
              background: isActive ? 'var(--bg-2)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: isActive ? 'var(--hv-fg)' : 'var(--fg-2)',
              font: `${isActive ? '500' : '400'} 13px/1 var(--font)`,
              textAlign: 'left',
              textDecoration: 'none',
              transition: 'background 100ms',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.icon}
                  size={15}
                  color={isActive ? 'var(--hv-accent)' : 'var(--fg-3)'}
                />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.live && <LiveDot size={6} />}
                {item.badgeKey === 'unclaimed' && unclaimed > 0 && (
                  <span
                    style={{
                      padding: '1px 6px',
                      background: 'var(--bg-2)',
                      borderRadius: 10,
                      font: '500 10.5px/1.5 var(--mono)',
                      color: 'var(--fg-3)',
                    }}
                  >
                    {unclaimed}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--hv-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Avatar user={userToAvatar(user, 'active')} size={28} dot />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '500 12.5px/1.2 var(--font)' }}>
              {user.display_name}
            </div>
            <div
              style={{
                font: '400 11px/1 var(--font)',
                color: 'var(--fg-3)',
                marginTop: 2,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <LiveDot size={5} />
              Online
            </div>
          </div>
          <button
            type="button"
            style={{
              width: 26,
              height: 26,
              borderRadius: 5,
              border: 'none',
              background: 'transparent',
              color: 'var(--fg-3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Settings"
          >
            <Icon name="settings" size={14} />
          </button>
        </div>
      )}
    </aside>
  )
}
