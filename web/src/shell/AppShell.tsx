import { useEffect, useState, type ReactNode } from 'react'
import { CreateStoryDialogProvider } from '../components/CreateStoryDialog'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopMeta } from './TopMeta'

export function AppShell({ children }: { children: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false)

  // ⌘K / Ctrl-K — open/close palette. Also Esc closes.
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
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
          background: 'var(--hv-bg)',
        }}
      >
        <Sidebar onOpenCmd={() => setCmdOpen(true)} />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <TopMeta />
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
        </main>
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      </div>
    </CreateStoryDialogProvider>
  )
}
