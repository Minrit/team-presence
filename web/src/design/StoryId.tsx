/** Compact id chip: `HIV-042` / first 6 of a uuid. */
export function StoryId({ id }: { id: string }) {
  const short = id.length > 12 ? id.slice(0, 6).toUpperCase() : id
  return (
    <span
      style={{
        font: '500 12px/1 var(--mono)',
        color: 'var(--fg-3)',
        letterSpacing: 0.2,
      }}
    >
      {short}
    </span>
  )
}
