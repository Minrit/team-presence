/** Visual placeholder for screens that land in later units.
 *  Rendered inside the Hive shell so routing + shell feel honest while
 *  Units 15-22 ship the real content. */
export function Placeholder({
  title,
  hint,
}: {
  title: string
  hint: string
}) {
  return (
    <div
      style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        color: 'var(--fg-2)',
        font: '400 13px/1.5 var(--font)',
      }}
    >
      <div
        style={{
          font: '600 18px/1.2 var(--font)',
          color: 'var(--hv-fg)',
        }}
      >
        {title}
      </div>
      <div style={{ color: 'var(--fg-3)' }}>{hint}</div>
    </div>
  )
}
