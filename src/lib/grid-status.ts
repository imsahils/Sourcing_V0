import type { SubOrder } from './types'

// ─── Grid Status (OTB) ───────────────────────────────────────────────────────
// Phase A foundation: a grid moves through these statuses from creation to GRN.
//   draft        → not submitted yet, no SubOrders exist
//   submitted    → submitted, SubOrders created at order-brief, awaiting POC
//   partial      → some styles have a POC, others don't
//   assigned     → every style has a POC, no vendor yet
//   in-progress  → at least one SubOrder has a vendor assigned
//   delayed      → at least one SubOrder past Inward Date with grnQty < orderQty
//   completed    → every SubOrder has grnQty = orderQty (terminal)

export type GridStatus =
  | 'draft'
  | 'submitted'
  | 'partial'
  | 'assigned'
  | 'in-progress'
  | 'delayed'
  | 'completed'

export const GRID_STATUSES: GridStatus[] = [
  'draft', 'submitted', 'partial', 'assigned', 'in-progress', 'delayed', 'completed',
]

export const GRID_STATUS_LABELS: Record<GridStatus, string> = {
  'draft':       'Draft',
  'submitted':   'Submitted',
  'partial':     'Partially Assigned',
  'assigned':    'Assigned',
  'in-progress': 'In Progress',
  'delayed':     'Delayed',
  'completed':   'Completed',
}

/**
 * Tailwind-class map for the grid status badge.
 * Mirrors the Manju ds-badge variants: gray, orange, blue, indigo, blue (filled),
 * red, green.
 */
export const GRID_STATUS_BADGE_CLASSES: Record<GridStatus, string> = {
  'draft':       'bg-slate-100 text-slate-600',
  'submitted':   'bg-amber-100 text-amber-700',
  'partial':     'bg-violet-100 text-violet-700',
  'assigned':    'bg-indigo-100 text-indigo-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  'delayed':     'bg-red-100 text-red-700',
  'completed':   'bg-green-100 text-green-700',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a date string like "DD/MM/YYYY" or ISO "YYYY-MM-DD" into a Date.
 * Returns null if unparseable.
 */
function parseGridDate(s: string | undefined | null): Date | null {
  if (!s) return null
  // DD/MM/YYYY
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (dmy) {
    const [, d, m, y] = dmy
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t) : null
}

/**
 * Returns true if any SubOrder in the list is past its Inward Date and
 * still has unfulfilled GRN quantity (grnQty < orderQty).
 */
export function isAnyDelayed(subOrders: SubOrder[], now: Date = new Date()): boolean {
  return subOrders.some(so => {
    const inward = parseGridDate(so.buyingExpectedInwardDate)
    if (!inward) return false
    return now > inward && so.grnQty < so.orderQty
  })
}

/**
 * Computes the grid status from a (still-draft) base status plus the SubOrders
 * that belong to it. The base status is what the page-level state machine has
 * recorded; for grids past `submitted`, we recompute by inspecting SubOrders.
 *
 * Phase A: pure function — no side effects, easy to unit test.
 */
export function computeGridStatus(
  baseStatus: GridStatus,
  subOrders: SubOrder[],
  now: Date = new Date(),
): GridStatus {
  // Draft never auto-promotes.
  if (baseStatus === 'draft') return 'draft'

  // No SubOrders attached yet → respect the recorded base status.
  if (subOrders.length === 0) return baseStatus

  // Completed = terminal: every SubOrder has been fully received.
  const allComplete = subOrders.every(so => so.grnQty >= so.orderQty && so.orderQty > 0)
  if (allComplete) return 'completed'

  // Delayed takes precedence over in-progress/assigned/etc.
  if (isAnyDelayed(subOrders, now)) return 'delayed'

  // In-progress = at least one SubOrder has a vendor assigned (or has moved
  // past order-brief / assigned stages).
  const anyExecuting = subOrders.some(so =>
    !!so.vendor?.id ||
    !['order-brief', 'assigned'].includes(so.currentStage),
  )
  if (anyExecuting) return 'in-progress'

  // Otherwise fall back to the recorded assignment status.
  const assignedCount = subOrders.filter(so => !!so.poc?.id).length
  if (assignedCount === 0) return 'submitted'
  if (assignedCount < subOrders.length) return 'partial'
  return 'assigned'
}

/**
 * Convenience: tells the caller which actions are allowed at this status,
 * keyed by intent. Used by the UI to enable/disable buttons.
 */
export function gridStatusActions(status: GridStatus) {
  return {
    canEditAnyField:    status === 'draft',
    canEditPerRole:     status !== 'completed',
    canSubmit:          status === 'draft',
    canAssignPocs:      ['submitted', 'partial'].includes(status),
    canReassignPocs:    !['draft', 'completed'].includes(status),
    canDeleteGrid:      status === 'draft',
    isReadOnly:         status === 'completed',
    isTerminal:         status === 'completed',
  }
}
