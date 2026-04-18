import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, bootstrap } from '../api'
import { useAuth } from '../auth'
import { Button } from '../design/Button'
import { AuthShell, Field } from './Login'

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
      <h1 style={{ font: '600 22px/1.2 var(--font)', marginBottom: 2 }}>
        Create the first account
      </h1>
      <p
        style={{
          font: '400 12.5px/1.5 var(--font)',
          color: 'var(--fg-3)',
          marginBottom: 18,
        }}
      >
        This endpoint only works once — the first user becomes an admin; all members are
        admins after that.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Display name">
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
          />
        </Field>
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
        <Field label="Password (min 8)">
          <input
            type="password"
            autoComplete="new-password"
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
          {busy ? 'Creating…' : 'Bootstrap team'}
        </Button>
      </form>
      <p
        style={{
          marginTop: 18,
          font: '400 13px/1.4 var(--font)',
          color: 'var(--fg-3)',
        }}
      >
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--hv-accent)' }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
