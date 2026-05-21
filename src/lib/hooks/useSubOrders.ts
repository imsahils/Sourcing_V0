'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchSubOrders, fetchSubOrder, type ApiSubOrder, type SubOrderFilters } from '@/lib/api/orders'
import { apiOrderToSubOrder } from '@/lib/api/adapters'
import { subOrders as mockSubOrders } from '@/lib/data'
import type { SubOrder } from '@/lib/types'

// ─── Convert mock SubOrder → ApiSubOrder shape ────────────────────────────────

function mockToApi(s: SubOrder): ApiSubOrder {
  return {
    id:                       s.id,
    styleCode:                s.styleCode,
    styleName:                s.styleName,
    colour:                   s.colour,
    category:                 s.category,
    product:                  s.product ?? null,
    season:                   s.season ?? null,
    orderType:                s.orderType,
    tier:                     s.tier ?? null,
    gender:                   s.gender ?? null,
    ageGroup:                 s.ageGroup ?? null,
    fabricQuality:            s.fabricQuality ?? null,
    status:                   s.status,
    currentStage:             s.currentStage,
    atRisk:                   s.atRisk,
    targetPrice:              s.targetPrice ?? null,
    closedCost:               s.closedCost ?? null,
    costStatus:               s.costStatus,
    orderQty:                 s.orderQty,
    cutQty:                   s.cutQty,
    sewingQty:                s.sewingQty,
    packedQty:                s.packedQty,
    fiQty:                    s.fiQty,
    dispatchedQty:            s.dispatchedQty,
    grnQty:                   s.grnQty,
    handoverDate:             s.handoverDate ?? null,
    orderToVendorDate:        s.orderToVendorDate ?? null,
    buyingExpectedInwardDate: s.buyingExpectedInwardDate ?? null,
    vendorPromisedDate:       s.vendorPromisedDate ?? null,
    costingApprovedDate:      s.costingApprovedDate ?? null,
    pocId:                    s.poc?.id ?? null,
    pocName:                  s.poc?.name ?? null,
    pocInitials:              s.poc?.initials ?? null,
    vendorId:                 s.vendor?.id ?? null,
    createdAt:                new Date().toISOString(),
    updatedAt:                new Date().toISOString(),
  }
}

const MOCK_API_ORDERS: ApiSubOrder[] = mockSubOrders.map(mockToApi)

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSubOrders(filters: SubOrderFilters = {}) {
  const [data,    setData]    = useState<ApiSubOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtersKey = JSON.stringify(filters)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchSubOrders(filters)
      .then(data => { setData(data); setLoading(false) })
      .catch(() => {
        // API unreachable — fall back to mock data silently
        setData(MOCK_API_ORDERS)
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => { load() }, [load])

  return { data, loading, error, refetch: load }
}

export function useSubOrder(id: string) {
  const [data,    setData]    = useState<SubOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    fetchSubOrder(id)
      .then(apiData => { setData(apiOrderToSubOrder(apiData)); setLoading(false) })
      .catch(() => {
        // Fall back to original mock objects — preserves all fields (vendorRFQs, rfqStatus, etc.)
        const mock = mockSubOrders.find(o => o.id === id) ?? null
        setData(mock)
        if (!mock) setError(`Order ${id} not found`)
        setLoading(false)
      })
  }, [id])

  return { data, loading, error }
}
