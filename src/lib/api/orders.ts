import { apiFetch } from './client'

export interface ApiSubOrder {
  id: string
  styleCode: string
  styleName: string
  colour: string
  category: string
  product: string | null
  season: string | null
  orderType: string
  tier: string | null
  gender: string | null
  ageGroup: string | null
  fabricQuality: string | null
  status: string
  currentStage: string
  atRisk: boolean
  targetPrice: number | null
  closedCost: number | null
  costStatus: string
  orderQty: number
  cutQty: number
  sewingQty: number
  packedQty: number
  fiQty: number
  dispatchedQty: number
  grnQty: number
  handoverDate: string | null
  orderToVendorDate: string | null
  buyingExpectedInwardDate: string | null
  vendorPromisedDate: string | null
  costingApprovedDate: string | null
  pocId: string | null
  pocName: string | null
  pocInitials: string | null
  vendorId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductionEntryDto {
  id: string
  subOrderId: string
  cutQty: number
  sewingQty: number
  packedQty: number
  updatedBy: string | null
  onBehalfOf: string | null
  reason: string | null
  date: string | null
  createdAt: string
}

export interface SubOrderFilters {
  stage?: string
  status?: string
  category?: string
  styleCode?: string
  page?: number
  limit?: number
}

export async function fetchSubOrders(filters: SubOrderFilters = {}): Promise<ApiSubOrder[]> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)) })
  // Fetch all — set a high limit so we get everything in one call
  params.set('limit', '500')
  const qs = params.toString()
  const result = await apiFetch<ApiSubOrder[] | { items: ApiSubOrder[] }>(`/orders${qs ? `?${qs}` : ''}`)
  // Handle both paginated { items: [...] } and plain array responses
  return Array.isArray(result) ? result : result.items
}

export async function fetchSubOrder(id: string): Promise<ApiSubOrder> {
  return apiFetch<ApiSubOrder>(`/orders/${id}`)
}

export async function updateProduction(
  id: string,
  dto: { cutQty: number; sewingQty: number; packedQty: number; updatedBy?: string; reason?: string }
): Promise<ApiSubOrder> {
  return apiFetch<ApiSubOrder>(`/orders/${id}/production`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  })
}

export async function fetchProductionHistory(id: string): Promise<ProductionEntryDto[]> {
  return apiFetch<ProductionEntryDto[]>(`/orders/${id}/production-history`)
}
