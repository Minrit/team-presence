import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button } from '../design/Button'
import { Icon } from '../design/Icon'
import { AGENTS } from '../design/meta'
import type { AgentKind } from '../types'

const STEPS = ['Choose agent', 'Install bridge', 'Configure shares', 'Ready'] as const

export default function Connect() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const stepNum = Math.max(1, Math.min(4, Number(params.get('step') ?? '1')))
  const agent = (params.get('agent') as AgentKind) || 'claude_code'
  const shares = useMemo(() => loadShares(), [])

  const goStep = (n: number) => {
    const p = new URLSearchParams(params)
    p.set('step', String(n))
    setParams(p, { replace: false })
  }

  const pickAgent = (id: AgentKind) => {
    const p = new URLSearchParams(params)
    p.set('agent', id)
    p.set('step', '2')
    setParams(p)
  }

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 10 }}>
        {STEPS.map((label, i) => {
          const n = i + 1
          const active = n === stepNum
          const done = n < stepNum
          return (
            <div
              key={label}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: active ? 'var(--surface)' : 'var(--bg-2)',
                border: `1px solid ${active ? 'var(--hv-accent)' : 'var(--hv-border)'}`,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                font: '500 12.5px/1 var(--font)',
                color: active ? 'var(--hv-fg)' : done ? 'var(--fg-2)' : 'var(--fg-3)',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: done ? 'var(--success)' : active ? 'var(--hv-accent)' : 'var(--fg-4)',
                  color: '#fff',
                  font: '600 11px/20px var(--font)',
                  textAlign: 'center',
                }}
              >
                {n}
              </span>
              {label}
            </div>
          )
        })}
      </div>

      {/* Content */}
      {stepNum === 1 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ font: '600 15px/1.2 var(--font)' }}>Which agent runtime?</div>
          <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-3)' }}>
            Only Claude Code has a production capture path today. Other options are reserved for
            future collectors — picking them lets the platform record your presence but content
            won't stream.
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            {(Object.keys(AGENTS) as AgentKind[]).map((id) => {
              const meta = AGENTS[id]
              const live = id === 'claude_code'
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => pickAgent(id)}
                  style={{
                    padding: 14,
                    background: 'var(--surface)',
                    border: `1px solid ${agent === id ? 'var(--hv-accent)' : 'var(--hv-border)'}`,
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: meta.color }} />
                  <span style={{ font: '600 13.5px/1.2 var(--font)' }}>{meta.label}</span>
                  <span
                    style={{
                      font: '400 11px/1 var(--font)',
                      color: live ? 'var(--success)' : 'var(--fg-4)',
                    }}
                  >
                    {live ? 'Available now' : 'Coming soon'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {stepNum === 2 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ font: '600 15px/1.2 var(--font)' }}>Install the bridge</div>
          <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-3)' }}>
            The collector runs on your laptop. It listens for {AGENTS[agent].label} hook events,
            tails transcripts, and streams frames to this workspace over WebSocket.
          </div>
          <pre
            style={{
              background: '#0b0b0f',
              color: '#d4d4d8',
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              font: '400 12px/1.5 var(--mono)',
              overflow: 'auto',
            }}
          >
            {`# From the repo root
cargo run --bin team-presence -- login --server ${window.location.origin} --email ${
              user?.email ?? 'you@team.local'
            }
cargo run --bin team-presence -- start --agent ${agent}`}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => goStep(1)}>
              Back
            </Button>
            <div style={{ flex: 1 }} />
            <Button size="sm" onClick={() => goStep(3)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {stepNum === 3 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ font: '600 15px/1.2 var(--font)' }}>Share preferences</div>
          <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-3)' }}>
            These toggles configure what your teammates can see. Stored in your browser for now —
            server-side persistence ships in Phase B.
          </div>
          {[
            { id: 'view_sessions', label: 'Let teammates watch my live sessions', default: true },
            { id: 'scheduled_jobs', label: 'Allow scheduled agent jobs on my machine', default: false },
            { id: 'remote_terminal', label: 'Allow remote terminal control', default: false },
            { id: 'share_gpu', label: 'Share GPU / accelerator', default: false },
          ].map((row) => (
            <label
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: '1px solid var(--hv-border)',
              }}
            >
              <input
                type="checkbox"
                defaultChecked={shares[row.id] ?? row.default}
                onChange={(e) => saveShare(row.id, e.currentTarget.checked)}
              />
              <span style={{ font: '400 13px/1.4 var(--font)' }}>{row.label}</span>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => goStep(2)}>
              Back
            </Button>
            <div style={{ flex: 1 }} />
            <Button size="sm" onClick={() => goStep(4)}>
              Finish
            </Button>
          </div>
        </div>
      )}

      {stepNum === 4 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            textAlign: 'center',
          }}
        >
          <Icon name="check" size={40} color="var(--success)" />
          <div style={{ font: '600 18px/1.2 var(--font)' }}>You're connected</div>
          <div style={{ font: '400 13px/1.5 var(--font)', color: 'var(--fg-3)' }}>
            Anything you work on in {AGENTS[agent].label} will show up here for the team within a
            few seconds.
          </div>
          <Button onClick={() => navigate('/')}>Go to Board</Button>
        </div>
      )}
    </div>
  )
}

const SHARES_KEY = 'tp.connect.shares.v1'

function loadShares(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SHARES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveShare(key: string, v: boolean) {
  try {
    const cur = loadShares()
    cur[key] = v
    localStorage.setItem(SHARES_KEY, JSON.stringify(cur))
  } catch {
    /* noop */
  }
}
