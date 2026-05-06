'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchSubOrders, fetchSubOrder, ApiSubOrder, SubOrderFilters } from '@/lib/api/orders'

export function useSubOrders(filters: SubOrderFilters = {}) {
  const [data, setData] = useState<ApiSubOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtersKey = JSON.stringify(filters)

  const load = useCallback(() => {
    setLoading(true)
    fetchSubOrders(filters)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => { load() }, [load])

  return { data, loading, error, refetch: load }
}

export function useSubOrder(id: string) {
  const [data, setData] = useState<ApiSubOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    fetchSubOrder(id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading, error }
}
