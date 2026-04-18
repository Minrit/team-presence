import { useEffect, useState } from 'react'
import { Button } from '../design/Button'
import { Card } from '../design/Card'
import { Icon } from '../design/Icon'
import { MarkdownView } from '../design/MarkdownView'

/** Renders /public/agent-setup.md inside the shell, with a download
 *  button. The canonical fetch target for AIs is /agent-setup.md
 *  (served raw, no JS); this page is the human-friendly rendering. */
export default function AgentSetup() {
  const [source, setSource] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/agent-setup.md')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then(setSource)
      .catch((e) => setErr(String(e)))
  }, [])

  const download = () => {
    if (!source) return
    const blob = new Blob([source], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'team-presence-agent-setup.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 900,
      }}
    >
      <Card
        style={{
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name="plug" size={16} color="var(--hv-accent)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ font: '600 13px/1.2 var(--font)' }}>For AI agents</div>
          <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-3)' }}>
            This page is the canonical self-configuration guide. Any AI can
            <span className="mono"> fetch /agent-setup.md </span> (plain
            markdown, no JS), follow the steps, and end up wired into the
            team-presence MCP + skill stack. Share the URL or download the
            file and paste it into another agent&rsquo;s system.
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Icon name="external" size={12} color="#fff" />}
          disabled={!source}
          onClick={download}
        >
          Download .md
        </Button>
      </Card>

      {err && (
        <Card style={{ padding: 16, color: 'var(--danger)' }}>
          Failed to load /agent-setup.md: {err}
        </Card>
      )}

      {!err && !source && (
        <Card style={{ padding: 24, color: 'var(--fg-3)' }}>Loading…</Card>
      )}

      {source && (
        <Card style={{ padding: 20 }}>
          <MarkdownView source={source} />
        </Card>
      )}
    </div>
  )
}
