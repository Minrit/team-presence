import { useNavigate } from 'react-router-dom'
import { Avatar, userToAvatar } from '../../design/Avatar'
import { Icon } from '../../design/Icon'
import { LiveDot } from '../../design/LiveDot'
import { Priority } from '../../design/Priority'
import { ProgressBar } from '../../design/ProgressBar'
import { StoryId } from '../../design/StoryId'
import type { Epic, GridTile, Story, User } from '../../types'

/** Read-only card. Clicking navigates to /story/:id. Drag-and-drop was
 *  removed in the AI-native refactor — status moves happen via MCP tools. */
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

  const epic = story.epic_id ? epics[story.epic_id] : undefined
  const tiles = (tilesByStory[story.id] ?? []).filter((t) => !t.ended_at)
  const acDone = story.acceptance_criteria.filter((a) => a.done).length
  const acTotal = story.acceptance_criteria.length

  return (
    <div
      onClick={() => navigate(`/story/${story.id}`)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
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

      <div
        style={{
          font: '500 13.5px/1.35 var(--font)',
          color: 'var(--hv-fg)',
        }}
      >
        {story.name}
      </div>

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
  )
}
