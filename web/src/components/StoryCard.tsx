import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Story } from '../types'

export interface StoryCardProps {
  story: Story
  onOpen: () => void
}

export default function StoryCard({ story, onOpen }: StoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border border-border rounded-lg p-3 shadow-sm hover:border-accent/50 transition-colors"
    >
      {/* Drag handle — whole card except the title click */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
        aria-label="Drag story"
      >
        <p className="font-medium text-sm leading-tight break-words">{story.title}</p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted">
          {story.repo && (
            <span className="px-1.5 py-0.5 rounded bg-border/40">{story.repo}</span>
          )}
          <span>updated {relative(story.updated_at)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 text-xs text-accent hover:underline"
      >
        Open
      </button>
    </div>
  )
}

function relative(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diffMs / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
