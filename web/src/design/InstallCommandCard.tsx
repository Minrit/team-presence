import { useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Icon } from './Icon'

/**
 * Top-of-page install-command card (plan 010 Unit 5).
 *
 * Shows `curl <origin>/install.sh | sh` and a Copy button so a teammate
 * opening /connect or /agent-setup in a browser can paste straight into
 * a terminal. The server URL is read from `window.location.origin`
 * at render time, so dev (localhost:5173 → proxied to :8080),
 * staging, and prod all produce the right command without config.
 */
export function InstallCommandCard({
  title = 'Install tp-mcp on this laptop',
  hint = 'Runs the official installer served by this team-presence server. Verifies sha256, drops tp-mcp at ~/.local/bin. macOS + Linux, arm64 + x86_64.',
}: {
  title?: string
  hint?: string
}) {
  const origin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : 'http://localhost:8080'
  const command = `curl -fsSL ${origin}/install.sh | sh`
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Non-fatal — user can still select-and-copy the visible text.
      setCopied(false)
    }
  }

  return (
    <Card
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="terminal" size={16} color="var(--hv-accent)" />
        <div style={{ font: '600 13px/1.2 var(--font)' }}>{title}</div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 10,
        }}
      >
        <pre
          style={{
            flex: 1,
            background: '#0b0b0f',
            color: '#d4d4d8',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            font: '500 12.5px/1.4 var(--mono)',
            overflow: 'auto',
            margin: 0,
            userSelect: 'all',
          }}
        >
          {command}
        </pre>
        <Button variant="secondary" size="sm" onClick={copy} title="Copy to clipboard">
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div style={{ font: '400 12px/1.5 var(--font)', color: 'var(--fg-3)' }}>
        {hint}
      </div>
    </Card>
  )
}
