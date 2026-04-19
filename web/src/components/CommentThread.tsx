import { useState } from 'react'
import { useAuth } from '../auth'
import { deleteComment, patchComment, postComment, useComments } from '../stories'
import type { Comment, User } from '../types'

/** Comment list + single-line composer + inline edit / delete for the
 *  current viewer's own comments. Body is plain text (⌘↵ posts) —
 *  Markdown in comments is intentionally out of scope for now. */
export function CommentThread({
  storyId,
  usersById,
}: {
  storyId: string
  usersById: Record<string, User>
}) {
  const { user } = useAuth()
  const { data: comments } = useComments(storyId)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function handlePost() {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      await postComment(storyId, body)
      setDraft('')
    } catch (err) {
      alert(`Post failed: ${msg(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit(commentId: string) {
    const body = editDraft.trim()
    if (!body) return
    try {
      await patchComment(storyId, commentId, body)
      setEditingId(null)
      setEditDraft('')
    } catch (err) {
      alert(`Edit failed: ${msg(err)}`)
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return
    try {
      await deleteComment(storyId, commentId)
    } catch (err) {
      alert(`Delete failed: ${msg(err)}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ font: '600 13px/1 var(--font)' }}>Comments</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(comments ?? []).map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            author={usersById[c.author_id]}
            canEdit={user?.id === c.author_id}
            editing={editingId === c.id}
            editDraft={editDraft}
            onStartEdit={() => {
              setEditingId(c.id)
              setEditDraft(c.body)
            }}
            onCancelEdit={() => {
              setEditingId(null)
              setEditDraft('')
            }}
            onChangeEdit={setEditDraft}
            onSaveEdit={() => handleSaveEdit(c.id)}
            onDelete={() => handleDelete(c.id)}
          />
        ))}
        {(!comments || comments.length === 0) && (
          <div style={{ font: '400 12.5px/1.5 var(--font)', color: 'var(--fg-4)' }}>
            No comments yet.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              void handlePost()
            }
          }}
          placeholder="Leave a comment…  (⌘↵ to post)"
          rows={2}
          style={{
            flex: 1,
            padding: 8,
            background: 'var(--surface)',
            color: 'var(--hv-fg)',
            border: '1px solid var(--hv-border)',
            borderRadius: 'var(--radius-sm)',
            font: '400 13px/1.45 var(--font)',
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={busy || !draft.trim()}
          style={{
            padding: '6px 12px',
            background: draft.trim() ? 'var(--hv-accent)' : 'var(--bg-2)',
            color: draft.trim() ? 'white' : 'var(--fg-4)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            font: '500 12.5px/1 var(--font)',
            cursor: draft.trim() && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          Post
        </button>
      </div>
    </div>
  )
}

function CommentRow({
  comment,
  author,
  canEdit,
  editing,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  onDelete,
}: {
  comment: Comment
  author: User | undefined
  canEdit: boolean
  editing: boolean
  editDraft: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onChangeEdit: (v: string) => void
  onSaveEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--bg-2)',
        border: '1px solid var(--hv-border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ font: '600 12px/1 var(--font)', color: 'var(--hv-fg)' }}>
          {author?.display_name ?? comment.author_id.slice(0, 6)}
        </div>
        <div style={{ font: '400 11px/1 var(--mono)', color: 'var(--fg-3)' }}>
          {shortTime(comment.created_at)}
        </div>
        <div style={{ flex: 1 }} />
        {canEdit && !editing && (
          <>
            <TextButton onClick={onStartEdit}>Edit</TextButton>
            <TextButton onClick={onDelete} danger>
              Delete
            </TextButton>
          </>
        )}
        {editing && (
          <>
            <TextButton onClick={onSaveEdit}>Save</TextButton>
            <TextButton onClick={onCancelEdit}>Cancel</TextButton>
          </>
        )}
      </div>
      {!editing && (
        <div
          style={{
            font: '400 13px/1.5 var(--font)',
            color: 'var(--hv-fg)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {comment.body}
        </div>
      )}
      {editing && (
        <textarea
          value={editDraft}
          onChange={(e) => onChangeEdit(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onSaveEdit()
            }
          }}
          rows={Math.max(2, editDraft.split('\n').length)}
          autoFocus
          style={{
            width: '100%',
            padding: 8,
            background: 'var(--surface)',
            color: 'var(--hv-fg)',
            border: '1px solid var(--hv-accent)',
            borderRadius: 'var(--radius-sm)',
            font: '400 13px/1.45 var(--font)',
            resize: 'vertical',
          }}
        />
      )}
    </div>
  )
}

function TextButton({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: danger ? 'var(--danger)' : 'var(--hv-accent)',
        font: '500 11.5px/1 var(--font)',
        cursor: 'pointer',
        padding: 2,
      }}
    >
      {children}
    </button>
  )
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
