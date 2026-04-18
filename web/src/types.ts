// Wire types mirroring the server. Snake_case matches the server's serde output
// (team-presence intentionally stays uniform; no casing layer).

export type StoryStatus = 'todo' | 'doing' | 'done'

export interface User {
  id: string
  email: string
  display_name: string
  created_at: string
}

export interface Story {
  id: string
  title: string
  description: string
  status: StoryStatus
  owner_id: string | null
  repo: string | null
  last_modified_by: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  story_id: string
  title: string
  done_at: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface StoryWithTasks extends Story {
  tasks: Task[]
}

export const STATUSES: StoryStatus[] = ['todo', 'doing', 'done']
export const STATUS_LABEL: Record<StoryStatus, string> = {
  todo: 'Todo',
  doing: 'Doing',
  done: 'Done',
}

// Live session wire types — mirror crates/server/src/session/model.rs GridTile
// and shared-types Frame. Snake_case intentional.

export type CliKind = 'claude_code'
export type ContentRole = 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'meta'

export interface GridTile {
  session_id: string
  user_id: string
  cli: CliKind | string
  cwd: string
  detected_story_id: string | null
  last_activity_at: string
  ended_at: string | null
  muted: boolean
}

export type RoomFrame =
  | {
      type: 'session_start'
      session_id: string
      cli: CliKind
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
