import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export interface TopNavProps {
  current: 'kanban' | 'live'
}

export default function TopNav({ current }: TopNavProps) {
  const { user, signOut } = useAuth()
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-semibold hover:text-accent">
          team-presence
        </Link>
        <nav className="text-sm text-muted flex gap-4">
          <Link
            to="/"
            className={current === 'kanban' ? 'text-fg' : 'hover:text-fg'}
          >
            Kanban
          </Link>
          <Link
            to="/live"
            className={current === 'live' ? 'text-fg' : 'hover:text-fg'}
          >
            Live
          </Link>
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
