import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../design/Icon'
import { StatusPill } from '../design/StatusPill'
import { StoryId } from '../design/StoryId'
import { useStories } from '../stories'
import { NAV_ITEMS } from './nav'

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface Hit {
  kind: 'screen' | 'story'
  id: string
  label: string
  hint?: string
  to: string
  status?: string
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { data: stories } = useStories()

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase()
    const screenHits: Hit[] = NAV_ITEMS.filter((n) =>
      needle === '' ? true : n.label.toLowerCase().includes(needle),
    ).map((n) => ({
      kind: 'screen',
      id: n.id,
      label: n.label,
      hint: n.path,
      to: n.path,
    }))

    if (needle === '') return screenHits.slice(0, 8)

    const storyHits: Hit[] = (stories ?? [])
      .filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.id.toLowerCase().includes(needle),
      )
      .slice(0, 12)
      .map((s) => ({
        kind: 'story',
        id: s.id,
        label: s.name,
        hint: s.id,
        to: `/story/${s.id}`,
        status: s.status,
      }))

    return [...screenHits, ...storyHits].slice(0, 16)
  }, [q, stories])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(hits.length - 1, c + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(0, c - 1))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const h = hits[cursor]
        if (h) {
          navigate(h.to)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hits, cursor, onClose, navigate])

  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,15,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--hv-border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
          <Icon name="search" size={15} color="var(--fg-3)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setCursor(0)
            }}
            placeholder="Jump to screen or search stories…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              font: '400 14px/1 var(--font)',
            }}
          />
        </div>
        <div
          style={{
            borderTop: '1px solid var(--hv-border)',
            maxHeight: 360,
            overflow: 'auto',
          }}
        >
          {hits.length === 0 && (
            <div style={{ padding: 18, color: 'var(--fg-3)' }}>No results</div>
          )}
          {hits.map((h, i) => {
            const active = i === cursor
            return (
              <button
                type="button"
                key={h.kind + h.id}
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  navigate(h.to)
                  onClose()
                }}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  background: active ? 'var(--bg-2)' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: '400 13px/1 var(--font)',
                }}
              >
                {h.kind === 'screen' ? (
                  <span
                    style={{
                      font: '400 10.5px/1 var(--mono)',
                      color: 'var(--fg-3)',
                      padding: '2px 6px',
                      background: 'var(--bg-2)',
                      borderRadius: 10,
                    }}
                  >
                    screen
                  </span>
                ) : (
                  <StoryId id={h.id} />
                )}
                <span style={{ flex: 1, color: 'var(--hv-fg)' }}>{h.label}</span>
                {h.kind === 'story' && h.status && (
                  <StatusPill status={h.status as import('../types').StoryStatus} dense />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
