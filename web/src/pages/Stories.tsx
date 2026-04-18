// @ts-nocheck — legacy pre-Hive file; restyled or removed in Unit 15/16/26.
import { useState } from 'react'
import StoryDetailDialog from '../components/StoryDetailDialog'
import TopNav from '../components/TopNav'
import { useStoryActivity } from '../hooks/useStoryActivity'
import { useSprints } from '../sprints'
import { useStories } from '../stories'
import { STATUS_LABEL } from '../types'

export default function Stories() {
  const [sprintFilter, setSprintFilter] = useState<string>('')
  const { data: stories, error, isLoading } = useStories(sprintFilter || null)
  const { data: sprints } = useSprints()
  const activity = useStoryActivity()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="min-h-full flex flex-col">
      <TopNav current="stories" />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-lg font-semibold">Stories</h1>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <label className="flex items-center gap-2 text-muted">
              Sprint
              <select
                value={sprintFilter}
                onChange={(e) => setSprintFilter(e.target.value)}
                className="input-inline"
              >
                <option value="">— all —</option>
                {(sprints ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-muted">
              {stories?.length ?? 0} stor{(stories?.length ?? 0) === 1 ? 'y' : 'ies'}
            </span>
          </div>
        </div>

        {isLoading && <p className="text-muted">Loading…</p>}
        {error && <p className="text-red-500">Failed: {String(error)}</p>}

        {stories && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Sprint</th>
                  <th className="text-left px-3 py-2">Repo</th>
                  <th className="text-left px-3 py-2">Live</th>
                  <th className="text-left px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {stories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-xs text-muted/70"
                    >
                      No stories {sprintFilter ? 'in this sprint' : 'yet'}
                    </td>
                  </tr>
                ) : (
                  stories.map((s) => {
                    const sprint = (sprints ?? []).find((sp) => sp.id === s.sprint_id)
                    const live = activity.get(s.id)?.active_count ?? 0
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setOpenId(s.id)}
                        className="border-t border-border hover:bg-card/60 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2">{STATUS_LABEL[s.status]}</td>
                        <td className="px-3 py-2 text-muted">
                          {sprint ? sprint.name : <span className="opacity-60">—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted">{s.repo ?? ''}</td>
                        <td className="px-3 py-2">
                          {live > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-400">
                              <span className="inline-block size-1.5 rounded-full bg-red-500 animate-pulse" />
                              {live}
                            </span>
                          ) : (
                            <span className="text-muted/50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {new Date(s.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {openId && <StoryDetailDialog storyId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
