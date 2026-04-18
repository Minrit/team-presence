import useSWR, { mutate as globalMutate } from 'swr'
import { api } from './api'
import type { Story, StoryStatus, StoryWithTasks, Task } from './types'

export const STORIES_KEY = '/api/v1/stories'
export const storyDetailKey = (id: string) => `/api/v1/stories/${id}`

const fetcher = <T,>(path: string) => api.get<T>(path)

export function useStories() {
  return useSWR<Story[]>(STORIES_KEY, fetcher)
}

export function useStory(id: string | null | undefined) {
  return useSWR<StoryWithTasks>(id ? storyDetailKey(id) : null, fetcher)
}

// Mutations ----------------------------------------------------------------

export interface CreateStoryInput {
  title: string
  description?: string
  status?: StoryStatus
  owner_id?: string | null
  repo?: string | null
}

export interface PatchStoryInput {
  title?: string
  description?: string
  status?: StoryStatus
  owner_id?: string | null
  repo?: string | null
}

export async function createStory(input: CreateStoryInput): Promise<Story> {
  const s = await api.post<Story>(STORIES_KEY, input)
  await globalMutate(STORIES_KEY)
  return s
}

export async function patchStory(id: string, input: PatchStoryInput): Promise<Story> {
  const s = await api.patch<Story>(storyDetailKey(id), input)
  await Promise.all([globalMutate(STORIES_KEY), globalMutate(storyDetailKey(id))])
  return s
}

export async function deleteStory(id: string): Promise<void> {
  await api.delete<void>(storyDetailKey(id))
  await globalMutate(STORIES_KEY)
}

// Tasks --------------------------------------------------------------------

export interface CreateTaskInput {
  title: string
  position?: number
}

export interface PatchTaskInput {
  title?: string
  done?: boolean
  position?: number
}

export async function createTask(storyId: string, input: CreateTaskInput): Promise<Task> {
  const t = await api.post<Task>(`/api/v1/stories/${storyId}/tasks`, input)
  await Promise.all([globalMutate(STORIES_KEY), globalMutate(storyDetailKey(storyId))])
  return t
}

export async function patchTask(
  taskId: string,
  storyId: string,
  input: PatchTaskInput,
): Promise<Task> {
  const t = await api.patch<Task>(`/api/v1/tasks/${taskId}`, input)
  await Promise.all([globalMutate(STORIES_KEY), globalMutate(storyDetailKey(storyId))])
  return t
}

export async function deleteTask(taskId: string, storyId: string): Promise<void> {
  await api.delete<void>(`/api/v1/tasks/${taskId}`)
  await Promise.all([globalMutate(STORIES_KEY), globalMutate(storyDetailKey(storyId))])
}
