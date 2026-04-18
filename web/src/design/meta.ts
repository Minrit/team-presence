/* Shared metadata tables ported from Hive design
   (/tmp/hive-design/nb/project/src/ModernUI.jsx). */

import type { AgentKind, Priority, StoryStatus } from '../types'

export interface StatusMeta {
  label: string
  fg: string
  bg: string
  dot: string
  icon: 'circle' | 'activity' | 'flag' | 'clock' | 'check'
}

export const STATUS_META: Record<StoryStatus, StatusMeta> = {
  todo:        { label: 'Todo',        fg: '#71717a', bg: '#f4f4f5', dot: '#a1a1aa', icon: 'circle' },
  in_progress: { label: 'In progress', fg: '#4f46e5', bg: '#eef2ff', dot: '#6366f1', icon: 'activity' },
  blocked:     { label: 'Blocked',     fg: '#dc2626', bg: '#fef2f2', dot: '#ef4444', icon: 'flag' },
  review:      { label: 'In review',   fg: '#7c3aed', bg: '#f5f3ff', dot: '#a855f7', icon: 'clock' },
  done:        { label: 'Done',        fg: '#059669', bg: '#ecfdf5', dot: '#10b981', icon: 'check' },
}

export interface PriorityMeta {
  color: string
  label: string
  /** Bar heights for the 3-bar SVG glyph. */
  heights: [number, number, number]
  /** Opacity of the bars. */
  opacity: number
}

export const PRIO_META: Record<Priority, PriorityMeta> = {
  P1: { color: '#ef4444', label: 'Urgent', heights: [4, 6, 8], opacity: 1 },
  P2: { color: '#f59e0b', label: 'High',   heights: [4, 6, 6], opacity: 0.85 },
  P3: { color: '#71717a', label: 'Medium', heights: [3, 5, 6], opacity: 0.6 },
  P4: { color: '#a1a1aa', label: 'Low',    heights: [3, 4, 5], opacity: 0.45 },
}

export interface AgentMeta {
  id: AgentKind
  short: string
  color: string
  label: string
}

export const AGENTS: Record<AgentKind, AgentMeta> = {
  claude_code: { id: 'claude_code', short: 'Claude', color: '#d97706', label: 'Claude Code' },
  cursor:      { id: 'cursor',      short: 'Cursor', color: '#6366f1', label: 'Cursor' },
  codex:       { id: 'codex',       short: 'Codex',  color: '#10b981', label: 'Codex' },
  aider:       { id: 'aider',       short: 'Aider',  color: '#8b5cf6', label: 'Aider' },
  local:       { id: 'local',       short: 'Local',  color: '#71717a', label: 'Local shell' },
}
