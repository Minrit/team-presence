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
          width: 580,
          background: 'var(--cream)',
          borderRadius: 0,
          boxShadow: '3px 3px 0 var(--steel)',
          border: '2px solid var(--steel)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <span className="rivet rivet-xs" style={{ position: 'absolute', top: 4, left: 4 }} />
        <span className="rivet rivet-xs" style={{ position: 'absolute', top: 4, right: 4 }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--cream-2)',
            borderBottom: '1.5px solid var(--steel)',
          }}
        >
          <span
            className="label"
            style={{
              font: '700 11px/1 var(--font-label)',
              letterSpacing: '0.15em',
              color: 'var(--ink)',
            }}
          >
            JUMP · FIND
          </span>
          <div style={{ flex: 1 }} />
          <Icon name="search" size={14} color="var(--steel)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setCursor(0)
            }}
            placeholder="Screen or story…"
            className="mono"
            style={{
              flex: 2,
              background: 'var(--cream)',
              border: '1.5px solid var(--steel)',
              outline: 'none',
              padding: '4px 8px',
              font: '500 12px/1 var(--mono)',
              letterSpacing: '0.04em',
              color: 'var(--ink)',
            }}
          />
        </div>
        <div className="tick-stripe" />
        <div
          style={{
            maxHeight: 380,
            overflow: 'auto',
          }}
        >
          {hits.length === 0 && (
            <div
              className="mono"
              style={{
                padding: 18,
                color: 'var(--muted)',
                font: '500 11px/1 var(--mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              — NO MATCHES —
            </div>
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
                  padding: '8px 14px',
                  background: active ? 'var(--cream-3)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--rule)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: '500 12.5px/1 var(--mono)',
                }}
              >
                {h.kind === 'screen' ? (
                  <span
                    className="label"
                    style={{
                      font: '700 9.5px/1 var(--font-label)',
                      color: 'var(--cream)',
                      background: 'var(--steel)',
                      padding: '2px 6px',
                      letterSpacing: '0.15em',
                    }}
                  >
                    SCREEN
                  </span>
                ) : (
                  <StoryId id={h.id} />
                )}
                <span
                  style={{
                    flex: 1,
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {h.label}
                </span>
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
