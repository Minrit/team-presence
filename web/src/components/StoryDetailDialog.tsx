import { useEffect, useState } from 'react'
import {
  createTask,
  deleteStory,
  deleteTask,
  patchStory,
  patchTask,
  useStory,
} from '../stories'
import { STATUSES, STATUS_LABEL, type StoryStatus } from '../types'

export interface StoryDetailDialogProps {
  storyId: string
  onClose: () => void
}

export default function StoryDetailDialog({ storyId, onClose }: StoryDetailDialogProps) {
  const { data, error, isLoading } = useStory(storyId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repo, setRepo] = useState('')
  const [status, setStatus] = useState<StoryStatus>('todo')
  const [newTask, setNewTask] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) {
      setTitle(data.title)
      setDescription(data.description)
      setRepo(data.repo ?? '')
      setStatus(data.status)
    }
  }, [data])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patchField = async <K extends 'title' | 'description' | 'repo' | 'status',>(
    field: K,
    value: string,
  ) => {
    if (!data) return
    setSaving(true)
    try {
      await patchStory(storyId, {
        [field]: field === 'repo' ? (value.trim() === '' ? null : value) : value,
      } as Record<string, unknown>)
    } finally {
      setSaving(false)
    }
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.trim()) return
    await createTask(storyId, { title: newTask.trim() })
    setNewTask('')
  }

  const onDelete = async () => {
    if (!confirm('Delete this story and all its tasks?')) return
    await deleteStory(storyId)
    onClose()
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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-xl">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-xs text-muted">
            {saving ? 'Saving…' : `Updated ${data ? new Date(data.updated_at).toLocaleString() : ''}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {isLoading && <div className="p-8 text-center text-muted">Loading…</div>}
        {error && <div className="p-8 text-center text-red-500">{String(error)}</div>}

        {data && (
          <div className="p-4 space-y-5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== data.title) patchField('title', title.trim())
              }}
              className="input text-lg font-semibold"
              aria-label="Story title"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm text-muted">
                Status
                <select
                  value={status}
                  onChange={(e) => {
                    const v = e.target.value as StoryStatus
                    setStatus(v)
                    patchField('status', v)
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
              <label className="text-sm text-muted flex-1">
                Repo
                <input
                  type="text"
                  placeholder="org/repo or path"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  onBlur={() => {
                    if ((data.repo ?? '') !== repo) patchField('repo', repo)
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
                  if (description !== data.description) patchField('description', description)
                }}
                rows={6}
                className="input font-mono text-sm"
                placeholder="Markdown — no preview in MVP"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Tasks</h3>
                <span className="text-xs text-muted">
                  {data.tasks.filter((t) => t.done_at).length} / {data.tasks.length} done
                </span>
              </div>
              <ul className="space-y-1 mb-2">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!t.done_at}
                      onChange={(e) => patchTask(t.id, storyId, { done: e.target.checked })}
                    />
                    <span className={t.done_at ? 'line-through text-muted' : ''}>{t.title}</span>
                    <button
                      type="button"
                      onClick={() => deleteTask(t.id, storyId)}
                      className="ml-auto text-xs text-muted hover:text-red-500"
                      aria-label="Delete task"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={addTask} className="flex gap-2">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Add a task…"
                  className="input flex-1"
                />
                <button type="submit" className="btn-primary px-3">
                  Add
                </button>
              </form>
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
