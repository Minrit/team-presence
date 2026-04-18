import { EmptyPanel } from './EmptyPanel'

export function ChangesPanel(_props: { sessionId: string | null }) {
  return (
    <EmptyPanel
      title="Changes"
      hint="Will aggregate tool=edit_file/write_file frames + adjacent diff-add / diff-del counts. Wired in Unit 24."
      icon="branch"
    />
  )
}
