import { mutate as globalMutate } from 'swr'
import { api } from './api'
import type { User } from './types'

export const USERS_KEY = '/api/v1/auth/users'

export interface CreateUserInput {
  email: string
  password: string
  display_name: string
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const u = await api.post<User>(USERS_KEY, input)
  await globalMutate(USERS_KEY)
  return u
}
