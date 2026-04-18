import { Card } from '../design/Card'
import { Icon } from '../design/Icon'
import { InstallCommandCard } from '../design/InstallCommandCard'
import { Kbd } from '../design/Kbd'

/** Read-only onboarding guide. All four setup steps now flow through the
 *  /tp-connect-machine skill in Claude Code; this page only explains how. */
export default function Connect() {
  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 820,
      }}
    >
      <InstallCommandCard
        title="First step: install tp-mcp"
        hint="Run this on any macOS or Linux laptop to pull the pre-built tp-mcp binary from this server (sha256 checked, dropped at ~/.local/bin). After it finishes, open Claude Code and run /tp-connect-machine to log in + wire hooks + start the collector."
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <Icon name="plug" size={16} color="var(--hv-accent)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <div style={{ font: '600 13px/1.2 var(--font)' }}>Connect your machine</div>
          <div style={{ font: '400 12px/1.4 var(--font)', color: 'var(--fg-3)' }}>
            team-presence is driven by Claude Code + MCP. Open Claude Code in this repo,
            then run <Kbd>⌘K</Kbd> → <span className="mono">/tp-connect-machine</span>.
            The skill walks you through the four steps below.
          </div>
        </div>
      </div>

      <Step
        num={1}
        title="Choose agent"
        body="The collector tails Claude Code transcripts today. Cursor / Codex / Aider / Local are reserved wire-level stubs for later collectors; picking them logs presence only, no content."
      />

      <Step
        num={2}
        title="Install bridge"
        body="Log in once and install Claude Code hooks so transcripts start flowing."
        code={`# inside this repo\ncargo run --bin team-presence -- login \\\n    --server http://localhost:8080 \\\n    --email you@team.local\ncargo run --bin team-presence -- install-hooks\ncargo run --bin team-presence -- start`}
      />

      <Step
        num={3}
        title="Configure shares"
        body="The four share toggles (view sessions / scheduled jobs / remote terminal / GPU) live in your local config. Server-side persistence is Phase B. Use /tp-connect-machine → “configure shares” to flip them."
      />

      <Step
        num={4}
        title="Ready"
        body="Anything you do in Claude Code shows up in Stream and on the owning story. Drive PM (create / edit / move status / groom AC) via the /tp-* skills — no clicks on this page."
      />

      <Card
        style={{
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ font: '600 12.5px/1.2 var(--font)' }}>Troubleshooting</div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            font: '400 12.5px/1.5 var(--font)',
            color: 'var(--fg-2)',
          }}
        >
          <li>
            <strong>No live sessions in Stream?</strong> Make sure the collector is running
            (<span className="mono">team-presence start</span>) and Claude Code has the
            hooks installed (<span className="mono">install-hooks</span>).
          </li>
          <li>
            <strong>MCP not visible in Claude Code?</strong> Rebuild the server
            (<span className="mono">cargo build -p team-presence-lp-mcp</span>) and restart
            Claude Code so it re-reads <span className="mono">.mcp.json</span>.
          </li>
          <li>
            <strong>Every MCP tool errors “not logged in”?</strong> Run
            <span className="mono"> team-presence login</span> once. Credentials land in
            the macOS keyring (with a file fallback at
            <span className="mono"> ~/.config/team-presence/credentials.json</span>).
          </li>
        </ul>
      </Card>
    </div>
  )
}

function Step({
  num,
  title,
  body,
  code,
}: {
  num: number
  title: string
  body: string
  code?: string
}) {
  return (
    <Card
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--hv-accent)',
            color: '#fff',
            font: '600 12px/22px var(--font)',
            textAlign: 'center',
          }}
        >
          {num}
        </span>
        <div style={{ font: '600 14px/1.2 var(--font)' }}>{title}</div>
      </div>
      <div style={{ font: '400 12.5px/1.55 var(--font)', color: 'var(--fg-2)' }}>{body}</div>
      {code && (
        <pre
          style={{
            background: '#0b0b0f',
            color: '#d4d4d8',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            font: '400 12px/1.6 var(--mono)',
            overflow: 'auto',
            margin: 0,
          }}
        >
          {code}
        </pre>
      )}
    </Card>
  )
}
