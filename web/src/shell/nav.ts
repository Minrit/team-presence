export interface NavItem {
  id: string
  label: string
  code: string
  path: string
  icon: string
  live?: boolean
  badgeKey?: 'unclaimed'
}

/** v2 horizontal top-nav with 01–10 serial codes. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'story',    label: 'Current',   code: '01', path: '/',         icon: 'sparkle' },
  { id: 'board',    label: 'Board',     code: '02', path: '/board',    icon: 'columns' },
  { id: 'backlog',  label: 'Backlog',   code: '03', path: '/backlog',  icon: 'inbox', badgeKey: 'unclaimed' },
  { id: 'stream',   label: 'Stream',    code: '04', path: '/stream',   icon: 'terminal', live: true },
  { id: 'members',  label: 'Members',   code: '05', path: '/members',  icon: 'users' },
  { id: 'sprints',  label: 'Sprints',   code: '06', path: '/sprints',  icon: 'clock' },
  { id: 'compute',  label: 'Nodes',     code: '07', path: '/compute',  icon: 'cpu' },
  { id: 'overview', label: 'Overview',  code: '08', path: '/overview', icon: 'chart' },
  { id: 'agent-setup', label: 'Agent',  code: '09', path: '/agent-setup', icon: 'zap' },
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
  if (pathname.startsWith('/connect') || pathname.startsWith('/agent-setup')) return 'Agent'
  if (pathname.startsWith('/stories')) return 'Stories'
  if (pathname.startsWith('/sprints')) return 'Sprints'
  if (pathname.startsWith('/room/')) return 'Session'
  return ''
}
