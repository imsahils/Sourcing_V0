// ─── Core Enums ───────────────────────────────────────────────────────────────

export type SubOrderStatus = 'on-track' | 'needs-attention' | 'overdue' | 'completed' | 'not-started'
export type SpineStage =
  | 'order-brief'
  | 'assigned'
  | 'vendor'
  | 'costing'
  | 'pre-prod'
  | 'production'
  | 'fi'
  | 'asn'
  | 'grn'

export type PreProdStageStatus = 'not-started' | 'pending' | 'approved' | 'rejected' | 'overdue'
export type FIStatus = 'new' | 'not-ready' | 'scheduled' | 'in-progress' | 'pass' | 'fail' | 'hold' | 're-inspection'
export type OrderType = 'NEW' | 'REPLEN'
export type Tier = 'HERO' | 'TIER-1' | 'TIER-2' | 'TAIL'
export type NotificationType = 'overdue' | 'due-today' | 'completed' | 'info'

export type Role =
  | 'sourcing-poc'
  | 'sourcing-manager'
  | 'sourcing-director'
  | 'category-head'
  | 'vendor'
  | 'qa-manager'
  | 'qa-inspector'
  | 'designer'
  | 'fit-tech'
  | 'mis'
  | 'warehouse'
  | 'finance'
  | 'super-admin'

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  initials: string
  role: Role
  brand: string
  email: string
}

// ─── SubOrder ─────────────────────────────────────────────────────────────────

export interface SubOrder {
  id: string                        // Fabricate Code
  styleCode: string
  styleName: string
  colour: string
  category: string
  product: string
  season: string
  orderType: OrderType
  tier: Tier
  gender: string
  ageGroup: string
  fabricQuality: string
  vendor: Vendor
  poc: User
  status: SubOrderStatus
  currentStage: SpineStage
  atRisk: boolean

  // Dates
  handoverDate: string
  orderToVendorDate: string
  buyingExpectedInwardDate: string
  vendorPromisedDate: string
  costingApprovedDate?: string

  // Costing
  targetPrice: number
  closedCost?: number
  costStatus: 'pending' | 'submitted' | 'approved' | 'escalated'

  // Quantities
  orderQty: number
  cutQty: number
  sewingQty: number
  packedQty: number
  fiQty: number
  dispatchedQty: number
  grnQty: number

  // POs
  poNumbers: { warehouse: string; poNumber: string; qty: number }[]

  // Pre-production
  preProdStages: PreProdStage[]
  preProdUnlocked?: boolean       // manually unlocked before costing approval
  preProdUnlockReason?: string    // mandatory reason entered at unlock time
  preProdUnlockedBy?: string      // name of person who last toggled it
  preProdUnlockedAt?: string      // ISO date string

  // Production history
  productionHistory: ProductionEntry[]

  // FI
  fiRequests: FIRequest[]

  // Sample dispatch log
  samples?: SampleRecord[]

  // History
  history: ActivityLog[]

  // Vendor RFQ (vendor stage)
  techPackUrl?: string
  rfqStatus?: RFQStatus
  vendorRFQs?: VendorRFQ[]
  parentSubOrderId?: string
  cancellationRequest?: CancellationRequest
}

// ─── Vendor ───────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string
  name: string
  location: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  tier?: string
  otifScore?: number
  fiPassRate?: number
}

// ─── Pre-Production ───────────────────────────────────────────────────────────

export interface PreProdStage {
  id: string
  name: string
  status: PreProdStageStatus
  plannedDate: string
  actualDate?: string
  approvedBy?: string
  approverRole?: string
  remarks?: string
  photoUrl?: string
}

// ─── Production ───────────────────────────────────────────────────────────────

export interface ProductionEntry {
  date: string
  cutQty: number
  sewingQty: number
  packedQty: number
  updatedBy: string
  onBehalfOf?: string
  reason?: string
}

// ─── Final Inspection ─────────────────────────────────────────────────────────

export interface FIRequest {
  id: string
  requestedDate: string
  scheduledDate?: string
  assignedInspector?: string
  status: FIStatus
  fiQty: number
  location?: string
  result?: 'pass' | 'fail' | 'hold'
  round: number
  parentId?: string
  reportUrl?: string
  remarks?: string
}

// ─── Sample Record ────────────────────────────────────────────────────────────

export type SampleType = 'Proto' | 'Fit Sample' | 'Size Set' | 'PP Sample' | 'Sealer' | 'TOP'
export type SampleStatus = 'dispatched' | 'received' | 'under-review' | 'approved' | 'rejected' | 'revision-requested'

export interface SampleRecord {
  id: string
  type: SampleType
  round: number                 // 1st attempt, 2nd attempt, etc.
  dispatchDate: string          // when sent from factory
  receivedDate?: string         // when received by reviewer
  sentTo: string                // e.g. "Priya M (Designer)"
  courier?: string              // e.g. "DTDC", "FedEx"
  trackingNo?: string
  qty: number                   // number of pieces sent
  status: SampleStatus
  comments?: string             // reviewer notes
  revisionNotes?: string        // what to fix before next round
  approvedBy?: string
  approvedDate?: string
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string
  timestamp: string
  actor: string
  actorRole: string
  action: string
  details?: string
  onBehalfOf?: string
}

// ─── Queue Item ───────────────────────────────────────────────────────────────

export type QueueActionType =
  | 'production-update-overdue'
  | 'pre-prod-overdue'
  | 'fi-needed'
  | 'costing-due'
  | 'sample-approval-pending'
  | 'asn-pending'
  | 'grn-pending'

export interface QueueItem {
  subOrderId: string
  styleCode: string
  colour: string
  vendorName: string
  actionType: QueueActionType
  actionLabel: string
  urgency: 'overdue' | 'due-today'
  daysOverdue?: number
  ctaLabel: string
  ctaRoute: string
}

// ─── Vendor RFQ ───────────────────────────────────────────────────────────────

export type RFQStatus = 'not-started' | 'draft' | 'sent' | 'responded' | 'confirmed' | 'closed-no-vendor'
export type VendorRFQStatus = 'sent' | 'responded' | 'declined' | 'accepted' | 'rejected' | 'expired' | 'revoked'

export interface VendorRFQ {
  id: string
  subOrderId: string
  vendor: Vendor
  // Style brief snapshot at time of sending
  styleCode: string
  styleName: string
  colour: string
  orderQty: number
  targetPrice: number
  handoverDate: string
  fabricQuality: string
  category: string
  sizeRatio: string
  warehouseSplit: { warehouse: string; qty: number }[]
  techPackUrl: string
  notes?: string
  // Lifecycle
  status: VendorRFQStatus
  sentAt: string
  expiresAt: string
  respondedAt?: string
  closedAt?: string
  // Vendor response
  quotedPrice?: number
  vendorPromisedDate?: string
  leadTimeDays?: number
  capacityQty?: number
  declineReason?: string
  // POC action
  revokedReason?: string
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

export type CancelReason =
  | 'DEMAND_DROP'
  | 'DESIGN_CHANGE'
  | 'BUDGET_CUT'
  | 'STYLE_MERGED'
  | 'VENDOR_FAILURE'
  | 'QUALITY_MISMATCH'
  | 'OTHER'

export interface ApprovalEntry {
  approverId?: string
  approverName?: string
  status: 'pending' | 'approved' | 'rejected'
  actedAt?: string
  note?: string
}

export interface CancellationRequest {
  id: string
  subOrderId: string
  status: 'pending-approval' | 'approved' | 'rejected' | 'revised'
  initiatedBy: { id: string; name: string; role: Role }
  initiatedAt: string
  reasonCode: CancelReason
  reasonNote?: string
  categoryHeadApproval: ApprovalEntry
  sourcingDirectorApproval: ApprovalEntry
  rejectedBy?: { id: string; name: string; role: Role }
  rejectionReason?: string
  revisions: { revisedAt: string; reasonCode: CancelReason; reasonNote?: string }[]
  lastReminderSentAt?: string
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  type: NotificationType
  subOrderId?: string
  message: string
  timestamp: string
  read: boolean
}
