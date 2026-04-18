import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, bootstrap } from '../api'
import { useAuth } from '../auth'
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
      <h1 className="text-2xl font-semibold mb-1">Create the first account</h1>
      <p className="text-sm text-muted mb-6">
        This endpoint only works once — the first user becomes an admin; all members
        are admins after that.
      </p>
      <form onSubmit={submit} className="space-y-4">
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
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Creating…' : 'Bootstrap team'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
