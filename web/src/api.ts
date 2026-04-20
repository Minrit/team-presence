// Minimal fetch wrapper: attaches the stored bearer token, JSON content-type,
// and parses error bodies into a typed ApiError. No Orval for MVP; the API
// surface is small enough to hand-type in ./types.ts.

import type { User } from './types'

const TOKEN_KEY = 'tp.access_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Json = unknown

async function rawFetch(method: string, path: string, body?: Json): Promise<Response> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  })
}

// Silent token refresh — swaps the access_token using the refresh cookie.
// Returns true if a new access_token was minted, false otherwise.
// Concurrent 401s share a single in-flight refresh so we don't flood the
// server with /auth/refresh calls when a page of SWR hooks all 401 at once.
let refreshInFlight: Promise<boolean> | null = null

export async function attemptSilentRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return false
      const data = (await res.json()) as { access_token?: string }
      if (!data.access_token) return false
      setToken(data.access_token)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function request<T>(method: string, path: string, body?: Json): Promise<T> {
  let res = await rawFetch(method, path, body)

  // On 401, try one silent refresh via the HttpOnly refresh cookie and
  // replay the original request once. Skip the retry dance on the auth
  // endpoints themselves to avoid infinite loops.
  const isAuthEndpoint = path.startsWith('/api/v1/auth/')
  if (res.status === 401 && !isAuthEndpoint) {
    const refreshed = await attemptSilentRefresh()
    if (refreshed) {
      res = await rawFetch(method, path, body)
    }
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  const text = await res.text()
  const parsed = text ? safeJson(text) : undefined

  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : text) || res.statusText
    const code =
      parsed && typeof parsed === 'object' && 'code' in parsed
        ? String((parsed as { code: unknown }).code)
        : undefined
    throw new ApiError(msg, res.status, code)
  }
  return parsed as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: Json) => request<T>('POST', path, body),
  patch: <T,>(path: string, body?: Json) => request<T>('PATCH', path, body),
  delete: <T,>(path: string) => request<T>('DELETE', path),
}

// Typed endpoints -----------------------------------------------------------

export async function login(email: string, password: string): Promise<User> {
  const res = await api.post<{ access_token: string; user: User }>(
    '/api/v1/auth/login',
    { email, password },
  )
  setToken(res.access_token)
  return res.user
}

export async function bootstrap(
  email: string,
  password: string,
  display_name: string,
): Promise<User> {
  const res = await api.post<{ access_token: string; user: User }>(
    '/api/v1/auth/bootstrap',
    { email, password, display_name },
  )
  setToken(res.access_token)
  return res.user
}

export async function logout(): Promise<void> {
  try {
    await api.post<void>('/api/v1/auth/logout')
  } finally {
    setToken(null)
  }
}

export async function me(): Promise<User> {
  return api.get<User>('/api/v1/auth/me')
}
