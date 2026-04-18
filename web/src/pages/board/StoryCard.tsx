import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import { Avatar, userToAvatar } from '../../design/Avatar'
import { Icon } from '../../design/Icon'
import { LiveDot } from '../../design/LiveDot'
import { Priority } from '../../design/Priority'
import { ProgressBar } from '../../design/ProgressBar'
import { StoryId } from '../../design/StoryId'
import type { Epic, GridTile, Story, User } from '../../types'

export function StoryCard({
  story,
  epics,
  tilesByStory,
  owner,
}: {
  story: Story
  epics: Record<string, Epic>
  tilesByStory: Record<string, GridTile[]>
  owner?: User
}) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: story.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const epic = story.epic_id ? epics[story.epic_id] : undefined
  const tiles = (tilesByStory[story.id] ?? []).filter((t) => !t.ended_at)
  const acDone = story.acceptance_criteria.filter((a) => a.done).length
  const acTotal = story.acceptance_criteria.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Avoid nav while actively dragging.
        if (isDragging) return
        if ((e.target as HTMLElement).dataset?.nodrag === 'true') return
        navigate(`/story/${story.id}`)
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hv-border)',
          borderRadius: 'var(--radius)',
          padding: '10px 12px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          cursor: 'grab',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = 'var(--shadow-md)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        }}
      >
        {/* Top row: id + epic + priority */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StoryId id={story.id} />
          {epic && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: epic.color,
                flexShrink: 0,
              }}
              title={epic.name}
            />
          )}
          <div style={{ flex: 1 }} />
          {story.priority && <Priority level={story.priority} />}
        </div>

        {/* Title */}
        <div
          style={{
            font: '500 13.5px/1.35 var(--font)',
            color: 'var(--hv-fg)',
          }}
        >
          {story.name}
        </div>

        {/* AC progress */}
        {acTotal > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ProgressBar value={acDone} total={acTotal} />
            <div
              style={{
                font: '400 11px/1 var(--mono)',
                color: 'var(--fg-3)',
              }}
            >
              {acDone} / {acTotal}
            </div>
          </div>
        )}

        {/* Footer: avatar + points + live sessions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {owner && <Avatar user={userToAvatar(owner, 'active')} size={20} />}
          <div style={{ flex: 1 }} />
          {story.points != null && (
            <span
              style={{
                font: '500 11px/1 var(--mono)',
                color: 'var(--fg-3)',
              }}
            >
              {story.points} pt
            </span>
          )}
          {tiles.length > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                font: '500 11px/1 var(--font)',
                color: 'var(--fg-3)',
              }}
            >
              <Icon name="terminal" size={11} color="var(--fg-3)" />
              <LiveDot size={5} />
              {tiles.length}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
