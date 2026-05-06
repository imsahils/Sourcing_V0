import { apiFetch } from './client'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  department: string | null
  initials: string | null
  vendorId: string | null
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  localStorage.setItem('fabricate-token', res.accessToken)
  localStorage.setItem('fabricate-user', JSON.stringify(res.user))
  return res
}

export function logout(): void {
  localStorage.removeItem('fabricate-token')
  localStorage.removeItem('fabricate-user')
  window.location.href = '/login'
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('fabricate-user')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('fabricate-token')
}
