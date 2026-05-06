'use client'
import { useState, useEffect } from 'react'
import { fetchUsers, type ApiUser } from '@/lib/api/users'

// ─── Mock fallback — minimal user list derived from mock sub-orders ───────────

const MOCK_API_USERS: ApiUser[] = [
  { id: 'u1', email: 'parthipan@tmrw.com',  name: 'Parthipan Kumar', role: 'sourcing-poc', department: 'Sourcing', initials: 'PK', vendorId: null },
  { id: 'u2', email: 'priya@tmrw.com',      name: 'Priya Menon',     role: 'sourcing-mgr', department: 'Sourcing', initials: 'PM', vendorId: null },
  { id: 'u3', email: 'arun@tmrw.com',       name: 'Arun Sharma',     role: 'sourcing-poc', department: 'Sourcing', initials: 'AS', vendorId: null },
  { id: 'u4', email: 'deepa@tmrw.com',      name: 'Deepa Nair',      role: 'sourcing-poc', department: 'Sourcing', initials: 'DN', vendorId: null },
  { id: 'u5', email: 'megha@tmrw.com',      name: 'Megha Sharma',    role: 'category-head',department: 'Buying',   initials: 'MS', vendorId: null },
]

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUsers() {
  const [data,    setData]    = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
      .then(data => { setData(data); setLoading(false) })
      .catch(() => {
        // API unreachable — fall back to mock users silently
        setData(MOCK_API_USERS)
        setLoading(false)
      })
  }, [])

  return { data, loading, error }
}
