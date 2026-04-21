// @ts-nocheck — legacy pre-Hive file; restyled for v2 ZIRA board.
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

/** Per-column header tint — ACTIVE and CHECK earn accent colour, the
 *  rest stay neutral. Matches v2 board screenshot. */
const HEAD: Record<
  StoryStatus,
  { bg: string; fg: string; border: string; rule: string }
> = {
  todo:        { bg: 'var(--cream-2)', fg: 'var(--ink)',   border: 'var(--rule)',    rule: 'var(--rule)' },
  in_progress: { bg: 'var(--red)',     fg: 'var(--cream)', border: 'var(--red-ink)', rule: 'var(--red-ink)' },
  blocked:     { bg: 'var(--iron)',    fg: 'var(--cream)', border: 'var(--iron)',    rule: 'var(--iron)' },
  review:      { bg: 'var(--cyan)',    fg: 'var(--cream)', border: 'var(--cyan-2)',  rule: 'var(--cyan-2)' },
  done:        { bg: 'var(--cream-2)', fg: 'var(--ink)',   border: 'var(--rule)',    rule: 'var(--rule)' },
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
  const h = HEAD[status]
  const code = String(stories.length).padStart(2, '0')

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-[var(--cream)] min-h-[240px] ${isOver ? 'ring-[3px] ring-[var(--red)]' : ''}`}
      style={{ border: `1.5px solid ${h.border}` }}
    >
      <header
        className="flex items-center justify-between px-3 py-2"
        style={{ background: h.bg, color: h.fg, borderBottom: `1.5px solid ${h.rule}` }}
      >
        <h2 className="label text-[11px] font-bold tracking-[0.18em] uppercase inline-flex items-center gap-2">
          {STATUS_LABEL[status]}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className="mono text-[10.5px]"
            style={{ color: h.fg, opacity: 0.75, letterSpacing: '0.05em' }}
          >
            {code}
          </span>
          <button
            type="button"
            onClick={() => onCreateStory(status)}
            className="label text-[14px] leading-none px-1"
            style={{ color: h.fg }}
            aria-label={`Add story to ${status}`}
          >
            +
          </button>
        </div>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-2">
          {stories.length === 0 ? (
            <p className="label text-[10px] tracking-[0.15em] text-[var(--muted)] text-center pt-6 uppercase">
              — empty —
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
