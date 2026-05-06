const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('fabricate-token')
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('fabricate-token')
    localStorage.removeItem('fabricate-user')
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }

  const body = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, body.message ?? 'Request failed')
  }

  // Unwrap the TransformInterceptor envelope { data: T }
  return (body.data ?? body) as T
}
