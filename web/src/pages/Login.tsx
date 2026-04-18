import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../api'
import { Button } from '../design/Button'

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
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'linear-gradient(135deg,var(--hv-accent),#8b5cf6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="#fff">
            <path d="M7 1 2 4v6l5 3 5-3V4L7 1Zm0 2 3 1.8v3.4L7 10 4 8.2V4.8L7 3Z" />
          </svg>
        </div>
        <div style={{ font: '600 14px/1 var(--font)' }}>team-presence</div>
      </div>
      <h1 style={{ font: '600 22px/1.2 var(--font)', marginBottom: 2 }}>Sign in</h1>
      <p style={{ font: '400 13px/1.4 var(--font)', color: 'var(--fg-3)', marginBottom: 18 }}>
        Hive workspace
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
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
            className="input"
          />
        </Field>
        {err && (
          <p style={{ font: '400 12.5px/1.4 var(--font)', color: 'var(--danger)' }}>{err}</p>
        )}
        <Button type="submit" disabled={busy} size="lg" style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p
        style={{
          marginTop: 18,
          font: '400 13px/1.4 var(--font)',
          color: 'var(--fg-3)',
        }}
      >
        First person on the team?{' '}
        <Link to="/register" style={{ color: 'var(--hv-accent)' }}>
          Bootstrap
        </Link>
      </p>
    </AuthShell>
  )
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--hv-bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          font: '500 11.5px/1 var(--font)',
          color: 'var(--fg-3)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
