import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, getToken, login, logout, me, setToken } from './api'
import type { User } from './types'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const u = await me()
      setUser(u)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null)
        setUser(null)
      } else {
        console.error('auth refresh failed', err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await login(email, password)
    setUser(u)
  }, [])

  const signOut = useCallback(async () => {
    await logout()
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}
