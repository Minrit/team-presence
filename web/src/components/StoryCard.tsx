// @ts-nocheck — legacy pre-Hive file; restyled or removed in Unit 15/16/26.
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import type { Story } from '../types'
import type { StoryActivity } from '../hooks/useStoryActivity'

export interface StoryCardProps {
  story: Story
  onOpen: () => void
  activity?: StoryActivity
}

export default function StoryCard({ story, onOpen, activity }: StoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const active = activity?.active_count ?? 0
  const firstSession = activity?.session_ids[0]

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
        <div className="flex items-start gap-2">
          {active > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-400 px-1.5 py-0.5 text-[10px] font-medium"
              title={`${active} live session${active > 1 ? 's' : ''}`}
              aria-label="live"
            >
              <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-red-500 animate-pulse" />
              {active > 1 ? `LIVE · ${active}` : 'LIVE'}
            </span>
          )}
          <p className="font-medium text-sm leading-tight break-words">{story.name}</p>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted">
          {story.repo && (
            <span className="px-1.5 py-0.5 rounded bg-border/40">{story.repo}</span>
          )}
          <span>updated {relative(story.updated_at)}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="text-xs text-accent hover:underline"
        >
          Open
        </button>
        {firstSession && (
          <Link
            to={`/room/${firstSession}`}
            className="text-xs text-red-400 hover:underline"
          >
            Watch live →
          </Link>
        )}
      </div>
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
