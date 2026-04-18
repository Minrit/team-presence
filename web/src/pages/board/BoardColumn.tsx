import { StatusIcon } from '../../design/StatusIcon'
import { STATUS_META } from '../../design/meta'
import { StoryCard } from './StoryCard'
import type { Epic, GridTile, Story, StoryStatus, User } from '../../types'

/** Read-only column. Previously droppable for dnd-kit; now purely a list. */
export function BoardColumn({
  status,
  stories,
  epics,
  tilesByStory,
  usersById,
}: {
  status: StoryStatus
  stories: Story[]
  epics: Record<string, Epic>
  tilesByStory: Record<string, GridTile[]>
  usersById: Record<string, User>
}) {
  const meta = STATUS_META[status]

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 4px',
        }}
      >
        <StatusIcon status={status} />
        <span
          style={{
            font: '600 12.5px/1 var(--font)',
            color: 'var(--hv-fg)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {meta.label}
        </span>
        <span
          style={{
            font: '500 11px/1 var(--mono)',
            color: 'var(--fg-3)',
            padding: '2px 6px',
            background: 'var(--bg-2)',
            borderRadius: 10,
          }}
        >
          {stories.length}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 6,
        }}
      >
        {stories.map((s) => (
          <StoryCard
            key={s.id}
            story={s}
            epics={epics}
            tilesByStory={tilesByStory}
            owner={s.owner_id ? usersById[s.owner_id] : undefined}
          />
        ))}
        {stories.length === 0 && (
          <div
            style={{
              padding: 18,
              textAlign: 'center',
              font: '400 12px/1.4 var(--font)',
              color: 'var(--fg-4)',
            }}
          >
            —
          </div>
        )}
      </div>
    </div>
  )
}
