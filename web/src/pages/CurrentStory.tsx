import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { useAuth } from '../auth'
import { AgentChip } from '../design/AgentChip'
import { Avatar, userToAvatar } from '../design/Avatar'
import { Button } from '../design/Button'
import { Card } from '../design/Card'
import { Icon } from '../design/Icon'
import { Kbd } from '../design/Kbd'
import { Priority } from '../design/Priority'
import { ProgressBar } from '../design/ProgressBar'
import { StatusPill } from '../design/StatusPill'
import { StoryId } from '../design/StoryId'
import { useSseGrid } from '../hooks/useSseGrid'
import { useStoryActivityStream } from '../hooks/useStoryActivityStream'
import {
  patchStory,
  postComment,
  storyCommentsKey,
  useComments,
  useEpics,
  useStory,
  useStoryActivity,
  useStoryRelations,
} from '../stories'
import { Terminal } from '../terminal/Terminal'
import type { SessionMetaLite, Story } from '../types'
import { ChangesPanel } from './story-panels/ChangesPanel'
import { EmptyPanel } from './story-panels/EmptyPanel'
import { RelatedPanel } from './story-panels/RelatedPanel'
import { RunsPanel } from './story-panels/RunsPanel'

type RightTab = 'terminal' | 'changes' | 'runs' | 'related'

export default function CurrentStory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: story, mutate: mutateStory, error } = useStory(id)
  const { data: activity } = useStoryActivity(id)
  const { data: relations } = useStoryRelations(id)
  const { data: epics } = useEpics()
  const { data: comments } = useComments(id)
  const { data: sessions } = useSWR<SessionMetaLite[]>(
    '/api/v1/sessions',
    (k) => api.get<SessionMetaLite[]>(k),
    { refreshInterval: 15_000 },
  )
  const { tiles } = useSseGrid()
  const { live: liveActivity } = useStoryActivityStream(id)

  const [tab, setTab] = useState<RightTab>('terminal')
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [composer, setComposer] = useState('')

  const epic = useMemo(
    () => (story?.epic_id && epics ? epics.find((e) => e.id === story.epic_id) : undefined),
    [story?.epic_id, epics],
  )

  // Sessions linked to this story. Prefer the live SSE grid tile (has
  // last_heartbeat_at + agent_kind), fall back to the REST list when the
  // stream hasn't filled yet.
  const storySessions = useMemo(() => {
    const byId = new Map<string, { id: string; agent_kind: string; cwd: string; ended: boolean }>()
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

  // Default the terminal tab to the first live session.
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

  const acDone = story.acceptance_criteria.filter((a) => a.done).length
  const acTotal = story.acceptance_criteria.length

  const toggleAc = async (index: number) => {
    const next = story.acceptance_criteria.map((a, i) =>
      i === index ? { ...a, done: !a.done } : a,
    )
    mutateStory({ ...story, acceptance_criteria: next } as Story, { revalidate: false })
    try {
      await patchStory(story.id, { acceptance_criteria: next })
    } catch {
      mutateStory(story, { revalidate: false })
    }
  }

  const submitComment = async () => {
    const body = composer.trim()
    if (!body || !story) return
    setComposer('')
    try {
      await postComment(story.id, body)
      // optimistic-ish: SWR revalidates both comments + activity
    } catch {
      setComposer(body)
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
            <StatusPill status={story.status} />
            {story.priority && <Priority level={story.priority} showLabel />}
            {story.points != null && (
              <span style={{ font: '500 12px/1 var(--mono)', color: 'var(--fg-3)' }}>
                {story.points} pt
              </span>
            )}
          </div>
          <div style={{ font: '600 20px/1.3 var(--font)' }}>{story.name}</div>
          {story.description && (
            <div
              style={{
                font: '400 13px/1.55 var(--font)',
                color: 'var(--fg-2)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {story.description}
            </div>
          )}
        </Card>

        {/* AC checklist */}
        <Card style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 8,
              gap: 10,
            }}
          >
            <div style={{ font: '600 13px/1 var(--font)' }}>Acceptance criteria</div>
            {acTotal > 0 && (
              <div
                style={{
                  font: '500 11px/1 var(--mono)',
                  color: 'var(--fg-3)',
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: 'var(--bg-2)',
                }}
              >
                {acDone} / {acTotal}
              </div>
            )}
          </div>
          {acTotal > 0 && <ProgressBar value={acDone} total={acTotal} />}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {acTotal === 0 && (
              <div
                style={{
                  font: '400 12.5px/1.5 var(--font)',
                  color: 'var(--fg-4)',
                }}
              >
                No acceptance criteria yet.
              </div>
            )}
            {story.acceptance_criteria.map((a, i) => (
              <label
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '4px 0',
                  cursor: 'pointer',
                  font: '400 13px/1.45 var(--font)',
                  color: a.done ? 'var(--fg-3)' : 'var(--hv-fg)',
                  textDecoration: a.done ? 'line-through' : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={a.done}
                  onChange={() => toggleAc(i)}
                  style={{ marginTop: 3 }}
                />
                <span>{a.text}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Relations */}
        {relations && (relations.blocks.length > 0 || relations.blocked_by.length > 0) && (
          <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ font: '600 13px/1 var(--font)' }}>Relations</div>
            {relations.blocked_by.length > 0 && (
              <div style={{ font: '400 12.5px/1.4 var(--font)', color: 'var(--fg-2)' }}>
                <span style={{ color: 'var(--danger)', marginRight: 6 }}>blocked by</span>
                {relations.blocked_by.map((rid) => (
                  <Link
                    key={rid}
                    to={`/story/${rid}`}
                    style={{
                      marginRight: 8,
                      color: 'var(--hv-accent)',
                      textDecoration: 'none',
                    }}
                  >
                    <StoryId id={rid} />
                  </Link>
                ))}
              </div>
            )}
            {relations.blocks.length > 0 && (
              <div style={{ font: '400 12.5px/1.4 var(--font)', color: 'var(--fg-2)' }}>
                <span style={{ color: 'var(--warning)', marginRight: 6 }}>blocks</span>
                {relations.blocks.map((rid) => (
                  <Link
                    key={rid}
                    to={`/story/${rid}`}
                    style={{
                      marginRight: 8,
                      color: 'var(--hv-accent)',
                      textDecoration: 'none',
                    }}
                  >
                    <StoryId id={rid} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

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
          {comments && comments.length > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--hv-border)',
                font: '400 11.5px/1 var(--font)',
                color: 'var(--fg-3)',
              }}
            >
              {comments.length} comment{comments.length === 1 ? '' : 's'} also logged above
            </div>
          )}
        </Card>

        {/* Composer */}
        <Card style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {user && <Avatar user={userToAvatar(user, 'active')} size={24} />}
            <textarea
              className="input"
              placeholder="Leave a comment — @mention a teammate"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  submitComment()
                }
              }}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }} />
            <span style={{ font: '400 11px/1 var(--font)', color: 'var(--fg-3)' }}>
              <Kbd>⌘</Kbd> <Kbd>↵</Kbd> to send
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={!composer.trim()}
              onClick={submitComment}
            >
              Comment
            </Button>
          </div>
        </Card>
      </div>

      {/* RIGHT — tabbed pane */}
      <div
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        {/* Tabs */}
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

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {tab === 'terminal' && (
            storySessions.length === 0 ? (
              <EmptyPanel
                title="No agent attached"
                hint="Kick off a Claude Code session in a repo where the branch matches the story id, or 改派 an existing session here."
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

      {/* Nav back affordance */}
      <div style={{ display: 'none' }}>
        <button type="button" onClick={() => navigate('/')}>Back to Board</button>
        <Icon name="arrow" size={12} />
      </div>

      {/* Ensure SWR key helpers aren't tree-shaken accidentally */}
      <span style={{ display: 'none' }}>{storyCommentsKey(story.id)}</span>
    </div>
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
