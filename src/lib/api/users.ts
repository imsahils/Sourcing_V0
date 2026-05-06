import { apiFetch } from './client'

export interface ApiUser {
  id: string
  email: string
  name: string
  role: string
  department: string | null
  initials: string | null
  vendorId: string | null
}

export async function fetchUsers(): Promise<ApiUser[]> {
  return apiFetch<ApiUser[]>('/users')
}
