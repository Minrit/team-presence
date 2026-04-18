import useSWR, { mutate as globalMutate } from 'swr'
import { api } from './api'
import type { Sprint } from './types'

export const SPRINTS_KEY = '/api/v1/sprints'
export const sprintDetailKey = (id: string) => `/api/v1/sprints/${id}`

const fetcher = <T,>(path: string) => api.get<T>(path)

export function useSprints() {
  return useSWR<Sprint[]>(SPRINTS_KEY, fetcher)
}

export interface CreateSprintInput {
  name: string
  start_date: string // YYYY-MM-DD
  end_date: string
}

export interface PatchSprintInput {
  name?: string
  start_date?: string
  end_date?: string
}

export async function createSprint(input: CreateSprintInput): Promise<Sprint> {
  const s = await api.post<Sprint>(SPRINTS_KEY, input)
  await globalMutate(SPRINTS_KEY)
  return s
}

export async function patchSprint(id: string, input: PatchSprintInput): Promise<Sprint> {
  const s = await api.patch<Sprint>(sprintDetailKey(id), input)
  await globalMutate(SPRINTS_KEY)
  return s
}

export async function deleteSprint(id: string): Promise<void> {
  await api.delete<void>(sprintDetailKey(id))
  await globalMutate(SPRINTS_KEY)
}
