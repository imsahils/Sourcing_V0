'use client'
import { useState, useEffect } from 'react'
import { fetchVendors, type ApiVendor } from '@/lib/api/vendors'
import { vendors as mockVendors } from '@/lib/data'

// ─── Mock fallback ────────────────────────────────────────────────────────────

const MOCK_API_VENDORS: ApiVendor[] = mockVendors.map(v => ({
  id:           v.id,
  name:         v.name,
  location:     v.location ?? null,
  contactName:  v.contactName ?? null,
  contactPhone: v.contactPhone ?? null,
  contactEmail: v.contactEmail ?? null,
  tier:         v.tier ?? null,
  otifScore:    v.otifScore ?? null,
  fiPassRate:   v.fiPassRate ?? null,
  isActive:     true,
}))

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVendors() {
  const [data,    setData]    = useState<ApiVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetchVendors()
      .then(data => { setData(data); setLoading(false) })
      .catch(() => {
        // API unreachable — fall back to mock data silently
        setData(MOCK_API_VENDORS)
        setLoading(false)
      })
  }, [])

  return { data, loading, error }
}
