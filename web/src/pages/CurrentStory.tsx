import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'
import { api } from '../api'
import { AgentChip } from '../design/AgentChip'
import { Card } from '../design/Card'
import { MarkdownEditor, type MarkdownEditorHandle } from '../design/MarkdownEditor'
import { StoryId } from '../design/StoryId'
import { useStoryDraft } from '../hooks/useStoryDraft'
import { useSseGrid } from '../hooks/useSseGrid'
import { useStoryActivityStream } from '../hooks/useStoryActivityStream'
import { useSprints } from '../sprints'
import {
  deleteStory,
  patchStory,
  useComments,
  useEpics,
  useStory,
  useStoryActivity,
  useStoryRelations,
} from '../stories'
import { Terminal } from '../terminal/Terminal'
import type { SessionMetaLite, User } from '../types'
import type { StoryDraft } from '../hooks/useStoryDraft'
import { AcChecklist } from '../components/AcChecklist'
import { CommentThread } from '../components/CommentThread'
import { RelationsEditor } from '../components/RelationsEditor'
import { StoryMetaBar } from '../components/StoryMetaBar'
import { ChangesPanel } from './story-panels/ChangesPanel'
import { EmptyPanel } from './story-panels/EmptyPanel'
import { RelatedPanel } from './story-panels/RelatedPanel'
import { RunsPanel } from './story-panels/RunsPanel'

type RightTab = 'terminal' | 'changes' | 'runs' | 'related'

/** Editable story detail with a staged Save/Reset flow. The left pane's
 *  title / description / metadata / AC checklist all feed one draft;
 *  nothing is persisted until the user clicks Save.
 *
 *  Relations and Comments remain immediate — they're verb-actions (add
 *  blocker, post comment) rather than form fields.
 *
 *  The right pane (Live terminal / Changes / Runs / Related) stays
 *  strictly read-only — that's collector telemetry. */
export default function CurrentStory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: story, error } = useStory(id)
  const { data: activity } = useStoryActivity(id)
  const { data: relations } = useStoryRelations(id)
  const { data: epics } = useEpics()
  const { data: sprints } = useSprints()
  const { data: comments } = useComments(id)
  const { data: sessions } = useSWR<SessionMetaLite[]>(
    '/api/v1/sessions',
    (k: string) => api.get<SessionMetaLite[]>(k),
    { refreshInterval: 15_000 },
  )
  const { data: users } = useSWR<User[]>(
    '/api/v1/auth/users',
    (k: string) => api.get<User[]>(k),
    { refreshInterval: 60_000 },
  )
  const { tiles } = useSseGrid()
  const { live: liveActivity } = useStoryActivityStream(id)

  const { draft, patch, reset, dirty, diff, markClean } = useStoryDraft(story)

  const [tab, setTab] = useState<RightTab>('terminal')
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const descEditorRef = useRef<MarkdownEditorHandle>(null)

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
  if (!story || !draft) {
    return <div style={{ padding: 32, color: 'var(--fg-3)' }}>Loading story…</div>
  }

  async function handleSave() {
    if (!story || saving) return
    // Flush any pending debounced description so the save catches it even
    // if the user clicked Save mid-debounce. flush() returns latest md
    // synchronously; the onChange it fires schedules a patch() that won't
    // commit this tick — so fold latestDesc into the payload directly.
    const latestDesc = descEditorRef.current?.flush()
    const payload = diff()
    if (latestDesc !== undefined && latestDesc !== story.description) {
      payload.description = latestDesc
    }
    if (Object.keys(payload).length === 0) return
    setSaving(true)
    try {
      await patchStory(story.id, payload)
      // Snap baseline to (draft + latestDesc). This guarantees Save
      // disables even when the debounced setDraft for description hasn't
      // landed yet by the time we mark clean.
      markClean(
        latestDesc !== undefined ? { description: latestDesc } : undefined,
      )
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    if (!story || !draft) return
    const latestDesc = descEditorRef.current?.flush() ?? draft.description
    const md = buildStoryMarkdown({
      story,
      draft: { ...draft, description: latestDesc },
      epics: epics ?? [],
      sprints: sprints ?? [],
      usersById,
      relations,
      comments: comments ?? [],
    })
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      // Clipboard API needs HTTPS / localhost + user gesture — if it's
      // blocked, fall back to a prompt dialog so the user can grab it
      // manually.
      window.prompt('Copy this markdown:', md)
    }
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
            {dirty && (
              <span
                style={{
                  font: '500 11px/1 var(--font)',
                  color: 'var(--warning)',
                  padding: '2px 7px',
                  background: 'var(--bg-2)',
                  borderRadius: 10,
                }}
              >
                unsaved
              </span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              title="Copy full story (title + metadata + description + AC + relations + comments) as Markdown, for handing off to an AI agent"
              style={{
                padding: '4px 10px',
                background: copied ? 'var(--success)' : 'transparent',
                color: copied ? 'white' : 'var(--fg-2)',
                border: '1px solid var(--hv-border)',
                borderRadius: 'var(--radius-sm)',
                font: '500 11.5px/1 var(--font)',
                cursor: 'pointer',
                transition: 'background 120ms, color 120ms',
              }}
            >
              {copied ? '✓ Copied' : 'Copy MD'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={!dirty || saving}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                color: dirty ? 'var(--fg-2)' : 'var(--fg-4)',
                border: '1px solid var(--hv-border)',
                borderRadius: 'var(--radius-sm)',
                font: '500 11.5px/1 var(--font)',
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              style={{
                padding: '4px 12px',
                background: dirty ? 'var(--hv-accent)' : 'var(--bg-2)',
                color: dirty ? 'white' : 'var(--fg-4)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                font: '500 11.5px/1 var(--font)',
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              style={{
                padding: '4px 10px',
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

          <input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Story title"
            style={{
              font: '600 20px/1.3 var(--font)',
              color: 'var(--hv-fg)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '2px 0',
            }}
          />

          <StoryMetaBar draft={draft} patch={patch} />

          <MarkdownEditor
            key={`desc-${story.id}`}
            ref={descEditorRef}
            value={draft.description}
            onChange={(md) => patch({ description: md })}
            placeholder="Describe this story…  (Markdown, mermaid, code blocks supported)"
          />
        </Card>

        <Card style={{ padding: 16 }}>
          <AcChecklist
            items={draft.acceptance_criteria}
            onChange={(next) => patch({ acceptance_criteria: next })}
          />
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

/** Render a story + related context as a single Markdown block, for
 *  pasting into a Claude Code / Codex session. Uses the draft values so
 *  in-flight edits (before Save) are captured. */
function buildStoryMarkdown({
  story,
  draft,
  epics,
  sprints,
  usersById,
  relations,
  comments,
}: {
  story: { id: string; created_at: string; updated_at: string }
  draft: StoryDraft
  epics: { id: string; name: string }[]
  sprints: { id: string; name: string }[]
  usersById: Record<string, User>
  relations: { blocks: string[]; blocked_by: string[] } | undefined
  comments: { id: string; author_id: string; body: string; created_at: string }[]
}): string {
  const lines: string[] = []
  const shortId = story.id.slice(0, 8)
  lines.push(`# ${draft.name || '(untitled)'}`)
  lines.push('')
  lines.push(`**ID:** \`${story.id}\`  (\`${shortId}\`)`)

  const meta: string[] = []
  meta.push(`**Status:** ${draft.status}`)
  if (draft.priority) meta.push(`**Priority:** ${draft.priority}`)
  if (draft.points !== null) meta.push(`**Points:** ${draft.points}`)
  if (draft.epic_id) {
    const e = epics.find((x) => x.id === draft.epic_id)
    meta.push(`**Epic:** ${e?.name ?? draft.epic_id}`)
  }
  if (draft.sprint_id) {
    const s = sprints.find((x) => x.id === draft.sprint_id)
    meta.push(`**Sprint:** ${s?.name ?? draft.sprint_id}`)
  }
  if (draft.owner_id) {
    const u = usersById[draft.owner_id]
    meta.push(`**Owner:** ${u?.display_name ?? draft.owner_id}`)
  }
  if (draft.branch) meta.push(`**Branch:** \`${draft.branch}\``)
  if (draft.pr_ref) meta.push(`**PR:** ${draft.pr_ref}`)
  lines.push(meta.join('  ·  '))
  lines.push('')

  lines.push('## Description')
  lines.push('')
  lines.push(draft.description.trim() || '_(empty)_')
  lines.push('')

  lines.push('## Acceptance criteria')
  lines.push('')
  if (draft.acceptance_criteria.length === 0) {
    lines.push('_(none)_')
  } else {
    for (const a of draft.acceptance_criteria) {
      lines.push(`- [${a.done ? 'x' : ' '}] ${a.text}`)
    }
  }
  lines.push('')

  if (relations && (relations.blocks.length || relations.blocked_by.length)) {
    lines.push('## Relations')
    lines.push('')
    if (relations.blocked_by.length) {
      lines.push(
        `- **Blocked by:** ${relations.blocked_by
          .map((id) => `\`${id.slice(0, 8)}\``)
          .join(', ')}`,
      )
    }
    if (relations.blocks.length) {
      lines.push(
        `- **Blocks:** ${relations.blocks
          .map((id) => `\`${id.slice(0, 8)}\``)
          .join(', ')}`,
      )
    }
    lines.push('')
  }

  if (comments.length > 0) {
    lines.push('## Comments')
    lines.push('')
    for (const c of comments) {
      const author = usersById[c.author_id]?.display_name ?? c.author_id.slice(0, 6)
      const when = shortTime(c.created_at)
      lines.push(`### ${author} — ${when}`)
      lines.push('')
      lines.push(c.body)
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}
