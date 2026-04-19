import { StarterKit } from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Placeholder } from '@tiptap/extension-placeholder'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'

const lowlight = createLowlight(common)

export interface TiptapExtensionOptions {
  placeholder?: string
}

/** Shared Tiptap extension set used by both the read-only `<MarkdownView>`
 *  and the editable `<MarkdownEditor>`. Keeping a single source ensures the
 *  markdown round-trip (read → edit → save) is lossless. */
export function createTiptapExtensions(opts: TiptapExtensionOptions = {}) {
  return [
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
    Placeholder.configure({
      placeholder: opts.placeholder ?? '',
      emptyEditorClass: 'tp-md-empty',
    }),
    Markdown.configure({
      html: false,
      breaks: true,
      linkify: true,
      transformPastedText: false,
      transformCopiedText: false,
    }),
  ]
}
