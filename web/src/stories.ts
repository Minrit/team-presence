import useSWR, { mutate as globalMutate } from 'swr'
import { api } from './api'
import type {
  AcceptanceCriterion,
  Comment,
  Epic,
  Priority,
  Story,
  StoryActivity,
  StoryRelations,
  StoryStatus,
} from './types'

export const STORIES_KEY = '/api/v1/stories'
export const storyDetailKey = (id: string) => `/api/v1/stories/${id}`
export const storyActivityKey = (id: string) => `/api/v1/stories/${id}/activity`
export const storyRelationsKey = (id: string) => `/api/v1/stories/${id}/relations`
export const storyCommentsKey = (id: string) => `/api/v1/stories/${id}/comments`
export const EPICS_KEY = '/api/v1/epics'

const fetcher = <T,>(path: string) => api.get<T>(path)

export function useStories(sprintId?: string | null) {
  const key = sprintId ? `${STORIES_KEY}?sprint=${encodeURIComponent(sprintId)}` : STORIES_KEY
  return useSWR<Story[]>(key, fetcher)
}

export function useStory(id: string | null | undefined) {
  return useSWR<Story>(id ? storyDetailKey(id) : null, fetcher)
}

export function useEpics() {
  return useSWR<Epic[]>(EPICS_KEY, fetcher)
}

export function useStoryActivity(id: string | null | undefined) {
  return useSWR<StoryActivity[]>(id ? storyActivityKey(id) : null, fetcher)
}

export function useStoryRelations(id: string | null | undefined) {
  return useSWR<StoryRelations>(id ? storyRelationsKey(id) : null, fetcher)
}

export function useComments(id: string | null | undefined) {
  return useSWR<Comment[]>(id ? storyCommentsKey(id) : null, fetcher)
}

// Mutations ----------------------------------------------------------------

export interface CreateStoryInput {
  name: string
  description?: string
  acceptance_criteria?: AcceptanceCriterion[]
  status?: StoryStatus
  owner_id?: string | null
  repo?: string | null
  sprint_id?: string | null
  priority?: Priority | null
  points?: number | null
  epic_id?: string | null
  branch?: string | null
  pr_ref?: string | null
}

export interface PatchStoryInput {
  name?: string
  description?: string
  acceptance_criteria?: AcceptanceCriterion[]
  status?: StoryStatus
  owner_id?: string | null
  repo?: string | null
  sprint_id?: string | null
  priority?: Priority | null
  points?: number | null
  epic_id?: string | null
  branch?: string | null
  pr_ref?: string | null
}

export async function createStory(input: CreateStoryInput): Promise<Story> {
  const s = await api.post<Story>(STORIES_KEY, input)
  await mutateAllStoryLists()
  return s
}

export async function patchStory(id: string, input: PatchStoryInput): Promise<Story> {
  const s = await api.patch<Story>(storyDetailKey(id), input)
  await Promise.all([
    mutateAllStoryLists(),
    globalMutate(storyDetailKey(id)),
    globalMutate(storyActivityKey(id)),
  ])
  return s
}

export async function deleteStory(id: string): Promise<void> {
  await api.delete<void>(storyDetailKey(id))
  await mutateAllStoryLists()
}

export async function postComment(storyId: string, body: string): Promise<Comment> {
  const c = await api.post<Comment>(storyCommentsKey(storyId), { body })
  await Promise.all([
    globalMutate(storyCommentsKey(storyId)),
    globalMutate(storyActivityKey(storyId)),
  ])
  return c
}

export async function claimStory(id: string, userId: string): Promise<Story> {
  return patchStory(id, { status: 'in_progress', owner_id: userId })
}

async function mutateAllStoryLists() {
  await globalMutate(
    (key) => typeof key === 'string' && key.startsWith(STORIES_KEY),
    undefined,
    { revalidate: true },
  )
}
