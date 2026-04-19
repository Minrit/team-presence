import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'

import { createTiptapExtensions } from './tiptap-extensions'
import './markdown-view.css'

export interface MarkdownEditorProps {
  value: string
  onChange: (md: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  /** When true, renders a compact toolbar above the editor. */
  toolbar?: boolean
  /** Debounce onChange in ms. Defaults to 200. Set to 0 to disable. */
  debounceMs?: number
}

/** Editable markdown editor backed by Tiptap, sharing the same extension set
 *  as `<MarkdownView>` so round-trips are lossless. onChange fires debounced
 *  with a fresh Markdown string extracted via tiptap-markdown. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
  toolbar = true,
  debounceMs = 200,
}: MarkdownEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Undefined until the editor has loaded content at least once — so the
  // very first effect run always calls setContent, even when the parent
  // passes a non-empty `value` on mount (description prefill).
  const pendingValue = useRef<string | undefined>(undefined)

  const editor = useEditor({
    editable: true,
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    extensions: createTiptapExtensions({ placeholder }),
    content: '',
    onUpdate({ editor }) {
      // Read markdown straight from storage rather than HTML to avoid double
      // conversions; debounce so fast typing doesn't flood the network.
      const md = readMarkdown(editor)
      pendingValue.current = md
      if (debounceMs === 0) {
        onChange(md)
        return
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => onChange(md), debounceMs)
    },
  })

  // Load / reset content when the external `value` changes. Skip if the
  // incoming value already matches what we just emitted — otherwise the
  // parent's setState-from-onChange would wipe the caret mid-type.
  useEffect(() => {
    if (!editor) return
    if (value === pendingValue.current) return
    editor.commands.setContent(value ?? '', { emitUpdate: false })
    pendingValue.current = value
  }, [editor, value])

  // Flush any pending debounced change on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        const pv = pendingValue.current
        if (pv !== undefined && pv !== value) onChange(pv)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`tp-md tp-md-editable ${className ?? ''}`}>
      {toolbar && <MarkdownToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } }
  return storage.markdown?.getMarkdown?.() ?? editor.getText()
}

function MarkdownToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--hv-fg)' : 'var(--fg-3)',
    border: `1px solid ${active ? 'var(--hv-accent)' : 'var(--hv-border)'}`,
    borderRadius: 'var(--radius-sm)',
    font: '500 11.5px/1 var(--mono)',
    cursor: 'pointer',
  })
  const onLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('URL', prev ?? 'https://')
    if (href === null) return
    if (href === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
  }
  return (
    <div
      className="tp-md-toolbar"
      style={{
        display: 'flex',
        gap: 4,
        padding: '4px 4px 8px 4px',
        borderBottom: '1px solid var(--hv-border)',
        marginBottom: 6,
      }}
    >
      <button
        type="button"
        style={btnStyle(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (⌘B)"
      >
        B
      </button>
      <button
        type="button"
        style={{ ...btnStyle(editor.isActive('italic')), fontStyle: 'italic' }}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (⌘I)"
      >
        I
      </button>
      <button
        type="button"
        style={btnStyle(editor.isActive('code'))}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        {'<>'}
      </button>
      <button
        type="button"
        style={btnStyle(editor.isActive('codeBlock'))}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        {'{ }'}
      </button>
      <button
        type="button"
        style={btnStyle(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        •
      </button>
      <button
        type="button"
        style={btnStyle(editor.isActive('taskList'))}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Task list"
      >
        ☐
      </button>
      <button
        type="button"
        style={btnStyle(editor.isActive('link'))}
        onClick={onLink}
        title="Link"
      >
        ↗
      </button>
    </div>
  )
}
