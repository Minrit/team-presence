import { useState } from 'react'
import TopNav from '../components/TopNav'
import {
  createSprint,
  deleteSprint,
  patchSprint,
  useSprints,
} from '../sprints'
import type { Sprint } from '../types'

export default function Sprints() {
  const { data: sprints, isLoading, error } = useSprints()
  const [name, setName] = useState('')
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(addDays(today(), 14))
  const [busy, setBusy] = useState(false)

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await createSprint({ name: name.trim(), start_date: start, end_date: end })
      setName('')
    } catch (err) {
      alert(`Create failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopNav current="sprints" />
      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold mb-3">Sprints</h1>
          <form
            onSubmit={onCreate}
            className="flex flex-wrap items-end gap-3 text-sm bg-card/40 border border-border rounded-xl p-3"
          >
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sprint 1"
                className="input"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">Start</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="input-inline"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted text-xs">End</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="input-inline"
                required
              />
            </label>
            <button type="submit" disabled={busy} className="btn-primary px-4">
              Create
            </button>
          </form>
        </div>

        {isLoading && <p className="text-muted">Loading…</p>}
        {error && <p className="text-red-500">Failed: {String(error)}</p>}

        {sprints && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Start</th>
                  <th className="text-left px-3 py-2">End</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sprints.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-xs text-muted/70">
                      No sprints yet — create one above.
                    </td>
                  </tr>
                ) : (
                  sprints.map((s) => <SprintRow key={s.id} sprint={s} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function SprintRow({ sprint }: { sprint: Sprint }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sprint.name)
  const [start, setStart] = useState(sprint.start_date)
  const [end, setEnd] = useState(sprint.end_date)

  const save = async () => {
    try {
      await patchSprint(sprint.id, { name, start_date: start, end_date: end })
      setEditing(false)
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const remove = async () => {
    if (!confirm(`Delete sprint "${sprint.name}"? Stories stay but lose the link.`)) return
    await deleteSprint(sprint.id)
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-inline" />
        ) : (
          <span className="font-medium">{sprint.name}</span>
        )}
      </td>
      <td className="px-3 py-2 text-muted">
        {editing ? (
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input-inline" />
        ) : (
          sprint.start_date
        )}
      </td>
      <td className="px-3 py-2 text-muted">
        {editing ? (
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input-inline" />
        ) : (
          sprint.end_date
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <div className="flex gap-2 justify-end text-xs">
            <button type="button" onClick={save} className="text-accent hover:underline">
              save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setName(sprint.name)
                setStart(sprint.start_date)
                setEnd(sprint.end_date)
              }}
              className="text-muted hover:text-fg"
            >
              cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-3 justify-end text-xs">
            <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-fg">
              edit
            </button>
            <button type="button" onClick={remove} className="text-red-500 hover:underline">
              delete
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
