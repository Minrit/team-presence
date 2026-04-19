// Wire types mirroring the server. Snake_case matches the server's serde output.

export type StoryStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done'
export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4'

export interface User {
  id: string
  email: string
  display_name: string
  created_at: string
}

export interface AcceptanceCriterion {
  text: string
  done: boolean
}

export interface Story {
  id: string
  name: string
  description: string
  acceptance_criteria: AcceptanceCriterion[]
  status: StoryStatus
  owner_id: string | null
  repo: string | null
  sprint_id: string | null
  priority: Priority | null
  points: number | null
  epic_id: string | null
  branch: string | null
  pr_ref: string | null
  last_modified_by: string
  created_at: string
  updated_at: string
}

export interface Sprint {
  id: string
  name: string
  start_date: string // YYYY-MM-DD
  end_date: string
  created_at: string
  updated_at: string
}

export interface Epic {
  id: string
  name: string
  color: string
  description: string
  created_at: string
}

export interface StoryActivity {
  id: string
  story_id: string
  actor_type: 'user' | 'agent' | 'system'
  actor_ref: string
  kind: string
  text: string
  ref: string | null
  created_at: string
}

export interface StoryRelations {
  blocks: string[]
  blocked_by: string[]
}

export interface Comment {
  id: string
  story_id: string
  author_id: string
  body: string
  created_at: string
}

export const STATUSES: StoryStatus[] = ['todo', 'in_progress', 'blocked', 'review', 'done']
export const STATUS_LABEL: Record<StoryStatus, string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  blocked: 'Blocked',
  review: 'In review',
  done: 'Done',
}

// Live session wire types — mirror crates/server/src/session/model.rs GridTile
// and shared-types Frame. Snake_case intentional.

export type AgentKind = 'claude_code' | 'cursor' | 'codex' | 'aider' | 'local'
/** Legacy alias; collector frame uses `cli` on the wire for v1 compat. */
export type CliKind = AgentKind
export type ContentRole = 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'meta'

export interface GridTile {
  session_id: string
  user_id: string
  agent_kind: AgentKind | string
  cwd: string
  detected_story_id: string | null
  last_heartbeat_at: string
  last_activity_at: string
  ended_at: string | null
  muted: boolean
}

export interface SessionMetaLite {
  id: string
  user_id: string
  agent_kind: AgentKind | string
  cwd: string
  detected_story_id: string | null
  started_at: string
  ended_at: string | null
}

export type RoomFrame =
  | {
      type: 'session_start'
      session_id: string
      cli: AgentKind
      cwd: string
      git_remote: string | null
      git_branch: string | null
      transcript_path: string | null
      started_at: string
    }
  | {
      type: 'session_content'
      session_id: string
      role: ContentRole
      text: string
      ts: string
    }
  | {
      type: 'session_end'
      session_id: string
      ended_at: string
      exit_code: number | null
    }
  | {
      type: 'heartbeat'
      sent_at: string
      active_session_ids: string[]
      muted: boolean
    }
