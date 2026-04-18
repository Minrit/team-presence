import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Story, StoryStatus } from '../types'
import { STATUS_LABEL } from '../types'
import StoryCard from './StoryCard'
import type { StoryActivity } from '../hooks/useStoryActivity'

export interface KanbanColumnProps {
  status: StoryStatus
  stories: Story[]
  onOpenStory: (id: string) => void
  onCreateStory: (status: StoryStatus) => void
  activity: Map<string, StoryActivity>
}

export default function KanbanColumn({
  status,
  stories,
  onOpenStory,
  onCreateStory,
  activity,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` })
  const ids = stories.map((s) => s.id)

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border border-border bg-card/40 p-3 min-h-[200px] ${
        isOver ? 'ring-2 ring-accent/50' : ''
      }`}
    >
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {STATUS_LABEL[status]}{' '}
          <span className="ml-1 text-muted/70">{stories.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => onCreateStory(status)}
          className="text-xs text-muted hover:text-accent"
          aria-label={`Add story to ${status}`}
        >
          +
        </button>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2">
          {stories.length === 0 ? (
            <p className="text-xs text-muted/70 text-center pt-6">
              No stories here yet
            </p>
          ) : (
            stories.map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                onOpen={() => onOpenStory(s.id)}
                activity={activity.get(s.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}
