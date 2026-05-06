import { apiFetch } from './client'

export interface ApiVendor {
  id: string
  name: string
  location: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  tier: string | null
  otifScore: number | null
  fiPassRate: number | null
  isActive: boolean
}

export async function fetchVendors(): Promise<ApiVendor[]> {
  return apiFetch<ApiVendor[]>('/vendors')
}

export async function fetchVendor(id: string): Promise<ApiVendor> {
  return apiFetch<ApiVendor>(`/vendors/${id}`)
}
