import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import KanbanColumn from '../components/KanbanColumn'
import StoryDetailDialog from '../components/StoryDetailDialog'
import { createStory, patchStory, useStories } from '../stories'
import { STATUSES, type Story, type StoryStatus } from '../types'
import { useAuth } from '../auth'

export default function Kanban() {
  const { data: stories, error, isLoading, mutate } = useStories()
  const { user, signOut } = useAuth()
  const [openId, setOpenId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const grouped = useMemo(() => {
    const g: Record<StoryStatus, Story[]> = { todo: [], doing: [], done: [] }
    for (const s of stories ?? []) g[s.status].push(s)
    return g
  }, [stories])

  const onDragEnd = async (e: DragEndEvent) => {
    if (!stories) return
    const storyId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (!overId) return

    // `over` is either a column droppable `col:<status>` or a card id. Resolve → target status.
    let target: StoryStatus | null = null
    if (overId.startsWith('col:')) {
      target = overId.slice(4) as StoryStatus
    } else {
      const overStory = stories.find((s) => s.id === overId)
      if (overStory) target = overStory.status
    }
    if (!target) return

    const moving = stories.find((s) => s.id === storyId)
    if (!moving || moving.status === target) return

    // Optimistic update.
    const next = stories.map((s) => (s.id === storyId ? { ...s, status: target! } : s))
    mutate(next, { revalidate: false })

    try {
      await patchStory(storyId, { status: target })
    } catch (err) {
      mutate(stories, { revalidate: false })
      alert(`Update failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const createInColumn = async (status: StoryStatus) => {
    const title = prompt('Story title')?.trim()
    if (!title) return
    const s = await createStory({ title, status })
    setOpenId(s.id)
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-6">
          <h1 className="font-semibold">team-presence</h1>
          <nav className="text-sm text-muted flex gap-4">
            <span className="text-fg">Kanban</span>
            <span className="opacity-60 cursor-not-allowed" title="Live grid ships in Unit 8">
              Live
            </span>
          </nav>
        </div>
        <div className="text-sm text-muted flex items-center gap-3">
          <span>{user?.display_name ?? user?.email}</span>
          <button
            type="button"
            onClick={signOut}
            className="hover:text-fg"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {isLoading && <p className="text-muted">Loading…</p>}
        {error && <p className="text-red-500">Failed to load stories: {String(error)}</p>}
        {stories && (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
              {STATUSES.map((s) => (
                <KanbanColumn
                  key={s}
                  status={s}
                  stories={grouped[s]}
                  onOpenStory={setOpenId}
                  onCreateStory={createInColumn}
                />
              ))}
            </div>
          </DndContext>
        )}
      </main>

      {openId && <StoryDetailDialog storyId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
