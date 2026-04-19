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

export async function patchComment(
  storyId: string,
  commentId: string,
  body: string,
): Promise<Comment> {
  const c = await api.patch<Comment>(
    `${storyCommentsKey(storyId)}/${commentId}`,
    { body },
  )
  await Promise.all([
    globalMutate(storyCommentsKey(storyId)),
    globalMutate(storyActivityKey(storyId)),
  ])
  return c
}

export async function deleteComment(
  storyId: string,
  commentId: string,
): Promise<void> {
  await api.delete<void>(`${storyCommentsKey(storyId)}/${commentId}`)
  await Promise.all([
    globalMutate(storyCommentsKey(storyId)),
    globalMutate(storyActivityKey(storyId)),
  ])
}

export async function addRelation(
  storyId: string,
  kind: 'blocks',
  to: string,
): Promise<void> {
  await api.post<unknown>(storyRelationsKey(storyId), { kind, to })
  await Promise.all([
    globalMutate(storyRelationsKey(storyId)),
    globalMutate(storyRelationsKey(to)),
    globalMutate(storyActivityKey(storyId)),
  ])
}

export async function removeRelation(
  storyId: string,
  target: string,
): Promise<void> {
  await api.delete<void>(`${storyRelationsKey(storyId)}/${target}`)
  await Promise.all([
    globalMutate(storyRelationsKey(storyId)),
    globalMutate(storyRelationsKey(target)),
    globalMutate(storyActivityKey(storyId)),
  ])
}

/** Replace the AC array on a story. Callers pass the full next array; this
 *  is a thin wrapper around patchStory. */
export function patchAc(
  id: string,
  next: AcceptanceCriterion[],
): Promise<Story> {
  return patchStory(id, { acceptance_criteria: next })
}

async function mutateAllStoryLists() {
  await globalMutate(
    (key) => typeof key === 'string' && key.startsWith(STORIES_KEY),
    undefined,
    { revalidate: true },
  )
}
