import { mutate as globalMutate } from 'swr'
import { api } from './api'
import { EPICS_KEY } from './stories'
import type { Epic } from './types'

export interface CreateEpicInput {
  name: string
  color: string
  description?: string
}

export interface PatchEpicInput {
  name?: string
  color?: string
  description?: string
}

export async function createEpic(input: CreateEpicInput): Promise<Epic> {
  const e = await api.post<Epic>(EPICS_KEY, input)
  await globalMutate(EPICS_KEY)
  return e
}

export async function patchEpic(id: string, input: PatchEpicInput): Promise<Epic> {
  const e = await api.patch<Epic>(`${EPICS_KEY}/${id}`, input)
  await globalMutate(EPICS_KEY)
  return e
}

export async function deleteEpic(id: string): Promise<void> {
  await api.delete<void>(`${EPICS_KEY}/${id}`)
  await globalMutate(EPICS_KEY)
}
