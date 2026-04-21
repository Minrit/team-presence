import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from '../design/Icon'
import { Kbd } from '../design/Kbd'
import { LiveDot } from '../design/LiveDot'
import { useStories } from '../stories'
import { NAV_ITEMS } from './nav'

/** v2 horizontal nav — one row of numbered section buttons + search on the
 *  right. Active section gets a red fill with cream fg and a red-ink
 *  underline. */
export function NavBar({ onOpenCmd }: { onOpenCmd: () => void }) {
  const { pathname } = useLocation()
  const { data: stories } = useStories()
  const unclaimed = (stories ?? []).filter((s) => s.status === 'todo' && !s.owner_id).length

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--cream)',
        borderBottom: '1.5px solid var(--steel)',
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active =
          item.path === '/'
            ? pathname === '/' || pathname.startsWith('/story/')
            : pathname.startsWith(item.path)
        return (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            title={item.label}
            style={{
              padding: '0 16px',
              height: 40,
              background: active ? 'var(--red)' : 'transparent',
              color: active ? 'var(--cream)' : 'var(--ink)',
              border: 'none',
              borderRight: '1px solid var(--rule)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              position: 'relative',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <span
              className="mono"
              style={{
                font: '600 9.5px/1 var(--mono)',
                color: active ? 'rgba(246,244,238,0.6)' : 'var(--muted)',
                letterSpacing: '0.05em',
              }}
            >
              {item.code}
            </span>
            <Icon name={item.icon} size={13} />
            <span
              className="label"
              style={{
                font: '700 11px/1 var(--font-label)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {item.label}
            </span>
            {item.live && <LiveDot size={6} color={active ? 'var(--cream)' : 'var(--red)'} />}
            {item.badgeKey === 'unclaimed' && unclaimed > 0 && (
              <span
                className="mono"
                style={{
                  padding: '1px 5px',
                  background: active ? 'var(--red-ink)' : 'var(--red)',
                  color: 'var(--cream)',
                  borderRadius: 0,
                  font: '700 9.5px/1.4 var(--mono)',
                  letterSpacing: '0.05em',
                }}
              >
                {unclaimed}
              </span>
            )}
            {active && (
              <span
                style={{
                  position: 'absolute',
                  bottom: -2,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--red-ink)',
                }}
              />
            )}
          </NavLink>
        )
      })}
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onOpenCmd}
        className="label"
        style={{
          padding: '0 16px',
          height: 40,
          background: 'var(--steel)',
          color: 'var(--cream)',
          border: 'none',
          borderLeft: '1.5px solid var(--steel)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          flexShrink: 0,
          font: '700 10.5px/1 var(--font-label)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <Icon name="search" size={13} />
        Search
        <Kbd>⌘K</Kbd>
      </button>
    </nav>
  )
}
