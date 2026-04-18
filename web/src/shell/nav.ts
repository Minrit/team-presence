export interface NavItem {
  id: string
  label: string
  path: string
  icon: string
  live?: boolean
  badgeKey?: 'unclaimed'
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'story',    label: 'Current story', path: '/',         icon: 'sparkle' },
  { id: 'board',    label: 'Board',         path: '/board',    icon: 'columns' },
  { id: 'backlog',  label: 'Backlog',       path: '/backlog',  icon: 'inbox', badgeKey: 'unclaimed' },
  { id: 'stream',   label: 'Team stream',   path: '/stream',   icon: 'terminal', live: true },
  { id: 'members',  label: 'Members',       path: '/members',  icon: 'users' },
  { id: 'compute',  label: 'Compute',       path: '/compute',  icon: 'cpu' },
  { id: 'overview', label: 'Overview',      path: '/overview', icon: 'chart' },
  { id: 'connect',  label: 'Connect',       path: '/connect',  icon: 'plug' },
]

/** Screen breadcrumb label for a given URL pathname. */
export function activeNavLabel(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/story/')) return 'Current story'
  if (pathname.startsWith('/board')) return 'Board'
  if (pathname.startsWith('/backlog')) return 'Backlog'
  if (pathname.startsWith('/stream')) return 'Team stream'
  if (pathname.startsWith('/members')) return 'Members'
  if (pathname.startsWith('/compute')) return 'Compute'
  if (pathname.startsWith('/overview')) return 'Overview'
  if (pathname.startsWith('/connect')) return 'Connect'
  if (pathname.startsWith('/stories')) return 'Stories'
  if (pathname.startsWith('/sprints')) return 'Sprints'
  if (pathname.startsWith('/room/')) return 'Session'
  return ''
}
