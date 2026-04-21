import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, bootstrap } from '../api'
import { useAuth } from '../auth'
import { Button } from '../design/Button'
import { ZiraLogo } from '../design/ZiraLogo'
import { AuthShell, Field } from './Login'

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

export default function Register() {
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <AuthShell>Loading…</AuthShell>
  if (user) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await bootstrap(email, password, displayName)
      await refresh()
      navigate('/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'bootstrap_done') {
        setErr(
          'A user already exists. Ask an existing member to invite you, or sign in on the previous page.',
        )
      } else {
        setErr(e instanceof ApiError ? e.message : String(e))
      }
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
            SER. 001 · Bootstrap
          </span>
        </div>
      </div>

      <div className="tick-strip" style={{ height: 10 }} />

      <div style={{ padding: '22px 22px' }}>
        <h1
          className="display"
          style={{
            font: '800 18px/1.2 var(--font-display)',
            margin: '0 0 6px',
            letterSpacing: '0.02em',
            color: 'var(--ink)',
            textTransform: 'uppercase',
          }}
        >
          Create the first account
        </h1>
        <p
          className="mono"
          style={{
            font: '500 11px/1.5 var(--mono)',
            color: 'var(--muted)',
            marginBottom: 18,
            letterSpacing: '0.03em',
          }}
        >
          Works once. The first user becomes admin; all members are admins after that.
        </p>

        <form
          onSubmit={submit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Display name">
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mono"
              style={inputStyle}
            />
          </Field>
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
          <Field label="Password (min 8)">
            <input
              type="password"
              autoComplete="new-password"
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
            {busy ? 'Creating…' : 'Bootstrap team'}
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
            Already registered?
          </span>
          <Link
            to="/login"
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
            Sign in ▸
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
