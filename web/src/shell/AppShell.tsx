import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TopMeta } from './TopMeta'
import { useTweaks } from './useTweaks'

export function AppShell({ children }: { children: ReactNode }) {
  const [tweaks] = useTweaks()
  const [cmdOpen, setCmdOpen] = useState(false)
  // ⌘K handler will be wired in Unit 23; shell just exposes the toggle now.

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
      {/* Command palette + Tweaks panel land in Unit 23. */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 120,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--hv-border)',
              padding: '20px 18px',
              color: 'var(--fg-2)',
              font: '400 13px/1.5 var(--font)',
            }}
          >
            <div style={{ font: '600 14px/1 var(--font)', color: 'var(--hv-fg)', marginBottom: 8 }}>
              Command palette
            </div>
            Full ⌘K jump + fuzzy-search lands in Unit 23.
          </div>
        </div>
      )}
    </div>
  )
}
