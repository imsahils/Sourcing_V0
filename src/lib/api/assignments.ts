import { apiFetch } from './client'

export interface ApiAssignment {
  id: string
  subOrderId: string
  vendorId: string
  costingDueDate: string | null
  notes: string | null
  costingStatus: string
  submittedCost: number | null
  closedCost: number | null
  costingApprovedDate: string | null
  notificationSent: boolean
}

export interface CreateAssignmentDto {
  subOrderId: string
  vendorIds: string[]
  costingDueDate?: string
  notes?: string
}

export async function fetchAssignments(subOrderId: string): Promise<ApiAssignment[]> {
  return apiFetch<ApiAssignment[]>(`/vendor-assignments?subOrderId=${subOrderId}`)
}

export async function createAssignments(dto: CreateAssignmentDto): Promise<ApiAssignment[]> {
  return apiFetch<ApiAssignment[]>('/vendor-assignments/bulk', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}
