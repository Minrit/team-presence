// @ts-nocheck — legacy pre-Hive file; restyled or removed in Unit 15/16/26.
import { useEffect, useMemo, useState } from 'react'
import { deleteStory, patchStory, useStory } from '../stories'
import { useSprints } from '../sprints'
import { useStoryActivity } from '../hooks/useStoryActivity'
import { STATUSES, STATUS_LABEL, type Sprint, type Story, type StoryStatus } from '../types'
import { Link } from 'react-router-dom'

export interface StoryDetailDialogProps {
  storyId: string
  onClose: () => void
}

export default function StoryDetailDialog({ storyId, onClose }: StoryDetailDialogProps) {
  const { data, error, isLoading } = useStory(storyId)
  const { data: sprints } = useSprints()
  const activity = useStoryActivity()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [acceptance, setAcceptance] = useState('')
  const [repo, setRepo] = useState('')
  const [status, setStatus] = useState<StoryStatus>('todo')
  const [sprintId, setSprintId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (data) {
      setName(data.name)
      setDescription(data.description)
      setAcceptance(data.acceptance_criteria)
      setRepo(data.repo ?? '')
      setStatus(data.status)
      setSprintId(data.sprint_id ?? '')
    }
  }, [data])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patchField = async (body: Record<string, unknown>) => {
    if (!data) return
    setSaving(true)
    try {
      await patchStory(storyId, body)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!confirm('Delete this story?')) return
    await deleteStory(storyId)
    onClose()
  }

  const linkedSessions = useMemo(
    () => (data ? activity.get(data.id)?.session_ids ?? [] : []),
    [activity, data],
  )

  const copyAsMd = async () => {
    if (!data) return
    const sprint = sprints?.find((s) => s.id === data.sprint_id) ?? null
    const md = storyToMarkdown(data, sprint, linkedSessions)
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      // fallback: dump into a hidden textarea
      const ta = document.createElement('textarea')
      ta.value = md
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--cream)] border-[2px] border-[var(--steel)] shadow-[3px_3px_0_var(--steel)]">
        <header className="flex items-center justify-between p-4 border-b-[1.5px] border-[var(--steel)] bg-[var(--cream-2)]">
          <span className="mono text-[10px] text-[var(--muted)] uppercase tracking-wider">
            {saving ? 'SAVING…' : `UPD ${data ? new Date(data.updated_at).toLocaleString() : ''}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={copyAsMd}
              className="label text-[10px] tracking-[0.12em] uppercase bg-[var(--cream-3)] border-[1.5px] border-[var(--steel)] hover:bg-[var(--cream-2)] px-2 py-1"
            >
              {copied ? 'COPIED' : 'COPY MD'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-fg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </header>

        {isLoading && <div className="label p-8 text-center text-[var(--muted)] tracking-[0.15em] uppercase text-[11px]">— Loading —</div>}
        {error && <div className="p-8 text-center text-[var(--red)]">{String(error)}</div>}

        {data && (
          <div className="p-4 space-y-5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== data.name) patchField({ name: name.trim() })
              }}
              className="input text-lg font-semibold"
              aria-label="Story name"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm text-muted">
                Status
                <select
                  value={status}
                  onChange={(e) => {
                    const v = e.target.value as StoryStatus
                    setStatus(v)
                    patchField({ status: v })
                  }}
                  className="ml-2 input-inline"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-muted">
                Sprint
                <select
                  value={sprintId}
                  onChange={(e) => {
                    const v = e.target.value
                    setSprintId(v)
                    patchField({ sprint_id: v === '' ? null : v })
                  }}
                  className="ml-2 input-inline"
                >
                  <option value="">— none —</option>
                  {(sprints ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-muted flex-1 min-w-[200px]">
                Repo
                <input
                  type="text"
                  placeholder="org/repo or path"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  onBlur={() => {
                    if ((data.repo ?? '') !== repo) patchField({ repo: repo.trim() === '' ? null : repo })
                  }}
                  className="ml-2 input-inline"
                />
              </label>
            </div>

            <div>
              <label className="text-sm text-muted block mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (description !== data.description) patchField({ description })
                }}
                rows={5}
                className="input font-mono text-sm"
                placeholder="Markdown"
              />
            </div>

            <div>
              <label className="text-sm text-muted block mb-1">Acceptance criteria</label>
              <textarea
                value={acceptance}
                onChange={(e) => setAcceptance(e.target.value)}
                onBlur={() => {
                  if (acceptance !== data.acceptance_criteria)
                    patchField({ acceptance_criteria: acceptance })
                }}
                rows={5}
                className="input font-mono text-sm"
                placeholder="- [ ] given X, when Y, then Z"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Live sessions</h3>
              {linkedSessions.length === 0 ? (
                <p className="text-xs text-muted">No sessions are currently linked to this story.</p>
              ) : (
                <ul className="space-y-1">
                  {linkedSessions.map((sid) => (
                    <li key={sid} className="text-xs flex items-center gap-2">
                      <span className="inline-block size-1.5 bg-[var(--red)] z-pulse" />
                      <span className="font-mono">{sid.slice(0, 8)}</span>
                      <Link
                        to={`/room/${sid}`}
                        onClick={onClose}
                        className="text-accent hover:underline ml-auto"
                      >
                        watch →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="flex justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={onDelete}
                className="text-sm text-red-500 hover:underline"
              >
                Delete story
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}

function storyToMarkdown(
  story: Story,
  sprint: Sprint | null,
  sessionIds: string[],
): string {
  const parts: string[] = []
  parts.push(`# ${story.name}`)
  parts.push('')
  parts.push(`**Status:** ${STATUS_LABEL[story.status]}`)
  if (sprint) parts.push(`**Sprint:** ${sprint.name} (${sprint.start_date} → ${sprint.end_date})`)
  if (story.repo) parts.push(`**Repo:** ${story.repo}`)
  parts.push(`**Last updated:** ${new Date(story.updated_at).toLocaleString()}`)
  parts.push('')
  parts.push('## Description')
  parts.push(story.description || '_(empty)_')
  parts.push('')
  parts.push('## Acceptance Criteria')
  parts.push(story.acceptance_criteria || '_(none)_')
  if (sessionIds.length > 0) {
    parts.push('')
    parts.push('## Active sessions')
    for (const sid of sessionIds) parts.push(`- ${sid}`)
  }
  return parts.join('\n') + '\n'
}
