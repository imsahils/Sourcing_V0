'use client'
import { useState, useEffect } from 'react'
import { fetchUsers, ApiUser } from '@/lib/api/users'

export function useUsers() {
  const [data, setData] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
