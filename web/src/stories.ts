import useSWR, { mutate as globalMutate } from 'swr'
import { api } from './api'
import type { Story, StoryStatus } from './types'

export const STORIES_KEY = '/api/v1/stories'
export const storyDetailKey = (id: string) => `/api/v1/stories/${id}`

const fetcher = <T,>(path: string) => api.get<T>(path)

export function useStories(sprintId?: string | null) {
  // Server filters by sprint if query param present.
  const key = sprintId ? `${STORIES_KEY}?sprint=${encodeURIComponent(sprintId)}` : STORIES_KEY
  return useSWR<Story[]>(key, fetcher)
}

export function useStory(id: string | null | undefined) {
  return useSWR<Story>(id ? storyDetailKey(id) : null, fetcher)
}

// Mutations ----------------------------------------------------------------

export interface CreateStoryInput {
  name: string
  description?: string
  acceptance_criteria?: string
  status?: StoryStatus
  owner_id?: string | null
  repo?: string | null
  sprint_id?: string | null
}

export interface PatchStoryInput {
  name?: string
  description?: string
  acceptance_criteria?: string
  status?: StoryStatus
  owner_id?: string | null
  repo?: string | null
  sprint_id?: string | null
}

export async function createStory(input: CreateStoryInput): Promise<Story> {
  const s = await api.post<Story>(STORIES_KEY, input)
  await mutateAllStoryLists()
  return s
}

export async function patchStory(id: string, input: PatchStoryInput): Promise<Story> {
  const s = await api.patch<Story>(storyDetailKey(id), input)
  await Promise.all([mutateAllStoryLists(), globalMutate(storyDetailKey(id))])
  return s
}

export async function deleteStory(id: string): Promise<void> {
  await api.delete<void>(storyDetailKey(id))
  await mutateAllStoryLists()
}

// List cache is keyed by optional `?sprint=` — revalidate every matching key.
async function mutateAllStoryLists() {
  await globalMutate(
    (key) => typeof key === 'string' && key.startsWith(STORIES_KEY),
    undefined,
    { revalidate: true },
  )
}
