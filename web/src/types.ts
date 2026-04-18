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
