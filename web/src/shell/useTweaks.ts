import { useEffect, useState } from 'react'

export interface Tweaks {
  accent: string
  density: 'cozy' | 'compact'
  nav: 'sidebar' | 'topbar'
  style: 'modern'
}

const DEFAULTS: Tweaks = {
  accent: '#6366f1',
  density: 'cozy',
  nav: 'sidebar',
  style: 'modern',
}

const STORAGE_KEY = 'tp.tweaks.v1'

const HOVERS: Record<string, string> = {
  '#6366f1': '#4f46e5',
  '#8b5cf6': '#7c3aed',
  '#f43f5e': '#e11d48',
  '#10b981': '#059669',
  '#f59e0b': '#d97706',
}

export function applyTweaks(t: Tweaks) {
  const r = document.documentElement
  r.style.setProperty('--hv-accent', t.accent)
  r.style.setProperty('--accent-hover', HOVERS[t.accent] ?? t.accent)
  document.body.dataset.density = t.density
  document.body.dataset.nav = t.nav
  document.body.dataset.style = t.style
  if (t.density === 'compact') {
    r.style.setProperty('--radius', '6px')
    document.body.style.fontSize = '12.5px'
  } else {
    r.style.setProperty('--radius', '8px')
    document.body.style.fontSize = '13.5px'
  }
}

function loadStored(): Tweaks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function useTweaks(): [Tweaks, (t: Partial<Tweaks>) => void] {
  const [tweaks, setTweaks] = useState<Tweaks>(loadStored)

  useEffect(() => {
    applyTweaks(tweaks)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks))
    } catch {
      /* localStorage unavailable — apply still works for this session. */
    }
  }, [tweaks])

  const update = (patch: Partial<Tweaks>) =>
    setTweaks((prev) => ({ ...prev, ...patch }))

  return [tweaks, update]
}

export const ACCENT_CHOICES = [
  { id: 'indigo', color: '#6366f1' },
  { id: 'violet', color: '#8b5cf6' },
  { id: 'rose', color: '#f43f5e' },
  { id: 'emerald', color: '#10b981' },
  { id: 'amber', color: '#f59e0b' },
]
