import { Link, useParams } from 'react-router-dom'
import StdoutStream from '../components/StdoutStream'
import TopNav from '../components/TopNav'
import { useSseRoom } from '../hooks/useSseRoom'

export default function Room() {
  const { id = '' } = useParams()
  const { entries, connected, error } = useSseRoom(id || null)

  return (
    <div className="min-h-full flex flex-col">
      <TopNav current="live" />
      <main className="flex-1 flex flex-col p-6 min-h-0">
        <header className="flex items-center justify-between mb-4">
          <div>
            <Link to="/live" className="text-xs text-muted hover:text-fg">
              ← back to live
            </Link>
            <h1 className="font-mono text-sm mt-1">room · {id.slice(0, 8)}</h1>
          </div>
          <div className="text-xs text-muted flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 ${
                connected ? 'text-emerald-500' : 'text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block size-2 rounded-full ${
                  connected ? 'bg-emerald-500' : 'bg-muted/50'
                }`}
              />
              {connected ? 'connected' : 'reconnecting…'}
            </span>
            {error && <span className="text-red-500">{error}</span>}
          </div>
        </header>
        <StdoutStream entries={entries} />
      </main>
    </div>
  )
}
