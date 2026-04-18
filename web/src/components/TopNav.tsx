import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export interface TopNavProps {
  current: 'kanban' | 'live' | 'stories' | 'sprints'
}

const TABS: { key: TopNavProps['current']; to: string; label: string }[] = [
  { key: 'kanban', to: '/', label: 'Kanban' },
  { key: 'stories', to: '/stories', label: 'Stories' },
  { key: 'sprints', to: '/sprints', label: 'Sprints' },
  { key: 'live', to: '/live', label: 'Live' },
]

export default function TopNav({ current }: TopNavProps) {
  const { user, signOut } = useAuth()
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-semibold hover:text-accent">
          team-presence
        </Link>
        <nav className="text-sm text-muted flex gap-4">
          {TABS.map((t) => (
            <Link
              key={t.key}
              to={t.to}
              className={current === t.key ? 'text-fg' : 'hover:text-fg'}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="text-sm text-muted flex items-center gap-3">
        <span>{user?.display_name ?? user?.email}</span>
        <button
          type="button"
          onClick={signOut}
          className="hover:text-fg"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
