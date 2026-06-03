'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle, ArrowLeft, Calendar, Package, TrendingUp,
  CheckCircle2, Clock, AlertCircle, FileText, ChevronRight,
  MapPin, Phone, Mail, BarChart3, Layers, Edit3,
  Plus, ExternalLink, User, Truck, ClipboardCheck,
  Building2, X, Info, Send, RotateCcw, Eye, ChevronDown, Upload, Search,
  Zap, Lock, LockOpen,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { ProgressStrip } from '@/components/suborder/ProgressStrip'
import { StatusBadge, PreProdStageBadge, FIStatusBadge, OrderTypeBadge, TierBadge } from '@/components/shared/StatusBadge'
import { useSubOrder } from '@/lib/hooks/useSubOrders'

import { cn } from '@/lib/utils'
import type { SubOrder, PreProdStage, FIRequest, ActivityLog, SampleRecord, SampleType, SampleStatus, VendorRFQ, VendorRFQStatus } from '@/lib/types'
import { vendors, subOrders as allSubOrders } from '@/lib/data'

// ─── Production Update Modal ─────────────────────────────────────────────────

function ProductionUpdateModal({
  order,
  onClose,
}: {
  order: SubOrder
  onClose: () => void
}) {
  const [cutQty, setCutQty]     = useState(String(order.cutQty))
  const [sewingQty, setSewingQty] = useState(String(order.sewingQty))
  const [packedQty, setPackedQty] = useState(String(order.packedQty))
  const [onBehalf, setOnBehalf] = useState(false)
  const [reason, setReason]     = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    // In a real app, this would call an API
    setSubmitted(true)
    setTimeout(onClose, 1500)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-sm w-full">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Production Updated!</p>
          <p className="text-sm text-slate-500 mt-1">Quantities saved successfully.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">Update Production Quantities</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.id} · {order.styleCode} · {order.colour}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-6 mt-4 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 flex gap-2 text-xs text-violet-700">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Enter <strong className="mx-0.5">cumulative totals</strong> — system will calculate the daily delta automatically.
        </div>

        {/* Fields */}
        <div className="px-6 py-4 space-y-4">
          {/* Order context */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{order.orderQty}</p>
              <p className="text-xs text-slate-500">Order Qty</p>
            </div>
            <div>
              <p className="text-lg font-bold text-violet-600">{order.cutQty}</p>
              <p className="text-xs text-slate-500">Last Cut</p>
            </div>
            <div>
              <p className="text-lg font-bold text-violet-600">{order.sewingQty}</p>
              <p className="text-xs text-slate-500">Last Sewing</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Cut Qty (cumulative)</label>
            <input
              type="number"
              value={cutQty}
              onChange={e => setCutQty(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              min="0"
              max={order.orderQty}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Sewing Qty (cumulative)</label>
            <input
              type="number"
              value={sewingQty}
              onChange={e => setSewingQty(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Packed Qty (cumulative)</label>
            <input
              type="number"
              value={packedQty}
              onChange={e => setPackedQty(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* On behalf */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onBehalf}
                onChange={e => setOnBehalf(e.target.checked)}
                className="rounded text-violet-600"
              />
              <span className="text-sm text-slate-700">Entering on behalf of <strong>{order.vendor.name}</strong></span>
            </label>
            {onBehalf && (
              <div className="mt-2.5">
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Reason (required)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Vendor called with updated numbers, entered by POC"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={onBehalf && !reason.trim()}
            className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Update
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FI Request Modal ─────────────────────────────────────────────────────────

function FIRequestModal({ order, onClose }: { order: SubOrder; onClose: () => void }) {
  const [fiQty, setFiQty]     = useState(String(order.packedQty || order.sewingQty))
  const [location, setLocation] = useState(order.vendor.location)
  const [date, setDate]         = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-sm w-full">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">FI Requested!</p>
          <p className="text-sm text-slate-500 mt-1">The QA team has been notified.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">Request Final Inspection</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.id} · {order.styleCode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 flex gap-2 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            FI can be requested once production has started — even if packing is not complete.
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Qty for Inspection</label>
            <input
              type="number"
              value={fiQty}
              onChange={e => setFiQty(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Inspection Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Preferred Date (optional)</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => { setSubmitted(true); setTimeout(onClose, 1500) }}
            className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pre-Prod Unlock Modal ────────────────────────────────────────────────────

function PreProdUnlockModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason]   = useState('')
  const [acked,  setAcked]    = useState(false)
  const canSubmit = reason.trim().length > 0 && acked

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <LockOpen className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Unlock pre-production early</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Risk banner */}
        <div className="mx-5 mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">
            <span className="font-semibold">Vendor will proceed before costing is finalised.</span>
            {' '}No PO can be raised until costing is approved. Any materials or work done by the vendor are at their own risk.
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Reason for early unlock <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Tight inward date — vendor needs to start fabric approval now. Costing verbally agreed, paperwork pending."
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acked}
              onChange={e => setAcked(e.target.checked)}
              className="mt-0.5 accent-amber-500 w-3.5 h-3.5 flex-shrink-0"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I understand that vendor activities will proceed before costing is finalised, and this action will be recorded in the order history.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onConfirm(reason.trim())}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors',
              canSubmit
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            <LockOpen className="w-3.5 h-3.5" />
            Unlock Pre-Production
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pre-Prod Unlock Banner (shown in Overview tab) ───────────────────────────

type SplitChildUnlockState = {
  childId: string
  childLabel: string   // "A" / "B"
  vendor: string
  vendorLocation: string
  qty: number
  costStatus: string
  unlocked: boolean
  unlockedBy?: string
  unlockedAt?: string
  unlockReason?: string
}

function PreProdUnlockBanner({
  order,
  // single-vendor mode
  unlocked,
  unlockedBy,
  unlockedAt,
  unlockReason,
  canToggle,
  onUnlock,
  onRelock,
  // split mode
  splitChildren,
  onUnlockChild,
  onRelockChild,
}: {
  order: SubOrder
  unlocked?: boolean
  unlockedBy?: string
  unlockedAt?: string
  unlockReason?: string
  canToggle?: boolean
  onUnlock?: () => void
  onRelock?: () => void
  splitChildren?: SplitChildUnlockState[]
  onUnlockChild?: (childId: string) => void
  onRelockChild?: (childId: string) => void
}) {
  // Don't show if costing already approved
  if (order.costStatus === 'approved') return null

  const fmtDate = (iso?: string) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // ── Case 1: No vendor assigned ──────────────────────────────────────────────
  if (order.vendor.id === 'v_tba' && !splitChildren) {
    return (
      <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700">Pre-production locked — no vendor yet</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            A vendor must be assigned before pre-production can be started or unlocked.
          </p>
        </div>
      </div>
    )
  }

  // ── Case 2: Split parent — per-child unlock ─────────────────────────────────
  if (splitChildren && splitChildren.length > 0) {
    const allUnlocked = splitChildren.every(c => c.unlocked)
    return (
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Split order — pre-production is per vendor
            </p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              This order is split across {splitChildren.length} vendors. Each vendor's allocation
              can be unlocked independently before costing is approved.
            </p>
          </div>
        </div>

        {/* Per-child rows */}
        <div className="space-y-2">
          {splitChildren.map(child => (
            <div key={child.childId}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-white',
                child.unlocked ? 'border-amber-300' : 'border-slate-200'
              )}
            >
              {/* Vendor info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-800">{child.vendor}</span>
                  <span className="text-[10px] text-slate-500">{child.vendorLocation}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                    {child.qty} pcs
                  </span>
                  {child.unlocked && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5" /> Unlocked
                      {child.unlockedBy ? ` · ${child.unlockedBy}` : ''}
                      {child.unlockedAt ? ` · ${fmtDate(child.unlockedAt)}` : ''}
                    </span>
                  )}
                </div>
                {child.unlocked && child.unlockReason && (
                  <p className="text-[10px] text-amber-700 italic mt-0.5">"{child.unlockReason}"</p>
                )}
              </div>

              {/* Toggle */}
              {canToggle && (
                child.unlocked
                  ? (
                    <button
                      onClick={() => onRelockChild?.(child.childId)}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <Lock className="w-3 h-3" /> Re-lock
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnlockChild?.(child.childId)}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
                    >
                      <LockOpen className="w-3 h-3" /> Unlock
                    </button>
                  )
              )}
            </div>
          ))}
        </div>

        {allUnlocked && (
          <p className="text-xs text-amber-600 mt-2.5 pl-1">
            No PO can be raised for any allocation until costing is approved.
          </p>
        )}
      </div>
    )
  }

  // ── Case 3: Single vendor — standard lock/unlock ────────────────────────────
  if (!unlocked) {
    return (
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">Pre-production is locked</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Costing is not yet approved. Pre-prod stages cannot be started until costing is closed,
            unless manually unlocked by the POC or manager.
          </p>
        </div>
        {canToggle && (
          <button
            onClick={onUnlock}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            <LockOpen className="w-3.5 h-3.5" />
            Unlock Pre-Production
          </button>
        )}
      </div>
    )
  }

  // ── Case 4: Single vendor — unlocked ───────────────────────────────────────
  return (
    <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <Zap className="w-4 h-4 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-amber-900">Pre-production unlocked early</p>
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Costing pending</span>
          </div>
          {unlockedBy && (
            <p className="text-xs text-amber-700 mt-0.5">
              Unlocked by <span className="font-medium">{unlockedBy}</span>
              {unlockedAt ? ` · ${fmtDate(unlockedAt)}` : ''}
            </p>
          )}
          {unlockReason && (
            <p className="text-xs text-amber-800 mt-1 italic leading-relaxed">"{unlockReason}"</p>
          )}
          <p className="text-xs text-amber-600 mt-1.5">
            No PO can be raised until costing is approved.
          </p>
        </div>
        {canToggle && (
          <button
            onClick={onRelock}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            Re-lock
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ order, onUpdateProduction, onRequestFI, unlockBannerProps }: {
  order: SubOrder
  onUpdateProduction: () => void
  onRequestFI: () => void
  unlockBannerProps?: React.ComponentProps<typeof PreProdUnlockBanner>
}) {
  const qtyPct = order.orderQty > 0 ? Math.round((order.packedQty / order.orderQty) * 100) : 0

  return (
    <>
    {/* Lifecycle status banner */}
    {(order.currentStage === 'order-brief' || order.currentStage === 'assigned' || order.vendor.id === 'v_tba') && (
      <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {order.vendor.id === 'v_tba' ? 'Vendor Not Yet Assigned' : `Vendor Assigned: ${order.vendor.name}`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {order.vendor.id === 'v_tba'
              ? 'This order is awaiting vendor assignment before costing can begin.'
              : `${order.vendor.location} · Costing pending from vendor`
            }
          </p>
        </div>
      </div>
    )}

    {/* Pre-prod unlock banner */}
    {unlockBannerProps && <PreProdUnlockBanner {...unlockBannerProps} />}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
      {/* Left col: Key info */}
      <div className="md:col-span-2 space-y-4">
        {/* Qty summary card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Production Status</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onRequestFI}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors font-medium"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Request FI
              </button>
              <button
                onClick={onUpdateProduction}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Update Qty
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-5">
            {[
              { label: 'Order', value: order.orderQty, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Cut',   value: order.cutQty,   color: 'text-violet-700',  bg: 'bg-violet-50' },
              { label: 'Sewing',value: order.sewingQty, color: 'text-purple-700',bg: 'bg-purple-50' },
              { label: 'Packed',value: order.packedQty, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'FI',    value: order.fiQty,     color: 'text-orange-700',bg: 'bg-orange-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn('rounded-lg px-3 py-3 text-center', bg)}>
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Stacked progress */}
          <div className="space-y-2.5">
            {[
              { label: 'Cut',    qty: order.cutQty,    color: 'bg-violet-500' },
              { label: 'Sewing', qty: order.sewingQty, color: 'bg-purple-500' },
              { label: 'Packed', qty: order.packedQty, color: 'bg-green-500' },
            ].map(({ label, qty, color }) => {
              const pct = order.orderQty > 0 ? Math.min(100, Math.round((qty / order.orderQty) * 100)) : 0
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-12 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-600 font-medium w-14 text-right">{qty} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Dates card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Key Dates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Handover to POC',      date: order.handoverDate,              icon: Calendar, color: 'text-slate-500' },
              { label: 'Order to Vendor',       date: order.orderToVendorDate,         icon: Truck,    color: 'text-slate-500' },
              { label: 'Buying Expected Inward',date: order.buyingExpectedInwardDate,  icon: Package,  color: 'text-violet-600', highlight: true },
              { label: 'Vendor Promised Date',  date: order.vendorPromisedDate,        icon: Clock,    color: 'text-amber-600' },
            ].map(({ label, date, icon: Icon, color, highlight }) => (
              <div key={label} className={cn('rounded-lg px-4 py-3', highlight ? 'bg-violet-50 border border-violet-100' : 'bg-slate-50')}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
                <p className={cn('text-sm font-semibold', color)}>
                  {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
          {/* PO Status row */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
            <div className={cn('text-xs font-medium px-2.5 py-1 rounded-full',
              order.poNumbers.length > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            )}>
              {order.poNumbers.length > 0 ? `✓ PO Raised (${order.poNumbers.length} warehouses)` : '⏳ PO Not Yet Raised'}
            </div>
            {order.poNumbers.length > 0 && (
              <span className="text-xs text-slate-400">{order.poNumbers.map(p => p.poNumber).join(' · ')}</span>
            )}
          </div>
        </div>

        {/* Costing */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Costing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Target Price</p>
              <p className="text-lg font-bold text-slate-900">₹{order.targetPrice}</p>
            </div>
            <div className={cn('rounded-lg px-4 py-3', order.closedCost && order.closedCost <= order.targetPrice ? 'bg-green-50' : 'bg-amber-50')}>
              <p className="text-xs text-slate-500 mb-1">Closed Cost</p>
              <p className={cn('text-lg font-bold', order.closedCost ? (order.closedCost <= order.targetPrice ? 'text-green-700' : 'text-amber-700') : 'text-slate-400')}>
                {order.closedCost ? `₹${order.closedCost}` : '—'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Cost Status</p>
              <span className={cn('text-xs font-semibold px-2 py-1 rounded-full',
                order.costStatus === 'approved' ? 'bg-green-100 text-green-700' :
                order.costStatus === 'submitted' ? 'bg-violet-100 text-violet-700' :
                order.costStatus === 'escalated' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {order.costStatus.charAt(0).toUpperCase() + order.costStatus.slice(1)}
              </span>
            </div>
          </div>
          {order.closedCost && order.closedCost <= order.targetPrice && (
            <p className="text-xs text-green-600 mt-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Cost within target — savings of ₹{order.targetPrice - order.closedCost} per piece
              ({Math.round(((order.targetPrice - order.closedCost) / order.targetPrice) * 100)}% below target)
            </p>
          )}
        </div>

        {/* POs */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Purchase Orders</h3>
          <div className="space-y-2">
            {order.poNumbers.map(po => (
              <div key={po.poNumber} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 font-mono">{po.poNumber}</p>
                    <p className="text-xs text-slate-500">{po.warehouse} Warehouse</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-700">{po.qty} pcs</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-500">Total</span>
              <span className="text-sm font-bold text-slate-900">{order.poNumbers.reduce((s, p) => s + p.qty, 0)} pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right col: Vendor + metadata */}
      <div className="space-y-4">
        {/* Vendor card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-slate-400" />
            Vendor
          </h3>

          <div className="space-y-3">
            <div>
              <p className="font-semibold text-slate-900">{order.vendor.name}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {order.vendor.location}
              </p>
            </div>
            {order.vendor.contactName && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <User className="w-3 h-3 text-slate-400" />
                {order.vendor.contactName}
              </div>
            )}
            {order.vendor.contactPhone && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Phone className="w-3 h-3 text-slate-400" />
                {order.vendor.contactPhone}
              </div>
            )}
            {order.vendor.contactEmail && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail className="w-3 h-3 text-slate-400" />
                {order.vendor.contactEmail}
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {order.vendor.otifScore !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">OTIF Score</span>
                  <span className={cn('text-xs font-semibold', order.vendor.otifScore >= 75 ? 'text-green-600' : order.vendor.otifScore >= 60 ? 'text-amber-600' : 'text-red-600')}>
                    {order.vendor.otifScore}%
                  </span>
                </div>
              )}
              {order.vendor.fiPassRate !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">FI Pass Rate</span>
                  <span className={cn('text-xs font-semibold', order.vendor.fiPassRate >= 85 ? 'text-green-600' : order.vendor.fiPassRate >= 70 ? 'text-amber-600' : 'text-red-600')}>
                    {order.vendor.fiPassRate}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order metadata */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            Order Details
          </h3>
          <div className="space-y-2.5">
            {[
              { label: 'Style Code',   value: order.styleCode },
              { label: 'Style Name',   value: order.styleName },
              { label: 'Colour',       value: order.colour },
              { label: 'Category',     value: order.category },
              { label: 'Product',      value: order.product },
              { label: 'Season',       value: order.season },
              { label: 'Gender',       value: order.gender },
              { label: 'Age Group',    value: order.ageGroup },
              { label: 'Fabric',       value: order.fabricQuality },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-xs text-slate-500 w-24 flex-shrink-0 mt-0.5">{label}</span>
                <span className="text-xs text-slate-800 font-medium leading-tight">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
            <OrderTypeBadge type={order.orderType} />
            <TierBadge tier={order.tier} />
          </div>
        </div>

        {/* POC */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            POC
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {order.poc.initials}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{order.poc.name}</p>
              <p className="text-xs text-slate-500">{order.poc.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Tab: Pre-Production ──────────────────────────────────────────────────────

// ─── PP stage definitions (canonical 7-stage checklist) ──────────────────────

const PP_STAGE_DEFS: { name: string; abbr: string; type: 'approval' | 'tracking'; reviewer: string; gate: 'hard' | 'soft' }[] = [
  { name: 'Lab Dip',                       abbr: 'LD',  type: 'approval',  reviewer: 'Designer',             gate: 'hard' },
  { name: 'Strike Off',                     abbr: 'SO',  type: 'approval',  reviewer: 'Designer',             gate: 'soft' },
  { name: 'Fit Sample',                     abbr: 'FS',  type: 'approval',  reviewer: 'Fit Technician',       gate: 'hard' },
  { name: 'Fabric Inward (FD Status)',      abbr: 'FD',  type: 'tracking',  reviewer: 'POC',                  gate: 'hard' },
  { name: 'PP Sample (4B / Commercial)',    abbr: 'PP',  type: 'approval',  reviewer: 'Designer + Fit Tech',  gate: 'soft' },
  { name: 'GPT (Garment Processing Test)', abbr: 'GPT', type: 'tracking',  reviewer: 'POC',                  gate: 'soft' },
  { name: 'PP Fit',                         abbr: 'PPF', type: 'approval',  reviewer: 'Fit Technician',       gate: 'soft' },
]

const PP_STATUS_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'approved':    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', dot: 'bg-green-500'  },
  'pending':     { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-400'  },
  'overdue':     { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-500'    },
  'rejected':    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-600'    },
  'not-started': { bg: 'bg-slate-50',  text: 'text-slate-500',  border: 'border-slate-200', dot: 'bg-slate-300'  },
}

function PreProdTab({ order }: { order: SubOrder }) {
  const [stages, setStages] = useState<PreProdStage[]>(() => {
    // Merge existing data with the 7 canonical stages (fill gaps with not-started)
    return PP_STAGE_DEFS.map((def, i) => {
      const existing = order.preProdStages.find(s => s.name === def.name)
      return existing ?? {
        id: `pp-default-${i}`,
        name: def.name,
        status: 'not-started' as const,
        plannedDate: '',
        actualDate: undefined,
        approvedBy: undefined,
        approverRole: def.reviewer,
        remarks: undefined,
      }
    })
  })

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<PreProdStage>>({})

  const approved = stages.filter(s => s.status === 'approved').length
  const total = stages.length
  const allApproved = approved === total
  const pct = Math.round((approved / total) * 100)

  function openEdit(idx: number) {
    setExpandedIdx(expandedIdx === idx ? null : idx)
    setEditDraft({ ...stages[idx] })
  }

  function saveStage(idx: number) {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, ...editDraft } as PreProdStage : s))
    setExpandedIdx(null)
  }

  function quickAction(idx: number, action: 'approve' | 'reject' | 'pending') {
    setStages(prev => prev.map((s, i) => {
      if (i !== idx) return s
      if (action === 'approve') return { ...s, status: 'approved', actualDate: new Date().toISOString().split('T')[0] }
      if (action === 'reject')  return { ...s, status: 'rejected' }
      return { ...s, status: 'pending' }
    }))
  }

  return (
    <div className="space-y-4">

      {/* ── Unlocked-early pill ──────────────────────────────────────────────── */}
      {order.preProdUnlocked && order.costStatus !== 'approved' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
          <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            Unlocked early — costing not yet approved. Stages are accessible but vendor proceeds at their own risk.
          </p>
        </div>
      )}

      {/* ── Progress header ─────────────────────────────────────────────────── */}
      <div className={cn('rounded-xl border p-4', allApproved ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200')}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {allApproved
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <Clock className="w-4 h-4 text-amber-500" />
            }
            <span className={cn('text-sm font-semibold', allApproved ? 'text-green-800' : 'text-slate-800')}>
              {allApproved ? 'All stages approved — production gate cleared' : `${approved} of ${total} stages approved`}
            </span>
          </div>
          <span className={cn('text-sm font-bold', allApproved ? 'text-green-700' : 'text-violet-700')}>{pct}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', allApproved ? 'bg-green-500' : 'bg-violet-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Stage dots */}
        <div className="flex items-center gap-1 mt-3">
          {stages.map((s, i) => {
            const def = PP_STAGE_DEFS[i]
            const style = PP_STATUS_STYLE[s.status] ?? PP_STATUS_STYLE['not-started']
            return (
              <div key={i} title={`${def.name}: ${s.status}`}
                className={cn('flex items-center justify-center rounded-full text-[9px] font-bold border w-7 h-7 flex-shrink-0', style.bg, style.text, style.border)}>
                {s.status === 'approved' ? '✓' : def.abbr}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Stage cards ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {stages.map((stage, idx) => {
          const def = PP_STAGE_DEFS[idx]
          const style = PP_STATUS_STYLE[stage.status] ?? PP_STATUS_STYLE['not-started']
          const isExpanded = expandedIdx === idx
          const isActionable = stage.status !== 'approved'
          const today = new Date().toISOString().split('T')[0]
          const isOverdue = stage.plannedDate && stage.plannedDate < today && stage.status !== 'approved'

          return (
            <div key={stage.id} className={cn('rounded-xl border overflow-hidden transition-all', style.border, isExpanded ? style.bg : 'bg-white')}>
              {/* Card row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/80 transition-colors"
                onClick={() => openEdit(idx)}
              >
                {/* Status dot / number */}
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border text-xs font-bold', style.bg, style.text, style.border)}>
                  {stage.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : <span>{idx + 1}</span>}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{stage.name}</span>
                    {/* Type badge */}
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                      def.type === 'approval' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'
                    )}>
                      {def.type === 'approval' ? 'Approval' : 'Tracking'}
                    </span>
                    {/* Gate badge */}
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                      def.gate === 'hard' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                    )}>
                      {def.gate === 'hard' ? 'Hard gate' : 'Soft gate'}
                    </span>
                    {isOverdue && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    <span>Reviewer: <span className="text-slate-600">{def.reviewer}</span></span>
                    {stage.plannedDate && <span>Planned: <span className="text-slate-600">{fmtD(stage.plannedDate)}</span></span>}
                    {stage.actualDate  && <span>Actual: <span className="text-green-600 font-medium">{fmtD(stage.actualDate)}</span></span>}
                  </div>
                </div>

                {/* Status badge + quick actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium border capitalize', style.bg, style.text, style.border)}>
                    {stage.status.replace('-', ' ')}
                  </span>
                  {stage.status === 'approved' && stage.approvedBy && (
                    <span className="text-xs text-slate-400 hidden sm:inline">{stage.approvedBy}</span>
                  )}
                  <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
                </div>
              </div>

              {/* Expanded edit panel */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-white">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Status selector */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
                      <select
                        value={editDraft.status ?? stage.status}
                        onChange={e => setEditDraft(d => ({ ...d, status: e.target.value as PreProdStage['status'] }))}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        <option value="not-started">Not Started</option>
                        <option value="pending">Pending / Submitted</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </div>

                    {/* Planned date */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Planned Date</label>
                      <input type="date"
                        value={editDraft.plannedDate ?? stage.plannedDate}
                        onChange={e => setEditDraft(d => ({ ...d, plannedDate: e.target.value }))}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>

                    {/* Actual date */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Actual / Completion Date</label>
                      <input type="date"
                        value={editDraft.actualDate ?? stage.actualDate ?? ''}
                        onChange={e => setEditDraft(d => ({ ...d, actualDate: e.target.value }))}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>

                    {/* Approved by */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Approved / Reviewed By</label>
                      <input
                        value={editDraft.approvedBy ?? stage.approvedBy ?? ''}
                        onChange={e => setEditDraft(d => ({ ...d, approvedBy: e.target.value }))}
                        placeholder={def.reviewer}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Remarks / Notes</label>
                    <textarea
                      value={editDraft.remarks ?? stage.remarks ?? ''}
                      onChange={e => setEditDraft(d => ({ ...d, remarks: e.target.value }))}
                      rows={2}
                      placeholder="Any notes, revision comments, colour remarks, test results…"
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    />
                  </div>

                  {/* Photo upload placeholder */}
                  <div className="border border-dashed border-slate-300 rounded-xl px-4 py-3 flex items-center gap-3 bg-slate-50 cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-600">Upload sample photo / report</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG, PDF up to 10 MB</p>
                    </div>
                    {stage.photoUrl && <span className="ml-auto text-xs text-violet-600 font-medium">1 file attached</span>}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setExpandedIdx(null)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                    <div className="flex-1" />
                    {isActionable && (
                      <>
                        <button onClick={() => { quickAction(idx, 'reject'); setExpandedIdx(null) }}
                          className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors">
                          Reject
                        </button>
                        {stage.status !== 'pending' && (
                          <button onClick={() => { quickAction(idx, 'pending'); setExpandedIdx(null) }}
                            className="px-4 py-2 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors">
                            Mark Submitted
                          </button>
                        )}
                        <button onClick={() => { quickAction(idx, 'approve'); setExpandedIdx(null) }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      </>
                    )}
                    <button onClick={() => saveStage(idx)}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors">
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Gate legend ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Hard gate — production blocked until approved</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Soft gate — production can proceed with warning</span>
      </div>
    </div>
  )
}

// ─── Tab: Production ──────────────────────────────────────────────────────────

function ProductionTab({ order, onUpdate }: { order: SubOrder; onUpdate: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Production History</h3>
        <button
          onClick={onUpdate}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Update Quantities
        </button>
      </div>

      {/* Latest snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Cut', qty: order.cutQty, total: order.orderQty, color: 'bg-violet-500', textColor: 'text-violet-700', bgColor: 'bg-violet-50' },
          { label: 'Sewing', qty: order.sewingQty, total: order.orderQty, color: 'bg-purple-500', textColor: 'text-purple-700', bgColor: 'bg-purple-50' },
          { label: 'Packed', qty: order.packedQty, total: order.orderQty, color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' },
          { label: 'FI Passed', qty: order.fiQty, total: order.orderQty, color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50' },
        ].map(({ label, qty, total, color, textColor, bgColor }) => {
          const pct = total > 0 ? Math.min(100, Math.round((qty / total) * 100)) : 0
          return (
            <div key={label} className={cn('rounded-xl p-4', bgColor)}>
              <div className="flex items-end justify-between mb-2">
                <span className="text-xs text-slate-500">{label}</span>
                <span className={cn('text-xs font-semibold', textColor)}>{pct}%</span>
              </div>
              <p className={cn('text-2xl font-bold', textColor)}>{qty}</p>
              <p className="text-xs text-slate-500 mt-0.5">of {total}</p>
              <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* History table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Cut</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Sewing</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Packed</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily Δ Cut</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Updated By</th>
            </tr>
          </thead>
          <tbody>
            {order.productionHistory.map((entry, i) => {
              const prev = order.productionHistory[i + 1]
              const delta = prev ? entry.cutQty - prev.cutQty : entry.cutQty
              return (
                <tr key={entry.date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-700 font-medium">
                    {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-violet-700">{entry.cutQty}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-purple-700">{entry.sewingQty}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">{entry.packedQty}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('text-xs font-medium', delta > 0 ? 'text-green-600' : 'text-slate-400')}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs text-slate-700">{entry.updatedBy}</p>
                      {entry.onBehalfOf && (
                        <p className="text-xs text-amber-600">On behalf of {entry.onBehalfOf}</p>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Samples ─────────────────────────────────────────────────────────────

// ─── Sample status config ─────────────────────────────────────────────────────

const SAMPLE_STATUS_CONFIG: Record<SampleStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  'dispatched':         { label: 'Dispatched',         color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Truck },
  'received':           { label: 'Received',           color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Package },
  'under-review':       { label: 'Under Review',       color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Eye },
  'approved':           { label: 'Approved',           color: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle2 },
  'rejected':           { label: 'Rejected',           color: 'bg-red-50 text-red-700 border-red-200',         icon: X },
  'revision-requested': { label: 'Revision Requested', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: RotateCcw },
}

const SAMPLE_TYPES: SampleType[] = ['Proto', 'Fit Sample', 'Size Set', 'PP Sample', 'Sealer', 'TOP']

function fmtD(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function SamplesTab({ order }: { order: SubOrder }) {
  const [samples, setSamples] = useState<SampleRecord[]>(order.samples ?? [])
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // New sample form state
  const [form, setForm] = useState({
    type: 'Proto' as SampleType,
    qty: '',
    sentTo: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    courier: '',
    trackingNo: '',
    comments: '',
  })

  const handleLog = () => {
    if (!form.sentTo || !form.qty) return
    const existing = samples.filter(s => s.type === form.type)
    const round = existing.length + 1
    const newSample: SampleRecord = {
      id: `s-new-${Date.now()}`,
      type: form.type,
      round,
      dispatchDate: form.dispatchDate,
      sentTo: form.sentTo,
      courier: form.courier || undefined,
      trackingNo: form.trackingNo || undefined,
      qty: parseInt(form.qty) || 1,
      status: 'dispatched',
      comments: form.comments || undefined,
    }
    setSamples(prev => [...prev, newSample])
    setShowForm(false)
    setForm({ type: 'Proto', qty: '', sentTo: '', dispatchDate: new Date().toISOString().split('T')[0], courier: '', trackingNo: '', comments: '' })
  }

  // Group by type
  const byType = SAMPLE_TYPES.map(type => ({
    type,
    records: samples.filter(s => s.type === type),
  })).filter(g => g.records.length > 0)

  const hasSamples = samples.length > 0

  return (
    <div className="space-y-5">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sample Dispatch Log</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical samples sent from factory for review &amp; approval
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Sample
        </button>
      </div>

      {/* ── Progress summary ───────────────────────────────────────────────── */}
      {hasSamples && (
        <div className="grid grid-cols-3 gap-3">
          {(['dispatched','under-review','approved'] as SampleStatus[]).map(st => {
            const count = samples.filter(s => s.status === st).length
            const cfg = SAMPLE_STATUS_CONFIG[st]
            const Icon = cfg.icon
            return (
              <div key={st} className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', cfg.color)}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold leading-none">{count}</p>
                  <p className="text-xs mt-0.5 opacity-80">{cfg.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── New sample form ────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Log New Sample Dispatch</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sample Type <span className="text-red-500">*</span></label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as SampleType }))}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400">
                {SAMPLE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Qty Sent <span className="text-red-500">*</span></label>
              <input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                placeholder="e.g. 3"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sent To <span className="text-red-500">*</span></label>
              <input value={form.sentTo} onChange={e => setForm(f => ({ ...f, sentTo: e.target.value }))}
                placeholder="e.g. Priya M (Designer)"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Dispatch Date</label>
              <input type="date" value={form.dispatchDate} onChange={e => setForm(f => ({ ...f, dispatchDate: e.target.value }))}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Courier</label>
              <input value={form.courier} onChange={e => setForm(f => ({ ...f, courier: e.target.value }))}
                placeholder="e.g. DTDC, FedEx"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Tracking No.</label>
              <input value={form.trackingNo} onChange={e => setForm(f => ({ ...f, trackingNo: e.target.value }))}
                placeholder="e.g. DTDC-8821001"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Notes / Instructions for Reviewer</label>
            <textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
              rows={2} placeholder="Any specific points to check, colour notes, fit remarks…"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium hover:bg-white transition-colors">
              Cancel
            </button>
            <button onClick={handleLog} disabled={!form.sentTo || !form.qty}
              className={cn('flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5',
                form.sentTo && form.qty ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}>
              <Send className="w-3 h-3" /> Log Dispatch
            </button>
          </div>
        </div>
      )}

      {/* ── No samples empty state ─────────────────────────────────────────── */}
      {!hasSamples && !showForm && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-6 py-10 text-center">
          <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No samples logged yet</p>
          <p className="text-xs text-slate-400 mt-1">Use "Log Sample" to record when the factory dispatches a physical sample for review.</p>
        </div>
      )}

      {/* ── Sample cards grouped by type ───────────────────────────────────── */}
      {byType.map(({ type, records }) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{type}</p>
            <span className="text-xs text-slate-400">{records.length} round{records.length > 1 ? 's' : ''}</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="space-y-2">
            {records.sort((a, b) => a.round - b.round).map(sample => {
              const cfg = SAMPLE_STATUS_CONFIG[sample.status]
              const Icon = cfg.icon
              const isExpanded = expandedId === sample.id
              return (
                <div key={sample.id} className={cn('bg-white rounded-xl border overflow-hidden', cfg.color.split(' ')[0], 'border-slate-200')}>
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : sample.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border', cfg.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-800">Round {sample.round}</p>
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Dispatched {fmtD(sample.dispatchDate)} → {sample.sentTo}
                        {sample.courier && ` · ${sample.courier}`}
                        {sample.trackingNo && ` · ${sample.trackingNo}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-400">{sample.qty} pcs</span>
                      <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/50">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div><span className="text-slate-400">Dispatch date</span><p className="font-medium text-slate-700 mt-0.5">{fmtD(sample.dispatchDate)}</p></div>
                        {sample.receivedDate && <div><span className="text-slate-400">Received date</span><p className="font-medium text-slate-700 mt-0.5">{fmtD(sample.receivedDate)}</p></div>}
                        <div><span className="text-slate-400">Sent to</span><p className="font-medium text-slate-700 mt-0.5">{sample.sentTo}</p></div>
                        <div><span className="text-slate-400">Qty</span><p className="font-medium text-slate-700 mt-0.5">{sample.qty} pieces</p></div>
                        {sample.courier && <div><span className="text-slate-400">Courier</span><p className="font-medium text-slate-700 mt-0.5">{sample.courier}</p></div>}
                        {sample.trackingNo && <div><span className="text-slate-400">Tracking</span><p className="font-mono font-medium text-violet-700 mt-0.5">{sample.trackingNo}</p></div>}
                      </div>
                      {sample.comments && (
                        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Reviewer Comments</p>
                          <p className="text-xs text-slate-700">{sample.comments}</p>
                        </div>
                      )}
                      {sample.revisionNotes && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-1">Revision Instructions</p>
                          <p className="text-xs text-orange-800">{sample.revisionNotes}</p>
                        </div>
                      )}
                      {sample.status === 'approved' && sample.approvedBy && (
                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-green-800">Approved by {sample.approvedBy}</p>
                            {sample.approvedDate && <p className="text-xs text-green-600 mt-0.5">{fmtD(sample.approvedDate)}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Soft gate note ─────────────────────────────────────────────────── */}
      <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3 text-xs text-violet-700 flex gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>PP Sample approval is a <strong>soft gate</strong> — production can proceed with a warning if it is still pending. Lab Dip and Fit Sample are hard gates.</span>
      </div>
    </div>
  )
}

// ─── Tab: Inspection ─────────────────────────────────────────────────────────

function InspectionTab({ order, onRequestFI }: { order: SubOrder; onRequestFI: () => void }) {
  const canRequest = order.cutQty > 0 || order.sewingQty > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Final Inspection</h3>
          <p className="text-xs text-slate-500 mt-0.5">{order.fiRequests.length} inspection request(s)</p>
        </div>
        <button
          onClick={onRequestFI}
          disabled={!canRequest}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Request Inspection
        </button>
      </div>

      {!canRequest && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700 flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Production must start before requesting FI. Once cutting/sewing begins, FI can be requested at any time.
        </div>
      )}

      {order.fiRequests.length === 0 && canRequest && (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No inspection requests yet</p>
          <p className="text-xs text-slate-400 mt-1">
            {order.packedQty > 0
              ? `${order.packedQty} pcs packed — ready to request FI`
              : `${order.sewingQty} pcs in sewing — you can request FI now`
            }
          </p>
          <button
            onClick={onRequestFI}
            className="mt-4 text-xs text-violet-600 hover:underline font-medium"
          >
            Request your first inspection →
          </button>
        </div>
      )}

      {order.fiRequests.map((fi: FIRequest) => (
        <div key={fi.id} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Round {fi.round}</span>
                {fi.parentId && <span className="text-xs text-slate-500">(Re-inspection of {fi.parentId})</span>}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Requested: {new Date(fi.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
            <FIStatusBadge status={fi.status} />
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">FI Qty</span>
              <p className="font-semibold text-slate-900 mt-0.5">{fi.fiQty} pcs</p>
            </div>
            <div>
              <span className="text-slate-500">Scheduled</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {fi.scheduledDate ? new Date(fi.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Inspector</span>
              <p className="font-semibold text-slate-900 mt-0.5">{fi.assignedInspector || '—'}</p>
            </div>
            {fi.location && (
              <div>
                <span className="text-slate-500">Location</span>
                <p className="font-semibold text-slate-900 mt-0.5">{fi.location}</p>
              </div>
            )}
            {fi.result && (
              <div>
                <span className="text-slate-500">Result</span>
                <p className={cn('font-bold mt-0.5', fi.result === 'pass' ? 'text-green-600' : fi.result === 'fail' ? 'text-red-600' : 'text-amber-600')}>
                  {fi.result.toUpperCase()}
                </p>
              </div>
            )}
          </div>
          {fi.remarks && (
            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">{fi.remarks}</p>
          )}
          {fi.reportUrl && (
            <a href={fi.reportUrl} className="mt-2 text-xs text-violet-600 hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              View Inspection Report
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Costing ─────────────────────────────────────────────────────────────

// ─── Costing types ────────────────────────────────────────────────────────────

// Open costing — matches the exact columns from the sourcing cost sheet
type OpenCosting = {
  mainFabricPrice: string        // DN — ₹/metre
  mainFabricConsumption: string  // DO — metres
  trimFabricPrice: string        // DQ — ₹/metre
  trimFabricConsumption: string  // DR — metres
  trimCostThread: string         // DU — trims + thread (₹)
  cmp: string                    // DV — cut, make, pack (₹)
  valueAddition: string          // DW — embroidery, print, etc. (₹)
  testing: string                // DY — lab testing (₹)
  logistic: string               // DZ — freight / logistics (₹)
  rejectionPct: string           // EA — % applied on TTL product cost
  marginPct: string              // EB — % applied on TTL product cost
}

type NegotiationRound = {
  round: number
  by: 'vendor' | 'poc'
  quote: number
  variance: number     // % vs target
  notes: string
  date: string
  status: 'pending' | 'countered' | 'approved' | 'escalated'
}

// Intermediate open costing calculation — mirrors the spreadsheet columns
function deriveOpenCosting(b: OpenCosting) {
  const mainFabricCost  = (parseFloat(b.mainFabricPrice) || 0) * (parseFloat(b.mainFabricConsumption) || 0)
  const trimFabricCost  = (parseFloat(b.trimFabricPrice) || 0) * (parseFloat(b.trimFabricConsumption) || 0)
  const ttlFabricCost   = mainFabricCost + trimFabricCost
  const ttlProductCost  = ttlFabricCost
                        + (parseFloat(b.trimCostThread) || 0)
                        + (parseFloat(b.cmp) || 0)
                        + (parseFloat(b.valueAddition) || 0)
  const rejectionAmt    = ttlProductCost * ((parseFloat(b.rejectionPct) || 0) / 100)
  const marginAmt       = ttlProductCost * ((parseFloat(b.marginPct) || 0) / 100)
  const openCostingTotal = ttlProductCost
                         + (parseFloat(b.testing) || 0)
                         + (parseFloat(b.logistic) || 0)
                         + rejectionAmt
                         + marginAmt
  return {
    mainFabricCost:   Math.round(mainFabricCost * 100) / 100,
    trimFabricCost:   Math.round(trimFabricCost * 100) / 100,
    ttlFabricCost:    Math.round(ttlFabricCost * 100) / 100,
    ttlProductCost:   Math.round(ttlProductCost * 100) / 100,
    rejectionAmt:     Math.round(rejectionAmt * 100) / 100,
    marginAmt:        Math.round(marginAmt * 100) / 100,
    openCostingTotal: Math.round(openCostingTotal * 100) / 100,
  }
}

function variancePct(cost: number, target: number) {
  return Math.round(((cost - target) / target) * 100)
}

// Returns the label for who needs to approve based on variance %
function approvalRouting(variance: number): { role: string; colour: 'green' | 'amber' | 'red' } {
  if (variance <= 0)  return { role: 'Sourcing POC',       colour: 'green' }
  if (variance <= 5)  return { role: 'Sourcing Manager',   colour: 'amber' }
  return               { role: 'Category Head',            colour: 'red'   }
}

function CostingTab({ order }: { order: SubOrder }) {
  const isApproved  = order.costStatus === 'approved'
  const isPending   = order.costStatus === 'pending'
  const isSubmitted = order.costStatus === 'submitted'
  const isEscalated = order.costStatus === 'escalated'

  // ── Open costing state ───────────────────────────────────────────────────────
  const [breakdown, setBreakdown] = useState<OpenCosting>({
    mainFabricPrice: '', mainFabricConsumption: '',
    trimFabricPrice: '', trimFabricConsumption: '',
    trimCostThread: '', cmp: '', valueAddition: '',
    testing: '', logistic: '', rejectionPct: '', marginPct: '',
  })
  const [showBreakdown, setShowBreakdown] = useState(false)
  const bField = (k: keyof OpenCosting) => (v: string) => setBreakdown(p => ({ ...p, [k]: v }))

  // ── Negotiation / submission state ───────────────────────────────────────────
  const [rounds, setRounds] = useState<NegotiationRound[]>([])
  const [quoteInput, setQuoteInput]     = useState(order.closedCost ? String(order.closedCost) : '')
  const [notesInput, setNotesInput]     = useState('')
  const [counterInput, setCounterInput] = useState('')
  const [counterNotes, setCounterNotes] = useState('')
  const [escalateNotes, setEscalateNotes] = useState('')
  const [action, setAction]             = useState<'idle'|'counter'|'escalate'|'done'>('idle')
  const [mode, setMode]                 = useState<'vendor'|'poc'>('poc')

  const derived            = deriveOpenCosting(breakdown)
  const totalFromBreakdown = derived.openCostingTotal
  const effectiveQuote     = parseFloat(quoteInput) || 0
  const variance           = effectiveQuote > 0 ? variancePct(effectiveQuote, order.targetPrice) : null
  const withinTarget        = order.closedCost !== undefined && order.closedCost <= order.targetPrice
  const savings             = order.closedCost !== undefined ? order.targetPrice - order.closedCost : 0
  const routing            = variance !== null ? approvalRouting(variance) : null

  function submitRound() {
    if (!quoteInput) return
    const r: NegotiationRound = {
      round: rounds.length + 1,
      by: mode,
      quote: effectiveQuote,
      variance: variancePct(effectiveQuote, order.targetPrice),
      notes: notesInput,
      date: new Date().toISOString().split('T')[0],
      status: effectiveQuote <= order.targetPrice ? 'approved' : 'escalated',
    }
    setRounds(p => [...p, r])
    setAction('done')
  }

  function submitCounter() {
    const r: NegotiationRound = {
      round: rounds.length + 1,
      by: 'poc',
      quote: parseFloat(counterInput) || 0,
      variance: variancePct(parseFloat(counterInput) || 0, order.targetPrice),
      notes: counterNotes,
      date: new Date().toISOString().split('T')[0],
      status: 'countered',
    }
    setRounds(p => [...p, r])
    setAction('idle')
    setCounterInput('')
    setCounterNotes('')
  }

  const latestRound = rounds[rounds.length - 1]

  return (
    <div className="space-y-5">

      {/* ── Status banner ──────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium',
        isApproved  ? 'bg-green-50 border-green-200 text-green-800' :
        isEscalated ? 'bg-red-50 border-red-200 text-red-800' :
        isSubmitted ? 'bg-violet-50 border-violet-200 text-violet-800' :
        'bg-amber-50 border-amber-200 text-amber-800'
      )}>
        {isApproved  && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
        {isEscalated && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
        {isSubmitted && <Clock className="w-4 h-4 flex-shrink-0" />}
        {isPending   && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
        <span>
          {isApproved  && `Costing approved${order.costingApprovedDate ? ` · ${new Date(order.costingApprovedDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}` : ''}`}
          {isEscalated && 'Costing escalated — above target price, awaiting manager decision'}
          {isSubmitted && 'Vendor submitted cost — awaiting POC review'}
          {isPending   && 'Costing pending — vendor has not submitted yet'}
        </span>
      </div>

      {/* ── KPI summary row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Target Price</p>
          <p className="text-xl font-bold text-slate-900">₹{order.targetPrice}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">per piece</p>
        </div>
        <div className={cn('rounded-xl px-4 py-3 text-center border',
          isApproved && order.closedCost
            ? (withinTarget ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
            : 'bg-slate-50 border-slate-200'
        )}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Closed Cost</p>
          <p className={cn('text-xl font-bold', isApproved && order.closedCost ? (withinTarget ? 'text-green-700' : 'text-red-700') : 'text-slate-300')}>
            {order.closedCost ? `₹${order.closedCost}` : '—'}
          </p>
          <p className={cn('text-[10px] mt-0.5', withinTarget ? 'text-green-500' : order.closedCost ? 'text-red-500' : 'text-slate-400')}>
            {order.closedCost ? (withinTarget ? `₹${savings} below target` : `₹${Math.abs(savings)} above target`) : 'Not yet set'}
          </p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Order Qty</p>
          <p className="text-xl font-bold text-violet-700">{order.orderQty.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">pieces</p>
        </div>
        <div className={cn('rounded-xl px-4 py-3 text-center border',
          isApproved && order.closedCost ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'
        )}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Order Value</p>
          <p className={cn('text-xl font-bold', isApproved && order.closedCost ? 'text-violet-700' : 'text-slate-300')}>
            {order.closedCost ? `₹${(order.closedCost * order.orderQty).toLocaleString()}` : '—'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">at closed cost</p>
        </div>
      </div>

      {/* ── Approved read-only summary ─────────────────────────────────────── */}
      {isApproved && order.closedCost && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Approved Cost Summary</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Approved
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">Total savings on order</p>
              <p className="text-lg font-bold text-green-700">₹{(savings * order.orderQty).toLocaleString()}</p>
              <p className="text-xs text-green-600">₹{savings}/pc × {order.orderQty} pcs</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">Variance vs target</p>
              <p className={cn('text-lg font-bold', withinTarget ? 'text-green-700' : 'text-red-700')}>
                {withinTarget ? '-' : '+'}{Math.abs(variancePct(order.closedCost, order.targetPrice))}%
              </p>
              <p className="text-xs text-slate-400">₹{order.closedCost} vs ₹{order.targetPrice} target</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Open Costing Form ─────────────────────────────────────────────── */}
      {!isApproved && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-semibold text-slate-800">Open Costing Breakdown</span>
              <span className="text-xs text-slate-400">(optional — auto-calculates the final quote)</span>
            </div>
            <div className="flex items-center gap-3">
              {totalFromBreakdown > 0 && (
                <span className="text-sm font-bold text-violet-700">₹{totalFromBreakdown} / pc</span>
              )}
              <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', showBreakdown && 'rotate-180')} />
            </div>
          </button>

          {showBreakdown && (
            <div className="border-t border-slate-100 px-5 py-4 space-y-4">

              {/* ── Fabric Section ── */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Fabric</p>
                <div className="space-y-2">
                  {/* Main Fabric */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Main Fabric Price (₹/m)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                        <input type="number" value={breakdown.mainFabricPrice} onChange={e => bField('mainFabricPrice')(e.target.value)}
                          placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Consumption (m)</label>
                      <input type="number" value={breakdown.mainFabricConsumption} onChange={e => bField('mainFabricConsumption')(e.target.value)}
                        placeholder="0.00" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    </div>
                    <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-right min-w-[80px]">
                      <p className="text-[9px] text-slate-400">Main Fabric Cost</p>
                      <p className="text-sm font-bold text-violet-700">₹{derived.mainFabricCost.toFixed(2)}</p>
                    </div>
                  </div>
                  {/* Trim Fabric */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Trim Fabric Price (₹/m)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                        <input type="number" value={breakdown.trimFabricPrice} onChange={e => bField('trimFabricPrice')(e.target.value)}
                          placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Consumption (m)</label>
                      <input type="number" value={breakdown.trimFabricConsumption} onChange={e => bField('trimFabricConsumption')(e.target.value)}
                        placeholder="0.00" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    </div>
                    <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-right min-w-[80px]">
                      <p className="text-[9px] text-slate-400">Trim Fabric Cost</p>
                      <p className="text-sm font-bold text-violet-700">₹{derived.trimFabricCost.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                {/* TTL Fabric subtotal */}
                <div className="mt-2 flex justify-end">
                  <div className="bg-slate-800 text-white rounded-lg px-4 py-1.5 flex items-center gap-3">
                    <span className="text-[10px] font-medium">TTL Fabric Cost</span>
                    <span className="text-sm font-bold">₹{derived.ttlFabricCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* ── Processing Section ── */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Processing</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'trimCostThread' as const, label: 'Trim Cost + Thread', hint: 'buttons, zippers, labels, thread' },
                    { key: 'cmp'            as const, label: 'CMP',                hint: 'cut, make, pack' },
                    { key: 'valueAddition'  as const, label: 'Value Addition',     hint: 'embroidery, print, etc.' },
                  ]).map(({ key, label, hint }) => (
                    <div key={key}>
                      <label className="text-[10px] text-slate-400 block mb-1">{label} <span className="text-slate-300">({hint})</span></label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                        <input type="number" value={breakdown[key]} onChange={e => bField(key)(e.target.value)}
                          placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </div>
                    </div>
                  ))}
                </div>
                {/* TTL Product Cost subtotal */}
                <div className="mt-2 flex justify-end">
                  <div className="bg-slate-800 text-white rounded-lg px-4 py-1.5 flex items-center gap-3">
                    <span className="text-[10px] font-medium">TTL Product Cost</span>
                    <span className="text-sm font-bold">₹{derived.ttlProductCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* ── Overheads Section ── */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Overheads & Margins</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Testing (₹)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                      <input type="number" value={breakdown.testing} onChange={e => bField('testing')(e.target.value)}
                        placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Logistic (₹)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                      <input type="number" value={breakdown.logistic} onChange={e => bField('logistic')(e.target.value)}
                        placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Rejection %</label>
                    <div className="relative">
                      <input type="number" value={breakdown.rejectionPct} onChange={e => bField('rejectionPct')(e.target.value)}
                        placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg px-3 pr-7 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                    </div>
                    {breakdown.rejectionPct && <p className="text-[10px] text-slate-400 mt-0.5">= ₹{derived.rejectionAmt.toFixed(2)}/pc</p>}
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Margin %</label>
                    <div className="relative">
                      <input type="number" value={breakdown.marginPct} onChange={e => bField('marginPct')(e.target.value)}
                        placeholder="0" className="w-full text-xs border border-slate-200 rounded-lg px-3 pr-7 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                    </div>
                    {breakdown.marginPct && <p className="text-[10px] text-slate-400 mt-0.5">= ₹{derived.marginAmt.toFixed(2)}/pc</p>}
                  </div>
                </div>
              </div>

              {/* ── Final total bar ── */}
              <div className={cn('rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2',
                totalFromBreakdown === 0 ? 'bg-slate-900' :
                totalFromBreakdown <= order.targetPrice ? 'bg-green-700' : 'bg-red-700'
              )}>
                <div className="text-white">
                  <p className="text-[10px] font-medium opacity-70">Cost (Open Costing) / piece</p>
                  <p className="text-xl font-bold">₹{totalFromBreakdown > 0 ? totalFromBreakdown : '—'}</p>
                </div>
                <div className="flex items-center flex-wrap gap-3">
                  {totalFromBreakdown > 0 && (
                    <span className="text-xs text-white/80 font-medium">
                      {totalFromBreakdown <= order.targetPrice
                        ? `₹${(order.targetPrice - totalFromBreakdown).toFixed(0)} under target`
                        : `₹${(totalFromBreakdown - order.targetPrice).toFixed(0)} over target`}
                    </span>
                  )}
                  {totalFromBreakdown > 0 && (
                    <button
                      onClick={() => setQuoteInput(String(totalFromBreakdown))}
                      className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      Use as Quote →
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ── Vendor Quote submission / review ──────────────────────────────── */}
      {!isApproved && action !== 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {isSubmitted ? 'Review Vendor Quote' : 'Enter Vendor Quote'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSubmitted ? 'Vendor has submitted. Approve, counter-propose, or escalate.' : 'Enter the cost the vendor has quoted (or submit on their behalf).'}
              </p>
            </div>
            {/* Who is submitting */}
            {!isSubmitted && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
                <button onClick={() => setMode('poc')} className={cn('px-3 py-1.5 rounded-md transition-colors', mode==='poc' ? 'bg-white shadow text-slate-900' : 'text-slate-500')}>On Behalf</button>
                <button onClick={() => setMode('vendor')} className={cn('px-3 py-1.5 rounded-md transition-colors', mode==='vendor' ? 'bg-white shadow text-slate-900' : 'text-slate-500')}>Vendor Direct</button>
              </div>
            )}
          </div>

          {/* Negotiation rounds history */}
          {rounds.length > 0 && (
            <div className="space-y-2">
              {rounds.map(r => (
                <div key={r.round} className={cn('flex items-start gap-3 px-4 py-3 rounded-xl border text-xs',
                  r.status === 'approved' ? 'bg-green-50 border-green-200' :
                  r.status === 'escalated' ? 'bg-red-50 border-red-200' :
                  r.status === 'countered' ? 'bg-violet-50 border-violet-200' :
                  'bg-slate-50 border-slate-200'
                )}>
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white border flex items-center justify-center font-bold text-[10px] text-slate-600">{r.round}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-800">₹{r.quote}</span>
                      <span className={cn('px-1.5 py-0.5 rounded-full font-medium',
                        r.variance <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      )}>{r.variance > 0 ? '+' : ''}{r.variance}% vs target</span>
                      <span className="text-slate-400">by {r.by === 'poc' ? 'POC' : 'Vendor'} · {r.date}</span>
                    </div>
                    {r.notes && <p className="text-slate-600">{r.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quote input */}
          {action === 'idle' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  {isSubmitted ? 'Vendor Quote (₹ / piece)' : 'Quote to Enter (₹ / piece)'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₹</span>
                  <input type="number" value={quoteInput} onChange={e => setQuoteInput(e.target.value)}
                    placeholder={String(order.targetPrice)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                {quoteInput && variance !== null && routing && (
                  <div className={cn('mt-2 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2',
                    routing.colour === 'green' ? 'bg-green-50 border border-green-200 text-green-700' :
                    routing.colour === 'amber' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                    'bg-red-50 border border-red-200 text-red-700'
                  )}>
                    {routing.colour === 'green' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {routing.colour === 'amber' && <AlertCircle className="w-3.5 h-3.5" />}
                    {routing.colour === 'red'   && <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>
                      {variance <= 0
                        ? `Within target · ₹${Math.abs(variance * order.targetPrice / 100).toFixed(0)} headroom · approval: ${routing.role}`
                        : `${variance}% above target · ₹${(effectiveQuote - order.targetPrice).toFixed(0)}/pc over · approval: ${routing.role}`}
                    </span>
                    <span className="ml-auto font-bold">
                      Order impact: ₹{Math.abs((effectiveQuote - order.targetPrice) * order.orderQty).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Cost Notes / Justification</label>
                <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} rows={2}
                  placeholder="Breakdown of the quote, material specifics, reason for variance, etc."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {isSubmitted && (
                  <>
                    <button onClick={() => setAction('counter')}
                      className="flex-1 py-2.5 border border-violet-200 text-violet-700 rounded-xl text-sm font-semibold hover:bg-violet-50 transition-colors">
                      Counter-Propose
                    </button>
                    <button onClick={() => setAction('escalate')}
                      className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border',
                        routing?.colour === 'amber'
                          ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          : 'border-red-200 text-red-600 hover:bg-red-50'
                      )}>
                      {routing?.colour === 'amber' ? 'Send to Sourcing Manager' : 'Send to Category Head'}
                    </button>
                  </>
                )}
                <button disabled={!quoteInput} onClick={submitRound}
                  className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2',
                    quoteInput ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}>
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitted
                    ? variance !== null && variance <= 0
                      ? 'Approve Costing'
                      : variance !== null && variance <= 5
                      ? 'Submit to Sourcing Manager'
                      : 'Submit to Category Head'
                    : 'Submit Quote'}
                </button>
              </div>
            </div>
          )}

          {/* Counter-propose form */}
          {action === 'counter' && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-violet-800">Send Counter-Proposal to Vendor</p>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Your Counter Price (₹/pc) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input type="number" value={counterInput} onChange={e => setCounterInput(e.target.value)}
                    placeholder={String(order.targetPrice)}
                    className="w-full border border-violet-200 rounded-lg pl-8 pr-4 py-2.5 text-lg font-bold bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason / Message to Vendor</label>
                <textarea value={counterNotes} onChange={e => setCounterNotes(e.target.value)} rows={2}
                  placeholder="Explain what needs to change — fabric substitution, CMT reduction, etc."
                  className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAction('idle')} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium bg-white hover:bg-slate-50">Cancel</button>
                <button onClick={submitCounter} disabled={!counterInput}
                  className={cn('flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5',
                    counterInput ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}>
                  <Send className="w-3 h-3" /> Send Counter
                </button>
              </div>
            </div>
          )}

          {/* Escalate form */}
          {action === 'escalate' && (
            <div className={cn('rounded-xl p-4 space-y-3 border',
              routing?.colour === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
            )}>
              <p className={cn('text-xs font-semibold', routing?.colour === 'amber' ? 'text-amber-800' : 'text-red-800')}>
                Send to {routing?.role ?? 'Approver'} for Review
              </p>
              <p className={cn('text-xs', routing?.colour === 'amber' ? 'text-amber-700' : 'text-red-600')}>
                {routing?.colour === 'amber'
                  ? 'Quote is 0–5% above target. Sourcing Manager can approve or ask vendor to resubmit.'
                  : 'Quote is more than 5% above target. Category Head approval is required.'}
              </p>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Escalation Notes <span className="text-red-500">*</span></label>
                <textarea value={escalateNotes} onChange={e => setEscalateNotes(e.target.value)} rows={2}
                  placeholder={`Context for the ${routing?.role ?? 'approver'} — reason for variance, vendor justification, etc.`}
                  className={cn('w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 resize-none border',
                    routing?.colour === 'amber' ? 'border-amber-200 focus:ring-amber-400' : 'border-red-200 focus:ring-red-400'
                  )} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAction('idle')} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium bg-white hover:bg-slate-50">Cancel</button>
                <button onClick={() => setAction('done')} disabled={!escalateNotes}
                  className={cn('flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5',
                    escalateNotes
                      ? routing?.colour === 'amber' ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}>
                  <AlertTriangle className="w-3 h-3" /> Send to {routing?.role ?? 'Approver'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Done confirmation ─────────────────────────────────────────────── */}
      {action === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="font-bold text-green-800 text-base">
            {latestRound?.status === 'approved'
              ? 'Costing Approved!'
              : latestRound?.status === 'escalated'
              ? `Sent to ${routing?.role ?? 'Approver'}`
              : 'Action Recorded'}
          </p>
          <p className="text-xs text-green-600 mt-1">
            {latestRound?.status === 'approved'
              ? `Approved at ₹${latestRound.quote}/pc · Order value ₹${(latestRound.quote * order.orderQty).toLocaleString()}`
              : `${routing?.role ?? 'Approver'} will review and can approve or ask the vendor to resubmit.`}
          </p>
        </div>
      )}

      {/* ── Costing history / timeline ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Costing Timeline</h3>
        {(() => {
          const costLogs = order.history.filter(h => h.action.toLowerCase().includes('cost'))
          if (costLogs.length === 0) return <p className="text-xs text-slate-400">No costing actions recorded yet.</p>
          return (
            <div className="relative">
              <div className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-100" />
              {costLogs.map((log, i) => (
                <div key={log.id} className="flex items-start gap-3 pb-4 last:pb-0 relative">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 z-10">
                    <BarChart3 className="w-3 h-3 text-amber-600" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-xs font-medium text-slate-900">{log.action}</p>
                    {log.details && <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{log.actor} · {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Tab: ASN / GRN ───────────────────────────────────────────────────────────

function ASNGRNTab({ order }: { order: SubOrder }) {
  const [asnMode, setAsnMode] = useState(false)
  const [grnMode, setGrnMode] = useState(false)
  const [asnData, setAsnData] = useState({ shipmentDate: '', courier: '', trackingNo: '', qty: String(order.packedQty || '') })
  const [grnData, setGrnData] = useState({ receivedDate: '', receivedQty: '', shortageQty: '0', remarks: '' })
  const [asnSaved, setAsnSaved] = useState(false)
  const [grnSaved, setGrnSaved] = useState(false)

  const canASN = order.packedQty > 0
  const canGRN = order.dispatchedQty > 0 || order.packedQty > 0

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Stage context */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className={cn('px-2 py-1 rounded border', order.packedQty > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200')}>
          {order.packedQty} pcs packed
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className={cn('px-2 py-1 rounded border', order.dispatchedQty > 0 ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-slate-50 border-slate-200')}>
          {order.dispatchedQty} pcs dispatched (ASN)
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className={cn('px-2 py-1 rounded border', order.grnQty > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200')}>
          {order.grnQty} pcs received (GRN)
        </span>
      </div>

      {/* ASN Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-400" />
              Advance Shipment Notice (ASN)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Vendor dispatches goods and shares tracking details</p>
          </div>
          {!asnSaved && canASN && !asnMode && (
            <button onClick={() => setAsnMode(true)} className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors">
              + Create ASN
            </button>
          )}
        </div>

        {!canASN && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700 flex gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Packing must start before creating an ASN. Update production quantities first.
          </div>
        )}

        {asnSaved ? (
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            ASN created — tracking {asnData.trackingNo || 'pending'} via {asnData.courier || 'courier'}
          </div>
        ) : asnMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Shipment Date</label>
                <input type="date" value={asnData.shipmentDate} onChange={e => setAsnData(p => ({...p, shipmentDate: e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Dispatch Qty</label>
                <input type="number" value={asnData.qty} onChange={e => setAsnData(p => ({...p, qty: e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Courier / Transporter</label>
                <input type="text" value={asnData.courier} onChange={e => setAsnData(p => ({...p, courier: e.target.value}))} placeholder="e.g. DTDC, BlueDart" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Tracking / LR Number</label>
                <input type="text" value={asnData.trackingNo} onChange={e => setAsnData(p => ({...p, trackingNo: e.target.value}))} placeholder="e.g. LR-XXXX" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>

            {/* PO allocation */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-2 block">Ship to Warehouses (PO Split)</label>
              <div className="space-y-2">
                {order.poNumbers.map(po => (
                  <div key={po.poNumber} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-slate-900">{po.poNumber} — {po.warehouse}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Allot:</span>
                      <input type="number" defaultValue={po.qty} className="w-20 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 text-right" />
                      <span className="text-xs text-slate-400">of {po.qty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAsnMode(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => { setAsnSaved(true); setAsnMode(false) }} className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">Create ASN</button>
            </div>
          </div>
        ) : canASN && (
          <p className="text-xs text-slate-400">No ASN created yet. {order.packedQty} pcs are packed and ready to dispatch.</p>
        )}
      </div>

      {/* GRN Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" />
              Goods Receipt Note (GRN)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Warehouse receives goods and confirms quantities</p>
          </div>
          {!grnSaved && canGRN && !grnMode && (
            <button onClick={() => setGrnMode(true)} className="text-xs px-3 py-1.5 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 font-medium transition-colors">
              + Record GRN
            </button>
          )}
        </div>

        {!canGRN && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-500">
            GRN will be available once goods are dispatched via ASN.
          </div>
        )}

        {grnSaved ? (
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            GRN recorded — {grnData.receivedQty} pcs received on {grnData.receivedDate || 'today'}.
            {Number(grnData.shortageQty) > 0 && <span className="text-amber-600 ml-1">({grnData.shortageQty} pcs short)</span>}
          </div>
        ) : grnMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Date Received</label>
                <input type="date" value={grnData.receivedDate} onChange={e => setGrnData(p => ({...p, receivedDate: e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Qty Received</label>
                <input type="number" value={grnData.receivedQty} onChange={e => setGrnData(p => ({...p, receivedQty: e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Shortage Qty</label>
                <input type="number" value={grnData.shortageQty} onChange={e => setGrnData(p => ({...p, shortageQty: e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Remarks</label>
                <input type="text" value={grnData.remarks} onChange={e => setGrnData(p => ({...p, remarks: e.target.value}))} placeholder="e.g. 5 pcs damaged, returned to vendor" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGrnMode(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => { setGrnSaved(true); setGrnMode(false) }} className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">Save GRN</button>
            </div>
          </div>
        ) : canGRN && (
          <p className="text-xs text-slate-400">No GRN recorded yet.</p>
        )}
      </div>
    </div>
  )
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab({ order }: { order: SubOrder }) {
  const iconMap: Record<string, React.ReactNode> = {
    'POC':                 <User className="w-3 h-3" />,
    'Auto':                <BarChart3 className="w-3 h-3" />,
    'Sourcing Manager':    <Layers className="w-3 h-3" />,
    'Category Head':       <FileText className="w-3 h-3" />,
    'Fit Technician':      <CheckCircle2 className="w-3 h-3" />,
    'Designer + Fit Tech': <CheckCircle2 className="w-3 h-3" />,
    'Designer':            <CheckCircle2 className="w-3 h-3" />,
  }

  return (
    <div className="space-y-2">
      {order.history.map((log: ActivityLog, i: number) => (
        <div key={log.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs',
              log.actorRole === 'Auto' ? 'bg-slate-400' :
              log.actorRole.includes('Manager') ? 'bg-purple-500' :
              log.actorRole.includes('Category') ? 'bg-indigo-500' :
              'bg-violet-500'
            )}>
              {iconMap[log.actorRole] || <User className="w-3 h-3" />}
            </div>
            {i < order.history.length - 1 && (
              <div className="w-px flex-1 bg-slate-200 my-1" />
            )}
          </div>
          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{log.action}</p>
                {log.onBehalfOf && (
                  <p className="text-xs text-amber-600 mt-0.5">On behalf of {log.onBehalfOf}</p>
                )}
                {log.details && (
                  <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>
                )}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">
                {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' '}
                {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {log.actor} · <span className="text-slate-400">{log.actorRole}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Vendor Assign Tab ────────────────────────────────────────────────────────

const RFQ_STATUS_LABELS: Record<VendorRFQStatus, string> = {
  sent:      'Awaiting Response',
  responded: 'Quote Received',
  declined:  'Declined',
  accepted:  'Confirmed',
  rejected:  'Rejected',
  expired:   'Expired',
  revoked:   'Revoked',
}

const RFQ_STATUS_STYLES: Record<VendorRFQStatus, string> = {
  sent:      'bg-blue-50 text-blue-700 border-blue-200',
  responded: 'bg-violet-50 text-violet-700 border-violet-200',
  declined:  'bg-red-50 text-red-600 border-red-200',
  accepted:  'bg-green-50 text-green-700 border-green-200',
  rejected:  'bg-slate-100 text-slate-500 border-slate-200',
  expired:   'bg-slate-100 text-slate-500 border-slate-200',
  revoked:   'bg-orange-50 text-orange-600 border-orange-200',
}

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

// ─── Vendor Discovery Modal ───────────────────────────────────────────────────

function VendorDiscoveryModal({
  order,
  onClose,
  onSendRFQ,
}: {
  order: SubOrder
  onClose: () => void
  onSendRFQ: (selectedVendors: typeof vendors) => void
}) {
  const [search, setSearch]         = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [selected, setSelected]     = useState<Set<string>>(new Set())

  const alreadySentIds = new Set((order.vendorRFQs ?? []).map(r => r.vendor.id))

  // Per-vendor workload: count active orders (stage not 'grn') and total pipeline qty
  const vendorWorkload = new Map<string, { activeOrders: number; pipelineQty: number; sameCategory: number }>()
  for (const so of allSubOrders) {
    if (!so.vendor?.id || so.vendor.id === 'v_tba') continue
    if (so.currentStage === 'grn') continue
    const prev = vendorWorkload.get(so.vendor.id) ?? { activeOrders: 0, pipelineQty: 0, sameCategory: 0 }
    prev.activeOrders += 1
    prev.pipelineQty  += so.orderQty
    if (so.category === order.category) prev.sameCategory += 1
    vendorWorkload.set(so.vendor.id, prev)
  }

  const filtered = vendors.filter(v => {
    if (alreadySentIds.has(v.id)) return false
    if (tierFilter !== 'all' && v.tier !== tierFilter) return false
    const q = search.toLowerCase()
    return v.name.toLowerCase().includes(q) || v.location.toLowerCase().includes(q)
  })

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSend = () => {
    const chosen = vendors.filter(v => selected.has(v.id))
    onSendRFQ(chosen)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900">Select Vendors — Send RFQ</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.styleName} · {order.colour} · {order.orderQty} pcs</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex gap-1.5">
            {['all','Tier 1','Tier 2','Tier 3'].map(t => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={cn('px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  tierFilter === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                )}
              >
                {t === 'all' ? 'All Tiers' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Vendor list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No vendors match your filters</p>
            </div>
          ) : (
            filtered.map(v => {
              const isSelected = selected.has(v.id)
              const wl         = vendorWorkload.get(v.id) ?? { activeOrders: 0, pipelineQty: 0, sameCategory: 0 }
              const loadColor  = wl.activeOrders >= 8 ? 'text-red-600' : wl.activeOrders >= 4 ? 'text-amber-600' : 'text-green-600'
              return (
                <button
                  key={v.id}
                  onClick={() => toggle(v.id)}
                  className={cn(
                    'w-full text-left rounded-xl border p-4 transition-all',
                    isSelected
                      ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300'
                      : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                    )}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-900">{v.name}</span>
                        {v.tier && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{v.tier}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{v.location}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                          wl.activeOrders >= 8 ? 'bg-red-50 border-red-200 text-red-700' :
                          wl.activeOrders >= 4 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          'bg-green-50 border-green-200 text-green-700'
                        )}>
                          <Package className="w-2.5 h-2.5" />
                          {wl.activeOrders} active
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {wl.pipelineQty.toLocaleString()} pcs in pipeline
                        </span>
                        {wl.sameCategory > 0 && (
                          <span className="text-[11px] text-violet-600 font-medium">
                            · {wl.sameCategory} {order.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <div className="text-center">
                        <p className={cn('text-sm font-bold', (v.otifScore ?? 0) >= 75 ? 'text-green-600' : (v.otifScore ?? 0) >= 60 ? 'text-amber-600' : 'text-red-600')}>
                          {v.otifScore ?? '—'}%
                        </p>
                        <p className="text-xs text-slate-400">OTIF</p>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-sm font-bold', (v.fiPassRate ?? 0) >= 85 ? 'text-green-600' : (v.fiPassRate ?? 0) >= 70 ? 'text-amber-600' : 'text-red-600')}>
                          {v.fiPassRate ?? '—'}%
                        </p>
                        <p className="text-xs text-slate-400">FI Pass</p>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-sm font-bold', loadColor)}>
                          {wl.activeOrders}
                        </p>
                        <p className="text-xs text-slate-400">Load</p>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-500">
            {selected.size > 0 ? `${selected.size} vendor${selected.size > 1 ? 's' : ''} selected` : 'Select vendors to send RFQ'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button
              onClick={handleSend}
              disabled={selected.size === 0}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Preview RFQ ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── RFQ Preview Modal ────────────────────────────────────────────────────────

function RFQPreviewModal({
  order,
  selectedVendors,
  onClose,
  onConfirm,
}: {
  order: SubOrder
  selectedVendors: typeof vendors
  onClose: () => void
  onConfirm: (notes: string, expiryDays: number) => void
}) {
  const [notes, setNotes]           = useState('')
  const [expiryDays, setExpiryDays] = useState(7)
  const [sending, setSending]       = useState(false)
  const [sent, setSent]             = useState(false)

  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + expiryDays)

  const handleConfirm = () => {
    setSending(true)
    setTimeout(() => {
      setSent(true)
      setTimeout(() => onConfirm(notes, expiryDays), 1200)
    }, 800)
  }

  if (sent) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-sm w-full">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">RFQ Sent!</p>
          <p className="text-sm text-slate-500 mt-1">
            Sent to {selectedVendors.length} vendor{selectedVendors.length > 1 ? 's' : ''}. Expires {expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-slate-900">RFQ Preview</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Sending to */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sending to</p>
            <div className="flex flex-wrap gap-2">
              {selectedVendors.map(v => (
                <span key={v.id} className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">
                  {v.name}
                </span>
              ))}
            </div>
          </div>

          {/* Style brief */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Style Brief</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Style Code',    order.styleCode],
                ['Style Name',    order.styleName],
                ['Colour',        order.colour],
                ['Category',      order.category],
                ['Fabric',        order.fabricQuality],
                ['Order Qty',     `${order.orderQty} pcs`],
                ['Target Price',  `₹${order.targetPrice} / pc`],
                ['Handover Date', new Date(order.handoverDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech pack */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">Tech Pack — {order.styleCode}</p>
              <p className="text-xs text-slate-400">Attached to this RFQ</p>
            </div>
            {order.techPackUrl ? (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Linked</span>
            ) : (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Missing</span>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Notes to vendor</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="E.g. Ensure floral print is centered. Refer tech pack page 4 for placement..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">RFQ expires in</label>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {[3,5,7,10,14].map(d => (
                  <button
                    key={d}
                    onClick={() => setExpiryDays(d)}
                    className={cn('w-10 h-10 rounded-lg text-sm font-medium border transition-colors',
                      expiryDays === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                Expires {expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Back</button>
          <button
            onClick={handleConfirm}
            disabled={sending || !order.techPackUrl}
            className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            {sending ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
            ) : (
              <><Send className="w-3.5 h-3.5" />Send RFQ to {selectedVendors.length} vendor{selectedVendors.length > 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vendor Assign Tab ────────────────────────────────────────────────────────

function VendorAssignTab({ order }: { order: SubOrder }) {
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [showPreview, setShowPreview]     = useState(false)
  const [selectedVendors, setSelectedVendors] = useState<typeof vendors>([])
  const [rfqs, setRfqs]                   = useState<VendorRFQ[]>(order.vendorRFQs ?? [])
  const [confirmingId, setConfirmingId]   = useState<string | null>(null)

  const responded   = rfqs.filter(r => r.status === 'responded')
  const sent        = rfqs.filter(r => r.status === 'sent')
  const declined    = rfqs.filter(r => r.status === 'declined' || r.status === 'expired' || r.status === 'revoked')
  const isConfirmed = rfqs.some(r => r.status === 'accepted')
  const confirmedRFQ = rfqs.find(r => r.status === 'accepted')

  const handleSelectVendors = (v: typeof vendors) => {
    setSelectedVendors(v)
    setShowDiscovery(false)
    setShowPreview(true)
  }

  const handleConfirmSend = (_notes: string, _expiryDays: number) => {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + _expiryDays)
    const newRFQs: VendorRFQ[] = selectedVendors.map((v, i) => ({
      id: `rfq-new-${Date.now()}-${i}`,
      subOrderId: order.id,
      vendor: v,
      styleCode: order.styleCode,
      styleName: order.styleName,
      colour: order.colour,
      orderQty: order.orderQty,
      targetPrice: order.targetPrice,
      handoverDate: order.handoverDate,
      fabricQuality: order.fabricQuality,
      category: order.category,
      sizeRatio: '1:2:2:1',
      warehouseSplit: [],
      techPackUrl: order.techPackUrl ?? '',
      notes: _notes,
      status: 'sent',
      sentAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
    }))
    setRfqs(prev => [...prev, ...newRFQs])
    setShowPreview(false)
  }

  const handleRevoke = (rfqId: string) => {
    setRfqs(prev => prev.map(r => r.id === rfqId ? { ...r, status: 'revoked' as VendorRFQStatus } : r))
  }

  const handleAccept = (rfqId: string) => {
    setConfirmingId(rfqId)
    setTimeout(() => {
      setRfqs(prev => prev.map(r => ({
        ...r,
        status: r.id === rfqId ? 'accepted' : (r.status === 'sent' || r.status === 'responded') ? 'rejected' : r.status,
      } as VendorRFQ)))
      setConfirmingId(null)
    }, 800)
  }

  return (
    <div className="space-y-4">
      {/* Status summary */}
      {isConfirmed && confirmedRFQ ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Vendor Confirmed — {confirmedRFQ.vendor.name}</p>
            <p className="text-xs text-green-700 mt-0.5">
              ₹{confirmedRFQ.quotedPrice}/pc · Promised {confirmedRFQ.vendorPromisedDate
                ? new Date(confirmedRFQ.vendorPromisedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </p>
          </div>
        </div>
      ) : rfqs.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {responded.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">
              {responded.length} Quote{responded.length > 1 ? 's' : ''} Received
            </span>
          )}
          {sent.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              {sent.length} Awaiting Response
            </span>
          )}
          {declined.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
              {declined.length} Declined / Revoked
            </span>
          )}
          {rfqs[0]?.expiresAt && (
            <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1',
              daysUntil(rfqs[0].expiresAt) <= 2
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            )}>
              <Clock className="w-3 h-3" />
              {daysUntil(rfqs[0].expiresAt) > 0
                ? `Expires in ${daysUntil(rfqs[0].expiresAt)}d`
                : 'Expired'}
            </span>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center">
          <Send className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No RFQs sent yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Select vendors and send an RFQ to start the vendor selection process</p>
        </div>
      )}

      {/* RFQ Tracker */}
      {rfqs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">RFQ Tracker</h4>
            <span className="text-xs text-slate-400">{rfqs.length} sent</span>
          </div>
          <div className="divide-y divide-slate-100">
            {rfqs.map(rfq => (
              <div key={rfq.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900">{rfq.vendor.name}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', RFQ_STATUS_STYLES[rfq.status])}>
                        {RFQ_STATUS_LABELS[rfq.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{rfq.vendor.location}
                      {rfq.sentAt && <span className="ml-2">· Sent {new Date(rfq.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                      {rfq.expiresAt && rfq.status === 'sent' && (
                        <span className={cn('ml-1', daysUntil(rfq.expiresAt) <= 2 ? 'text-red-500 font-medium' : '')}>
                          · Expires {new Date(rfq.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {rfq.status === 'sent' && (
                      <button
                        onClick={() => handleRevoke(rfq.id)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                    {rfq.status === 'responded' && (
                      <button
                        onClick={() => handleAccept(rfq.id)}
                        disabled={confirmingId === rfq.id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 flex items-center gap-1 transition-colors"
                      >
                        {confirmingId === rfq.id
                          ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Confirming</>
                          : 'Accept'
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Quote details */}
                {rfq.status === 'responded' && rfq.quotedPrice !== undefined && (
                  <div className="mt-2.5 grid grid-cols-3 gap-3 bg-violet-50 rounded-lg p-2.5 border border-violet-100">
                    <div>
                      <p className="text-xs text-slate-400">Quoted Price</p>
                      <p className="text-sm font-semibold text-slate-900">₹{rfq.quotedPrice}<span className="text-xs font-normal text-slate-400">/pc</span></p>
                      <p className={cn('text-xs font-medium', rfq.quotedPrice <= order.targetPrice ? 'text-green-600' : 'text-red-500')}>
                        {rfq.quotedPrice <= order.targetPrice
                          ? `₹${order.targetPrice - rfq.quotedPrice} below target`
                          : `₹${rfq.quotedPrice - order.targetPrice} above target`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Promised Date</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {rfq.vendorPromisedDate ? new Date(rfq.vendorPromisedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Capacity</p>
                      <p className="text-sm font-semibold text-slate-900">{rfq.capacityQty ?? order.orderQty} pcs</p>
                    </div>
                  </div>
                )}

                {/* Decline reason */}
                {rfq.status === 'declined' && rfq.declineReason && (
                  <p className="mt-1.5 text-xs text-red-500 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">
                    {rfq.declineReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send RFQ CTA */}
      {!isConfirmed && (
        <button
          onClick={() => setShowDiscovery(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-violet-700 border border-violet-200 rounded-xl hover:bg-violet-50 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {rfqs.length > 0 ? 'Send to More Vendors' : 'Select Vendors & Send RFQ'}
        </button>
      )}

      {/* Modals */}
      {showDiscovery && (
        <VendorDiscoveryModal
          order={order}
          onClose={() => setShowDiscovery(false)}
          onSendRFQ={handleSelectVendors}
        />
      )}
      {showPreview && (
        <RFQPreviewModal
          order={order}
          selectedVendors={selectedVendors}
          onClose={() => { setShowPreview(false); setShowDiscovery(true) }}
          onConfirm={handleConfirmSend}
        />
      )}
    </div>
  )
}

// ─── Shared panel content (used in both drawer and standalone page) ───────────

type TabKey = 'overview' | 'vendor-assign' | 'costing' | 'pre-prod' | 'production' | 'samples' | 'inspection' | 'asn-grn' | 'history'

export function SubOrderPanel({
  order,
  onClose,
  initialTab,
}: {
  order: SubOrder
  onClose?: () => void
  initialTab?: TabKey
}) {
  const [activeTab,     setActiveTab]     = useState<TabKey>(initialTab ?? 'overview')
  const [showProdModal, setShowProdModal] = useState(false)
  const [showFIModal,   setShowFIModal]   = useState(false)

  // Pre-prod unlock state — seeded from order data, managed locally
  const [preProdUnlocked,    setPPUnlocked]    = useState(order.preProdUnlocked ?? false)
  const [ppUnlockReason,     setPPReason]      = useState(order.preProdUnlockReason ?? '')
  const [ppUnlockedBy,       setPPBy]          = useState(order.preProdUnlockedBy ?? '')
  const [ppUnlockedAt,       setPPAt]          = useState(order.preProdUnlockedAt ?? '')
  const [showUnlockModal,    setShowUnlockModal]   = useState(false)
  // For split-parent mode: tracks which child to unlock
  const [unlockingChildId,   setUnlockingChildId]  = useState<string | null>(null)

  // For prototype, assume current user is the POC (Parthipan Kumar)
  const currentUserName = 'Parthipan Kumar'
  const canToggleUnlock = true // would check role in prod

  // Detect split children — other sub-orders pointing to this order
  const splitChildren = allSubOrders.filter(o => o.parentSubOrderId === order.id)
  const isSplitParent = splitChildren.length > 0
  const vendorAssigned = order.vendor.id !== 'v_tba'

  // Per-child unlock state (keyed by child id)
  const [childUnlockMap, setChildUnlockMap] = useState<Record<string, {
    unlocked: boolean; reason: string; by: string; at: string
  }>>(() =>
    Object.fromEntries(splitChildren.map(c => [c.id, {
      unlocked: c.preProdUnlocked ?? false,
      reason: c.preProdUnlockReason ?? '',
      by: c.preProdUnlockedBy ?? '',
      at: c.preProdUnlockedAt ?? '',
    }]))
  )

  function handleUnlockConfirm(reason: string) {
    const now = new Date().toISOString()
    if (unlockingChildId) {
      // Split child unlock
      setChildUnlockMap(prev => ({
        ...prev,
        [unlockingChildId]: { unlocked: true, reason, by: currentUserName, at: now },
      }))
      setUnlockingChildId(null)
    } else {
      // Single-vendor order unlock
      setPPUnlocked(true)
      setPPReason(reason)
      setPPBy(currentUserName)
      setPPAt(now)
    }
    setShowUnlockModal(false)
  }

  function handleRelock() {
    setPPUnlocked(false)
    setPPReason('')
    setPPBy('')
    setPPAt('')
  }

  function handleRelockChild(childId: string) {
    setChildUnlockMap(prev => ({
      ...prev,
      [childId]: { unlocked: false, reason: '', by: '', at: '' },
    }))
  }

  const tabs: { key: TabKey; label: string; count?: number; alert?: boolean }[] = [
    { key: 'overview',      label: 'Overview' },
    ...(['assigned','vendor'].includes(order.currentStage) ? [
      { key: 'vendor-assign' as TabKey, label: 'Vendor RFQ',
        alert: order.rfqStatus === 'not-started' || order.rfqStatus === 'closed-no-vendor',
        count: (order.vendorRFQs ?? []).filter(r => r.status === 'responded').length || undefined,
      },
    ] : []),
    { key: 'costing',     label: 'Costing & PO', alert: order.costStatus === 'pending' || order.costStatus === 'submitted' },
    { key: 'pre-prod',    label: 'Pre-Production', count: order.preProdStages.filter(s => s.status !== 'approved').length || undefined },
    { key: 'production',  label: 'Production' },
    { key: 'samples',     label: 'Samples' },
    { key: 'inspection',  label: 'Inspection', count: order.fiRequests.length || undefined },
    { key: 'asn-grn',     label: 'ASN / GRN' },
    { key: 'history',     label: 'History', count: order.history.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Modals */}
      {showProdModal && (
        <ProductionUpdateModal order={order} onClose={() => setShowProdModal(false)} />
      )}
      {showFIModal && (
        <FIRequestModal order={order} onClose={() => setShowFIModal(false)} />
      )}

      {/* Panel header */}
      <div className="px-4 pt-4 pb-3 md:px-5 md:pt-5 border-b border-slate-200 flex-shrink-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm md:text-base font-bold text-slate-900 leading-tight flex-1 min-w-0 truncate">{order.styleName}</h2>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors flex-shrink-0 -mt-0.5">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <StatusBadge status={order.status} />
          <OrderTypeBadge type={order.orderType} />
          <TierBadge tier={order.tier} />
        </div>
        {/* Subtitle */}
        <p className="text-xs text-slate-500 truncate">
          {order.id} · {order.styleCode} · {order.colour} · {order.vendor.name}
        </p>
        {/* Action buttons — shown below subtitle when applicable */}
        {['production','fi','asn','grn'].includes(order.currentStage) && (
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => setShowFIModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 font-medium transition-colors"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Request FI
            </button>
            <button
              onClick={() => setShowProdModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Update Qty
            </button>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 md:px-5 md:py-4">
          {/* AT RISK banner */}
          {order.atRisk && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <div>
                <span className="font-semibold text-sm">At Risk — </span>
                <span className="text-sm">Requires immediate attention to meet the inward date.</span>
              </div>
            </div>
          )}

          {/* Progress strip */}
          <div className="mb-3">
            <ProgressStrip
              currentStage={order.currentStage}
              preProdUnlocked={
                isSplitParent
                  ? Object.values(childUnlockMap).some(c => c.unlocked)
                  : preProdUnlocked
              }
            />
          </div>

          {/* Stage context pills */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {order.currentStage === 'order-brief' && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">Awaiting Vendor Assignment</span>
            )}
            {order.currentStage === 'assigned' && (
              <span className="text-xs bg-violet-50 text-violet-600 px-2.5 py-1 rounded-full border border-violet-200">Costing Not Started</span>
            )}
            {order.currentStage === 'costing' && order.costStatus === 'pending' && (
              <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full border border-amber-200">Costing Pending from Vendor</span>
            )}
            {order.currentStage === 'costing' && order.costStatus === 'submitted' && (
              <span className="text-xs bg-violet-50 text-violet-600 px-2.5 py-1 rounded-full border border-violet-200">Costing Submitted · Under Review</span>
            )}
            {order.currentStage === 'costing' && order.costStatus === 'escalated' && (
              <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full border border-red-200">Costing Escalated · Above Target</span>
            )}
            {order.currentStage === 'pre-prod' && order.preProdStages.length > 0 && (() => {
              const done = order.preProdStages.filter(s => s.status === 'approved').length
              const total = order.preProdStages.length
              const allDone = done === total
              return (
                <span className={cn('text-xs px-2.5 py-1 rounded-full border',
                  allDone ? 'bg-green-50 text-green-700 border-green-200' : 'bg-violet-50 text-violet-700 border-violet-200'
                )}>
                  {allDone ? `✓ All ${total} PP Stages Approved` : `PP: ${done}/${total} Stages Approved`}
                </span>
              )
            })()}
            {order.currentStage === 'pre-prod' && order.preProdStages.length === 0 && (
              <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full border border-amber-200">PP Not Started</span>
            )}
            {order.poNumbers.length === 0 && !['order-brief','assigned','costing'].includes(order.currentStage) && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full border border-orange-200">PO Not Raised</span>
            )}
            {order.poNumbers.length > 0 && ['pre-prod','production','fi','asn','grn'].includes(order.currentStage) && (
              <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">✓ PO Raised · {order.poNumbers.length} Warehouse(s)</span>
            )}
            {order.currentStage === 'production' && order.cutQty === 0 && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">Production Not Started</span>
            )}
            {order.currentStage === 'fi' && order.fiRequests.length === 0 && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full border border-orange-200">FI Not Requested</span>
            )}
            {order.currentStage === 'fi' && order.fiRequests.some(f => f.status === 'in-progress') && (
              <span className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full border border-violet-200">FI In Progress</span>
            )}
            {order.currentStage === 'fi' && order.fiRequests.some(f => f.status === 'pass') && (
              <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">✓ FI Passed</span>
            )}
            {order.currentStage === 'asn' && (
              <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full border border-teal-200">Goods Dispatched · Awaiting GRN</span>
            )}
            {order.currentStage === 'grn' && (
              <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">✓ GRN Complete</span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar -mx-3 px-3 md:-mx-5 md:px-5">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3 py-2 text-xs font-medium whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                )}
              >
                {tab.label}
                {tab.alert && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                )}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                    activeTab === tab.key ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <OverviewTab
              order={order}
              onUpdateProduction={() => setShowProdModal(true)}
              onRequestFI={() => setShowFIModal(true)}
              unlockBannerProps={
                order.costStatus !== 'approved' ? {
                  order,
                  canToggle: canToggleUnlock,
                  // Split parent: per-child unlock list
                  ...(isSplitParent ? {
                    splitChildren: splitChildren.map((c, i) => ({
                      childId: c.id,
                      childLabel: String.fromCharCode(65 + i),
                      vendor: c.vendor.name,
                      vendorLocation: c.vendor.location,
                      qty: c.orderQty,
                      costStatus: c.costStatus,
                      unlocked: childUnlockMap[c.id]?.unlocked ?? false,
                      unlockedBy: childUnlockMap[c.id]?.by,
                      unlockedAt: childUnlockMap[c.id]?.at,
                      unlockReason: childUnlockMap[c.id]?.reason,
                    })),
                    onUnlockChild: (childId) => {
                      setUnlockingChildId(childId)
                      setShowUnlockModal(true)
                    },
                    onRelockChild: handleRelockChild,
                  } : {
                    // Single vendor: order-level unlock
                    unlocked: preProdUnlocked,
                    unlockedBy: ppUnlockedBy,
                    unlockedAt: ppUnlockedAt,
                    unlockReason: ppUnlockReason,
                    onUnlock: () => setShowUnlockModal(true),
                    onRelock: handleRelock,
                  }),
                } : undefined
              }
            />
          )}
          {activeTab === 'vendor-assign' && <VendorAssignTab order={order} />}
          {activeTab === 'costing' && <CostingTab order={order} />}
          {activeTab === 'pre-prod' && (
            <PreProdTab order={{ ...order, preProdUnlocked, preProdUnlockReason: ppUnlockReason }} />
          )}
          {activeTab === 'production' && <ProductionTab order={order} onUpdate={() => setShowProdModal(true)} />}
          {activeTab === 'samples' && <SamplesTab order={order} />}
          {activeTab === 'inspection' && <InspectionTab order={order} onRequestFI={() => setShowFIModal(true)} />}
          {activeTab === 'asn-grn' && <ASNGRNTab order={order} />}
          {activeTab === 'history' && <HistoryTab order={order} />}
        </div>
      </div>

      {/* Pre-prod unlock modal */}
      {showUnlockModal && (
        <PreProdUnlockModal
          onClose={() => setShowUnlockModal(false)}
          onConfirm={handleUnlockConfirm}
        />
      )}
    </div>
  )
}

// ─── Standalone page wrapper ──────────────────────────────────────────────────

export default function SubOrderDetailPage({ id, initialTab: tabProp }: { id: string; initialTab?: string }) {
  const router = useRouter()
  const validTabs: TabKey[] = ['overview','vendor-assign','costing','pre-prod','production','samples','inspection','asn-grn','history']
  const initialTab: TabKey = (tabProp && validTabs.includes(tabProp as TabKey) ? tabProp : 'overview') as TabKey
  const { data: order, loading, error } = useSubOrder(id)

  if (loading) {
    return (
      <>
        <Header title="Loading…" subtitle="" />
        <div className="px-6 py-12 text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </>
    )
  }

  if (error || !order) {
    return (
      <>
        <Header title="SubOrder Not Found" subtitle="" />
        <div className="px-6 py-12 text-center">
          <p className="text-slate-500">
            {error
              ? `Failed to load order: ${error}`
              : <>No SubOrder found with ID <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{id}</code></>
            }
          </p>
          <button onClick={() => router.push('/portfolio?tab=grid')} className="mt-4 text-sm text-violet-600 hover:underline">
            ← Back to Portfolio
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={order.styleCode} subtitle={`${order.id} · ${order.colour} · ${order.vendor.name}`} />
      <div className="px-6 py-5">
        <SubOrderPanel order={order} initialTab={initialTab} />
      </div>
    </>
  )
}
