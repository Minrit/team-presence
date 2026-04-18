import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'

import './markdown-view.css'

const lowlight = createLowlight(common)

/** Read-only markdown renderer backed by Tiptap. Scoped under `.tp-md`.
 *  `language-mermaid` code blocks are post-processed into SVG via a
 *  dynamically-imported mermaid runtime, falling back to plain code on
 *  render failure. */
export function MarkdownView({
  source,
  className,
}: {
  source: string
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // CodeBlockLowlight replaces the StarterKit default code block.
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({
        html: false,
        breaks: true,
        linkify: true,
        transformPastedText: false,
        transformCopiedText: false,
      }),
    ],
    content: '',
  })

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(source ?? '', { emitUpdate: false })
  }, [editor, source])

  useEffect(() => {
    if (!rootRef.current) return
    renderMermaidBlocks(rootRef.current)
  }, [source])

  return (
    <div ref={rootRef} className={`tp-md ${className ?? ''}`}>
      <EditorContent editor={editor} />
    </div>
  )
}

async function renderMermaidBlocks(root: HTMLElement) {
  const targets = Array.from(
    root.querySelectorAll<HTMLElement>(
      'pre > code.language-mermaid:not([data-mermaid-rendered])',
    ),
  )
  if (targets.length === 0) return
  let mermaid: typeof import('mermaid').default | null = null
  try {
    const mod = await import('mermaid')
    mermaid = mod.default
    mermaid.initialize({ startOnLoad: false, theme: 'default' })
  } catch {
    return
  }
  for (const code of targets) {
    code.setAttribute('data-mermaid-rendered', 'true')
    const pre = code.parentElement as HTMLElement
    const src = code.textContent ?? ''
    const id = `tp-md-mermaid-${Math.random().toString(36).slice(2)}`
    try {
      const { svg } = await mermaid.render(id, src)
      const wrap = document.createElement('div')
      wrap.className = 'tp-md-mermaid'
      wrap.innerHTML = svg
      pre.replaceWith(wrap)
    } catch (err) {
      const wrap = document.createElement('div')
      wrap.className = 'tp-md-mermaid tp-md-mermaid-error'
      wrap.textContent = `mermaid render failed: ${(err as Error).message}\n\n${src}`
      pre.replaceWith(wrap)
    }
  }
}
