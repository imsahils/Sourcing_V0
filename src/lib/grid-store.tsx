'use client'
//
// ─── Grid Store (Phase C) ──────────────────────────────────────────────────
//
// Cross-tab state container for the OTB module. Holds:
//   • grids        — list of OrderGridRecords shown in `?tab=grid`
//   • assignGrids  — per-grid style detail used by `?tab=assignment`
//   • subOrders    — the master SubOrder list (initial seed from /lib/data + any
//                    SubOrders created on grid submission)
//   • notifications— in-app notification log (shown in the bell icon, Phase F)
//
// The submit flow is owned here:
//   submitGrid(rows, meta) → creates the OrderGridRecord, AssignGrid, N SubOrders,
//   and 1 notification for the Sourcing Manager. Called by NewOrderView.
//
// This is deliberately a thin in-memory store (Context + useState). When a real
// API exists, swap the bodies of the action functions for fetch calls.
//

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react'
import type {
  SubOrder, Vendor, User, ActivityLog, Notification,
} from './types'
import { subOrders as initialSubOrders, vendors as seedVendors } from './data'

// ─── Public types (mirrored from order-management/page.tsx) ────────────────
import type { GridStatus } from './grid-status'

export type OrderGridRecord = {
  id: string
  name: string
  season: string
  source: 'buying' | 'sourcing'
  createdBy: string
  onBehalfOf: string
  date: string
  styleCount: number
  assignedCount: number
  status: GridStatus
}

export type AssignStyle = {
  id: string
  styleCode: string
  styleName: string
  qty: number
  gender: string
  assignedTo: string
  productGroup?: string
  type?: string
  subType?: string
  fabric?: string
  ageGroup?: string
  colorFamily?: string
  season?: string
  drop?: string
  mrp?: number
  targetPrice?: number
  handoverDate?: string
  buyingExpectedInwardDate?: string
  tier?: string
}

export type AssignGrid = {
  id: string
  name: string
  source: 'buying' | 'sourcing'
  createdBy: string
  onBehalfOf: string
  date: string
  styles: AssignStyle[]
}

// What the New Order flow hands us when a draft is submitted.
export type SubmitGridInput = {
  name:       string
  season:     string
  source:     'buying' | 'sourcing'
  createdBy:  string
  onBehalfOf: string                      // empty string when creator is Buying
  rows:       SubmitRow[]                 // already filtered (warnings allowed; skipped removed)
}

export type SubmitRow = {
  id:                       string
  styleCode:                string
  styleName:                string
  gender:                   string
  productGroup:             string
  type:                     string
  subType:                  string
  season:                   string
  drop:                     string
  fabric:                   string
  ageGroup:                 string
  colorFamily:              string
  activeSizes:              string
  sizeRatio:                string
  orderQty:                 string
  mrp:                      string
  targetPrice:              string
  whBhw:                    string
  whDel:                    string
  whBlr:                    string
  handoverDate:             string
  buyingExpectedInwardDate: string
  tier:                     string
  techPack:                 string
  designer:                 string
  disabled:                 boolean
}

export type SubmitGridResult = {
  ok:          true
  gridId:      string
  subOrderIds: string[]
}

// ─── Placeholder "Unassigned" objects ──────────────────────────────────────
// SubOrder.vendor and SubOrder.poc are required, so freshly-submitted SubOrders
// (no vendor or POC yet) carry these sentinels until they are assigned.

export const UNASSIGNED_VENDOR: Vendor = {
  id:       'unassigned',
  name:     'Unassigned',
  location: '—',
}

export const UNASSIGNED_POC: User = {
  id:       'unassigned',
  name:     'Unassigned',
  initials: '?',
  role:     'sourcing-poc',
  brand:    'Nautinati',
  email:    '',
}

export const isUnassigned = (u: Pick<User, 'id'> | Pick<Vendor, 'id'> | undefined | null) =>
  !u || u.id === 'unassigned'

// ─── Initial mock data (replaces the inline arrays in page.tsx) ────────────
const initialGrids: OrderGridRecord[] = [
  { id:'og1', name:'NN AW26 Outer Wear Batch 1',  season:'AW 26', source:'buying',   createdBy:'Priya Sharma',    onBehalfOf:'',             date:'26 Feb 2026', styleCount:42, assignedCount:42, status:'in-progress' },
  { id:'og2', name:'NN SS26 Knits Batch 2',       season:'SS 26', source:'sourcing', createdBy:'Parthipan Kumar', onBehalfOf:'',             date:'18 Feb 2026', styleCount:28, assignedCount:28, status:'assigned'    },
  { id:'og3', name:'NN SS26 Woven Bottoms',       season:'SS 26', source:'sourcing', createdBy:'Parthipan Kumar', onBehalfOf:'Neha Gupta',   date:'10 Feb 2026', styleCount:15, assignedCount:10, status:'partial'     },
  { id:'og4', name:'NN AW26 Infants Range',       season:'AW 26', source:'buying',   createdBy:'Ananya Joshi',    onBehalfOf:'',             date:'03 Feb 2026', styleCount:33, assignedCount:0,  status:'submitted'   },
  { id:'og5', name:'NN SS26 Girls Dresses Draft', season:'SS 26', source:'sourcing', createdBy:'Rajesh Menon',    onBehalfOf:'',             date:'28 Jan 2026', styleCount:9,  assignedCount:5,  status:'partial'     },
  { id:'og6', name:'NN AW26 Boys Basics',         season:'AW 26', source:'sourcing', createdBy:'Sahil Sharma',    onBehalfOf:'',             date:'01 May 2026', styleCount:12, assignedCount:0,  status:'draft'       },
  { id:'og7', name:'NN SS26 Sale Replen',         season:'SS 26', source:'buying',   createdBy:'Pooja Mehta',     onBehalfOf:'',             date:'12 Jan 2026', styleCount:18, assignedCount:18, status:'delayed'     },
]

// (assignGrids initial is the same MOCK_ASSIGN_GRIDS data — re-exported via the page so
// we don't duplicate ~130 lines of mock styles here. The provider seeds it from a prop.)

// ─── Context shape ──────────────────────────────────────────────────────────
type GridStoreValue = {
  grids:         OrderGridRecord[]
  assignGrids:   AssignGrid[]
  subOrders:     SubOrder[]
  notifications: Notification[]

  setAssignGrids: React.Dispatch<React.SetStateAction<AssignGrid[]>>
  setGrids:       React.Dispatch<React.SetStateAction<OrderGridRecord[]>>

  /** Submit a draft grid: creates the grid record, assignment grid, SubOrders, and a notification. */
  submitGrid: (input: SubmitGridInput) => SubmitGridResult

  /**
   * Commit a batch of POC assignments. Updates assignGrids + the corresponding
   * SubOrders, recomputes grid status (submitted → partial → assigned), writes
   * activity-log entries, and fires the right notifications:
   *   • new assignment   → activity log only
   *   • re-assignment    → activity log + notify(old) + notify(new)
   *   • grid hits 100%   → notify Buying POC ("fully assigned")
   */
  applyAssignments: (changes: AssignmentChange[], actor: string) => void

  // Bell-icon plumbing.
  markNotificationRead:    (id: string) => void
  markAllNotificationsRead: () => void
  unreadNotificationCount: number
}

export type AssignmentChange = {
  gridId:    string
  styleId:   string   // = SubOrder.id (Fabricate Code)
  oldPoc:    string   // empty when previously unassigned
  newPoc:    string   // empty means "unassign" (rare)
}

const GridStoreContext = createContext<GridStoreValue | null>(null)

export function useGridStore(): GridStoreValue {
  const ctx = useContext(GridStoreContext)
  if (!ctx) throw new Error('useGridStore must be used inside <GridStoreProvider>')
  return ctx
}

// ─── Provider ──────────────────────────────────────────────────────────────
export function GridStoreProvider({
  children,
  seedAssignGrids,
}: {
  children: ReactNode
  /** Initial assignment-grid seed (passed in from the page so we don't duplicate the giant fixture). */
  seedAssignGrids: AssignGrid[]
}) {
  const [grids,         setGrids]         = useState<OrderGridRecord[]>(initialGrids)
  const [assignGrids,   setAssignGrids]   = useState<AssignGrid[]>(seedAssignGrids)
  const [subOrders,     setSubOrders]     = useState<SubOrder[]>(initialSubOrders)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // ── submitGrid: the heart of Phase C ──────────────────────────────────────
  const submitGrid = useCallback((input: SubmitGridInput): SubmitGridResult => {
    const gridId = nextGridId(grids)
    const dateLabel = todayLabel()

    // 1. Filter out disabled rows. PRD §7 edge case: disabled rows do NOT create SubOrders.
    const activeRows = input.rows.filter(r => !r.disabled)

    // 2. Create one SubOrder per row.
    const newSubOrders: SubOrder[] = []
    const newAssignStyles: AssignStyle[] = []
    let serial = nextFabricateSerial(subOrders)

    for (const r of activeRows) {
      const fabricateCode = formatFabricateCode(r.gender, r.season, serial)
      serial += 1

      const so: SubOrder = {
        id:                       fabricateCode,
        styleCode:                r.styleCode,
        styleName:                r.styleName,
        colour:                   r.colorFamily,
        category:                 r.productGroup || '—',
        product:                  r.type || '—',
        season:                   r.season,
        orderType:                'NEW',
        tier:                     coerceTier(r.tier),
        gender:                   r.gender,
        ageGroup:                 r.ageGroup,
        fabricQuality:            r.fabric,
        vendor:                   UNASSIGNED_VENDOR,
        poc:                      UNASSIGNED_POC,
        status:                   'not-started',
        currentStage:             'order-brief',
        atRisk:                   false,
        handoverDate:             r.handoverDate,
        orderToVendorDate:        '',
        buyingExpectedInwardDate: r.buyingExpectedInwardDate,
        vendorPromisedDate:       '',
        targetPrice:              Number(r.targetPrice) || 0,
        costStatus:               'pending',
        orderQty:                 Number(r.orderQty) || 0,
        cutQty: 0, sewingQty: 0, packedQty: 0,
        fiQty: 0, dispatchedQty: 0, grnQty: 0,
        poNumbers:         [],
        preProdStages:     [],
        productionHistory: [],
        fiRequests:        [],
        samples:           [],
        history:           [makeActivityLog(input.createdBy, input.onBehalfOf,
                              `Sub-order created from grid "${input.name}".`)],
      }
      newSubOrders.push(so)

      newAssignStyles.push({
        id:                       so.id,
        styleCode:                r.styleCode,
        styleName:                r.styleName,
        qty:                      so.orderQty,
        gender:                   r.gender,
        assignedTo:               '',                  // unassigned at submission
        productGroup:             r.productGroup,
        type:                     r.type,
        subType:                  r.subType,
        fabric:                   r.fabric,
        ageGroup:                 r.ageGroup,
        colorFamily:              r.colorFamily,
        season:                   r.season,
        drop:                     r.drop,
        mrp:                      Number(r.mrp) || undefined,
        targetPrice:              Number(r.targetPrice) || undefined,
        handoverDate:             r.handoverDate,
        buyingExpectedInwardDate: r.buyingExpectedInwardDate,
        tier:                     r.tier,
      })
    }

    // 3. Create the grid record (status: submitted, assignedCount: 0).
    const newGrid: OrderGridRecord = {
      id:            gridId,
      name:          input.name,
      season:        input.season,
      source:        input.source,
      createdBy:     input.createdBy,
      onBehalfOf:    input.onBehalfOf,
      date:          dateLabel,
      styleCount:    activeRows.length,
      assignedCount: 0,
      status:        'submitted',
    }

    const newAssignGrid: AssignGrid = {
      id:         gridId,
      name:       input.name,
      source:     input.source,
      createdBy:  input.createdBy,
      onBehalfOf: input.onBehalfOf,
      date:       dateLabel,
      styles:     newAssignStyles,
    }

    // 4. Sourcing-Manager notification (PRD §5.10).
    const notif: Notification = {
      id:        `n-${Date.now()}`,
      type:      'info',
      message:   `New grid "${input.name}" submitted by ${input.createdBy} with ${activeRows.length} styles. Awaiting POC assignment.`,
      timestamp: new Date().toISOString(),
      read:      false,
    }

    // 5. Commit everything atomically.
    setGrids(prev => [newGrid, ...prev])
    setAssignGrids(prev => [newAssignGrid, ...prev])
    setSubOrders(prev => [...newSubOrders, ...prev])
    setNotifications(prev => [notif, ...prev])

    return { ok: true, gridId, subOrderIds: newSubOrders.map(s => s.id) }
  }, [grids, subOrders])

  // ── Notification helpers ─────────────────────────────────────────────────
  const pushNotif = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{
      ...n,
      id:        `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read:      false,
    }, ...prev])
  }, [])

  const markNotificationRead = useCallback((id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)),
    [],
  )

  const markAllNotificationsRead = useCallback(() =>
    setNotifications(prev => prev.map(n => n.read ? n : { ...n, read: true })),
    [],
  )

  const unreadNotificationCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  )

  // ── applyAssignments: commits POC assignments + fires notifications ──────
  const applyAssignments = useCallback((changes: AssignmentChange[], actor: string) => {
    if (changes.length === 0) return

    // Group by grid for efficient downstream updates.
    const byGrid = new Map<string, AssignmentChange[]>()
    for (const c of changes) {
      const arr = byGrid.get(c.gridId) ?? []
      arr.push(c)
      byGrid.set(c.gridId, arr)
    }

    const fullyAssignedGrids: { id: string; name: string; createdBy: string }[] = []
    const reassignmentEvents: AssignmentChange[] = []
    const nowIso = new Date().toISOString()

    // 1. Update assignGrids and figure out which grids hit 100% assigned.
    setAssignGrids(prev => prev.map(g => {
      const gridChanges = byGrid.get(g.id)
      if (!gridChanges) return g

      const changeMap = new Map(gridChanges.map(c => [c.styleId, c.newPoc]))
      const styles = g.styles.map(s =>
        changeMap.has(s.id) ? { ...s, assignedTo: changeMap.get(s.id) || '' } : s,
      )
      const total      = styles.length
      const assignedN  = styles.filter(s => s.assignedTo).length
      const wasFull    = g.styles.every(s => s.assignedTo)
      const isFullNow  = assignedN === total

      // Track the "just became fully assigned" event for the notification.
      if (!wasFull && isFullNow) {
        fullyAssignedGrids.push({ id: g.id, name: g.name, createdBy: g.createdBy })
      }
      return { ...g, styles }
    }))

    // 2. Mirror onto OrderGridRecord (assignedCount + status transition).
    setGrids(prev => prev.map(g => {
      const gridChanges = byGrid.get(g.id)
      if (!gridChanges) return g

      // Recompute the new assignedCount from the projected styles.
      const projected = computeProjectedAssigned(g.id, gridChanges, assignGrids)
      let nextStatus = g.status
      if (projected.total > 0 && projected.assigned === projected.total) nextStatus = 'assigned'
      else if (projected.assigned > 0)                                   nextStatus = 'partial'
      else                                                                nextStatus = 'submitted'

      return { ...g, assignedCount: projected.assigned, status: nextStatus }
    }))

    // 3. Update SubOrders + write activity-log entries; classify reassign vs first-assign.
    setSubOrders(prev => prev.map(so => {
      const change = changes.find(c => c.styleId === so.id)
      if (!change) return so

      const isReassignment = !!change.oldPoc && change.oldPoc !== change.newPoc
      if (isReassignment) reassignmentEvents.push(change)

      const log: ActivityLog = {
        id:        `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        actor,
        actorRole: 'Sourcing Manager',
        action:    isReassignment
                     ? `POC reassigned: ${change.oldPoc} → ${change.newPoc || 'Unassigned'}.`
                     : `POC assigned: ${change.newPoc}.`,
      }

      const nextPoc: User = change.newPoc
        ? {
            id:       `poc-${change.newPoc.replace(/\s+/g, '-').toLowerCase()}`,
            name:     change.newPoc,
            initials: change.newPoc.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(),
            role:     'sourcing-poc',
            brand:    so.poc.brand || 'Nautinati',
            email:    '',
          }
        : UNASSIGNED_POC

      // Stage flips from order-brief → assigned the first time a POC is set.
      const nextStage = so.currentStage === 'order-brief' && change.newPoc ? 'assigned' : so.currentStage

      return {
        ...so,
        poc:          nextPoc,
        currentStage: nextStage,
        history:      [log, ...so.history],
      }
    }))

    // 4. Fire notifications.
    for (const ev of reassignmentEvents) {
      pushNotif({
        type:       'info',
        subOrderId: ev.styleId,
        message:    `SubOrder ${ev.styleId} reassigned from ${ev.oldPoc} to ${ev.newPoc || 'Unassigned'} by ${actor}.`,
      })
    }
    for (const g of fullyAssignedGrids) {
      pushNotif({
        type:    'info',
        message: `Your grid "${g.name}" has been fully assigned. (Notify: ${g.createdBy})`,
      })
    }
  }, [assignGrids, pushNotif])

  const value = useMemo<GridStoreValue>(() => ({
    grids, assignGrids, subOrders, notifications,
    setGrids, setAssignGrids, submitGrid,
    applyAssignments,
    markNotificationRead, markAllNotificationsRead, unreadNotificationCount,
  }), [grids, assignGrids, subOrders, notifications, submitGrid, applyAssignments,
       markNotificationRead, markAllNotificationsRead, unreadNotificationCount])

  return <GridStoreContext.Provider value={value}>{children}</GridStoreContext.Provider>
}

// Helper: project how many styles will be assigned in a grid after applying changes.
function computeProjectedAssigned(
  gridId:  string,
  changes: AssignmentChange[],
  current: AssignGrid[],
): { assigned: number; total: number } {
  const grid = current.find(g => g.id === gridId)
  if (!grid) return { assigned: 0, total: 0 }
  const map = new Map(changes.map(c => [c.styleId, c.newPoc]))
  let assigned = 0
  for (const s of grid.styles) {
    const next = map.has(s.id) ? map.get(s.id) : s.assignedTo
    if (next) assigned++
  }
  return { assigned, total: grid.styles.length }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function nextGridId(grids: OrderGridRecord[]): string {
  // og1, og2, … — find the highest numeric suffix and add one.
  let max = 0
  for (const g of grids) {
    const m = /^og(\d+)$/.exec(g.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `og${max + 1}`
}

function nextFabricateSerial(existing: SubOrder[]): number {
  // Existing IDs look like NNKNTW250001 — pull the trailing number, return next.
  let max = 0
  for (const so of existing) {
    const m = /(\d{4,})$/.exec(so.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

/**
 * Build a Fabricate Code matching the existing convention:
 *   `NN` + brand prefix + gender prefix + category prefix + 2-digit year + 4-digit serial
 *
 * For Phase C we only have grid-row data so we approximate:
 *   NN + (gender first letter) + KNTW + last-2-of-year + 4-digit serial
 *
 * Example: NNGKNTW260042 (Girls, AW 26, serial 42).
 */
function formatFabricateCode(gender: string, season: string, serial: number): string {
  const g = (gender || '').trim().charAt(0).toUpperCase() || 'X'
  const yearMatch = /(\d{2})$/.exec(season || '')
  const yy = yearMatch ? yearMatch[1] : '26'
  return `NN${g}KNTW${yy}${String(serial).padStart(4, '0')}`
}

function coerceTier(t: string): SubOrder['tier'] {
  const allowed: SubOrder['tier'][] = ['HERO', 'TIER-1', 'TIER-2', 'TAIL']
  const up = (t || '').toUpperCase().trim() as SubOrder['tier']
  return allowed.includes(up) ? up : 'TIER-2'
}

function todayLabel(): string {
  const d = new Date()
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${String(d.getDate()).padStart(2, '0')} ${month} ${d.getFullYear()}`
}

function makeActivityLog(actor: string, onBehalfOf: string, action: string): ActivityLog {
  return {
    id:        `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor,
    actorRole: 'Buying POC',
    action,
    onBehalfOf: onBehalfOf || undefined,
  }
}

// Suppress unused-import warning in environments that don't tree-shake.
void seedVendors
