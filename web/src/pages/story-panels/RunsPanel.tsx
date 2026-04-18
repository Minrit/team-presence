import { EmptyPanel } from './EmptyPanel'

export function RunsPanel(_props: { sessionId: string | null }) {
  return (
    <EmptyPanel
      title="Runs"
      hint="Will list tool=run frames + exit signals derived from the stdout tail. Wired in Unit 24."
      icon="play"
    />
  )
}
