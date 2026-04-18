/** Memoized projection of a session's `tool_use` + stdout frames.
 *  Rides piggy-back on the existing useSseRoom buffer so Changes / Runs
 *  panels don't require a new endpoint. */

import { useMemo } from 'react'
import { useSseRoom } from './useSseRoom'
import type { RoomFrame } from '../types'

export interface ToolFrame {
  ts: string
  name: string
  payload: string
}

export interface StdoutRun {
  id: string
  ts: string
  command: string
  outputTail: string
  status: 'passed' | 'failed' | 'running'
}

export interface FileEdit {
  path: string
  add: number
  del: number
}

export interface SessionTools {
  changes: FileEdit[]
  runs: StdoutRun[]
  connected: boolean
}

const RUN_HINT = /(?:pass|passing|ok|✓)/i
const FAIL_HINT = /(?:fail|error|FAILED|✗)/i

export function useSessionTools(sessionId: string | null): SessionTools {
  const { entries, connected } = useSseRoom(sessionId)

  return useMemo(() => {
    const changes = new Map<string, FileEdit>()
    const runs: StdoutRun[] = []
    let activeRun: StdoutRun | null = null

    for (const e of entries) {
      const f = e.frame
      if (f.type === 'session_content') {
        if (f.role === 'tool_use') {
          // Treat the text as a one-line tool descriptor: "edit_file path=..."
          // Heuristic: the collector currently emits role=tool_use with the
          // tool name + args JSON-ish. Support both:
          //   edit_file / write_file → bump counts against the path token
          //   run / bash → start a StdoutRun
          const { tool, target, rest } = splitTool(f.text)
          if (tool === 'edit_file' || tool === 'write_file') {
            const cur = changes.get(target ?? '(unknown)') ?? {
              path: target ?? '(unknown)',
              add: 0,
              del: 0,
            }
            changes.set(cur.path, cur)
          } else if (tool === 'run' || tool === 'bash') {
            activeRun = {
              id: e.id,
              ts: f.ts,
              command: (target ?? rest ?? '').slice(0, 160),
              outputTail: '',
              status: 'running',
            }
            runs.push(activeRun)
          }
          continue
        }
        // Count diff lines toward the most recent file edit (best-effort).
        if (f.role === 'tool_result' || f.role === 'assistant') {
          const last = lastEntry(changes)
          if (last) {
            for (const line of f.text.split(/\r?\n/)) {
              if (line.startsWith('+') && !line.startsWith('+++')) last.add++
              else if (line.startsWith('-') && !line.startsWith('---')) last.del++
            }
          }
          if (activeRun) {
            activeRun.outputTail =
              (activeRun.outputTail + '\n' + f.text).trim().slice(-400)
            if (FAIL_HINT.test(f.text)) activeRun.status = 'failed'
            else if (RUN_HINT.test(f.text)) activeRun.status = 'passed'
          }
        }
      }
    }

    return {
      changes: Array.from(changes.values()),
      runs,
      connected,
    }
  }, [entries, connected])
}

function lastEntry(m: Map<string, FileEdit>): FileEdit | undefined {
  let last: FileEdit | undefined
  for (const v of m.values()) last = v
  return last
}

function splitTool(text: string): { tool: string | null; target: string | null; rest: string | null } {
  const trimmed = text.trim()
  if (!trimmed) return { tool: null, target: null, rest: null }
  const [head, ...rest] = trimmed.split(/\s+/)
  const restStr = rest.join(' ')
  // Try to tease out path=... or the first arg.
  const m = restStr.match(/(?:path|file)[=:]\s*([^\s,"']+)/i)
  return {
    tool: head.toLowerCase(),
    target: m?.[1] ?? rest[0] ?? null,
    rest: restStr,
  }
}

// Keep the import graph from eagerly pruning RoomFrame types.
export type { RoomFrame }
