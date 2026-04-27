/* Shared metadata tables — ZIRA industrial palette. */

import type { AgentKind, Priority, StoryStatus } from '../types'

export interface StatusMeta {
  label: string
  fg: string
  bg: string
  dot: string
  border: string
  icon: 'circle' | 'activity' | 'flag' | 'clock' | 'check'
}

/* v2 — surfaces toned down, accents as punctuation. Only ACTIVE keeps
   the full red fill (it's the verb — something's happening). CHECK
   uses cyan, DONE uses steel, BLOCK iron, TODO is a neutral plate. */
export const STATUS_META: Record<StoryStatus, StatusMeta> = {
  todo:        { label: 'TODO',   fg: 'var(--ink)',   bg: 'var(--cream-2)', dot: 'var(--muted)',   border: 'var(--rule)',    icon: 'circle' },
  in_progress: { label: 'ACTIVE', fg: 'var(--cream)', bg: 'var(--red)',     dot: 'var(--cream)',   border: 'var(--red-ink)', icon: 'activity' },
  blocked:     { label: 'BLOCK',  fg: 'var(--cream)', bg: 'var(--iron)',    dot: 'var(--cream)',   border: 'var(--iron)',    icon: 'flag' },
  review:      { label: 'CHECK',  fg: 'var(--cream)', bg: 'var(--cyan)',    dot: 'var(--cream)',   border: 'var(--cyan-2)',  icon: 'clock' },
  done:        { label: 'DONE',   fg: 'var(--cream)', bg: 'var(--steel)',   dot: 'var(--cream)',   border: 'var(--steel-2)', icon: 'check' },
}

export interface PriorityMeta {
  color: string
  label: string
  /** Bar opacities for the 3-step glyph. */
  opacities: [number, number, number]
  /** Bar heights (out of 18) for the 3-step glyph. */
  heights: [number, number, number]
  /** Legacy alias for callers still reading .opacity. */
  opacity: number
}

export const PRIO_META: Record<Priority, PriorityMeta> = {
  P0: { color: 'var(--red)',     label: 'CRITICAL', opacities: [1, 1, 1],       heights: [8, 12, 16], opacity: 1 },
  P1: { color: 'var(--red)',     label: 'URGENT',   opacities: [1, 1, 1],       heights: [6, 9, 12],  opacity: 1 },
  P2: { color: 'var(--iron)',    label: 'HIGH',     opacities: [1, 1, 0.4],     heights: [6, 9, 12],  opacity: 1 },
  P3: { color: 'var(--steel)',   label: 'MEDIUM',   opacities: [1, 0.4, 0.2],   heights: [6, 9, 12],  opacity: 0.65 },
  P4: { color: 'var(--muted)',   label: 'LOW',      opacities: [0.4, 0.2, 0.2], heights: [6, 9, 12],  opacity: 0.45 },
}

export interface AgentMeta {
  id: AgentKind
  short: string
  code: string
  color: string
  label: string
}

export const AGENTS: Record<AgentKind, AgentMeta> = {
  claude_code: { id: 'claude_code', short: 'CLAUDE', code: 'CC', color: 'var(--red)',   label: 'Claude Code' },
  cursor:      { id: 'cursor',      short: 'CURSOR', code: 'CR', color: 'var(--cyan)',  label: 'Cursor' },
  codex:       { id: 'codex',       short: 'CODEX',  code: 'CX', color: 'var(--ok)',    label: 'Codex' },
  opencode:    { id: 'opencode',    short: 'OPEN',   code: 'OP', color: 'var(--ok)',    label: 'OpenCode' },
  aider:       { id: 'aider',       short: 'AIDER',  code: 'AI', color: 'var(--iron)',  label: 'Aider' },
  local:       { id: 'local',       short: 'LOCAL',  code: 'LO', color: 'var(--muted)', label: 'Local shell' },
}
