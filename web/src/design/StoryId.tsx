/** Stamped serial — steel tag + mono id, ZIRA industrial style. */
export function StoryId({ id }: { id: string }) {
  const short = id.length > 12 ? id.slice(0, 6).toUpperCase() : id
  return (
    <span
      className="mono"
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        background: 'var(--steel)',
        color: 'var(--cream)',
        font: '600 11px/1 var(--mono)',
        letterSpacing: '0.08em',
      }}
    >
      {short}
    </span>
  )
}
