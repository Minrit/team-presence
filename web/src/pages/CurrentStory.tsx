import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { AgentChip } from '../design/AgentChip'
import { Card } from '../design/Card'
import { MarkdownEditor } from '../design/MarkdownEditor'
import { StoryId } from '../design/StoryId'
import { useSseGrid } from '../hooks/useSseGrid'
import { useStoryActivityStream } from '../hooks/useStoryActivityStream'
import {
  deleteStory,
  patchStory,
  useEpics,
  useStory,
  useStoryActivity,
  useStoryRelations,
} from '../stories'
import { Terminal } from '../terminal/Terminal'
import type { SessionMetaLite, User } from '../types'
import { AcChecklist } from '../components/AcChecklist'
import { CommentThread } from '../components/CommentThread'
import { RelationsEditor } from '../components/RelationsEditor'
import { StoryMetaBar } from '../components/StoryMetaBar'
import { ChangesPanel } from './story-panels/ChangesPanel'
import { EmptyPanel } from './story-panels/EmptyPanel'
import { RelatedPanel } from './story-panels/RelatedPanel'
import { RunsPanel } from './story-panels/RunsPanel'

type RightTab = 'terminal' | 'changes' | 'runs' | 'related'

/** Editable story detail. Left pane: inline-editable title + tiptap
 *  description + metadata bar + AC checklist + relations + activity +
 *  comments. Right pane (Live terminal / Changes / Runs / Related) stays
 *  strictly read-only — it's collector telemetry, not user data. */
export default function CurrentStory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: story, error } = useStory(id)
  const { data: activity } = useStoryActivity(id)
  const { data: relations } = useStoryRelations(id)
  const { data: epics } = useEpics()
  const { data: sessions } = useSWR<SessionMetaLite[]>(
    '/api/v1/sessions',
    (k) => api.get<SessionMetaLite[]>(k),
    { refreshInterval: 15_000 },
  )
  const { data: users } = useSWR<User[]>(
    '/api/v1/auth/users',
    (k) => api.get<User[]>(k),
    { refreshInterval: 60_000 },
  )
  const { tiles } = useSseGrid()
  const { live: liveActivity } = useStoryActivityStream(id)

  const [tab, setTab] = useState<RightTab>('terminal')
  const [activeSession, setActiveSession] = useState<string | null>(null)

  const epic = useMemo(
    () => (story?.epic_id && epics ? epics.find((e) => e.id === story.epic_id) : undefined),
    [story?.epic_id, epics],
  )

  const usersById = useMemo<Record<string, User>>(() => {
    const m: Record<string, User> = {}
    for (const u of users ?? []) m[u.id] = u
    return m
  }, [users])

  const storySessions = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; agent_kind: string; cwd: string; ended: boolean }
    >()
    for (const t of tiles) {
      if (t.detected_story_id === id) {
        byId.set(t.session_id, {
          id: t.session_id,
          agent_kind: t.agent_kind,
          cwd: t.cwd,
          ended: !!t.ended_at,
        })
      }
    }
    for (const s of sessions ?? []) {
      if (s.detected_story_id === id && !byId.has(s.id)) {
        byId.set(s.id, {
          id: s.id,
          agent_kind: s.agent_kind,
          cwd: s.cwd,
          ended: !!s.ended_at,
        })
      }
    }
    return Array.from(byId.values()).sort((a, b) => Number(a.ended) - Number(b.ended))
  }, [tiles, sessions, id])

  if (activeSession === null && storySessions.length > 0) {
    setActiveSession(storySessions[0].id)
  }

  const combinedActivity = useMemo(() => {
    const seen = new Set<string>()
    const out = [...liveActivity, ...(activity ?? [])]
    return out.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
  }, [activity, liveActivity])

  if (error) {
    return (
      <div style={{ padding: 32, color: 'var(--danger)' }}>
        Failed to load story: {String(error)}
      </div>
    )
  }
  if (!story) {
    return <div style={{ padding: 32, color: 'var(--fg-3)' }}>Loading story…</div>
  }

  async function handleDelete() {
    if (!story) return
    if (!confirm(`Delete story "${story.name}"? This cannot be undone.`)) return
    try {
      await deleteStory(story.id)
      navigate('/board')
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="story-split" style={{ height: '100%', padding: 18, minHeight: 0 }}>
      {/* LEFT — story detail */}
      <div
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflow: 'auto',
          padding: 2,
        }}
      >
        {/* Header */}
        <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StoryId id={story.id} />
            {epic && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--fg-3)',
                  font: '400 12px/1 var(--font)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: epic.color,
                  }}
                />
                {epic.name}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={handleDelete}
              style={{
                padding: '3px 10px',
                background: 'transparent',
                color: 'var(--danger)',
                border: '1px solid var(--hv-border)',
                borderRadius: 'var(--radius-sm)',
                font: '500 11.5px/1 var(--font)',
                cursor: 'pointer',
              }}
              title="Delete story"
            >
              Delete
            </button>
          </div>

          <TitleEditor
            key={story.id}
            initial={story.name}
            onSave={async (next) => {
              if (next.trim() === story.name) return
              await patchStory(story.id, { name: next.trim() })
            }}
          />

          <StoryMetaBar story={story} />

          <DescriptionEditor
            key={`desc-${story.id}`}
            initial={story.description}
            onSave={async (next) => {
              if (next === story.description) return
              await patchStory(story.id, { description: next })
            }}
          />
        </Card>

        <Card style={{ padding: 16 }}>
          <AcChecklist storyId={story.id} items={story.acceptance_criteria} />
        </Card>

        <Card style={{ padding: 16 }}>
          <RelationsEditor storyId={story.id} relations={relations} />
        </Card>

        {/* Activity timeline */}
        <Card style={{ padding: 16 }}>
          <div style={{ font: '600 13px/1 var(--font)', marginBottom: 10 }}>Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {combinedActivity.length === 0 && (
              <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-4)' }}>
                No activity yet.
              </div>
            )}
            {combinedActivity.map((row) => (
              <div
                key={row.id}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    width: 26,
                    display: 'flex',
                    justifyContent: 'center',
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  <ActivityGlyph kind={row.kind} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: '400 12.5px/1.5 var(--font)',
                      color: 'var(--fg-2)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.text}
                  </div>
                  <div
                    style={{
                      font: '400 11px/1 var(--mono)',
                      color: 'var(--fg-3)',
                      marginTop: 4,
                    }}
                  >
                    {row.actor_type} · {shortTime(row.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 16 }}>
          <CommentThread storyId={story.id} usersById={usersById} />
        </Card>
      </div>

      {/* RIGHT — tabbed pane (read-only: live collector data) */}
      <div
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 2,
            background: 'var(--bg-2)',
            borderRadius: 'var(--radius-sm)',
            width: 'fit-content',
          }}
        >
          {(['terminal', 'changes', 'runs', 'related'] as RightTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '5px 12px',
                background: tab === t ? 'var(--surface)' : 'transparent',
                color: tab === t ? 'var(--hv-fg)' : 'var(--fg-3)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                font: `${tab === t ? '500' : '400'} 12.5px/1 var(--font)`,
                cursor: 'pointer',
                boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t === 'terminal'
                ? 'Live terminal'
                : t === 'changes'
                ? 'Changes'
                : t === 'runs'
                ? 'Runs'
                : 'Related'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {tab === 'terminal' && (
            storySessions.length === 0 ? (
              <EmptyPanel
                title="No agent attached"
                hint="Start a Claude Code session on a branch matching this story id, or reassign an existing session via /tp-reassign."
                icon="terminal"
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {storySessions.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {storySessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSession(s.id)}
                        style={{
                          padding: '3px 9px',
                          background:
                            activeSession === s.id ? 'var(--surface)' : 'var(--bg-2)',
                          border: `1px solid ${
                            activeSession === s.id ? 'var(--hv-accent)' : 'var(--hv-border)'
                          }`,
                          borderRadius: 'var(--radius-sm)',
                          font: '500 11.5px/1 var(--font)',
                          cursor: 'pointer',
                          color: 'var(--fg-2)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <AgentChip agentKind={s.agent_kind} />
                        <span style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
                          {s.id.slice(0, 6)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ flex: 1, minHeight: 0 }}>
                  {activeSession && (
                    <Terminal
                      sessionId={activeSession}
                      header={{
                        agentKind:
                          storySessions.find((s) => s.id === activeSession)?.agent_kind ??
                          'claude_code',
                        cwd: storySessions.find((s) => s.id === activeSession)?.cwd,
                        branch: story.branch ?? undefined,
                        storyId: story.id.slice(0, 6).toUpperCase(),
                      }}
                    />
                  )}
                </div>
              </div>
            )
          )}
          {tab === 'changes' && <ChangesPanel sessionId={activeSession} />}
          {tab === 'runs' && <RunsPanel sessionId={activeSession} />}
          {tab === 'related' && <RelatedPanel story={story} />}
        </div>
      </div>
    </div>
  )
}

/** Click-to-edit title input. Enter / blur saves; Esc cancels. */
function TitleEditor({
  initial,
  onSave,
}: {
  initial: string
  onSave: (next: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setValue(initial)
  }, [initial])

  async function commit() {
    setEditing(false)
    const next = value.trim()
    if (next === '' || next === initial) {
      setValue(initial)
      return
    }
    try {
      await onSave(next)
    } catch (err) {
      alert(`Rename failed: ${err instanceof Error ? err.message : String(err)}`)
      setValue(initial)
    }
  }

  if (!editing) {
    return (
      <h2
        onClick={() => {
          setEditing(true)
          setTimeout(() => inputRef.current?.select(), 0)
        }}
        style={{
          margin: 0,
          font: '600 20px/1.3 var(--font)',
          color: 'var(--hv-fg)',
          cursor: 'text',
          padding: '2px 4px',
          borderRadius: 4,
        }}
        title="Click to rename"
      >
        {initial}
      </h2>
    )
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void commit()
        } else if (e.key === 'Escape') {
          setValue(initial)
          setEditing(false)
        }
      }}
      autoFocus
      style={{
        font: '600 20px/1.3 var(--font)',
        color: 'var(--hv-fg)',
        background: 'var(--surface)',
        border: '1px solid var(--hv-accent)',
        borderRadius: 4,
        padding: '2px 6px',
        outline: 'none',
      }}
    />
  )
}

/** Tiptap-backed description editor. Debounces saves at 500ms; this is on
 *  top of the 200ms debounce inside MarkdownEditor so network traffic is
 *  bounded even under heavy typing. */
function DescriptionEditor({
  initial,
  onSave,
}: {
  initial: string
  onSave: (next: string) => Promise<void>
}) {
  const [value, setValue] = useState(initial)
  const lastSaved = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(initial)
    lastSaved.current = initial
  }, [initial])

  function onChange(next: string) {
    setValue(next)
    if (next === lastSaved.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await onSave(next)
        lastSaved.current = next
      } catch (err) {
        alert(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }, 500)
  }

  return (
    <MarkdownEditor
      value={value}
      onChange={onChange}
      placeholder="Describe this story…  (Markdown, mermaid, code blocks supported)"
    />
  )
}

function ActivityGlyph({ kind }: { kind: string }) {
  const color =
    kind === 'status_change'
      ? 'var(--hv-accent)'
      : kind === 'claim'
      ? 'var(--success)'
      : kind === 'comment'
      ? 'var(--purple)'
      : kind === 'relation'
      ? 'var(--warning)'
      : kind === 'create'
      ? 'var(--fg-2)'
      : 'var(--fg-4)'
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        marginTop: 5,
      }}
    />
  )
}

function shortTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}
