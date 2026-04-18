import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../design/Icon'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TopMeta } from './TopMeta'
import { TweaksPanel } from './TweaksPanel'
import { useTweaks } from './useTweaks'

export function AppShell({ children }: { children: ReactNode }) {
  const [tweaks, updateTweaks] = useTweaks()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [tweaksOpen, setTweaksOpen] = useState(false)

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

  const nav = tweaks.nav
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: nav === 'topbar' ? 'column' : 'row',
        height: '100%',
        background: 'var(--hv-bg)',
      }}
    >
      {nav === 'sidebar' ? (
        <Sidebar onOpenCmd={() => setCmdOpen(true)} />
      ) : (
        <Topbar onOpenCmd={() => setCmdOpen(true)} />
      )}
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

      {/* Tweaks FAB */}
      <button
        type="button"
        onClick={() => setTweaksOpen((v) => !v)}
        title="Tweaks"
        style={{
          position: 'fixed',
          bottom: 18,
          right: 18,
          width: 38,
          height: 38,
          borderRadius: 999,
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-2)',
          zIndex: 40,
        }}
      >
        <Icon name="settings" size={16} />
      </button>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      {tweaksOpen && (
        <TweaksPanel
          tweaks={tweaks}
          update={updateTweaks}
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </div>
  )
}
