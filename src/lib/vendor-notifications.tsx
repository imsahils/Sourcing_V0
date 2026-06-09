'use client'
/**
 * VendorNotificationStore
 * Lightweight shared context for in-app vendor notifications.
 * Used by:
 *   - SubOrderDetailClient  → pushes on pre-prod unlock / auto-relock
 *   - vendor-portal/page    → reads and marks-read
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VendorNotifType =
  | 'preprod-unlocked'          // POC unlocked pre-prod — vendor can proceed
  | 'preprod-relocked'          // costing rejected — vendor must pause
  | 'preprod-stage-approved'    // a pre-prod stage was approved — vendor can prep next
  | 'preprod-stage-rejected'    // a pre-prod stage was rejected — vendor must resubmit

export interface VendorNotification {
  id: string
  type: VendorNotifType
  vendorId: string
  orderId: string
  styleCode: string
  styleName: string
  colour: string
  reason?: string           // unlock reason (for 'preprod-unlocked') or rejection notes
  unlockedBy?: string       // POC name
  stageName?: string        // for preprod-stage-approved/rejected
  rejectionTags?: string[]  // for preprod-stage-rejected
  createdAt: string        // ISO timestamp
  read: boolean
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface VendorNotifCtx {
  notifications: VendorNotification[]
  push: (n: Omit<VendorNotification, 'id' | 'read' | 'createdAt'>) => void
  markRead: (id: string) => void
  markAllRead: (vendorId: string) => void
  unreadCount: (vendorId: string) => number
}

const Ctx = createContext<VendorNotifCtx | null>(null)

// ─── Seed data (pre-populated demo) ──────────────────────────────────────────

const SEED: VendorNotification[] = [
  {
    id: 'vn-seed-001',
    type: 'preprod-unlocked',
    vendorId: 'v1',   // Bharti Apparels — matches demo vendor login
    orderId: 'NNKNTW250005',
    styleCode: 'NN413-438',
    styleName: 'Girls Skirt Set',
    colour: 'GREEN',
    reason: 'Tight inward date — please begin fabric approval and lab dip. Costing verbally agreed at ₹285.',
    unlockedBy: 'Parthipan Kumar',
    createdAt: '2026-06-03T10:30:00.000Z',
    read: false,
  },
]

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VendorNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<VendorNotification[]>(SEED)

  const push = useCallback((n: Omit<VendorNotification, 'id' | 'read' | 'createdAt'>) => {
    setNotifications(prev => [
      {
        ...n,
        id: `vn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllRead = useCallback((vendorId: string) => {
    setNotifications(prev => prev.map(n => n.vendorId === vendorId ? { ...n, read: true } : n))
  }, [])

  const unreadCount = useCallback((vendorId: string) =>
    notifications.filter(n => n.vendorId === vendorId && !n.read).length,
  [notifications])

  return (
    <Ctx.Provider value={{ notifications, push, markRead, markAllRead, unreadCount }}>
      {children}
    </Ctx.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVendorNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVendorNotifications must be used inside VendorNotificationProvider')
  return ctx
}
