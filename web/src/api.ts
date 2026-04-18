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

async function request<T>(method: string, path: string, body?: Json): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  })

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
