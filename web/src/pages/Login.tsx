import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../api'
import { Button } from '../design/Button'
import { ZiraLogo } from '../design/ZiraLogo'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <AuthShell>Loading…</AuthShell>
  if (user) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await signIn(email, password)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '18px 20px 14px',
          borderBottom: '1.5px solid var(--steel)',
          background: 'var(--cream-2)',
        }}
      >
        <ZiraLogo size={38} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            className="display"
            style={{
              font: '900 22px/1 var(--font-display)',
              letterSpacing: '0.02em',
              color: 'var(--ink)',
            }}
          >
            ZIRA
          </span>
          <span
            className="mono"
            style={{
              font: '500 9.5px/1 var(--mono)',
              color: 'var(--muted)',
              letterSpacing: '0.15em',
              marginTop: 3,
              textTransform: 'uppercase',
            }}
          >
            SER. 001 · Project tracker
          </span>
        </div>
      </div>

      <div className="tick-strip" style={{ height: 10 }} />

      <div style={{ padding: '22px 22px 22px' }}>
        <h1
          className="display"
          style={{
            font: '800 20px/1 var(--font-display)',
            margin: '0 0 4px',
            letterSpacing: '0.02em',
            color: 'var(--ink)',
            textTransform: 'uppercase',
          }}
        >
          Sign in · Operator
        </h1>
        <p
          className="mono"
          style={{
            font: '500 10.5px/1 var(--mono)',
            color: 'var(--muted)',
            marginBottom: 20,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Authorized personnel only
        </p>

        <form
          onSubmit={submit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mono"
              style={inputStyle}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mono"
              style={inputStyle}
            />
          </Field>
          {err && (
            <p
              className="label"
              style={{
                font: '700 10.5px/1.3 var(--font-label)',
                color: 'var(--cream)',
                background: 'var(--iron)',
                padding: '6px 10px',
                border: '1.5px solid var(--steel)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              ERR · {err}
            </p>
          )}
          <Button type="submit" disabled={busy} size="lg" style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px dashed var(--rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            className="mono"
            style={{
              font: '500 10.5px/1 var(--mono)',
              color: 'var(--muted)',
              letterSpacing: '0.05em',
            }}
          >
            First on the team?
          </span>
          <Link
            to="/register"
            className="label"
            style={{
              font: '700 10.5px/1 var(--font-label)',
              color: 'var(--red)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderBottom: '1.5px solid var(--red)',
              paddingBottom: 2,
            }}
          >
            Bootstrap ▸
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--cream)',
  border: '1.5px solid var(--steel)',
  borderRadius: 0,
  font: '500 13px/1.2 var(--mono)',
  color: 'var(--ink)',
  letterSpacing: '0.02em',
  outline: 'none',
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="paper-tex"
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--cream)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--cream)',
          border: '2px solid var(--steel)',
          boxShadow: '3px 3px 0 var(--steel)',
          position: 'relative',
        }}
      >
        {/* corner rivets */}
        <span className="rivet rivet-xs" style={{ position: 'absolute', top: 4, left: 4 }} />
        <span className="rivet rivet-xs" style={{ position: 'absolute', top: 4, right: 4 }} />
        <span className="rivet rivet-xs" style={{ position: 'absolute', bottom: 4, left: 4 }} />
        <span className="rivet rivet-xs" style={{ position: 'absolute', bottom: 4, right: 4 }} />
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span
        className="label"
        style={{
          display: 'block',
          font: '700 10px/1 var(--font-label)',
          color: 'var(--ink)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        }}
      >
        · {label}
      </span>
      {children}
    </label>
  )
}
