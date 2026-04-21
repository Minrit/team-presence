import { useEffect, useState, type ReactNode } from 'react'
import { CreateStoryDialogProvider } from '../components/CreateStoryDialog'
import { CommandPalette } from './CommandPalette'
import { Masthead } from './Masthead'
import { NavBar } from './NavBar'
import { StatusBar } from './StatusBar'

/** v2 shell — masthead on top, horizontal nav under it, main, status-bar
 *  footer. No sidebar. */
export function AppShell({ children }: { children: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <CreateStoryDialogProvider>
      <div
        className="paper-tex"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--cream)',
        }}
      >
        <Masthead />
        <NavBar onOpenCmd={() => setCmdOpen(true)} />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          {children}
        </main>
        <StatusBar />
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      </div>
    </CreateStoryDialogProvider>
  )
}
