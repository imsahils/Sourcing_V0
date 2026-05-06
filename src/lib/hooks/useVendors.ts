'use client'
import { useState, useEffect } from 'react'
import { fetchVendors, ApiVendor } from '@/lib/api/vendors'

export function useVendors() {
  const [data, setData] = useState<ApiVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVendors()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
