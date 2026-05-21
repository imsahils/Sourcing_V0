'use client'
import { useState, useMemo, useRef, useCallback, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, Download, Filter, ChevronUp, ChevronDown, MoreHorizontal,
  AlertTriangle, IndianRupee, TrendingUp, TrendingDown, Minus,
  CheckCircle2, X, Info, Send, FileText, RotateCcw, Check,
  Building2, MapPin, Star, AlertCircle, ChevronRight, Search,
  Calendar, Clock, FlaskConical, Package, Upload, ChevronLeft,
  Layers, Factory, ScanLine, Truck, CalendarCheck, Eye, Table2, LayoutGrid,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { StatusBadge, OrderTypeBadge, TierBadge } from '@/components/shared/StatusBadge'
import { useSubOrders } from '@/lib/hooks/useSubOrders'
import { useVendors } from '@/lib/hooks/useVendors'
import { useUsers } from '@/lib/hooks/useUsers'
import { apiOrderToSubOrder } from '@/lib/api/adapters'
import type { ApiVendor } from '@/lib/api/vendors'
import { cn } from '@/lib/utils'
import type { SubOrder, SubOrderStatus } from '@/lib/types'
import { subOrders as mockSubOrders } from '@/lib/data'
import { useCurrentUser } from '@/lib/user-context'
import { SubOrderPanel } from '@/app/portfolio/[id]/SubOrderDetailClient'
import {
  SAMPLING_ORDERS, STAGE_CONFIG, STAGE_IDS, cfg,
  getStage, stageCurrentStatus, getActiveStageIdx, isOrderComplete, fmtDate,
  type SamplingOrder, type StageId, type TrackingEntry, type ApprovalEntry, type PPSEntry,
} from '@/lib/sampling'
import {
  INITIAL_PO_RECORDS, VENDOR_D365_CODES, getOTBLines, getWH, poTotalQty, poTotalValue, sizesFromLines,
  type PORecord,
} from '@/lib/purchase-orders'
import { TrackerView } from './TrackerView'

// ─── Stage labels ─────────────────────────────────────────────────────────────

const stageLabel: Record<string, { label: string; color: string }> = {
  'order-brief': { label: 'Order Brief',    color: 'text-slate-500'  },
  'assigned':    { label: 'Assigned',       color: 'text-violet-600'   },
  'vendor':      { label: 'Vendor Assigned',color: 'text-indigo-600' },
  'costing':     { label: 'Costing',        color: 'text-amber-600'  },
  'sampling':    { label: 'Sampling',       color: 'text-purple-600' },
  'pre-prod':    { label: 'Pre-Production', color: 'text-violet-600' },
  'production':  { label: 'Production',     color: 'text-violet-700'   },
  'fi':          { label: 'Inspection',     color: 'text-orange-600' },
  'asn':         { label: 'ASN',            color: 'text-teal-600'   },
  'grn':         { label: 'GRN',            color: 'text-green-600'  },
}

// ─── Sampling stage dots ──────────────────────────────────────────────────────

const SAMPLE_STAGE_KEYS = ['Lab Dip', 'Strike Off', 'Fit Sample', 'PP Sample (4B / Commercial)', 'PP Fit'] as const
const SAMPLE_ABBR: Record<string, string> = {
  'Lab Dip': 'LD',
  'Strike Off': 'SO',
  'Fit Sample': 'FS',
  'PP Sample (4B / Commercial)': 'PP',
  'PP Fit': 'PPF',
}

function SamplingDots({ order }: { order: SubOrder }) {
  // Only show for pre-prod stage orders that have stages defined
  if (order.currentStage !== 'pre-prod' || order.preProdStages.length === 0) return null

  const sampleStages = order.preProdStages.filter(s =>
    SAMPLE_STAGE_KEYS.includes(s.name as typeof SAMPLE_STAGE_KEYS[number])
  )
  if (sampleStages.length === 0) return null

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {sampleStages.map(s => {
        const abbr = SAMPLE_ABBR[s.name] ?? s.name.slice(0, 2)
        const color =
          s.status === 'approved'  ? 'bg-green-500 text-white' :
          s.status === 'pending'   ? 'bg-amber-400 text-white' :
          s.status === 'overdue'   ? 'bg-red-400 text-white'   :
          s.status === 'rejected'  ? 'bg-red-500 text-white'   :
          'bg-slate-200 text-slate-500'
        return (
          <span key={s.id} title={`${s.name}: ${s.status}`}
            className={cn('text-[9px] font-bold px-1 py-0.5 rounded leading-none', color)}>
            {abbr}
          </span>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function QtyProgress({ order }: { order: SubOrder }) {
  const total = order.orderQty
  if (total === 0) return <span className="text-xs text-slate-400">—</span>
  const pct = order.packedQty > 0 ? Math.round((order.packedQty / total) * 100) : 0
  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-violet-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200'
  return (
    <div className="w-32">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-slate-500 w-7 text-right">{pct}%</span>
      </div>
      <p className="text-xs text-slate-400 leading-tight">
        {order.cutQty > 0 ? `${order.cutQty} cut` : '0 cut'}
        {order.sewingQty > 0 ? ` · ${order.sewingQty} sewn` : ''}
      </p>
    </div>
  )
}

function DispatchGRNCell({ order }: { order: SubOrder }) {
  const total = order.orderQty
  const hasDispatched = order.dispatchedQty > 0
  const hasGRN        = order.grnQty > 0
  const grnPending    = order.currentStage === 'grn' && !hasGRN

  if (!hasDispatched && !hasGRN && !grnPending) {
    return <span className="text-xs text-slate-300">—</span>
  }

  return (
    <div className="space-y-1.5 w-28">
      {hasDispatched && (
        <div>
          <p className="text-[10px] text-slate-400 leading-none mb-0.5">Dispatched</p>
          <p className="text-xs text-blue-600 font-medium">{order.dispatchedQty.toLocaleString()} <span className="text-slate-400 font-normal">/ {total.toLocaleString()}</span></p>
        </div>
      )}
      {(hasGRN || grnPending) && (
        <div>
          <p className="text-[10px] text-slate-400 leading-none mb-0.5">GRN</p>
          {hasGRN ? (
            <p className={cn('text-xs font-medium', order.grnQty >= total ? 'text-teal-600' : 'text-teal-500')}>
              {order.grnQty.toLocaleString()} <span className="text-slate-400 font-normal">/ {total.toLocaleString()}</span>
              {order.grnQty >= total && <span className="ml-1 text-[10px]">✓</span>}
            </p>
          ) : (
            <p className="text-xs text-amber-500 font-medium">Pending</p>
          )}
        </div>
      )}
    </div>
  )
}

function DaysLeft({ dateStr }: { dateStr: string }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return <span className="text-xs font-semibold text-red-600">{Math.abs(diff)}d late</span>
  const color = diff <= 7 ? 'text-red-600' : diff <= 14 ? 'text-amber-600' : 'text-green-700'
  return <span className={cn('text-xs font-semibold', color)}>{diff}d left</span>
}

// ─── Pre-Production Modal ─────────────────────────────────────────────────────

type PPStageLocal = {
  id: string
  name: string
  type: 'approval' | 'tracking'
  status: 'not-started' | 'pending' | 'approved' | 'rejected' | 'overdue'
  plannedDate: string
  actualDate?: string
  approvedBy?: string
  approverRole?: string
  remarks?: string
}

const STAGE_META: { name: string; abbr: string; type: 'approval' | 'tracking'; role: string }[] = [
  { name: 'Lab Dip',                       abbr: 'LD',  type: 'approval',  role: 'Designer' },
  { name: 'Strike Off',                     abbr: 'SO',  type: 'approval',  role: 'Designer' },
  { name: 'Fit Sample',                     abbr: 'FS',  type: 'approval',  role: 'Fit Technician' },
  { name: 'Fabric Inward (FD Status)',      abbr: 'FD',  type: 'tracking',  role: 'POC' },
  { name: 'PP Sample (4B / Commercial)',    abbr: 'PP',  type: 'approval',  role: 'Designer + Fit Tech' },
  { name: 'GPT (Garment Processing Test)', abbr: 'GPT', type: 'tracking',  role: 'POC' },
  { name: 'PP Fit',                         abbr: 'PPF', type: 'approval',  role: 'Fit Technician' },
]

const STATUS_COLORS: Record<string, string> = {
  'approved':    'bg-green-100 text-green-700 border-green-200',
  'pending':     'bg-amber-100 text-amber-700 border-amber-200',
  'overdue':     'bg-red-100 text-red-700 border-red-200',
  'rejected':    'bg-red-100 text-red-700 border-red-200',
  'not-started': 'bg-slate-100 text-slate-500 border-slate-200',
}

function PreProdModal({ order, onClose }: { order: SubOrder; onClose: () => void }) {
  // Build local editable stages — merge existing data with defaults
  const [stages, setStages] = useState<PPStageLocal[]>(() =>
    STAGE_META.map((meta, i) => {
      const existing = order.preProdStages[i] ?? order.preProdStages.find(s => s.name === meta.name)
      return {
        id:           existing?.id ?? `pp${i + 1}`,
        name:         meta.name,
        type:         meta.type,
        status:       (existing?.status ?? 'not-started') as PPStageLocal['status'],
        plannedDate:  existing?.plannedDate ?? '',
        actualDate:   existing?.actualDate,
        approvedBy:   existing?.approvedBy,
        approverRole: existing?.approverRole ?? meta.role,
        remarks:      existing?.remarks,
      }
    })
  )

  const [activeIdx,   setActiveIdx]   = useState<number | null>(null)
  const [savedDone,   setSavedDone]   = useState(false)

  const done  = stages.filter(s => s.status === 'approved').length
  const total = stages.length
  const pct   = Math.round((done / total) * 100)

  const update = (idx: number, patch: Partial<PPStageLocal>) =>
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))

  const approve = (idx: number) => {
    update(idx, {
      status:     'approved',
      actualDate: new Date().toISOString().slice(0, 10),
      approvedBy: 'Parthipan Kumar',
    })
    setActiveIdx(null)
  }

  const reject = (idx: number) => {
    update(idx, { status: 'rejected' })
    setActiveIdx(null)
  }

  const markPending = (idx: number) =>
    update(idx, { status: 'pending', actualDate: undefined, approvedBy: undefined })

  const handleSave = () => {
    setSavedDone(true)
    setTimeout(onClose, 1400)
  }

  const fmtD = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Layers className="w-4 h-4 text-violet-600" />
              <h3 className="font-bold text-slate-900 text-base">Pre-Production Stages</h3>
            </div>
            <p className="text-xs text-slate-500">
              {order.styleCode} · {order.colour} · {order.vendor.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Progress summary ── */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all',
                pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-violet-500' : 'bg-amber-400'
              )} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 w-20 text-right flex-shrink-0">
              {done}/{total} approved
            </span>
          </div>
          {/* Stage pills row */}
          <div className="flex gap-1.5 flex-wrap">
            {stages.map((s, i) => (
              <button key={s.id}
                onClick={() => setActiveIdx(activeIdx === i ? null : i)}
                className={cn(
                  'text-[10px] font-bold px-2 py-1 rounded border transition-all',
                  activeIdx === i ? 'ring-2 ring-violet-400 ring-offset-1' : '',
                  STATUS_COLORS[s.status]
                )}>
                {STAGE_META[i].abbr}
              </button>
            ))}
          </div>
          {/* PO status */}
          <div className={cn('mt-2 text-xs font-medium', order.poNumbers.length > 0 ? 'text-green-600' : 'text-amber-600')}>
            {order.poNumbers.length > 0
              ? `✓ PO Raised — ${order.poNumbers.map(p => p.poNumber).join(' · ')}`
              : '⏳ PO Not Yet Raised'
            }
          </div>
        </div>

        {/* ── Stage list ── */}
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-2">
          {stages.map((s, i) => {
            const meta     = STAGE_META[i]
            const isActive = activeIdx === i
            const isDone   = s.status === 'approved'
            const canAct   = !isDone || isActive

            return (
              <div key={s.id}
                className={cn(
                  'rounded-xl border transition-all',
                  isActive ? 'border-violet-300 shadow-sm' : 'border-slate-100',
                  isDone ? 'bg-green-50/50' : 'bg-white'
                )}>
                {/* ── Stage row (always visible) ── */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setActiveIdx(isActive ? null : i)}
                >
                  {/* Status dot */}
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                    s.status === 'approved'    ? 'bg-green-500 text-white' :
                    s.status === 'pending'     ? 'bg-amber-400 text-white' :
                    s.status === 'overdue'     ? 'bg-red-400 text-white'   :
                    s.status === 'rejected'    ? 'bg-red-500 text-white'   :
                    'bg-slate-200 text-slate-400'
                  )}>
                    {s.status === 'approved' ? <Check className="w-3 h-3" strokeWidth={3} /> : <span>{i + 1}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 leading-tight">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {meta.role}
                      {s.plannedDate && ` · Planned: ${fmtD(s.plannedDate)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.status === 'approved' && s.approvedBy && (
                      <p className="text-xs text-green-600 hidden sm:block">
                        {s.approvedBy} · {fmtD(s.actualDate)}
                      </p>
                    )}
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', STATUS_COLORS[s.status])}>
                      {s.status.replace('-', ' ')}
                    </span>
                    <ChevronDown className={cn('w-3.5 h-3.5 text-slate-300 transition-transform', isActive && 'rotate-180')} />
                  </div>
                </div>

                {/* ── Expanded edit panel ── */}
                {isActive && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                    {/* Date fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Planned Date</label>
                        <input type="date" value={s.plannedDate}
                          onChange={e => update(i, { plannedDate: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Actual Date</label>
                        <input type="date" value={s.actualDate ?? ''}
                          onChange={e => update(i, { actualDate: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                    </div>

                    {/* Approved by (for approval stages) */}
                    {meta.type === 'approval' && (
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Approved By</label>
                        <input type="text" value={s.approvedBy ?? ''}
                          onChange={e => update(i, { approvedBy: e.target.value })}
                          placeholder={`e.g. ${meta.role}`}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                    )}

                    {/* Remarks */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Remarks</label>
                      <textarea value={s.remarks ?? ''} rows={2}
                        onChange={e => update(i, { remarks: e.target.value })}
                        placeholder="Notes, revision instructions, observations…"
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                    </div>

                    {/* Photo upload (visual only) */}
                    <button className="flex items-center gap-2 text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors w-full">
                      <Upload className="w-3.5 h-3.5" /> Upload sample photo / document
                    </button>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      {s.status !== 'approved' && (
                        <button onClick={() => approve(i)}
                          className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" strokeWidth={3} /> Approve
                        </button>
                      )}
                      {s.status === 'not-started' || s.status === 'rejected' ? (
                        <button onClick={() => markPending(i)}
                          className="flex-1 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" /> Mark Pending
                        </button>
                      ) : null}
                      {s.status !== 'rejected' && s.status !== 'not-started' && s.status !== 'approved' && (
                        <button onClick={() => reject(i)}
                          className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-1">
                          <X className="w-3 h-3" /> Reject
                        </button>
                      )}
                      {s.status === 'approved' && (
                        <button onClick={() => markPending(i)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Revert
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
          {savedDone ? (
            <div className="flex items-center justify-center gap-2 py-1 text-green-600 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Saved successfully
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Qty Progress Modal ───────────────────────────────────────────────────────

function QtyProgressModal({ order, onClose }: { order: SubOrder; onClose: () => void }) {
  const [cut,    setCut]    = useState(String(order.cutQty))
  const [sewing, setSewing] = useState(String(order.sewingQty))
  const [packed, setPacked] = useState(String(order.packedQty))
  const [remarks, setRemarks] = useState('')
  const [onBehalf, setOnBehalf] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const oq = order.orderQty || 1
  const bar = (val: string, color: string) => {
    const pct = Math.min(100, Math.round((Number(val) / oq) * 100))
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
      </div>
    )
  }

  const fmtD = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })

  const handleSave = () => { setSaved(true); setTimeout(onClose, 1400) }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Package className="w-4 h-4 text-violet-600" />
              <h3 className="font-bold text-slate-900 text-base">Production Quantities</h3>
            </div>
            <p className="text-xs text-slate-500">
              {order.styleCode} · {order.colour} · {order.vendor.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* ── Order qty reference ── */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Order',  value: order.orderQty,  color: 'text-slate-700',   bg: 'bg-slate-50'   },
              { label: 'Cut',    value: order.cutQty,    color: 'text-violet-700',    bg: 'bg-violet-50'    },
              { label: 'Sewing', value: order.sewingQty, color: 'text-purple-700',  bg: 'bg-purple-50'  },
              { label: 'Packed', value: order.packedQty, color: 'text-green-700',   bg: 'bg-green-50'   },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn('rounded-xl px-2 py-3', bg)}>
                <p className={cn('text-lg font-bold', color)}>{value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Cumulative info banner ── */}
          <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs text-violet-700">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Enter <strong className="mx-0.5">cumulative totals</strong> — system calculates the daily delta automatically.
          </div>

          {/* ── Update fields ── */}
          <div className="space-y-3">
            {[
              { label: 'Cut Qty',    val: cut,    set: setCut,    color: 'bg-violet-500'   },
              { label: 'Sewing Qty', val: sewing, set: setSewing, color: 'bg-purple-500' },
              { label: 'Packed Qty', val: packed, set: setPacked, color: 'bg-green-500'  },
            ].map(({ label, val, set, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">{label} (cumulative)</label>
                  <span className="text-[10px] text-slate-400">of {order.orderQty}</span>
                </div>
                <input type="number" value={val} min={0} max={order.orderQty + 50}
                  onChange={e => set(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 mb-1" />
                {bar(val, color)}
              </div>
            ))}
          </div>

          {/* ── On behalf toggle ── */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={onBehalf} onChange={e => setOnBehalf(e.target.checked)}
              className="rounded text-violet-600 w-4 h-4" />
            <span className="text-sm text-slate-700">Entering on behalf of <strong>{order.vendor.name}</strong></span>
          </label>
          {onBehalf && (
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Reason (required)</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
                placeholder="e.g. Vendor called with updated numbers, entered by POC"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
            </div>
          )}

          {/* ── Production history ── */}
          {order.productionHistory.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">History</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Date','Cut','Sewing','Packed','By'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...order.productionHistory].reverse().map((h, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2 text-slate-500">{fmtD(h.date)}</td>
                        <td className="px-3 py-2 font-medium text-violet-700">{h.cutQty}</td>
                        <td className="px-3 py-2 font-medium text-purple-700">{h.sewingQty}</td>
                        <td className="px-3 py-2 font-medium text-green-700">{h.packedQty}</td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[80px]">{h.onBehalfOf ?? h.updatedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-1 text-green-600 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Saved successfully
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave}
                disabled={onBehalf && !remarks.trim()}
                className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Save Update
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pre-Production progress column ──────────────────────────────────────────

const PAST_PP_STAGES = ['production','fi','asn','grn']

function PreProdProgress({ order }: { order: SubOrder }) {
  const isPast   = PAST_PP_STAGES.includes(order.currentStage)
  const isBefore = ['order-brief','assigned','costing'].includes(order.currentStage)

  if (isBefore) return <span className="text-xs text-slate-300">—</span>

  if (isPast) return (
    <div>
      <p className="text-xs font-medium text-green-600 leading-tight">✓ All approved</p>
      <div className="flex items-center gap-0.5 mt-1">
        {['LD','SO','FS','PP','PPF'].map(a => (
          <span key={a} className="text-[9px] font-bold px-1 py-0.5 rounded leading-none bg-green-500 text-white">{a}</span>
        ))}
      </div>
    </div>
  )

  // currently at pre-prod
  const total = order.preProdStages.length
  const done  = order.preProdStages.filter(s => s.status === 'approved').length
  const hasPO = order.poNumbers.length > 0

  if (total === 0) return (
    <div>
      <p className="text-xs text-slate-400 leading-tight">Not started</p>
      <p className="text-[10px] text-slate-300 mt-0.5">{hasPO ? '✓ PO raised' : 'PO pending'}</p>
    </div>
  )

  const pct = Math.round((done / total) * 100)
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-violet-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'

  return (
    <div className="w-36">
      {/* progress bar */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-slate-500 w-12 text-right leading-none">
          {done}/{total} done
        </span>
      </div>
      {/* sample dots */}
      <SamplingDots order={order} />
      {/* PO status */}
      <p className={cn('text-[10px] mt-1 leading-none', hasPO ? 'text-green-600' : 'text-amber-500')}>
        {hasPO ? '✓ PO raised' : '⏳ PO pending'}
      </p>
    </div>
  )
}

// ─── Row context menu ────────────────────────────────────────────────────────

type RowAction = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  danger?: boolean
}

function RowContextMenu({ order, onRowClick }: { order: SubOrder; onRowClick: (o: SubOrder) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const actions: RowAction[] = [
    {
      label: 'View Details',
      icon: Eye,
      onClick: () => { setOpen(false); onRowClick(order) },
    },
    {
      label: 'Copy Fabricate Code',
      icon: FileText,
      onClick: () => { navigator.clipboard.writeText(order.id); setOpen(false) },
    },
    ...(order.currentStage === 'pre-prod' ? [{
      label: 'Pre-Production Checklist',
      icon: FlaskConical,
      onClick: () => { setOpen(false); onRowClick(order) },
    }] : []),
    ...(order.currentStage === 'production' ? [{
      label: 'Log Production Update',
      icon: Factory,
      onClick: () => { setOpen(false); onRowClick(order) },
    }] : []),
    ...(order.currentStage === 'fi' ? [{
      label: 'Raise / View FI',
      icon: ScanLine,
      onClick: () => { setOpen(false); onRowClick(order) },
    }] : []),
    ...(order.currentStage === 'asn' ? [{
      label: 'View ASN / Track',
      icon: Truck,
      onClick: () => { setOpen(false); onRowClick(order) },
    }] : []),
    {
      label: order.atRisk ? 'Remove At-Risk Flag' : 'Flag as At-Risk',
      icon: order.atRisk ? Check : AlertTriangle,
      danger: !order.atRisk,
      onClick: () => { setOpen(false) },   // visual only — no mutation API yet
    },
  ]

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'p-1.5 rounded transition-colors',
          open ? 'bg-violet-100 text-violet-600' : 'hover:bg-slate-200 text-slate-400'
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden">
          {actions.map((a, i) => {
            const Icon = a.icon
            return (
              <button
                key={i}
                onClick={a.onClick}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                  a.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {a.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Portfolio Grid ────────────────────────────────────────────────────────────

function StyleExpandPanel({ order }: { order: SubOrder }) {
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
  const attrs: { label: string; value: string }[] = [
    { label: 'Category',      value: order.category     },
    { label: 'Product',       value: order.product      },
    { label: 'Gender',        value: order.gender       },
    { label: 'Age Group',     value: order.ageGroup     },
    { label: 'Fabric',        value: order.fabricQuality},
    { label: 'Season',        value: order.season       },
    { label: 'Order Type',    value: order.orderType    },
    { label: 'Tier',          value: order.tier         },
    { label: 'Handover',      value: fmt(order.handoverDate)        },
    { label: 'Order to Vendor', value: fmt(order.orderToVendorDate) },
    { label: 'Costing Approved', value: fmt(order.costingApprovedDate) },
    { label: 'Target Price',  value: order.targetPrice ? `₹${order.targetPrice.toLocaleString('en-IN')}` : '—' },
    { label: 'Closed Cost',   value: order.closedCost  ? `₹${order.closedCost.toLocaleString('en-IN')}`  : '—' },
    { label: 'POC',           value: order.poc?.name ?? '—' },
  ]
  return (
    <div className="px-2 py-3 grid grid-cols-7 gap-x-6 gap-y-3">
      {attrs.map(a => (
        <div key={a.label}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">{a.label}</p>
          <p className="text-xs text-slate-700 font-medium leading-tight">{a.value || '—'}</p>
        </div>
      ))}
    </div>
  )
}

function PortfolioRow({ order, onPreProdClick, onQtyClick, onRowClick, isExpanded, onToggleExpand, visibleCols, styleAttrsOpen, totalColCount }: {
  order: SubOrder
  onPreProdClick: (o: SubOrder) => void
  onQtyClick: (o: SubOrder) => void
  onRowClick: (o: SubOrder) => void
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  visibleCols: Set<string>
  styleAttrsOpen: boolean
  totalColCount: number
}) {
  const stage = stageLabel[order.currentStage] ?? { label: order.currentStage, color: 'text-slate-500' }
  return (
    <>
    <tr className={cn('cursor-pointer transition-colors border-b border-slate-100', isExpanded ? 'bg-violet-50/40' : 'hover:bg-slate-50')}
      onClick={() => onRowClick(order)}>
      <td className="px-4 py-3 w-44">
        <div className="flex items-center gap-1.5">
          {order.atRisk && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
          <span className="font-mono text-xs text-violet-700 hover:underline font-medium">{order.id}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-start gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); onToggleExpand(order.id) }}
            className={cn(
              'mt-0.5 p-0.5 rounded transition-colors flex-shrink-0',
              isExpanded ? 'text-violet-500 bg-violet-100' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
            )}
            title={isExpanded ? 'Collapse style details' : 'Expand style details'}
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', isExpanded && 'rotate-180')} />
          </button>
          <div>
            <p className="text-sm font-medium text-slate-900 leading-tight">{order.styleCode}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-tight truncate max-w-36">{order.styleName}</p>
          </div>
        </div>
      </td>
      {/* Style Attributes group — condensed summary when collapsed, empty when expanded */}
      <td className="px-4 py-3">
        {!styleAttrsOpen ? (
          <div className="text-xs text-slate-500 leading-snug">
            <p className="font-medium text-slate-700">{order.category}{order.product ? ` · ${order.product}` : ''}</p>
            <p className="text-slate-400 mt-0.5">{[order.gender, order.ageGroup, order.season].filter(Boolean).join(' · ')}</p>
            {order.tier && <TierBadge tier={order.tier} />}
          </div>
        ) : (
          <span className="text-slate-200 text-xs">↗</span>
        )}
      </td>

      {/* Sub-column cells — only when expanded AND visible */}
      {styleAttrsOpen && visibleCols.has('category')      && <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.category}</span></td>}
      {styleAttrsOpen && visibleCols.has('product')       && <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.product}</span></td>}
      {styleAttrsOpen && visibleCols.has('season')        && <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.season}</span></td>}
      {styleAttrsOpen && visibleCols.has('gender')        && <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.gender}</span></td>}
      {styleAttrsOpen && visibleCols.has('ageGroup')      && <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.ageGroup}</span></td>}
      {styleAttrsOpen && visibleCols.has('fabricQuality') && <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.fabricQuality}</span></td>}
      {styleAttrsOpen && visibleCols.has('tier')          && <td className="px-4 py-3"><TierBadge tier={order.tier} /></td>}

      {visibleCols.has('colour') && <td className="px-4 py-3"><span className="text-sm text-slate-600">{order.colour}</span></td>}
      {visibleCols.has('vendor') && <td className="px-4 py-3">
        <div>
          <p className="text-sm text-slate-700 font-medium leading-tight">{order.vendor.name}</p>
          <p className="text-xs text-slate-400">{order.vendor.location}</p>
        </div>
      </td>}
      {visibleCols.has('poc') && <td className="px-4 py-3">
        {order.poc.name ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {order.poc.initials}
            </div>
            <span className="text-xs text-slate-700 leading-tight">{order.poc.name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">—</span>
        )}
      </td>}
      {/* Stage — clean, no pre-prod clutter */}
      {visibleCols.has('stage') && <td className="px-4 py-3">
        <div>
          <span className={cn('text-xs font-medium', stage.color)}>{stage.label}</span>
          <p className="text-xs text-slate-400 mt-0.5 leading-tight">
            {order.currentStage === 'order-brief' && 'Vendor not assigned'}
            {order.currentStage === 'assigned'    && 'Costing not started'}
            {order.currentStage === 'costing' && (
              order.costStatus === 'pending'   ? 'Pending from vendor' :
              order.costStatus === 'submitted' ? 'Submitted · awaiting review' :
              order.costStatus === 'escalated' ? '⚠ Above target · escalated' :
              order.costStatus === 'approved'  ? '✓ Approved' : ''
            )}
            {order.currentStage === 'production' && (
              order.cutQty === 0                    ? 'Not yet started' :
              order.packedQty >= order.orderQty     ? '✓ Production complete' :
              `${Math.round((order.packedQty / order.orderQty) * 100)}% packed`
            )}
            {order.currentStage === 'fi' && (
              order.fiRequests.length === 0                                ? 'FI not requested' :
              order.fiRequests.some(f => f.status === 'pass')             ? '✓ FI passed' :
              order.fiRequests.some(f => f.status === 'in-progress')      ? 'Inspection in progress' :
              'FI scheduled'
            )}
            {order.currentStage === 'asn' && 'Goods dispatched · awaiting GRN'}
            {order.currentStage === 'grn' && '✓ GRN complete'}
          </p>
        </div>
      </td>}
      {/* Pre-Production — dedicated column, click opens modal */}
      {visibleCols.has('pp') && <td className="px-4 py-3 group/pp"
        onClick={e => { e.stopPropagation(); onPreProdClick(order) }}>
        <div className="cursor-pointer group-hover/pp:opacity-80 transition-opacity">
          <PreProdProgress order={order} />
          <p className="text-[10px] text-violet-500 mt-1 opacity-0 group-hover/pp:opacity-100 transition-opacity font-medium">
            Click to update →
          </p>
        </div>
      </td>}
      {/* Qty Progress — click opens modal */}
      {visibleCols.has('qty') && <td className="px-4 py-3 group/qty"
        onClick={e => { e.stopPropagation(); onQtyClick(order) }}>
        <div className="cursor-pointer group-hover/qty:opacity-80 transition-opacity">
          <QtyProgress order={order} />
          <p className="text-[10px] text-violet-500 mt-1 opacity-0 group-hover/qty:opacity-100 transition-opacity font-medium">
            Click to update →
          </p>
        </div>
      </td>}
      {visibleCols.has('dispatched') && <td className="px-4 py-3"><DispatchGRNCell order={order} /></td>}
      {visibleCols.has('inwardDate') && <td className="px-4 py-3">
        <div>
          <p className="text-xs text-slate-700 font-medium">
            {new Date(order.buyingExpectedInwardDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
          </p>
          <DaysLeft dateStr={order.buyingExpectedInwardDate} />
        </div>
      </td>}
      {visibleCols.has('status') && <td className="px-4 py-3"><StatusBadge status={order.status} /></td>}
      {visibleCols.has('orderType') && <td className="px-4 py-3"><OrderTypeBadge type={order.orderType} /></td>}
      <td className="px-4 py-3">
        <RowContextMenu order={order} onRowClick={onRowClick} />
      </td>
    </tr>
    {isExpanded && (
      <tr className="bg-violet-50/40 border-b border-violet-100">
        <td colSpan={totalColCount} className="px-4 pb-3 pt-0">
          <div className="border border-violet-100 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
              <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Style Attributes</span>
              <span className="text-[10px] text-slate-400">· {order.styleCode} · {order.styleName}</span>
            </div>
            <StyleExpandPanel order={order} />
          </div>
        </td>
      </tr>
    )}
    </>
  )
}

// ─── Column filter input ──────────────────────────────────────────────────────

function ColFilter({ value, onChange, placeholder, type = 'text', options }:
  { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; options?: string[] }) {
  if (options) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
        className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer leading-tight">
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    )
  }
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-300 pointer-events-none" />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Filter…'}
        className="w-full text-[11px] pl-5 pr-1.5 py-0.5 border border-slate-200 rounded bg-white text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-400 leading-tight"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

function PortfolioGridView() {
  // ── API data ─────────────────────────────────────────────────────────────────
  const { data: rawOrders, loading: ordersLoading, error: ordersError } = useSubOrders()
  const { data: rawVendors } = useVendors()
  const { data: rawUsers  } = useUsers()
  const vendorMap = useMemo(
    () => new Map(rawVendors.map(v => [v.id, v])),
    [rawVendors],
  )
  const userMap = useMemo(
    () => new Map(rawUsers.map(u => [u.id, u])),
    [rawUsers],
  )
  const subOrders = useMemo(
    () => rawOrders.map(o => apiOrderToSubOrder(o, vendorMap, userMap)),
    [rawOrders, vendorMap, userMap],
  )

  // ── Tracker view toggle ──────────────────────────────────────────────────────
  const [trackerMode, setTrackerMode] = useState(false)

  // ── Drawer ───────────────────────────────────────────────────────────────────
  const [drawerOrder, setDrawerOrder] = useState<SubOrder | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)

  const openDrawer = useCallback((o: SubOrder) => {
    setDrawerOrder(o)
    setDrawerVisible(true)
    document.body.style.overflow = 'hidden'
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false)
    document.body.style.overflow = ''
    setTimeout(() => setDrawerOrder(null), 300)
  }, [])

  // Restore scroll on unmount (safety net)
  useEffect(() => {
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeDrawer])

  // ── Expanded style rows ──────────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const [styleAttrsOpen, setStyleAttrsOpen] = useState(false)

  const STYLE_ATTR_KEYS = ['category','product','season','gender','ageGroup','fabricQuality','tier'] as const
  const MAIN_OPT_KEYS   = ['colour','vendor','poc','stage','pp','qty','dispatched','inwardDate','status','orderType'] as const

  // ── Column visibility ────────────────────────────────────────────────────────
  const ALL_COLS = [
    'colour','vendor','poc','stage','pp','qty','dispatched','inwardDate','status','orderType',
    'category','product','season','gender','ageGroup','fabricQuality','tier',
  ] as const
  type ColKey = typeof ALL_COLS[number]
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(['colour','vendor','stage','pp','qty','dispatched','inwardDate','status','orderType'] as ColKey[])
  )
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!colPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setColPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [colPickerOpen])

  const toggleCol = (key: ColKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const col = (key: ColKey) => visibleCols.has(key)

  // ── Column count for colSpan ─────────────────────────────────────────────────
  const visibleMainCols     = MAIN_OPT_KEYS.filter(k => visibleCols.has(k as ColKey)).length
  const visibleStyleSubCols = styleAttrsOpen ? STYLE_ATTR_KEYS.filter(k => visibleCols.has(k as ColKey)).length : 0
  const totalColCount = 4 + visibleMainCols + visibleStyleSubCols
  // 4 = Fabricate Code + Style + Style Attrs group header + Actions (always visible)

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [ppModalOrder,  setPpModalOrder]  = useState<SubOrder | null>(null)
  const [qtyModalOrder, setQtyModalOrder] = useState<SubOrder | null>(null)

  // ── sort ────────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState('inwardDate')
  const [sortDir,   setSortDir]   = useState<'asc'|'desc'>('asc')

  // ── top status pills ────────────────────────────────────────────────────────
  const [statusPill, setStatusPill] = useState<string>('All')

  // ── per-column filters ──────────────────────────────────────────────────────
  const [fId,       setFId]       = useState('')
  const [fStyle,    setFStyle]    = useState('')
  const [fColour,   setFColour]   = useState('All')
  const [fVendor,   setFVendor]   = useState('All')
  const [fPoc,      setFPoc]      = useState('All')
  const [fStage,    setFStage]    = useState('All')
  const [fPP,       setFPP]       = useState('All')
  const [fStatus,   setFStatus]   = useState('All')
  const [fType,        setFType]        = useState('All')
  const [fTier,        setFTier]        = useState('All')
  const [fAtRisk,      setFAtRisk]      = useState(false)
  const [fDispatchGRN, setFDispatchGRN] = useState('All')
  const [fQtyStage,    setFQtyStage]    = useState('Overall')
  const [fQtyStatus,   setFQtyStatus]   = useState('All')
  const [fCategory,    setFCategory]    = useState('All')
  const [fProduct,     setFProduct]     = useState('All')
  const [fSeason,      setFSeason]      = useState('All')
  const [fGender,      setFGender]      = useState('All')
  const [fAgeGroup,    setFAgeGroup]    = useState('All')
  const [fFabricQty,   setFFabricQty]   = useState('All')

  // ── unique option lists ──────────────────────────────────────────────────────
  const colourOpts  = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(o => o.colour))).sort()], [subOrders])
  const vendorOpts  = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(o => o.vendor.name))).sort()], [subOrders])
  const pocOpts     = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(o => o.poc.name).filter(Boolean))).sort()], [subOrders])
  const categoryOpts  = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(s => s.category).filter(Boolean))).sort()], [subOrders])
  const productOpts   = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(s => s.product).filter(Boolean))).sort()], [subOrders])
  const seasonOpts    = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(s => s.season).filter(Boolean))).sort()], [subOrders])
  const genderOpts    = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(s => s.gender).filter(Boolean))).sort()], [subOrders])
  const ageGroupOpts  = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(s => s.ageGroup).filter(Boolean))).sort()], [subOrders])
  const fabricQtyOpts = useMemo(() => ['All', ...Array.from(new Set(subOrders.map(s => s.fabricQuality).filter(Boolean))).sort()], [subOrders])
  const stageOpts   = ['All','Order Brief','Assigned','Vendor','Costing','Pre-Production','Production','Inspection','ASN','GRN']
  const ppOpts      = ['All','Not Started','In Progress','All Approved','N/A']
  const statusOpts  = ['All','on-track','needs-attention','overdue','completed','not-started']
  const typeOpts    = ['All','NEW','REPLEN']
  const tierOpts    = ['All','HERO','TIER-1','TIER-2','TAIL']

  // stage label → key map for filter
  const stageLabelToKey: Record<string, string> = {
    'Order Brief':'order-brief','Assigned':'assigned','Vendor':'vendor','Costing':'costing',
    'Pre-Production':'pre-prod','Production':'production','Inspection':'fi','ASN':'asn','GRN':'grn',
  }

  const filtered = useMemo(() => {
    let list = [...subOrders]

    // status pill (top quick-filter)
    if (statusPill !== 'All') list = list.filter(s => s.status === statusPill)

    // column filters
    if (fId)           list = list.filter(s => s.id.toLowerCase().includes(fId.toLowerCase()))
    if (fStyle)        list = list.filter(s => s.styleCode.toLowerCase().includes(fStyle.toLowerCase()) || s.styleName.toLowerCase().includes(fStyle.toLowerCase()))
    if (fColour !== 'All')   list = list.filter(s => s.colour === fColour)
    if (fVendor !== 'All')   list = list.filter(s => s.vendor.name === fVendor)
    if (fPoc    !== 'All')   list = list.filter(s => s.poc.name === fPoc)
    if (fStage  !== 'All')   list = list.filter(s => s.currentStage === (stageLabelToKey[fStage] ?? fStage))
    if (fPP !== 'All') list = list.filter(s => {
      const isBefore = ['order-brief','assigned','costing'].includes(s.currentStage)
      const isPast   = PAST_PP_STAGES.includes(s.currentStage)
      if (fPP === 'N/A')          return isBefore
      if (fPP === 'All Approved') return isPast || (s.currentStage === 'pre-prod' && s.preProdStages.length > 0 && s.preProdStages.every(p => p.status === 'approved'))
      if (fPP === 'Not Started')  return s.currentStage === 'pre-prod' && (s.preProdStages.length === 0 || s.preProdStages.every(p => p.status === 'not-started'))
      if (fPP === 'In Progress')  return s.currentStage === 'pre-prod' && s.preProdStages.some(p => p.status === 'approved') && !s.preProdStages.every(p => p.status === 'approved')
      return true
    })
    if (fStatus !== 'All')   list = list.filter(s => s.status === fStatus)
    if (fType   !== 'All')   list = list.filter(s => s.orderType === fType)
    if (fTier   !== 'All')   list = list.filter(s => s.tier === fTier)
    if (fAtRisk)             list = list.filter(s => s.atRisk)
    if (fCategory  !== 'All') list = list.filter(s => s.category      === fCategory)
    if (fProduct   !== 'All') list = list.filter(s => s.product       === fProduct)
    if (fSeason    !== 'All') list = list.filter(s => s.season        === fSeason)
    if (fGender    !== 'All') list = list.filter(s => s.gender        === fGender)
    if (fAgeGroup  !== 'All') list = list.filter(s => s.ageGroup      === fAgeGroup)
    if (fFabricQty !== 'All') list = list.filter(s => s.fabricQuality === fFabricQty)
    if (fQtyStatus !== 'All') list = list.filter(s => {
      const qty = s.orderQty
      const ns  = (v: number) => v === 0
      const ip  = (v: number) => v > 0 && v < qty
      const done = (v: number) => qty > 0 && v >= qty
      if (fQtyStage === 'Overall') {
        if (fQtyStatus === 'Not Started') return s.cutQty === 0
        if (fQtyStatus === 'In Progress') return s.cutQty > 0 && s.packedQty < qty
        if (fQtyStatus === 'Completed')   return done(s.packedQty)
      }
      if (fQtyStage === 'Cutting') {
        if (fQtyStatus === 'Not Started') return ns(s.cutQty)
        if (fQtyStatus === 'In Progress') return ip(s.cutQty)
        if (fQtyStatus === 'Completed')   return done(s.cutQty)
      }
      if (fQtyStage === 'Sewing') {
        if (fQtyStatus === 'Not Started') return ns(s.sewingQty)
        if (fQtyStatus === 'In Progress') return ip(s.sewingQty)
        if (fQtyStatus === 'Completed')   return done(s.sewingQty)
      }
      if (fQtyStage === 'Packing') {
        if (fQtyStatus === 'Not Started') return ns(s.packedQty)
        if (fQtyStatus === 'In Progress') return ip(s.packedQty)
        if (fQtyStatus === 'Completed')   return done(s.packedQty)
      }
      return true
    })
    if (fDispatchGRN !== 'All') list = list.filter(s => {
      if (fDispatchGRN === 'Dispatched')    return s.dispatchedQty > 0
      if (fDispatchGRN === 'GRN Pending')   return s.currentStage === 'grn' && s.grnQty === 0
      if (fDispatchGRN === 'GRN Partial')   return s.grnQty > 0 && s.grnQty < s.orderQty
      if (fDispatchGRN === 'GRN Complete')  return s.grnQty >= s.orderQty && s.orderQty > 0
      return true
    })

    list.sort((a, b) => {
      let av = '', bv = ''
      if      (sortField === 'id')          { av = a.id;                          bv = b.id }
      else if (sortField === 'style')       { av = a.styleCode;                   bv = b.styleCode }
      else if (sortField === 'colour')      { av = a.colour;                      bv = b.colour }
      else if (sortField === 'vendor')      { av = a.vendor.name;                 bv = b.vendor.name }
      else if (sortField === 'poc')         { av = a.poc.name;                    bv = b.poc.name }
      else if (sortField === 'stage')       { av = a.currentStage;                bv = b.currentStage }
      else if (sortField === 'qty')         { av = String(a.packedQty / (a.orderQty || 1)); bv = String(b.packedQty / (b.orderQty || 1)) }
      else if (sortField === 'inwardDate')  { av = a.buyingExpectedInwardDate;    bv = b.buyingExpectedInwardDate }
      else if (sortField === 'status')      { av = a.status;                      bv = b.status }
      else if (sortField === 'orderType')   { av = a.orderType;                   bv = b.orderType }
      else if (sortField === 'tier')        { av = a.tier;                        bv = b.tier }
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [subOrders, statusPill, fId, fStyle, fColour, fVendor, fPoc, fStage, fPP, fStatus, fType, fTier, fAtRisk, fQtyStage, fQtyStatus, fDispatchGRN, fCategory, fProduct, fSeason, fGender, fAgeGroup, fFabricQty, sortField, sortDir])

  const toggleSort = (f: string) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('asc') }
  }
  const SortIcon = ({ field }: { field: string }) => (
    sortField === field
      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-violet-600"/> : <ChevronDown className="w-3 h-3 text-violet-600"/>
      : <ChevronUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"/>
  )

  const counts = {
    overdue:   subOrders.filter(s => s.status === 'overdue').length,
    attention: subOrders.filter(s => s.status === 'needs-attention').length,
    onTrack:   subOrders.filter(s => s.status === 'on-track').length,
    completed: subOrders.filter(s => s.status === 'completed').length,
  }

  const hasActiveFilter = fId || fStyle || fColour !== 'All' || fVendor !== 'All' || fPoc !== 'All' || fStage !== 'All' ||
    fPP !== 'All' || fStatus !== 'All' || fType !== 'All' || fTier !== 'All' || fAtRisk || fQtyStatus !== 'All' || fDispatchGRN !== 'All' ||
    fCategory !== 'All' || fProduct !== 'All' || fSeason !== 'All' || fGender !== 'All' || fAgeGroup !== 'All' || fFabricQty !== 'All'

  const clearAll = () => {
    setFId(''); setFStyle(''); setFColour('All'); setFVendor('All'); setFPoc('All'); setFStage('All'); setFPP('All')
    setFStatus('All'); setFType('All'); setFTier('All'); setFAtRisk(false)
    setFQtyStage('Overall'); setFQtyStatus('All'); setFDispatchGRN('All')
    setFCategory('All'); setFProduct('All'); setFSeason('All'); setFGender('All'); setFAgeGroup('All'); setFFabricQty('All')
    setStatusPill('All')
  }

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (ordersError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Could not load orders</p>
        <p className="text-xs text-slate-500 max-w-xs">
          The backend API is unreachable. Make sure the server is running on <code className="bg-slate-100 px-1 py-0.5 rounded">localhost:3001</code>.
        </p>
        <p className="text-xs text-red-400 font-mono">{ordersError}</p>
      </div>
    )
  }

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {ppModalOrder  && <PreProdModal      order={ppModalOrder}  onClose={() => setPpModalOrder(null)}  />}
      {qtyModalOrder && <QtyProgressModal  order={qtyModalOrder} onClose={() => setQtyModalOrder(null)} />}

      {/* ── Right Drawer ────────────────────────────────────────────────────── */}
      {drawerOrder && (
        <>
          <div
            className={cn(
              'fixed inset-0 bg-black/30 z-40 transition-opacity duration-300',
              drawerVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            onClick={closeDrawer}
          />
          <div
            className={cn(
              'fixed top-0 right-0 h-full w-full md:w-[780px] md:max-w-[90vw] bg-white shadow-2xl z-50',
              'flex flex-col transition-transform duration-300 ease-out',
              drawerVisible ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            <SubOrderPanel order={drawerOrder} onClose={closeDrawer} />
          </div>
        </>
      )}

      {/* ── Mobile search bar ──────────────────────────────────────────────── */}
      <div className="md:hidden mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={fStyle || fId}
            onChange={e => { setFStyle(e.target.value); setFId(e.target.value) }}
            placeholder="Search style, code, vendor…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm"
          />
        </div>
      </div>

      {/* ── Status quick-filter pills + actions ───────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        {/* Pills — own scrollable container so it doesn't clip absolute dropdowns */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto pb-1 -mx-1 px-1 md:mx-0 md:px-0 no-scrollbar">
          {[
            { val: 'overdue',         label: `${counts.overdue} Overdue`,     act: 'bg-red-600 text-white border-red-600',       def: 'bg-red-50 text-red-700 border-red-200' },
            { val: 'needs-attention', label: `${counts.attention} Due Today`, act: 'bg-amber-500 text-white border-amber-500',   def: 'bg-amber-50 text-amber-700 border-amber-200' },
            { val: 'on-track',        label: `${counts.onTrack} On Track`,    act: 'bg-violet-600 text-white border-violet-600', def: 'bg-violet-50 text-violet-700 border-violet-200' },
            { val: 'completed',       label: `${counts.completed} Completed`, act: 'bg-green-600 text-white border-green-600',   def: 'bg-green-50 text-green-700 border-green-200' },
          ].map(({ val, label, act, def }) => (
            <button key={val} onClick={() => setStatusPill(statusPill === val ? 'All' : val)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all whitespace-nowrap flex-shrink-0 text-xs', statusPill === val ? act : def)}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />{label}
            </button>
          ))}
        </div>

        {/* Right-side actions — NOT inside overflow-x-auto so popovers render correctly */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasActiveFilter && (
            <button onClick={clearAll} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg bg-white whitespace-nowrap">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length} / {subOrders.length}</span>

          {/* Column visibility picker */}
          <div ref={colPickerRef} className="relative hidden md:block">
            <button
              onClick={() => setColPickerOpen(v => !v)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs transition-colors',
                colPickerOpen ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <Layers className="w-3.5 h-3.5" /> Columns
              {visibleCols.size < ALL_COLS.length && (
                <span className="ml-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {ALL_COLS.length - visibleCols.size}
                </span>
              )}
            </button>
            {colPickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-2 w-44">
                <p className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Toggle columns</p>
                {([
                  { key: 'colour',     label: 'Colour'         },
                  { key: 'vendor',     label: 'Vendor'         },
                  { key: 'poc',        label: 'Sourcing POC'   },
                  { key: 'stage',      label: 'Stage'          },
                  { key: 'pp',         label: 'Pre-Production' },
                  { key: 'qty',        label: 'Production'     },
                  { key: 'dispatched', label: 'Dispatch / GRN' },
                  { key: 'inwardDate', label: 'Inward Date'    },
                  { key: 'status',     label: 'Status'         },
                  { key: 'orderType',  label: 'Type (New / Replen)' },
                ] as { key: ColKey; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(key)}
                      onChange={() => toggleCol(key)}
                      className="w-3 h-3 rounded text-violet-500 focus:ring-violet-400"
                    />
                    <span className="text-xs text-slate-700">{label}</span>
                  </label>
                ))}
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-t border-slate-100 mt-1">
                  Style Attributes
                  <span className="ml-1 text-[9px] font-normal normal-case text-slate-300">· click + in table to expand</span>
                </p>
                {([
                  { key: 'category',     label: 'Category'  },
                  { key: 'product',      label: 'Product'   },
                  { key: 'season',       label: 'Season'    },
                  { key: 'gender',       label: 'Gender'    },
                  { key: 'ageGroup',     label: 'Age Group' },
                  { key: 'fabricQuality', label: 'Fabric'   },
                  { key: 'tier',          label: 'Tier'     },
                ] as { key: ColKey; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(key)}
                      onChange={() => toggleCol(key)}
                      className="w-3 h-3 rounded text-violet-500 focus:ring-violet-400"
                    />
                    <span className="text-xs text-slate-700">{label}</span>
                  </label>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1 px-3">
                  <button onClick={() => { setVisibleCols(new Set(ALL_COLS)); setStyleAttrsOpen(true) }} className="text-[11px] text-violet-500 hover:underline">Show all</button>
                </div>
              </div>
            )}
          </div>

          {/* Tracker view toggle */}
          <button
            onClick={() => setTrackerMode(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 'var(--ds-radius-sm)',
              border: `1px solid ${trackerMode ? 'var(--ds-primary)' : 'var(--ds-border)'}`,
              background: trackerMode ? 'var(--ds-primary-light)' : 'var(--ds-surface)',
              color: trackerMode ? 'var(--ds-primary-dark)' : 'var(--ds-text-secondary)',
              fontSize: 12.5, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            title={trackerMode ? 'Switch to Portfolio view' : 'Switch to Tracker view'}
          >
            {trackerMode
              ? <><LayoutGrid style={{ width: 13, height: 13 }} /> Portfolio View</>
              : <><Table2 style={{ width: 13, height: 13 }} /> Tracker View</>
            }
          </button>

          <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-xs">
            <Download className="w-3.5 h-3.5" /> Export DPR
          </button>
        </div>
      </div>

      {/* ── Tracker View ───────────────────────────────────────────────────── */}
      {trackerMode && <TrackerView orders={filtered} />}

      {/* ── Portfolio View (mobile + desktop) ──────────────────────────────── */}
      {!trackerMode && <>

      {/* ── Mobile card list ───────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center text-slate-400 text-sm">
            No SubOrders match the current filters.
            <button onClick={clearAll} className="ml-2 text-violet-500 hover:underline">Clear all</button>
          </div>
        ) : filtered.map(order => {
          const stage = stageLabel[order.currentStage] ?? { label: order.currentStage, color: 'text-slate-500' }
          const pct = order.orderQty > 0 ? Math.round((order.packedQty / order.orderQty) * 100) : 0
          const today = new Date(); today.setHours(0,0,0,0)
          const inward = new Date(order.buyingExpectedInwardDate); inward.setHours(0,0,0,0)
          const diff = Math.ceil((inward.getTime() - today.getTime()) / 86400000)
          const daysColor = diff < 0 ? 'text-red-600' : diff <= 7 ? 'text-red-500' : diff <= 14 ? 'text-amber-600' : 'text-green-600'
          const daysLabel = diff < 0 ? `${Math.abs(diff)}d late` : `${diff}d left`
          return (
            <div
              key={order.id}
              onClick={() => openDrawer(order)}
              className={cn(
                'bg-white rounded-xl border shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors',
                order.atRisk ? 'border-red-200' : 'border-slate-200'
              )}
            >
              {/* Top row: code + status */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {order.atRisk && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                  <span className="font-mono text-xs font-semibold text-violet-700">{order.id}</span>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {/* Style */}
              <p className="text-sm font-semibold text-slate-900 leading-tight">{order.styleCode}</p>
              <p className="text-xs text-slate-400 mt-0.5 mb-3">{order.styleName} · {order.colour}</p>

              {/* Vendor + Stage row */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-600 truncate">{order.vendor.name}</span>
                </div>
                <span className={cn('text-xs font-semibold flex-shrink-0', stage.color)}>{stage.label}</span>
              </div>

              {/* Qty progress bar */}
              {order.orderQty > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Production</span>
                    <span className="font-medium text-slate-600">{pct}% packed</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-violet-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200')}
                      style={{ width: `${Math.max(pct, 0)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bottom row: inward date + type/tier + chevron */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-500">
                    {new Date(order.buyingExpectedInwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className={cn('text-xs font-semibold', daysColor)}>{daysLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <OrderTypeBadge type={order.orderType} />
                  <TierBadge tier={order.tier} />
                  <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table ──────────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* ── Column header row ──────────────────────────────────────── */}
              <tr className="bg-slate-50 border-b border-slate-100">
                {/* Always: Fabricate Code */}
                <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-44 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('id')}>
                  <div className="flex items-center gap-1">Fabricate Code <SortIcon field="id" /></div>
                </th>

                {/* Always: Style */}
                <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none min-w-[160px] cursor-pointer hover:text-slate-700" onClick={() => toggleSort('style')}>
                  <div className="flex items-center gap-1">Style <SortIcon field="style" /></div>
                </th>

                {/* Style Attributes group toggle — always visible */}
                <th
                  className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold uppercase tracking-wide select-none cursor-pointer w-36 whitespace-nowrap"
                  onClick={() => setStyleAttrsOpen(v => !v)}
                >
                  <div className={cn('flex items-center gap-1.5', styleAttrsOpen ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600')}>
                    <span>Style Attributes</span>
                    {styleAttrsOpen
                      ? <Minus className="w-3 h-3 flex-shrink-0" />
                      : <Plus  className="w-3 h-3 flex-shrink-0" />
                    }
                  </div>
                </th>

                {/* Style Attribute sub-columns — only when expanded AND column visible */}
                {styleAttrsOpen && col('category')      && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-28 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('category')}><div className="flex items-center gap-1">Category <SortIcon field="category" /></div></th>}
                {styleAttrsOpen && col('product')       && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-28 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('product')}><div className="flex items-center gap-1">Product <SortIcon field="product" /></div></th>}
                {styleAttrsOpen && col('season')        && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-24 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('season')}><div className="flex items-center gap-1">Season <SortIcon field="season" /></div></th>}
                {styleAttrsOpen && col('gender')        && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-24 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('gender')}><div className="flex items-center gap-1">Gender <SortIcon field="gender" /></div></th>}
                {styleAttrsOpen && col('ageGroup')      && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-28 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('ageGroup')}><div className="flex items-center gap-1">Age Group <SortIcon field="ageGroup" /></div></th>}
                {styleAttrsOpen && col('fabricQuality') && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-32 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('fabricQuality')}><div className="flex items-center gap-1">Fabric <SortIcon field="fabricQuality" /></div></th>}
                {styleAttrsOpen && col('tier')          && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-24 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('tier')}><div className="flex items-center gap-1">Tier <SortIcon field="tier" /></div></th>}

                {/* Remaining optional columns */}
                {col('colour')      && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-28 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('colour')}><div className="flex items-center gap-1">Colour <SortIcon field="colour" /></div></th>}
                {col('vendor')      && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none min-w-[140px] cursor-pointer hover:text-slate-700" onClick={() => toggleSort('vendor')}><div className="flex items-center gap-1">Vendor <SortIcon field="vendor" /></div></th>}
                {col('poc')         && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none min-w-[130px] cursor-pointer hover:text-slate-700" onClick={() => toggleSort('poc')}><div className="flex items-center gap-1">Sourcing POC <SortIcon field="poc" /></div></th>}
                {col('stage')       && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none min-w-[140px] cursor-pointer hover:text-slate-700" onClick={() => toggleSort('stage')}><div className="flex items-center gap-1">Stage <SortIcon field="stage" /></div></th>}
                {col('pp')          && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none min-w-[160px] cursor-pointer hover:text-slate-700" onClick={() => toggleSort('pp')}><div className="flex items-center gap-1">Pre-Production <SortIcon field="pp" /></div></th>}
                {col('qty')         && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-36 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('qty')}><div className="flex items-center gap-1">Production <SortIcon field="qty" /></div></th>}
                {col('dispatched')  && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-32 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('dispatched')}><div className="flex items-center gap-1">Dispatch / GRN <SortIcon field="dispatched" /></div></th>}
                {col('inwardDate')  && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-28 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('inwardDate')}><div className="flex items-center gap-1">Inward Date <SortIcon field="inwardDate" /></div></th>}
                {col('status')      && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-32 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('status')}><div className="flex items-center gap-1">Status <SortIcon field="status" /></div></th>}
                {col('orderType')   && <th className="group px-4 pt-2.5 pb-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide select-none w-24 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('orderType')}><div className="flex items-center gap-1">Type <SortIcon field="orderType" /></div></th>}

                {/* Always: actions */}
                <th className="w-10" />
              </tr>
              {/* ── Column filter row ──────────────────────────────────────── */}
              <tr className="bg-white border-b border-slate-200">
                {/* Fabricate Code filter */}
                <td className="px-3 py-1.5"><ColFilter value={fId} onChange={setFId} placeholder="Search ID…" /></td>
                {/* Style filter */}
                <td className="px-3 py-1.5"><ColFilter value={fStyle} onChange={setFStyle} placeholder="Style code / name…" /></td>
                {/* Style Attributes group — empty when collapsed, empty when expanded (each sub-col has its own filter) */}
                <td className="px-3 py-1.5" />
                {/* Sub-column filters */}
                {styleAttrsOpen && col('category')      && <td className="px-3 py-1.5"><ColFilter value={fCategory}  onChange={setFCategory}  options={categoryOpts}  /></td>}
                {styleAttrsOpen && col('product')       && <td className="px-3 py-1.5"><ColFilter value={fProduct}   onChange={setFProduct}   options={productOpts}   /></td>}
                {styleAttrsOpen && col('season')        && <td className="px-3 py-1.5"><ColFilter value={fSeason}    onChange={setFSeason}    options={seasonOpts}    /></td>}
                {styleAttrsOpen && col('gender')        && <td className="px-3 py-1.5"><ColFilter value={fGender}    onChange={setFGender}    options={genderOpts}    /></td>}
                {styleAttrsOpen && col('ageGroup')      && <td className="px-3 py-1.5"><ColFilter value={fAgeGroup}  onChange={setFAgeGroup}  options={ageGroupOpts}  /></td>}
                {styleAttrsOpen && col('fabricQuality') && <td className="px-3 py-1.5"><ColFilter value={fFabricQty} onChange={setFFabricQty} options={fabricQtyOpts} /></td>}
                {styleAttrsOpen && col('tier')          && <td className="px-3 py-1.5"><ColFilter value={fTier} onChange={setFTier} options={tierOpts} /></td>}
                {/* Remaining optional column filters */}
                {col('colour')     && <td className="px-3 py-1.5"><ColFilter value={fColour} onChange={setFColour} options={colourOpts} /></td>}
                {col('vendor')     && <td className="px-3 py-1.5"><ColFilter value={fVendor} onChange={setFVendor} options={vendorOpts} /></td>}
                {col('poc')        && <td className="px-3 py-1.5"><ColFilter value={fPoc}    onChange={setFPoc}    options={pocOpts}    /></td>}
                {col('stage')      && <td className="px-3 py-1.5"><ColFilter value={fStage}  onChange={setFStage}  options={stageOpts}  /></td>}
                {col('pp')         && <td className="px-3 py-1.5"><ColFilter value={fPP}     onChange={setFPP}     options={ppOpts}     /></td>}
                {col('qty')        && <td className="px-3 py-1.5">
                  <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                    <select value={fQtyStage} onChange={e => { setFQtyStage(e.target.value); setFQtyStatus('All') }} className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer leading-tight">
                      {['Overall','Cutting','Sewing','Packing'].map(o => <option key={o}>{o}</option>)}
                    </select>
                    <select value={fQtyStatus} onChange={e => setFQtyStatus(e.target.value)} className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer leading-tight">
                      {['All','Not Started','In Progress','Completed'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </td>}
                {col('dispatched') && <td className="px-3 py-1.5"><ColFilter value={fDispatchGRN} onChange={setFDispatchGRN} options={['All','Dispatched','GRN Pending','GRN Partial','GRN Complete']} /></td>}
                {col('inwardDate') && <td className="px-3 py-1.5">
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={fAtRisk} onChange={e => setFAtRisk(e.target.checked)} className="rounded text-red-500 w-3 h-3" />
                    <AlertTriangle className="w-2.5 h-2.5 text-red-400" /> At risk
                  </label>
                </td>}
                {col('status')     && <td className="px-3 py-1.5"><ColFilter value={fStatus} onChange={setFStatus} options={statusOpts} /></td>}
                {col('orderType')  && <td className="px-3 py-1.5"><ColFilter value={fType} onChange={setFType} options={typeOpts} /></td>}
                {/* Actions */}
                <td className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={totalColCount} className="px-4 py-12 text-center text-slate-400 text-sm">No SubOrders match the current filters.
                    <button onClick={clearAll} className="ml-2 text-violet-500 hover:underline text-sm">Clear all</button>
                  </td></tr>
                : filtered.map(order => <PortfolioRow key={order.id} order={order} onPreProdClick={setPpModalOrder} onQtyClick={setQtyModalOrder} onRowClick={openDrawer} isExpanded={expandedRows.has(order.id)} onToggleExpand={toggleExpand} visibleCols={visibleCols} styleAttrsOpen={styleAttrsOpen} totalColCount={totalColCount} />)}
            </tbody>
          </table>
        </div>
      </div>

      </>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR ASSIGNMENT VIEW
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Vendor Assignment types ──────────────────────────────────────────────────

type VendorAssignment = {
  vendorId: string
  costingDueDate: string
  notes: string
  notificationSent: boolean
  costingStatus: 'pending' | 'submitted' | 'submitted-by-poc' | 'approved'
  submittedCost?: number
  /** Date POC tells the vendor to deliver by (with buffer vs buying deadline) */
  vendorTargetDate?: string
}

// RFQ summary on the listing — lightweight view of `VendorRFQ` from /lib/types
type RFQListItemStatus = 'sent' | 'responded' | 'declined' | 'accepted' | 'rejected' | 'expired' | 'revoked'
type RFQListStatus     = 'not-started' | 'sent' | 'responded' | 'confirmed' | 'closed-no-vendor'

type RFQLite = {
  vendorId: string
  vendorName: string
  status: RFQListItemStatus
  quotedPrice?: number
  vendorPromisedDate?: string
  capacityQty?: number
  expiresAt?: string
}

type PendingAssignOrder = {
  id: string
  styleCode: string
  styleName: string
  colour: string
  category: string
  product: string
  subType: string
  gender: string
  fabric: string
  orderQty: number
  targetPrice: number
  deliveryDays?: number
  inwardDate: string
  season: string
  assignedDate: string
  tier: 'HERO' | 'TIER-1' | 'TIER-2' | 'TAIL'
  orderType: 'NEW' | 'REPLEN'
  assignments: VendorAssignment[]
  rfqStatus?: RFQListStatus
  rfqs?: RFQLite[]
  techPackUrl?: string
}

type DraftEntry = {
  vendorIds: string[]
  costingDueDate: string
  notes: string
  vendorTargetDate: string
}

const PENDING_ASSIGN_ORDERS: PendingAssignOrder[] = [
  {
    id: 'NNKNTW250018', styleCode: 'NN416-089', styleName: 'Girls Ruffle Neck Top',
    colour: 'MINT GREEN', category: 'Knits', product: 'Top', subType: 'Casual Top', gender: 'Girls', fabric: 'Cotton',
    orderQty: 500, targetPrice: 220, deliveryDays: 45, inwardDate: '2026-06-05',
    season: 'SS25', assignedDate: '2026-04-13', tier: 'TIER-2', orderType: 'NEW',
    assignments: [],
    techPackUrl: 'https://drive.google.com/file/d/mock-tech-pack-NN416-089',
    rfqStatus: 'sent',
    rfqs: [
      { vendorId: 'v_adt', vendorName: 'ADITEE INTERNATIONAL', status: 'sent', expiresAt: '2026-05-22' },
      { vendorId: 'v_crv', vendorName: 'CAARVI TEXTILES',       status: 'sent', expiresAt: '2026-05-22' },
      { vendorId: 'v_and', vendorName: 'AND DESIGN',            status: 'sent', expiresAt: '2026-05-22' },
    ],
  },
  {
    id: 'NNKNTW250019', styleCode: 'NN419-201', styleName: 'Boys Printed Polo T-Shirt',
    colour: 'WHITE', category: 'Knits', product: 'T-Shirt', subType: 'Polo', gender: 'Boys', fabric: 'Cotton Blend',
    orderQty: 750, targetPrice: 175, deliveryDays: 40, inwardDate: '2026-06-10',
    season: 'SS25', assignedDate: '2026-04-13', tier: 'TIER-1', orderType: 'NEW',
    assignments: [],
    techPackUrl: 'https://drive.google.com/file/d/mock-tech-pack-NN419-201',
    rfqStatus: 'responded',
    rfqs: [
      { vendorId: 'v_adt', vendorName: 'ADITEE INTERNATIONAL', status: 'responded', quotedPrice: 168, vendorPromisedDate: '2026-08-12', capacityQty: 750, expiresAt: '2026-05-20' },
      { vendorId: 'v_crv', vendorName: 'CAARVI TEXTILES',       status: 'sent',                                                                       expiresAt: '2026-05-20' },
      { vendorId: 'v_and', vendorName: 'AND DESIGN',            status: 'declined' },
    ],
  },
  {
    id: 'NNKNTW250020', styleCode: 'NN421-088', styleName: 'Girls Woven Pinafore Dress',
    colour: 'DUSTY ROSE', category: 'Wovens', product: 'Dress', subType: 'Pinafore', gender: 'Girls', fabric: 'Rayon',
    orderQty: 320, targetPrice: 345, deliveryDays: 50, inwardDate: '2026-06-18',
    season: 'SS25', assignedDate: '2026-04-14', tier: 'TIER-2', orderType: 'NEW',
    assignments: [],
  },
  {
    id: 'NNKNTW250021', styleCode: 'NN424-156', styleName: 'Boys Cargo Shorts',
    colour: 'KHAKI', category: 'Wovens', product: 'Shorts', subType: 'Cargo', gender: 'Boys', fabric: 'Denim',
    orderQty: 600, targetPrice: 210, deliveryDays: 38, inwardDate: '2026-06-12',
    season: 'SS25', assignedDate: '2026-04-14', tier: 'TIER-1', orderType: 'REPLEN',
    assignments: [],
  },
  {
    id: 'NNKNTW250022', styleCode: 'NN426-310', styleName: 'Girls Embroidered Kurti',
    colour: 'YELLOW', category: 'Wovens', product: 'Kurti', subType: 'Ethnic', gender: 'Girls', fabric: 'Rayon',
    orderQty: 250, targetPrice: 480, deliveryDays: 55, inwardDate: '2026-06-25',
    season: 'SS25', assignedDate: '2026-04-15', tier: 'HERO', orderType: 'NEW',
    assignments: [],
  },
  {
    id: 'NNKNTW250023', styleCode: 'NN428-077', styleName: 'Boys French Terry Hoodie',
    colour: 'NAVY', category: 'Knits', product: 'Hoodie', subType: 'Sweatshirt', gender: 'Boys', fabric: 'Fleece',
    orderQty: 420, targetPrice: 395, deliveryDays: 48, inwardDate: '2026-06-28',
    season: 'SS25', assignedDate: '2026-04-15', tier: 'TIER-1', orderType: 'NEW',
    assignments: [],
  },
  {
    id: 'NNKNTW250024', styleCode: 'NN429-311', styleName: 'Girls Cord Pinafore',
    colour: 'BERRY', category: 'Wovens', product: 'Dress', subType: 'Pinafore', gender: 'Girls', fabric: 'Cotton',
    orderQty: 280, targetPrice: 390, deliveryDays: 42, inwardDate: '2026-07-02',
    season: 'SS25', assignedDate: '2026-04-15', tier: 'TIER-2', orderType: 'NEW',
    assignments: [],
  },
]

// ─── On-Behalf Cost Modal (POC submits for a vendor that hasn't uploaded) ────

function OnBehalfCostModal({
  order,
  vendorId,
  vendors,
  onClose,
  onSubmit,
}: {
  order: PendingAssignOrder
  vendorId: string
  vendors: ApiVendor[]
  onClose: () => void
  onSubmit: (orderId: string, vendorId: string, cost: number, notes: string) => void
}) {
  const vendor   = vendors.find(v => v.id === vendorId)
  const [cost, setCost]   = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone]   = useState(false)
  const costNum = parseFloat(cost) || 0
  const variance = costNum > 0 ? Math.round(((costNum - order.targetPrice) / order.targetPrice) * 100) : null

  if (done) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Send className="w-6 h-6 text-green-600" />
        </div>
        <p className="font-bold text-slate-900 text-lg">Cost Submitted!</p>
        <p className="text-sm text-slate-500 mt-1">Logged on behalf of <strong>{vendor?.name}</strong>.</p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Submit on Behalf of Vendor</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.styleCode} · {order.colour}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* vendor banner */}
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Building2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">Submitting on behalf of</p>
              <p className="text-sm font-semibold text-amber-900">{vendor?.name} · {vendor?.location}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Target price</p>
              <p className="text-xl font-black text-amber-700">₹{order.targetPrice}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Order qty</p>
              <p className="text-lg font-bold text-slate-800">{order.orderQty.toLocaleString()}</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Vendor Quote (₹/piece) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input type="number" value={cost} onChange={e => setCost(e.target.value)}
                placeholder={String(order.targetPrice)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-violet-500 text-center" />
            </div>
            {variance !== null && (
              <p className={cn('text-xs mt-2 font-medium text-center',
                variance <= 0 ? 'text-green-600' : variance <= 5 ? 'text-amber-600' : 'text-red-600'
              )}>
                {variance <= 0
                  ? `✓ ${Math.abs(variance)}% below target`
                  : `⚠ ${variance}% above target${variance > 5 ? ' — will be escalated' : ''}`}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Remarks</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Reason for submitting on vendor's behalf, any cost notes…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50">Cancel</button>
          <button disabled={!cost} onClick={() => {
            setDone(true)
            setTimeout(() => { onSubmit(order.id, vendorId, costNum, notes); onClose() }, 1200)
          }} className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2',
            cost ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          )}>
            <Send className="w-3.5 h-3.5" /> Submit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vendor Assignment View — full rebuild ───────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  HERO:     'bg-rose-100 text-rose-700 border-rose-200',
  'TIER-1': 'bg-violet-100 text-violet-700 border-violet-200',
  'TIER-2': 'bg-slate-100 text-slate-600 border-slate-200',
  TAIL:     'bg-slate-50 text-slate-400 border-slate-100',
}

function VendorChip({
  vendorId,
  assignment,
  vendors,
  onSubmitOnBehalf,
}: {
  vendorId: string
  assignment?: VendorAssignment
  vendors: ApiVendor[]
  onSubmitOnBehalf?: () => void
}) {
  const vendor = vendors.find(v => v.id === vendorId)
  if (!vendor) return null

  const statusClr = !assignment
    ? 'bg-slate-100 text-slate-500 border-slate-200'
    : assignment.costingStatus === 'approved'
      ? 'bg-green-50 text-green-700 border-green-200'
    : assignment.costingStatus === 'submitted' || assignment.costingStatus === 'submitted-by-poc'
      ? 'bg-violet-50 text-violet-700 border-violet-200'
    : daysLeft(assignment.costingDueDate) < 0
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'

  const statusIcon = !assignment ? null
    : assignment.costingStatus === 'approved' ? <Check className="w-3 h-3 text-green-500" />
    : assignment.costingStatus === 'submitted' || assignment.costingStatus === 'submitted-by-poc'
      ? <Send className="w-3 h-3 text-violet-500" />
    : daysLeft(assignment.costingDueDate) < 0
      ? <AlertCircle className="w-3 h-3 text-red-500" />
      : <Clock className="w-3 h-3 text-amber-500" />

  return (
    <div className={cn('inline-flex items-start gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium', statusClr)}>
      {statusIcon && <span className="mt-0.5 flex-shrink-0">{statusIcon}</span>}
      <div className="min-w-0">
        <p className="font-semibold truncate max-w-[8rem]">{vendor.name}</p>
        <p className="text-[10px] opacity-60 font-mono">{vendor.id}</p>
      </div>
      {assignment && daysLeft(assignment.costingDueDate) < 0
        && assignment.costingStatus === 'pending'
        && onSubmitOnBehalf && (
        <button
          onClick={e => { e.stopPropagation(); onSubmitOnBehalf() }}
          className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200 transition-colors whitespace-nowrap self-center"
        >
          Submit on behalf
        </button>
      )}
    </div>
  )
}

function daysLeft(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

// ─── RFQ status display helpers (listing page) ────────────────────────────────

const RFQ_LIST_STATUS_LABEL: Record<RFQListStatus, string> = {
  'not-started':      'Not Started',
  'sent':             'RFQs Sent',
  'responded':        'Quotes Received',
  'confirmed':        'Vendor Confirmed',
  'closed-no-vendor': 'Closed — No Vendor',
}

const RFQ_LIST_STATUS_STYLE: Record<RFQListStatus, string> = {
  'not-started':      'bg-slate-100 text-slate-600 border-slate-200',
  'sent':             'bg-violet-100 text-violet-700 border-violet-200',
  'responded':        'bg-amber-100 text-amber-800 border-amber-200',
  'confirmed':        'bg-green-100 text-green-700 border-green-200',
  'closed-no-vendor': 'bg-slate-200 text-slate-600 border-slate-300',
}

function rfqSummaryCounts(rfqs: RFQLite[] | undefined) {
  const sent       = rfqs?.filter(r => r.status === 'sent').length          ?? 0
  const responded  = rfqs?.filter(r => r.status === 'responded').length     ?? 0
  const declined   = rfqs?.filter(r => r.status === 'declined' || r.status === 'expired' || r.status === 'revoked').length ?? 0
  const accepted   = rfqs?.filter(r => r.status === 'accepted').length      ?? 0
  const total      = rfqs?.length ?? 0
  return { sent, responded, declined, accepted, total }
}

function bestQuote(rfqs: RFQLite[] | undefined) {
  const quoted = (rfqs ?? []).filter(r => r.status === 'responded' && typeof r.quotedPrice === 'number')
  if (quoted.length === 0) return null
  return quoted.reduce((b, r) => (r.quotedPrice! < b.quotedPrice! ? r : b))
}

function VendorAssignView() {
  const { data: vendors } = useVendors()
  const router = useRouter()

  const defaultDue = () => {
    const d = new Date(); d.setDate(d.getDate() + 5)
    return d.toISOString().split('T')[0]
  }

  // ── RFQ Drawer (right-side panel) ──────────────────────────────────────────
  const [drawerOrder, setDrawerOrder] = useState<SubOrder | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)

  const openRFQDrawer = useCallback((id: string) => {
    const found = mockSubOrders.find(s => s.id === id)
    if (!found) return
    setDrawerOrder(found)
    setDrawerVisible(true)
    document.body.style.overflow = 'hidden'
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false)
    document.body.style.overflow = ''
    setTimeout(() => setDrawerOrder(null), 300)
  }, [])

  useEffect(() => () => { document.body.style.overflow = '' }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [closeDrawer])

  const [orders, setOrders]           = useState<PendingAssignOrder[]>(PENDING_ASSIGN_ORDERS)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [draft, setDraft]             = useState<Record<string, DraftEntry>>({})
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState<'all'|'unassigned'|'staged'|'assigned'|'rfq-sent'|'rfq-responded'>('all')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterSubType,  setFilterSubType]  = useState('All')
  const [filterGender,   setFilterGender]   = useState('All')
  const [filterFabric,   setFilterFabric]   = useState('All')
  const [sortField, setSortField]     = useState('inwardDate')
  const [sortDir, setSortDir]         = useState<'asc'|'desc'>('asc')
  const [savedToast, setSavedToast]   = useState<string|null>(null)

  // Unified assign sheet — works for both per-tile (1 id) and multi-select (n ids)
  const [assignSheetIds, setAssignSheetIds]           = useState<string[]>([])
  const [sheetVendorIds, setSheetVendorIds]           = useState<string[]>([])
  const [sheetDueDate, setSheetDueDate]               = useState(defaultDue)
  const [sheetVendorTargetDate, setSheetVendorTargetDate] = useState('')
  const [sheetNotes, setSheetNotes]                   = useState('')
  const [sheetVendorSearch, setSheetVendorSearch]     = useState('')

  const openSheet = (ids: string[]) => {
    setAssignSheetIds(ids)
    setSheetVendorIds([])
    setSheetDueDate(defaultDue())
    setSheetNotes('')
    setSheetVendorSearch('')
    // Pre-fill vendor target date: buying date minus 14 days (single order), blank for multi
    if (ids.length === 1) {
      const o = orders.find(x => x.id === ids[0])
      if (o?.inwardDate) {
        const d = new Date(o.inwardDate)
        d.setDate(d.getDate() - 14)
        setSheetVendorTargetDate(d.toISOString().split('T')[0])
      } else {
        setSheetVendorTargetDate('')
      }
    } else {
      setSheetVendorTargetDate('')
    }
  }

  const closeSheet = () => {
    setAssignSheetIds([])
    setSheetVendorIds([])
    setSheetVendorSearch('')
  }

  const stageSheet = () => {
    if (assignSheetIds.length === 0 || sheetVendorIds.length === 0) return
    setDraft(p => {
      const next = { ...p }
      assignSheetIds.forEach(id => {
        next[id] = { vendorIds: sheetVendorIds, costingDueDate: sheetDueDate, notes: sheetNotes, vendorTargetDate: sheetVendorTargetDate }
      })
      return next
    })
    setSelected(new Set())
    closeSheet()
  }

  const sheetOrders = assignSheetIds.map(id => orders.find(o => o.id === id)).filter(Boolean) as PendingAssignOrder[]
  // Active orders per vendor (stage not yet 'grn') — surfaces capacity context in the picker
  const sheetVendorWorkload = new Map<string, { activeOrders: number; pipelineQty: number; sameCategory: number }>()
  const sheetCategoryHint    = sheetOrders.length === 1 ? sheetOrders[0].category : null
  for (const so of mockSubOrders) {
    if (!so.vendor?.id || so.vendor.id === 'v_tba') continue
    if (so.currentStage === 'grn') continue
    const prev = sheetVendorWorkload.get(so.vendor.id) ?? { activeOrders: 0, pipelineQty: 0, sameCategory: 0 }
    prev.activeOrders += 1
    prev.pipelineQty  += so.orderQty
    if (sheetCategoryHint && so.category === sheetCategoryHint) prev.sameCategory += 1
    sheetVendorWorkload.set(so.vendor.id, prev)
  }
  const sheetFilteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(sheetVendorSearch.toLowerCase()) ||
    (v.location ?? '').toLowerCase().includes(sheetVendorSearch.toLowerCase())
  )

  // On-behalf modal
  const [onBehalfModal, setOnBehalfModal] = useState<{orderId: string; vendorId: string}|null>(null)

  // Select-all ref (indeterminate)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const assignCategoryOpts = useMemo(() => ['All', ...Array.from(new Set(orders.map(o => o.category))).sort()], [orders])
  const assignSubTypeOpts  = useMemo(() => ['All', ...Array.from(new Set(orders.map(o => o.subType))).sort()], [orders])
  const assignGenderOpts   = useMemo(() => ['All', ...Array.from(new Set(orders.map(o => o.gender))).sort()], [orders])
  const assignFabricOpts   = useMemo(() => ['All', ...Array.from(new Set(orders.map(o => o.fabric))).sort()], [orders])

  const filtered = useMemo(() => {
    let list = [...orders]
    const q = search.toLowerCase()
    if (q) list = list.filter(o =>
      o.styleCode.toLowerCase().includes(q) ||
      o.styleName.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.colour.toLowerCase().includes(q)
    )
    if (filterStatus === 'unassigned') list = list.filter(o => o.assignments.length === 0 && !draft[o.id] && (!o.rfqStatus || o.rfqStatus === 'not-started'))
    if (filterStatus === 'staged')     list = list.filter(o => !!draft[o.id])
    if (filterStatus === 'assigned')   list = list.filter(o => o.assignments.length > 0 && !draft[o.id])
    if (filterStatus === 'rfq-sent')      list = list.filter(o => o.rfqStatus === 'sent')
    if (filterStatus === 'rfq-responded') list = list.filter(o => o.rfqStatus === 'responded')
    if (filterCategory !== 'All') list = list.filter(o => o.category === filterCategory)
    if (filterSubType  !== 'All') list = list.filter(o => o.subType  === filterSubType)
    if (filterGender   !== 'All') list = list.filter(o => o.gender   === filterGender)
    if (filterFabric   !== 'All') list = list.filter(o => o.fabric   === filterFabric)
    list.sort((a, b) => {
      let av = '', bv = ''
      if (sortField === 'style')      { av = a.styleCode; bv = b.styleCode }
      else if (sortField === 'qty')   { return sortDir === 'asc' ? a.orderQty - b.orderQty : b.orderQty - a.orderQty }
      else if (sortField === 'price') { return sortDir === 'asc' ? a.targetPrice - b.targetPrice : b.targetPrice - a.targetPrice }
      else if (sortField === 'inwardDate') { av = a.inwardDate; bv = b.inwardDate }
      else if (sortField === 'tier')  { av = a.tier; bv = b.tier }
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [orders, search, filterStatus, filterCategory, filterSubType, filterGender, filterFabric, sortField, sortDir, draft])

  // Update select-all indeterminate state
  const allSel  = filtered.length > 0 && filtered.every(o => selected.has(o.id))
  const someSel = filtered.some(o => selected.has(o.id)) && !allSel
  useCallback(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSel
  }, [someSel])()

  const toggleAll = () => {
    if (allSel) setSelected(new Set())
    else setSelected(new Set(filtered.map(o => o.id)))
  }
  const toggle = (id: string) =>
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const stageBulk = stageSheet

  const discardDraft = (id?: string) => {
    if (id) setDraft(p => { const n = { ...p }; delete n[id]; return n })
    else setDraft({})
  }

  const confirmAll = () => {
    setOrders(prev => prev.map(o => {
      if (!draft[o.id]) return o
      const entry = draft[o.id]
      const newAssignments: VendorAssignment[] = entry.vendorIds.map(vid => ({
        vendorId: vid,
        costingDueDate: entry.costingDueDate,
        notes: entry.notes,
        notificationSent: true,
        costingStatus: 'pending',
        ...(entry.vendorTargetDate ? { vendorTargetDate: entry.vendorTargetDate } : {}),
      }))
      return { ...o, assignments: [...o.assignments, ...newAssignments] }
    }))
    const count = Object.keys(draft).length
    const vcount = new Set(Object.values(draft).flatMap(d => d.vendorIds)).size
    setDraft({})
    setSavedToast(`${count} style${count>1?'s':''} assigned to ${vcount} vendor${vcount>1?'s':''}. Notifications sent.`)
    setTimeout(() => setSavedToast(null), 4000)
  }

  const handleOnBehalfSubmit = (orderId: string, vendorId: string, cost: number, notes: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      return {
        ...o,
        assignments: o.assignments.map(a =>
          a.vendorId !== vendorId ? a : { ...a, costingStatus: 'submitted-by-poc', submittedCost: cost }
        ),
      }
    }))
  }

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  const SortBtn = ({ field, label }: { field: string; label: string }) => (
    <button onClick={() => toggleSort(field)}
      className={cn('flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap transition-colors',
        sortField === field ? 'text-violet-600' : 'text-slate-400 hover:text-slate-700'
      )}>
      {label}
      {sortField === field
        ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>
        : <ChevronUp className="w-3 h-3 opacity-30"/>}
    </button>
  )

  const totalDraft  = Object.keys(draft).length
  const selCount    = selected.size
  const selOrders   = Array.from(selected)

  const unassigned  = orders.filter(o => o.assignments.length === 0 && !draft[o.id] && (!o.rfqStatus || o.rfqStatus === 'not-started')).length
  const stagedCount = Object.keys(draft).length
  const assignedCount = orders.filter(o => o.assignments.length > 0).length
  const rfqSentCount      = orders.filter(o => o.rfqStatus === 'sent').length
  const rfqRespondedCount = orders.filter(o => o.rfqStatus === 'responded').length

  const onBehalfOrder = onBehalfModal ? orders.find(o => o.id === onBehalfModal.orderId) : null

  return (
    <div className="px-4 md:px-6 py-6 pb-24">

      {/* ── RFQ Right Drawer ────────────────────────────────────────────────── */}
      {drawerOrder && (
        <>
          <div
            className={cn(
              'fixed inset-0 bg-black/30 z-40 transition-opacity duration-300',
              drawerVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            onClick={closeDrawer}
          />
          <div
            className={cn(
              'fixed top-0 right-0 h-full w-full md:w-[780px] md:max-w-[90vw] bg-white shadow-2xl z-50',
              'flex flex-col transition-transform duration-300 ease-out',
              drawerVisible ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            <SubOrderPanel order={drawerOrder} onClose={closeDrawer} initialTab="vendor-assign" />
          </div>
        </>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Pending RFQ',        value: unassigned,         color: 'amber',  filter: 'unassigned'    as const },
          { label: 'RFQs Sent',          value: rfqSentCount,       color: 'violet', filter: 'rfq-sent'      as const },
          { label: 'Quotes Received',    value: rfqRespondedCount,  color: 'orange', filter: 'rfq-responded' as const },
          { label: 'Confirmed',          value: assignedCount,      color: 'green',  filter: 'assigned'      as const },
          { label: 'Total Styles',       value: orders.length,      color: 'slate',  filter: 'all'           as const },
        ].map(({ label, value, color, filter }) => {
          const bg   = { amber:'bg-amber-50 border-amber-200', violet:'bg-violet-50 border-violet-200', orange:'bg-orange-50 border-orange-200', green:'bg-green-50 border-green-200', slate:'bg-slate-50 border-slate-200' }[color]
          const txt  = { amber:'text-amber-700', violet:'text-violet-700', orange:'text-orange-700', green:'text-green-700', slate:'text-slate-700' }[color]
          return (
            <button key={label} onClick={() => setFilterStatus(filterStatus === filter ? 'all' : filter)}
              className={cn('rounded-xl border p-3 md:p-4 text-left transition-all hover:shadow-sm', bg,
                filterStatus === filter && 'ring-2 ring-offset-1 ring-violet-400'
              )}>
              <p className={cn('text-xl md:text-2xl font-black', txt)}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
            </button>
          )
        })}
      </div>

      {/* ── Toolbar: search + sort ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search style code, name, colour…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-500">
          <span className="mr-1 text-slate-400">Sort:</span>
          <SortBtn field="style"      label="Style" />
          <span className="text-slate-200">|</span>
          <SortBtn field="qty"        label="Qty" />
          <span className="text-slate-200">|</span>
          <SortBtn field="price"      label="Price" />
          <span className="text-slate-200">|</span>
          <SortBtn field="inwardDate" label="Date" />
          <span className="text-slate-200">|</span>
          <SortBtn field="tier"       label="Tier" />
        </div>

        {/* Attribute filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Category', value: filterCategory, opts: assignCategoryOpts, setter: setFilterCategory },
            { label: 'Sub-type', value: filterSubType,  opts: assignSubTypeOpts,  setter: setFilterSubType  },
            { label: 'Gender',   value: filterGender,   opts: assignGenderOpts,   setter: setFilterGender   },
            { label: 'Fabric',   value: filterFabric,   opts: assignFabricOpts,   setter: setFilterFabric   },
          ].map(({ label, value, opts, setter }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">{label}:</span>
              <select value={value} onChange={e => setter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer">
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {(filterCategory !== 'All' || filterSubType !== 'All' || filterGender !== 'All' || filterFabric !== 'All') && (
            <button onClick={() => { setFilterCategory('All'); setFilterSubType('All'); setFilterGender('All'); setFilterFabric('All') }}
              className="text-xs text-slate-400 hover:text-red-500 underline">Clear</button>
          )}
        </div>

        <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {orders.length} styles</span>
      </div>


      {/* ── Table (desktop) ── */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 w-10">
                <input type="checkbox" ref={selectAllRef} checked={allSel} onChange={toggleAll}
                  className="rounded text-violet-600 focus:ring-violet-500" />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Style</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Colour</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cat</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Sub-type</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Gender</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fabric</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Target ₹</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Del. Days</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Inward</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tier</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor Status</th>
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-400 text-sm">No styles match current filters.</td></tr>
            ) : filtered.map(order => {
              const isSel    = selected.has(order.id)
              const isDraft  = !!draft[order.id]
              const dEntry   = draft[order.id]
              const diff     = Math.ceil((new Date(order.inwardDate).getTime() - Date.now()) / 86400000)

              return (
                <tr key={order.id} className={cn(
                  'border-b border-slate-100 last:border-0 transition-colors',
                  isSel    ? 'bg-violet-50/40' :
                  isDraft  ? 'bg-amber-50/40' :
                  order.assignments.length > 0 ? 'bg-green-50/20' : 'hover:bg-slate-50'
                )}>
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(order.id)}
                      className="rounded text-violet-600 focus:ring-violet-500" />
                  </td>

                  {/* Style */}
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{order.styleCode}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[10rem]">{order.styleName}</p>
                    <p className="text-xs text-slate-400 font-mono">{order.id}</p>
                  </td>

                  {/* Colour */}
                  <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.colour}</span></td>

                  {/* Category */}
                  <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.category}</span></td>

                  {/* Sub-type */}
                  <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.subType}</span></td>

                  {/* Gender */}
                  <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.gender}</span></td>

                  {/* Fabric */}
                  <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.fabric}</span></td>

                  {/* Qty */}
                  <td className="px-4 py-3"><span className="text-sm font-medium text-slate-700">{order.orderQty.toLocaleString()}</span></td>

                  {/* Target */}
                  <td className="px-4 py-3"><span className="text-sm font-bold text-amber-700">₹{order.targetPrice}</span></td>

                  {/* Delivery Days */}
                  <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.deliveryDays ? `${order.deliveryDays}d` : '—'}</span></td>

                  {/* Inward */}
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">
                      {new Date(order.inwardDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                    </p>
                    <span className={cn('text-xs font-semibold',
                      diff < 0 ? 'text-red-600' : diff <= 14 ? 'text-amber-600' : 'text-green-700'
                    )}>
                      {diff < 0 ? `${Math.abs(diff)}d late` : `${diff}d left`}
                    </span>
                  </td>

                  {/* Tier */}
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', TIER_COLOR[order.tier])}>
                      {order.tier}
                    </span>
                  </td>

                  {/* Vendor status */}
                  <td className="px-4 py-3">
                    {isDraft ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {dEntry.vendorIds.map(vid => {
                            const v = vendors.find(x => x.id === vid)
                            return (
                              <span key={vid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full border border-amber-200 font-medium">
                                <Clock className="w-2.5 h-2.5" />
                                {v?.name.split(' ')[0]}
                              </span>
                            )
                          })}
                        </div>
                        <p className="text-xs text-amber-600 italic">
                          Staged · due {new Date(dEntry.costingDueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        </p>
                        <button onClick={() => discardDraft(order.id)}
                          className="text-xs text-slate-400 hover:text-red-500 underline">discard</button>
                      </div>
                    ) : order.rfqStatus && order.rfqStatus !== 'not-started' ? (
                      (() => {
                        const c = rfqSummaryCounts(order.rfqs)
                        const best = bestQuote(order.rfqs)
                        return (
                          <div className="space-y-1.5">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border', RFQ_LIST_STATUS_STYLE[order.rfqStatus])}>
                              <Send className="w-2.5 h-2.5" />
                              {RFQ_LIST_STATUS_LABEL[order.rfqStatus]}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-700">{c.total} sent</span>
                              {c.responded > 0 && <span className="text-amber-700">· {c.responded} responded</span>}
                              {c.declined  > 0 && <span className="text-slate-400">· {c.declined} declined</span>}
                            </div>
                            {best && (
                              <p className="text-[11px] text-slate-600">
                                Best: <span className="font-bold text-green-700">₹{best.quotedPrice}</span>
                                <span className="text-slate-400"> · {best.vendorName.split(' ')[0]}</span>
                              </p>
                            )}
                          </div>
                        )
                      })()
                    ) : order.assignments.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {order.assignments.map(a => (
                          <VendorChip
                            key={a.vendorId}
                            vendorId={a.vendorId}
                            assignment={a}
                            vendors={vendors}
                            onSubmitOnBehalf={() => setOnBehalfModal({ orderId: order.id, vendorId: a.vendorId })}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    {!isDraft && (
                      order.rfqStatus && order.rfqStatus !== 'not-started' ? (
                        <button
                          onClick={() => openRFQDrawer(order.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 whitespace-nowrap"
                        >
                          View RFQs <ChevronRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button onClick={() => openSheet([order.id])}
                          className={cn(
                            'flex items-center gap-1 text-xs font-medium whitespace-nowrap transition-colors',
                            order.assignments.length === 0
                              ? 'text-violet-600 hover:text-violet-800'
                              : 'text-slate-400 hover:text-slate-600'
                          )}>
                          <Building2 className="w-3 h-3" />
                          {order.assignments.length === 0 ? 'Send RFQ' : 'Re-assign'}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-3">
        {/* Select all bar */}
        <div className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-2.5 border transition-colors',
          selCount > 0
            ? 'bg-violet-50 border-violet-300'
            : 'bg-white border-slate-200'
        )}>
          <input type="checkbox" ref={selectAllRef} checked={allSel} onChange={toggleAll}
            className="rounded text-violet-600 focus:ring-violet-500 flex-shrink-0" />
          <span className="text-xs text-slate-600 font-medium">
            {allSel ? 'Deselect all' : `Select all (${filtered.length})`}
          </span>
          {selCount > 0 ? (
            <>
              <span className="text-xs font-bold text-violet-700 flex-shrink-0">{selCount} selected</span>
              <button
                onClick={() => openSheet(Array.from(selected))}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg active:bg-violet-800 shadow-sm flex-shrink-0"
              >
                <Building2 className="w-3.5 h-3.5" />
                Assign Vendor
              </button>
            </>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
            No styles match current filters.
          </div>
        ) : filtered.map(order => {
          const isSel   = selected.has(order.id)
          const isDraft = !!draft[order.id]
          const dEntry  = draft[order.id]
          const diff    = Math.ceil((new Date(order.inwardDate).getTime() - Date.now()) / 86400000)

          return (
            <div key={order.id} className={cn(
              'bg-white rounded-xl border shadow-sm overflow-hidden',
              isSel   ? 'border-violet-300 ring-1 ring-violet-200' :
              isDraft ? 'border-amber-200' :
              order.assignments.length > 0 ? 'border-green-200' : 'border-slate-200'
            )}>
              <div className={cn('h-1',
                isSel ? 'bg-violet-500' : isDraft ? 'bg-amber-400' :
                order.assignments.length > 0 ? 'bg-green-500' : 'bg-slate-200'
              )} />
              <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <input type="checkbox" checked={isSel} onChange={() => toggle(order.id)}
                    className="mt-1 rounded text-violet-600 focus:ring-violet-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{order.styleCode}</p>
                        <p className="text-xs text-slate-400 truncate">{order.styleName}</p>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', TIER_COLOR[order.tier])}>
                        {order.tier}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-xl p-3 mb-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Qty</p>
                    <p className="text-sm font-bold text-slate-800">{order.orderQty.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Target</p>
                    <p className="text-sm font-bold text-amber-700">₹{order.targetPrice}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Inward</p>
                    <p className={cn('text-xs font-bold',
                      diff < 0 ? 'text-red-600' : diff <= 14 ? 'text-amber-600' : 'text-green-700'
                    )}>
                      {diff < 0 ? `${Math.abs(diff)}d late` : `${diff}d left`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400">{order.colour} · {order.category}</span>
                </div>

                {/* Vendor status + assign CTA on mobile */}
                {isDraft ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-amber-700">Staged for assignment</p>
                      <button onClick={() => discardDraft(order.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium">Discard</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {dEntry.vendorIds.map(vid => {
                        const v = vendors.find(x => x.id === vid)
                        return (
                          <span key={vid} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full border border-amber-200 font-medium">
                            {v?.name.split(' ')[0]}
                          </span>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1.5">
                      Costing due {new Date(dEntry.costingDueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                    </p>
                  </div>
                ) : order.rfqStatus && order.rfqStatus !== 'not-started' ? (
                  (() => {
                    const c = rfqSummaryCounts(order.rfqs)
                    const best = bestQuote(order.rfqs)
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border', RFQ_LIST_STATUS_STYLE[order.rfqStatus!])}>
                            <Send className="w-2.5 h-2.5" />
                            {RFQ_LIST_STATUS_LABEL[order.rfqStatus!]}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {c.total} sent
                            {c.responded > 0 && <span className="text-amber-700"> · {c.responded} responded</span>}
                            {c.declined  > 0 && <span className="text-slate-400"> · {c.declined} declined</span>}
                          </span>
                        </div>
                        {best && (
                          <p className="text-[11px] text-slate-600 mb-2">
                            Best quote: <span className="font-bold text-green-700">₹{best.quotedPrice}</span>
                            <span className="text-slate-400"> · {best.vendorName}</span>
                          </p>
                        )}
                        <button
                          onClick={() => openRFQDrawer(order.id)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
                        >
                          <Send className="w-4 h-4" /> View RFQ Tracker
                        </button>
                      </div>
                    )
                  })()
                ) : order.assignments.length > 0 ? (
                  <div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {order.assignments.map(a => (
                        <VendorChip
                          key={a.vendorId}
                          vendorId={a.vendorId}
                          assignment={a}
                          vendors={vendors}
                          onSubmitOnBehalf={() => setOnBehalfModal({ orderId: order.id, vendorId: a.vendorId })}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => openSheet([order.id])}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Add another vendor
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openSheet([order.id])}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 active:bg-violet-800 transition-colors shadow-sm"
                  >
                    <Building2 className="w-4 h-4" /> Send RFQ
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Floating selection action bar ── */}
      {selCount > 0 && (
        <div className="fixed bottom-0 left-0 md:left-60 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-4 md:px-6 py-3">
          <div className="flex items-center gap-3 max-w-5xl mx-auto">
            {/* Count pill */}
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {selCount}
            </div>
            {/* Label + style pills */}
            <div className="min-w-0">
              <span className="text-sm font-semibold text-slate-800">
                {selCount} style{selCount > 1 ? 's' : ''} selected
              </span>
              <div className="hidden md:flex items-center gap-1 mt-0.5 flex-wrap">
                {Array.from(selected).slice(0, 4).map(id => {
                  const o = orders.find(x => x.id === id)
                  return o ? (
                    <span key={id} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                      {o.styleCode}
                    </span>
                  ) : null
                })}
                {selected.size > 4 && (
                  <span className="text-xs text-slate-400">+{selected.size - 4} more</span>
                )}
              </div>
            </div>
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors ml-1 flex-shrink-0">
              Clear
            </button>
            <div className="flex-1" />
            <button onClick={() => openSheet(Array.from(selected))}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 active:bg-violet-800 shadow-sm transition-colors flex-shrink-0">
              <Building2 className="w-4 h-4" />
              Assign to Vendor
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky save bar ── */}
      {totalDraft > 0 && selCount === 0 && (
        <div className="fixed bottom-0 left-0 md:left-60 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-4 md:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-5xl mx-auto">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {totalDraft} style{totalDraft > 1 ? 's' : ''} staged for assignment
              </p>
              <p className="text-xs text-slate-500">
                {new Set(Object.values(draft).flatMap(d => d.vendorIds)).size} vendor{new Set(Object.values(draft).flatMap(d => d.vendorIds)).size > 1 ? 's' : ''} will be notified · vendors will be asked to upload quotes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => discardDraft()}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                Discard All
              </button>
              <button onClick={confirmAll}
                className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm">
                <Send className="w-3.5 h-3.5" />
                Confirm & Send Notifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-behalf modal */}
      {onBehalfModal && onBehalfOrder && (
        <OnBehalfCostModal
          order={onBehalfOrder}
          vendorId={onBehalfModal.vendorId}
          vendors={vendors}
          onClose={() => setOnBehalfModal(null)}
          onSubmit={handleOnBehalfSubmit}
        />
      )}

      {/* ── Unified assign sheet — bottom sheet on mobile, right drawer on desktop ── */}
      {assignSheetIds.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeSheet} />
          {/* Mobile: bottom sheet | Desktop: right drawer */}
          <div className="fixed z-50 bg-white shadow-2xl flex flex-col
            bottom-0 left-0 right-0 rounded-t-2xl max-h-[90vh]
            md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[420px] md:max-h-full md:rounded-none md:rounded-l-2xl">

            {/* Mobile handle (hidden on desktop) */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0 md:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            {/* Desktop top padding */}
            <div className="hidden md:block pt-5 flex-shrink-0" />

            {/* Header */}
            <div className="px-5 pt-2 pb-3 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-slate-900">Assign Vendor</p>
                {sheetOrders.length === 1 ? (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sheetOrders[0].styleCode} · {sheetOrders[0].colour} · {sheetOrders[0].orderQty} pcs
                  </p>
                ) : (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className="text-xs text-slate-500">{sheetOrders.length} styles selected —</span>
                    {sheetOrders.slice(0, 3).map(o => (
                      <span key={o.id} className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">{o.styleCode}</span>
                    ))}
                    {sheetOrders.length > 3 && <span className="text-xs text-slate-400">+{sheetOrders.length - 3} more</span>}
                  </div>
                )}
              </div>
              <button onClick={closeSheet} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Vendor picker */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Select Vendor{sheetVendorIds.length > 1 ? 's' : ''}
                  {sheetVendorIds.length > 0 && (
                    <span className="ml-1.5 text-violet-600">{sheetVendorIds.length} selected</span>
                  )}
                </p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={sheetVendorSearch}
                    onChange={e => setSheetVendorSearch(e.target.value)}
                    placeholder="Search vendor…"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  />
                  {sheetVendorSearch && (
                    <button onClick={() => setSheetVendorSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {sheetFilteredVendors.length === 0 ? (
                    <p className="px-4 py-5 text-xs text-slate-400 text-center">No vendors match</p>
                  ) : sheetFilteredVendors.map(v => {
                    const sel  = sheetVendorIds.includes(v.id)
                    const otif = v.otifScore ?? 0
                    const fi   = v.fiPassRate ?? 0
                    const wl   = sheetVendorWorkload.get(v.id) ?? { activeOrders: 0, pipelineQty: 0, sameCategory: 0 }
                    const otifColor = otif >= 75 ? 'text-green-700 bg-green-50' : otif >= 60 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                    const fiColor   = fi   >= 85 ? 'text-green-700 bg-green-50' : fi   >= 70 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                    const loadColor = wl.activeOrders >= 8 ? 'bg-red-50 border-red-200 text-red-700' :
                                      wl.activeOrders >= 4 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                      'bg-green-50 border-green-200 text-green-700'
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSheetVendorIds(p => p.includes(v.id) ? p.filter(x => x !== v.id) : [...p, v.id])}
                        className={cn('w-full flex items-start gap-3 px-4 py-3 text-left transition-colors', sel ? 'bg-violet-50' : 'bg-white hover:bg-slate-50')}
                      >
                        <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5', sel ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white')}>
                          {sel && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-semibold leading-tight', sel ? 'text-violet-900' : 'text-slate-800')}>{v.name}</p>
                          <p className="text-xs text-slate-400">{v.location} · <span className="font-mono text-[10px]">{v.id}</span></p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', loadColor)}>
                              <Package className="w-2 h-2" />
                              {wl.activeOrders} active
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {wl.pipelineQty.toLocaleString()} pcs in pipeline
                            </span>
                            {wl.sameCategory > 0 && sheetCategoryHint && (
                              <span className="text-[10px] text-violet-600 font-medium">
                                · {wl.sameCategory} {sheetCategoryHint}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', otifColor)}>OTIF {otif}%</span>
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', fiColor)}>FI {fi}%</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {sheetVendorIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {sheetVendorIds.map(vid => {
                      const v = vendors.find(x => x.id === vid)
                      return (
                        <span key={vid} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-violet-100 text-violet-800 text-xs rounded-full font-medium border border-violet-200">
                          {v?.name.split(' ')[0]}
                          <button onClick={() => setSheetVendorIds(p => p.filter(x => x !== vid))} className="text-violet-400 hover:text-violet-700">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Costing due date */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Costing Due Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="date" value={sheetDueDate} onChange={e => setSheetDueDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  />
                </div>
              </div>

              {/* Vendor target inward date */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Target Inward Date for Vendor</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Date to communicate to the vendor — set earlier than buying&apos;s deadline to build in buffer for delays
                  </p>
                </div>

                {/* Buying deadline context — single order only */}
                {assignSheetIds.length === 1 && (() => {
                  const o = sheetOrders[0]
                  if (!o) return null
                  return (
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-500">Buying deadline</span>
                      <span className="font-semibold text-slate-700">
                        {new Date(o.inwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )
                })()}

                <div className="relative">
                  <CalendarCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-teal-500" />
                  <input
                    type="date"
                    value={sheetVendorTargetDate}
                    onChange={e => setSheetVendorTargetDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                  />
                </div>

                {/* Buffer indicator */}
                {sheetVendorTargetDate && assignSheetIds.length === 1 && sheetOrders[0] && (() => {
                  const buyingDate = new Date(sheetOrders[0].inwardDate)
                  const targetDate = new Date(sheetVendorTargetDate)
                  const bufferDays = Math.ceil((buyingDate.getTime() - targetDate.getTime()) / 86400000)
                  if (bufferDays > 0) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-teal-700">
                        <Check className="w-3 h-3 flex-shrink-0" />
                        <span>{bufferDays}d buffer before buying deadline</span>
                      </div>
                    )
                  } else if (bufferDays < 0) {
                    return (
                      <p className="text-xs text-red-600 font-medium">
                        ⚠ Date is {Math.abs(bufferDays)}d after buying deadline — vendor will miss OTIF
                      </p>
                    )
                  }
                  return null
                })()}

                {assignSheetIds.length > 1 && (
                  <p className="text-xs text-slate-400">
                    One target date applied to all {assignSheetIds.length} selected styles — each has a different buying deadline, adjust per style after staging if needed
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Notes for Vendor <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input type="text" value={sheetNotes} onChange={e => setSheetNotes(e.target.value)}
                  placeholder="Spec notes, fabric source…"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
              {sheetVendorIds.length > 1 && (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 mb-3 text-xs text-violet-700">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  {sheetVendorIds.length} vendors selected → Competitive costing will be triggered
                </div>
              )}
              <button
                onClick={stageSheet}
                disabled={sheetVendorIds.length === 0}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
                  sheetVendorIds.length > 0
                    ? 'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 shadow-sm'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <Building2 className="w-4 h-4" />
                {sheetVendorIds.length === 0
                  ? 'Select a vendor to continue'
                  : `Stage ${assignSheetIds.length} Style${assignSheetIds.length > 1 ? 's' : ''} · ${sheetVendorIds.length} Vendor${sheetVendorIds.length > 1 ? 's' : ''}`
                }
              </button>
              <p className="text-xs text-slate-400 text-center mt-2">
                Saves as draft — confirm all drafts below to send notifications
              </p>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {savedToast}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COSTING VIEW
// ═══════════════════════════════════════════════════════════════════════════════

type CostStatus = 'no-vendor' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'escalated'

type CostingOrder = {
  id: string
  styleCode: string
  styleName: string
  colour: string
  category: string
  vendor: string
  vendorLocation: string
  vendorId: string
  orderQty: number
  targetPrice: number
  costStatus: CostStatus
  /** Date buying team requires the goods — OTIF is measured against this. Never shared with vendor. */
  buyingExpectedDate: string
  /** Date sourcing POC tells the vendor — earlier than buyingExpectedDate to build in buffer. */
  vendorTargetDate: string
  season: string
  submittedCost?: number
  breakdown?: {
    fabric: number; cmt: number; trims: number
    print: number; packaging: number; other: number
  }
  submittedOn?: string
  approvedBy?: string
  approvedOn?: string
  rejectedReason?: string
  escalationReason?: string
  notes?: string
  // Vendor confirmed inward date (set after costing approval)
  confirmedInwardDate?: string
  inwardDateConfirmed?: boolean
}

// ─── Each entry represents a distinct real-world costing scenario ─────────────
//
//  1. no-vendor      — style not yet assigned to any vendor
//  2. pending        — vendor assigned, quote not yet submitted
//  3. submitted ✓    — quote under target, awaiting POC approval
//  4. submitted ~    — quote slightly over target (+5%), awaiting approval
//  5. submitted ✗    — quote significantly over target (+14%), auto-escalated
//  6. escalated      — waiting for category head sign-off
//  7. rejected       — POC rejected, vendor must resubmit
//  8. approved       — costing approved, inward date not yet confirmed by vendor
//  9. approved+date  — approved AND vendor has confirmed inward date (PO can be raised)
// 10. approved+PO    — PO already raised (full cycle complete)
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_COSTING_ORDERS: CostingOrder[] = [

  // ── Scenario 1: No vendor assigned yet ──────────────────────────────────────
  {
    id: 'NNKNTW250010', styleCode: 'NN407-221', styleName: 'Girls Tiered Floral Dress',
    colour: 'PEACH', category: 'Wovens', vendor: '', vendorLocation: '', vendorId: '',
    orderQty: 600, targetPrice: 265, costStatus: 'no-vendor',
    buyingExpectedDate: '2026-06-30', vendorTargetDate: '2026-06-15',
    season: 'SS25',
  },

  // ── Scenario 2: Vendor assigned, quote not yet submitted ─────────────────────
  {
    id: 'NNKNTW250011', styleCode: 'NN412-089', styleName: 'Boys Cargo Jogger',
    colour: 'OLIVE', category: 'Wovens', vendor: 'IDS FASHION', vendorLocation: 'NOIDA', vendorId: 'v3',
    orderQty: 450, targetPrice: 320, costStatus: 'pending',
    buyingExpectedDate: '2026-06-25', vendorTargetDate: '2026-06-10',
    season: 'SS25',
  },

  // ── Scenario 3: Quote submitted — under target (good) ────────────────────────
  {
    id: 'NNKNTW250012', styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', category: 'Knits', vendor: 'BS FASHION', vendorLocation: 'KOLKATA', vendorId: 'v4',
    orderQty: 720, targetPrice: 340, costStatus: 'submitted',
    submittedCost: 326,
    breakdown: { fabric: 148, cmt: 82, trims: 40, print: 28, packaging: 16, other: 12 },
    submittedOn: '2026-04-27',
    buyingExpectedDate: '2026-06-15', vendorTargetDate: '2026-05-30',
    season: 'SS25',
    notes: 'Able to reduce CMT by 4% by co-loading with another order. Fabric sourced at prev. season price.',
  },

  // ── Scenario 4: Quote submitted — slightly over target (+5%, amber) ──────────
  {
    id: 'NNKNTW250013', styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', category: 'Wovens', vendor: 'DIV CREATIONS', vendorLocation: 'FARIDABAD', vendorId: 'v5',
    orderQty: 380, targetPrice: 295, costStatus: 'submitted',
    submittedCost: 310,
    breakdown: { fabric: 152, cmt: 78, trims: 36, print: 0, packaging: 14, other: 30 },
    submittedOn: '2026-04-26',
    buyingExpectedDate: '2026-06-20', vendorTargetDate: '2026-06-05',
    season: 'SS25',
    notes: 'Linen blend yarn cost up 6% vs last season. Vendor proposes using 55/45 blend vs 60/40 to meet target — seeking POC direction.',
  },

  // ── Scenario 5: Quote submitted — significantly over target (+14%), escalated ─
  {
    id: 'NNKNTW250015', styleCode: 'NN415-078', styleName: 'Boys French Terry Sweatshirt',
    colour: 'NAVY MELANGE', category: 'Knits', vendor: 'CAARVI TEXTILES', vendorLocation: 'DELHI', vendorId: 'v8',
    orderQty: 550, targetPrice: 380, costStatus: 'escalated',
    submittedCost: 434,
    breakdown: { fabric: 198, cmt: 94, trims: 60, print: 42, packaging: 22, other: 18 },
    submittedOn: '2026-04-24',
    buyingExpectedDate: '2026-07-05', vendorTargetDate: '2026-06-20',
    season: 'SS25',
    escalationReason: 'Vendor cost exceeds target by 14.2% — auto-escalated to category head for approval.',
    notes: 'French terry yarn prices elevated due to cotton futures spike. Vendor has confirmed no scope for reduction without quality compromise.',
  },

  // ── Scenario 6: Awaiting category head (escalated — not yet approved) ────────
  {
    id: 'NNKNTW250018', styleCode: 'NN422-190', styleName: 'Girls Velvet Pinafore',
    colour: 'BURGUNDY', category: 'Wovens', vendor: 'ADITEE INTERNATIONAL', vendorLocation: 'JAIPUR', vendorId: 'v7',
    orderQty: 300, targetPrice: 480, costStatus: 'escalated',
    submittedCost: 545,
    breakdown: { fabric: 240, cmt: 128, trims: 82, print: 48, packaging: 24, other: 23 },
    submittedOn: '2026-04-22',
    buyingExpectedDate: '2026-07-15', vendorTargetDate: '2026-07-01',
    season: 'SS25',
    escalationReason: 'Velvet sourcing cost +13.5% over target. Category head approval pending since 26-Apr.',
    notes: 'Italian-origin velvet substitute proposed at ₹498 — category head reviewing quality sample before sign-off.',
  },

  // ── Scenario 7: Rejected — vendor must resubmit ──────────────────────────────
  {
    id: 'NNKNTW250019', styleCode: 'NN418-067', styleName: 'Boys Printed Co-ord Set',
    colour: 'MULTI', category: 'Knits', vendor: 'PESOS VISION', vendorLocation: 'MUMBAI', vendorId: 'v9',
    orderQty: 480, targetPrice: 355, costStatus: 'rejected',
    buyingExpectedDate: '2026-06-27', vendorTargetDate: '2026-06-12',
    season: 'SS25',
    rejectedReason: 'CMT quoted at ₹115 vs benchmark of ₹85 for similar product. Please renegotiate — target is achievable based on prior season data.',
  },

  // ── Scenario 8: Approved — inward date not yet confirmed by vendor ────────────
  {
    id: 'NNKNTW250016', styleCode: 'NN408-245', styleName: 'Girls Embroidered Sharara Set',
    colour: 'MAROON', category: 'Wovens', vendor: 'ARIHANT FASHIONS', vendorLocation: 'KOLKATA', vendorId: 'v2',
    orderQty: 280, targetPrice: 520, costStatus: 'approved',
    submittedCost: 498,
    breakdown: { fabric: 210, cmt: 120, trims: 68, print: 52, packaging: 22, other: 26 },
    submittedOn: '2026-04-18', approvedBy: 'Parthipan Kumar', approvedOn: '2026-04-22',
    buyingExpectedDate: '2026-06-25', vendorTargetDate: '2026-06-10',
    season: 'SS25',
    notes: 'Zari work cost elevated. Approved — within acceptable 4.2% under target range.',
  },

  // ── Scenario 9: Approved + vendor confirmed inward date (PO pending) ──────────
  // Vendor confirmed 5 Jun — within the buying window (12 Jun). OTIF safe.
  {
    id: 'NNKNTW250014', styleCode: 'NN401-190', styleName: 'Girls Printed Balloon Dress',
    colour: 'CORAL', category: 'Knits', vendor: 'AND DESIGN', vendorLocation: 'JAIPUR', vendorId: 'v6',
    orderQty: 900, targetPrice: 245, costStatus: 'approved',
    submittedCost: 238,
    breakdown: { fabric: 98, cmt: 72, trims: 28, print: 22, packaging: 11, other: 7 },
    submittedOn: '2026-04-14', approvedBy: 'Parthipan Kumar', approvedOn: '2026-04-17',
    buyingExpectedDate: '2026-06-12', vendorTargetDate: '2026-05-28',
    confirmedInwardDate: '2026-06-02', inwardDateConfirmed: true,
    season: 'SS25',
  },

  // ── Scenario 10: Full cycle — approved, date confirmed, PO raised ─────────────
  // Vendor confirmed 22 May — slightly later than target (15 May) but still within buying window (1 Jun). OTIF safe.
  {
    id: 'NNKNTW250017', styleCode: 'NN411-312', styleName: 'Boys Printed Bermuda Shorts',
    colour: 'COBALT', category: 'Wovens', vendor: 'PESOS VISION', vendorLocation: 'MUMBAI', vendorId: 'v9',
    orderQty: 650, targetPrice: 198, costStatus: 'approved',
    submittedCost: 192,
    breakdown: { fabric: 82, cmt: 58, trims: 24, print: 18, packaging: 8, other: 2 },
    submittedOn: '2026-04-10', approvedBy: 'Parthipan Kumar', approvedOn: '2026-04-12',
    buyingExpectedDate: '2026-06-01', vendorTargetDate: '2026-05-15',
    confirmedInwardDate: '2026-05-22', inwardDateConfirmed: true,
    season: 'SS25',
  },
]

// ─── Shared cost UI helpers ────────────────────────────────────────────────────

function CostStatusBadge({ status }: { status: CostStatus }) {
  const map: Record<CostStatus, { label: string; cls: string }> = {
    'no-vendor': { label: 'No Vendor',        cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    pending:     { label: 'Pending',          cls: 'bg-slate-100 text-slate-600 border-slate-200'   },
    submitted:   { label: 'Awaiting Approval',cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    approved:    { label: 'Approved',         cls: 'bg-green-50 text-green-700 border-green-200'    },
    rejected:    { label: 'Rejected',         cls: 'bg-red-50 text-red-700 border-red-200'          },
    escalated:   { label: 'Escalated',        cls: 'bg-amber-50 text-amber-700 border-amber-200'    },
  }
  const { label, cls } = map[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cls)}>{label}</span>
}

function VarianceChip({ target, quoted }: { target: number; quoted: number }) {
  const pct = Math.round(((quoted - target) / target) * 100)
  if (pct === 0) return <span className="flex items-center gap-0.5 text-xs font-semibold text-slate-500"><Minus className="w-3 h-3" /> 0%</span>
  if (pct < 0)   return <span className="flex items-center gap-0.5 text-xs font-semibold text-green-700"><TrendingDown className="w-3 h-3" />{Math.abs(pct)}% under</span>
  const cls = pct <= 5 ? 'text-amber-600' : 'text-red-600'
  return <span className={cn('flex items-center gap-0.5 text-xs font-semibold', cls)}><TrendingUp className="w-3 h-3" />{pct}% over</span>
}

function BreakdownBar({ breakdown }: { breakdown: NonNullable<CostingOrder['breakdown']> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const segs = [
    { key: 'fabric',    color: 'bg-violet-400',   val: breakdown.fabric },
    { key: 'cmt',       color: 'bg-purple-400', val: breakdown.cmt },
    { key: 'trims',     color: 'bg-amber-400',  val: breakdown.trims },
    { key: 'print',     color: 'bg-pink-400',   val: breakdown.print },
    { key: 'packaging', color: 'bg-teal-400',   val: breakdown.packaging },
    { key: 'other',     color: 'bg-slate-300',  val: breakdown.other },
  ].filter(s => s.val > 0)
  return (
    <div className="w-28">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {segs.map(s => <div key={s.key} className={s.color} style={{ width: `${(s.val/total)*100}%` }} />)}
      </div>
      <p className="text-xs text-slate-400 mt-0.5">
        {Math.round((breakdown.fabric/total)*100)}% fab · {Math.round((breakdown.cmt/total)*100)}% CMT
      </p>
    </div>
  )
}

// ─── Cost Submit Modal (POC submits on behalf of vendor) ──────────────────────

type BreakdownDraft = { fabric: string; cmt: string; trims: string; print: string; packaging: string; other: string }

function CostSubmitModal({
  order,
  vendors,
  onClose,
  onSubmit,
}: {
  order: CostingOrder
  vendors: ApiVendor[]
  onClose: () => void
  onSubmit: (orderId: string, cost: number, breakdown: NonNullable<CostingOrder['breakdown']>, notes: string, vendorId: string, confirmedDate?: string) => void
}) {
  const noVendor = order.vendorId === ''
  const existing = order.breakdown

  // vendor selection (only relevant when no vendor assigned)
  const [selectedVendorId, setSelectedVendorId] = useState(order.vendorId)
  const [vendorSearch, setVendorSearch]         = useState('')

  const selectedVendor  = vendors.find(v => v.id === selectedVendorId)
  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.location ?? '').toLowerCase().includes(vendorSearch.toLowerCase())
  )

  const [draft, setDraft] = useState<BreakdownDraft>({
    fabric:    existing ? String(existing.fabric)    : '',
    cmt:       existing ? String(existing.cmt)       : '',
    trims:     existing ? String(existing.trims)     : '',
    print:     existing ? String(existing.print)     : '0',
    packaging: existing ? String(existing.packaging) : '',
    other:     existing ? String(existing.other)     : '0',
  })
  const [notes, setNotes]               = useState(order.notes || '')
  const [confirmedDate, setConfirmedDate] = useState(order.confirmedInwardDate ?? '')
  const [submitted, setSubmitted]       = useState(false)

  const num = (v: string) => parseFloat(v) || 0
  const total = num(draft.fabric) + num(draft.cmt) + num(draft.trims) + num(draft.print) + num(draft.packaging) + num(draft.other)
  const variance = total > 0 ? Math.round(((total - order.targetPrice) / order.targetPrice) * 100) : null
  const canSubmit = total > 0 && (!noVendor || !!selectedVendorId)

  const handleSubmit = () => {
    if (!canSubmit) return
    setSubmitted(true)
    setTimeout(() => {
      onSubmit(order.id, total, {
        fabric: num(draft.fabric), cmt: num(draft.cmt), trims: num(draft.trims),
        print: num(draft.print), packaging: num(draft.packaging), other: num(draft.other),
      }, notes, selectedVendorId, confirmedDate || undefined)
      onClose()
    }, 1200)
  }

  const fields: { key: keyof BreakdownDraft; label: string; hint: string }[] = [
    { key: 'fabric',    label: 'Fabric Cost',        hint: 'Yarn, fabric, lining per piece' },
    { key: 'cmt',       label: 'CMT Charges',         hint: 'Cut, Make, Trim labour' },
    { key: 'trims',     label: 'Trims & Accessories', hint: 'Buttons, zippers, labels, patches' },
    { key: 'print',     label: 'Print / Embroidery',  hint: '0 if not applicable' },
    { key: 'packaging', label: 'Packaging',           hint: 'Polybag, hanger, sticker' },
    { key: 'other',     label: 'Other / Overhead',    hint: 'Transport, misc charges' },
  ]

  if (submitted) {
    const vendorName = selectedVendor?.name ?? order.vendor
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-bold text-slate-900 text-lg">
            {noVendor ? 'Vendor Assigned & Quote Submitted!' : 'Cost Submitted!'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {noVendor
              ? <><strong>{vendorName}</strong> assigned and quote logged on their behalf.</>
              : <>Logged on behalf of <strong>{vendorName}</strong>. Sent for manager approval.</>
            }
          </p>
        </div>
      </div>
    )
  }

  return (
    /* Mobile: bottom sheet · Desktop: left drawer */
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Drawer — bottom sheet on mobile, right panel on desktop */}
      <div
        className={cn(
          'relative flex flex-col bg-white shadow-2xl',
          // mobile: anchored to bottom, full width, rounded top corners
          'w-full max-h-[92dvh] rounded-t-2xl self-end',
          // desktop: right drawer, full height, rounded left corners
          'md:w-[460px] md:max-h-full md:h-full md:rounded-none md:rounded-l-2xl md:self-stretch md:ml-auto',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Submit Vendor Quote</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.id} · {order.styleCode} · {order.colour}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* ── VENDOR SECTION ── */}
          {noVendor ? (
            /* No vendor yet — show picker */
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-sm font-bold text-slate-800">Select Vendor</p>
                <span className="ml-auto text-xs text-orange-600 font-medium bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">Required</span>
              </div>

              {selectedVendor ? (
                /* Vendor chosen — show amber confirmation banner with change button */
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-amber-800">Submitting on behalf of vendor</p>
                    <p className="text-sm font-semibold text-amber-900">{selectedVendor.name} · {selectedVendor.location}</p>
                  </div>
                  <button onClick={() => { setSelectedVendorId(''); setVendorSearch('') }}
                    className="text-xs text-amber-700 underline hover:text-amber-900 transition-colors flex-shrink-0">
                    Change
                  </button>
                </div>
              ) : (
                /* Vendor not yet chosen — show searchable list */
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="relative border-b border-slate-200">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={vendorSearch}
                      onChange={e => setVendorSearch(e.target.value)}
                      placeholder="Search vendor name or city…"
                      className="w-full pl-9 pr-4 py-2.5 text-sm focus:outline-none text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredVendors.length === 0
                      ? <p className="px-4 py-3 text-xs text-slate-400 text-center">No vendors match</p>
                      : filteredVendors.map(v => (
                        <button key={v.id} onClick={() => setSelectedVendorId(v.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 transition-colors text-left border-b border-slate-100 last:border-0">
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {v.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{v.name}</p>
                            <p className="text-xs text-slate-400">{v.location}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                            <span>OTIF {v.otifScore}%</span>
                            <span>·</span>
                            <span>FI {v.fiPassRate}%</span>
                          </div>
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Vendor already assigned — show read-only amber banner */
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800">Submitting on behalf of vendor</p>
                <p className="text-sm font-semibold text-amber-900">{order.vendor} · {order.vendorLocation}</p>
              </div>
            </div>
          )}

          {/* Context */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-4 text-center">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Target Price</p>
              <p className="text-lg font-bold text-slate-900">₹{order.targetPrice}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Order Qty</p>
              <p className="text-lg font-bold text-slate-900">{order.orderQty.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Category</p>
              <p className="text-sm font-semibold text-slate-700">{order.category}</p>
            </div>
          </div>

          <div className="flex gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-xs text-violet-700">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Enter the <strong className="mx-0.5">per-piece cost</strong> breakdown as quoted by the vendor. This will be logged as a vendor submission.
          </div>

          {/* Breakdown inputs */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cost Breakdown (₹ per piece)</p>
            {fields.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-700">{label}</label>
                  <p className="text-xs text-slate-400">{hint}</p>
                </div>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                  <input
                    type="number" min="0" step="0.5" value={draft[key]}
                    onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-right"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total + variance */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Total Quoted Cost</span>
              <span className="text-xl font-bold text-slate-900">₹{total.toFixed(0)}</span>
            </div>
            {variance !== null && total > 0 && (
              <div className={cn(
                'mt-3 rounded-lg px-4 py-3 flex items-center justify-between',
                variance < 0  ? 'bg-green-50 border border-green-200' :
                variance <= 5 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'
              )}>
                <div>
                  <p className={cn('text-xs font-bold',
                    variance < 0 ? 'text-green-700' : variance <= 5 ? 'text-amber-700' : 'text-red-700'
                  )}>
                    {variance < 0
                      ? `₹${Math.abs(total - order.targetPrice).toFixed(0)} under target`
                      : `₹${(total - order.targetPrice).toFixed(0)} over target`}
                  </p>
                  <p className={cn('text-xs mt-0.5',
                    variance < 0 ? 'text-green-600' : variance <= 5 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {variance < 0
                      ? 'Within target — manager auto-approval likely'
                      : variance <= 5
                        ? 'Slightly over — manager review required'
                        : 'Over 5% — will be escalated to Category Head'}
                  </p>
                </div>
                <span className={cn('text-lg font-black',
                  variance < 0 ? 'text-green-600' : variance <= 5 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {variance > 0 ? '+' : ''}{variance}%
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">Notes / Remarks from Vendor</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Vendor's explanation for cost — fabric specs, print complexity, MOQ impact…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-slate-700 placeholder:text-slate-400"
            />
          </div>

          {/* Vendor confirmed inward date — optional at quote stage */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">Vendor Confirmed Inward Date</p>
                <p className="text-xs text-slate-400 mt-0.5">Optional — can be confirmed later after costing approval</p>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
            </div>

            {/* Context row */}
            <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Target given to vendor</span>
              <span className="font-semibold text-slate-700">
                {new Date(order.vendorTargetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <input
              type="date"
              value={confirmedDate}
              onChange={e => setConfirmedDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />

            {/* OTIF signal */}
            {confirmedDate && (() => {
              const diffVsBuying = Math.ceil((new Date(confirmedDate).getTime() - new Date(order.buyingExpectedDate).getTime()) / 86400000)
              return diffVsBuying > 0
                ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs">
                    <span className="font-semibold text-red-700">⚠ OTIF Risk — </span>
                    <span className="text-red-600">{diffVsBuying}d past buying deadline ({new Date(order.buyingExpectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-teal-700">
                    <Check className="w-3 h-3" />
                    <span>Within OTIF window — buying deadline {new Date(order.buyingExpectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                )
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
              canSubmit ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            <Send className="w-3.5 h-3.5" />
            {noVendor ? 'Assign Vendor & Submit Quote' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Request PO Modal ─────────────────────────────────────────────────────────

function RequestPOModal({
  order, onClose, onSubmit,
}: {
  order:    CostingOrder
  onClose:  () => void
  onSubmit: (newPOs: PORecord[]) => void
}) {
  const { currentUser } = useCurrentUser()
  const [done, setDone] = useState(false)

  const unitPrice  = order.submittedCost ?? order.targetPrice
  const lines      = getOTBLines(order.styleCode, order.colour, unitPrice)
  const sizes      = sizesFromLines(lines)
  const whCodes    = [...new Set(lines.map(l => l.whCode))]
  const totalQty   = poTotalQty(lines)
  const totalValue = poTotalValue(lines)
  const vendorCode = VENDOR_D365_CODES[order.vendorId] ?? '—'

  const handleRaise = () => {
    const today    = new Date().toISOString().split('T')[0]
    // One PORecord per warehouse — MIS will push each individually
    const newPOs: PORecord[] = whCodes.map((whCode, i) => {
      const whLines = lines.filter(l => l.whCode === whCode)
      return {
        id:            `POR-${Date.now()}-${i}`,
        subOrderId:    order.id,
        whCode,
        styleCode:     order.styleCode,
        styleName:     order.styleName,
        colour:        order.colour,
        season:        order.season,
        vendorId:      order.vendorId,
        vendorCode,
        vendor:        order.vendor,
        lines:         whLines,
        totalQty:      poTotalQty(whLines),
        totalValue:    poTotalValue(whLines),
        deliveryDate:  order.confirmedInwardDate ?? order.vendorTargetDate,
        status:        'requested',
        requestedBy:   currentUser.name,
        requestedDate: today,
      }
    })
    setDone(true)
    setTimeout(() => { onSubmit(newPOs); onClose() }, 1100)
  }

  if (done) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-xs w-full">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
        <p className="font-bold text-slate-900">PO Request Raised!</p>
        <p className="text-xs text-slate-400 mt-1">Sourcing MIS will create the PO in D365</p>
      </div>
    </div>
  )

  if (lines.length === 0) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <p className="font-bold text-slate-900">No OTB Data Found</p>
        <p className="text-sm text-slate-500 mt-1">Size / WH breakdown not available for this style. Check OTB system.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Close</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Package className="w-4 h-4 text-violet-600" />
              <span className="font-bold text-slate-900">Raise PO Request</span>
            </div>
            <p className="text-xs text-slate-500">
              {order.styleCode} · {order.colour} · {order.vendor} · ₹{unitPrice}/pc approved
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* D365 info strip */}
          <div className="flex flex-wrap gap-4 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
            {[
              { label: 'D365 Vendor Code', value: vendorCode, mono: true },
              { label: 'Delivery Date',    value: new Date(order.confirmedInwardDate ?? order.vendorTargetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) },
              { label: 'Unit Price',       value: `₹${unitPrice}` },
              { label: 'D365 Lines',       value: String(lines.length) },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <p className="text-xs text-violet-600 font-medium">{label}</p>
                <p className={cn('text-sm font-bold text-violet-800', mono && 'font-mono')}>{value}</p>
              </div>
            ))}
          </div>

          {/* OTB size × WH pivot table */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">OTB Size Breakdown — sourced from OTB system</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Size</th>
                    {whCodes.map(wh => {
                      const w = getWH(wh)
                      return (
                        <th key={wh} className="px-3 py-2 text-right font-semibold text-slate-600">
                          {w ? w.name.replace('Nautinati ', '') : wh}
                        </th>
                      )
                    })}
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Size Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Line Value</th>
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size, i) => {
                    const sizeLines = lines.filter(l => l.size === size)
                    const sizeQty   = sizeLines.reduce((s, l) => s + l.qty, 0)
                    const sizeVal   = sizeLines.reduce((s, l) => s + l.lineTotal, 0)
                    return (
                      <tr key={size} className={cn('border-b border-slate-100 last:border-0', i % 2 !== 0 && 'bg-slate-50/50')}>
                        <td className="px-3 py-2 font-semibold text-slate-700">{size}</td>
                        {whCodes.map(wh => {
                          const line = sizeLines.find(l => l.whCode === wh)
                          return (
                            <td key={wh} className="px-3 py-2 text-right text-slate-600">
                              {line ? line.qty.toLocaleString() : '—'}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{sizeQty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          ₹{sizeVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-xs">
                    <td className="px-3 py-2 text-slate-800">Total</td>
                    {whCodes.map(wh => {
                      const whQty = lines.filter(l => l.whCode === wh).reduce((s, l) => s + l.qty, 0)
                      return <td key={wh} className="px-3 py-2 text-right text-slate-700">{whQty.toLocaleString()}</td>
                    })}
                    <td className="px-3 py-2 text-right text-slate-900">{totalQty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-slate-900">
                      ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* WH master details */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Delivery Warehouses — from Unicommerce master</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {whCodes.map(wh => {
                const w = getWH(wh)
                if (!w) return null
                return (
                  <div key={wh} className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-700">{w.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{w.address}, {w.city}, {w.state} {w.pincode}</p>
                    <p className="text-xs text-slate-400 mt-0.5">GSTIN: {w.gstNo}</p>
                    <p className="font-mono text-xs text-violet-600 mt-1 font-medium">{w.code}</p>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{whCodes.length} POs</span>
            {' · '}{lines.length} D365 lines · {totalQty.toLocaleString()} pcs{' · '}
            <span className="font-bold text-slate-900">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="block text-slate-400 mt-0.5">1 PO raised per warehouse — MIS pushes each to D365</span>
          </div>
          <button onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleRaise}
            className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 flex items-center gap-2 shadow-sm">
            <Package className="w-3.5 h-3.5" /> Raise PO Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cost Approval Modal (POC approves / rejects vendor quote) ───────────────

function CostApprovalModal({
  order,
  onClose,
  onApprove,
  onReject,
}: {
  order: CostingOrder
  onClose: () => void
  onApprove: (orderId: string, notes: string) => void
  onReject: (orderId: string, reason: string) => void
}) {
  const [mode, setMode]     = useState<'review' | 'reject'>('review')
  const [notes, setNotes]   = useState(order.notes ?? '')
  const [reason, setReason] = useState('')

  const variance = order.submittedCost
    ? Math.round(((order.submittedCost! - order.targetPrice) / order.targetPrice) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-slate-900">Review Costing</p>
            <p className="text-xs text-slate-500 mt-0.5">{order.styleCode} · {order.colour} · {order.vendor}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Cost summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Target</p>
              <p className="text-base font-bold text-slate-700">₹{order.targetPrice}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Quoted</p>
              <p className="text-base font-bold text-slate-900">₹{order.submittedCost}</p>
            </div>
            <div className={cn('rounded-xl p-3 text-center', variance <= 0 ? 'bg-green-50' : variance <= 5 ? 'bg-amber-50' : 'bg-red-50')}>
              <p className="text-xs text-slate-400 mb-1">Variance</p>
              <p className={cn('text-base font-bold', variance <= 0 ? 'text-green-700' : variance <= 5 ? 'text-amber-700' : 'text-red-700')}>
                {variance > 0 ? '+' : ''}{variance}%
              </p>
            </div>
          </div>

          {/* Breakdown */}
          {order.breakdown && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Cost Breakdown</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(order.breakdown).filter(([, v]) => v > 0).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-slate-500 capitalize">{k}</span>
                    <span className="font-medium text-slate-700">₹{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vendor notes */}
          {order.notes && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-800">
              <p className="font-semibold mb-1">Vendor note</p>
              <p>{order.notes}</p>
            </div>
          )}

          {mode === 'review' ? (
            /* Approval notes */
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Approval notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add any notes for your record or the vendor…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              />
            </div>
          ) : (
            /* Rejection reason */
            <div>
              <label className="block text-xs font-semibold text-red-700 mb-1.5">
                Reason for rejection <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Cost exceeds target — please renegotiate fabric sourcing…"
                className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
          {mode === 'review' ? (
            <div className="flex gap-3">
              <button
                onClick={() => setMode('reject')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors">
                <X className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => onApprove(order.id, notes)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
                <Check className="w-4 h-4" /> Approve
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setMode('review')}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                Back
              </button>
              <button
                disabled={!reason.trim()}
                onClick={() => onReject(order.id, reason)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <X className="w-4 h-4" /> Confirm Rejection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Inward Date Modal (vendor finalises delivery date post-approval) ──

function ConfirmInwardModal({
  order,
  onClose,
  onConfirm,
}: {
  order: CostingOrder
  onClose: () => void
  onConfirm: (orderId: string, date: string) => void
}) {
  const [date, setDate] = useState(order.confirmedInwardDate ?? order.vendorTargetDate)

  const diffVsTarget   = date ? Math.ceil((new Date(date).getTime() - new Date(order.vendorTargetDate).getTime()) / 86400000) : null
  const diffVsBuying   = date ? Math.ceil((new Date(date).getTime() - new Date(order.buyingExpectedDate).getTime()) / 86400000) : null
  const otifRisk       = diffVsBuying !== null && diffVsBuying > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-white rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-900">Confirm Vendor Inward Date</p>
          <p className="text-xs text-slate-500 mt-0.5">{order.styleCode} · {order.vendor}</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Date context strip */}
          <div className="bg-slate-50 rounded-xl divide-y divide-slate-200 overflow-hidden text-xs">
            <div className="px-3 py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Target given to vendor</span>
              <span className="font-semibold text-slate-700">
                {new Date(order.vendorTargetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="px-3 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-slate-500">Buying required by</span>
                <span className="ml-1.5 text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">OTIF deadline</span>
              </div>
              <span className="font-semibold text-slate-700">
                {new Date(order.buyingExpectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Vendor confirmed date <span className="text-slate-400">(goes on PO)</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {/* Vs vendor target */}
            {diffVsTarget !== null && diffVsTarget !== 0 && (
              <p className="text-xs mt-1.5">
                {diffVsTarget > 0
                  ? <span className="text-amber-600 font-medium">⚠ {diffVsTarget}d later than vendor target</span>
                  : <span className="text-green-600 font-medium">✓ {Math.abs(diffVsTarget)}d earlier than vendor target</span>
                }
              </p>
            )}
          </div>

          {/* OTIF risk banner */}
          {otifRisk ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700 mb-0.5">⚠ OTIF Risk</p>
              <p className="text-xs text-red-600">
                Vendor date is {diffVsBuying}d after buying&apos;s deadline. This will be counted as late in OTIF.
                PO will use the confirmed date — coordinate with buying team on risk.
              </p>
            </div>
          ) : date && diffVsBuying !== null ? (
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700">
                Within OTIF window — {Math.abs(diffVsBuying)}d before buying&apos;s deadline.
              </p>
            </div>
          ) : null}

          <p className="text-[10px] text-slate-400 leading-relaxed">
            OTIF is always measured against the buying deadline, not the vendor&apos;s confirmed date.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            disabled={!date}
            onClick={() => onConfirm(order.id, date)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 transition-colors">
            <Check className="w-4 h-4" /> Confirm Date
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Costing View ─────────────────────────────────────────────────────────────

// Merge unassigned vendor-assignment orders into the costing list so POC can
// assign a vendor and submit a quote in a single step from this panel.
const MERGED_COSTING_ORDERS: CostingOrder[] = [
  ...INITIAL_COSTING_ORDERS,
  ...PENDING_ASSIGN_ORDERS
    .filter(o => o.assignments.length === 0)
    .map(o => ({
      id: o.id, styleCode: o.styleCode, styleName: o.styleName,
      colour: o.colour, category: o.category,
      vendor: '', vendorLocation: '', vendorId: '',
      orderQty: o.orderQty, targetPrice: o.targetPrice,
      costStatus: 'no-vendor' as CostStatus,
      // PendingAssignOrder only carries one date — use it as both until POC sets the real split
      buyingExpectedDate: o.inwardDate, vendorTargetDate: o.inwardDate,
      season: o.season,
    })),
]

function CostingView() {
  const { data: vendors } = useVendors()

  const [orders, setOrders]                 = useState<CostingOrder[]>(MERGED_COSTING_ORDERS)
  const [activeModal, setActiveModal]       = useState<string | null>(null)
  const [approvalModal, setApprovalModal]   = useState<string | null>(null)
  const [confirmDateModal, setConfirmDateModal] = useState<string | null>(null)
  const [filterStatus, setFilterStatus]     = useState<CostStatus | 'all'>('all')
  const [expandedRow, setExpandedRow]       = useState<string | null>(null)
  const [savedToast, setSavedToast]         = useState<string | false>(false)
  const [poRecords, setPoRecords]           = useState<PORecord[]>(INITIAL_PO_RECORDS)
  const [poModalOrder, setPoModalOrder]     = useState<CostingOrder | null>(null)

  const toast = (msg: string) => { setSavedToast(msg); setTimeout(() => setSavedToast(false), 3000) }

  const handleApprove = (orderId: string, notes: string) => {
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o,
      costStatus: 'approved',
      approvedBy: 'Parthipan Kumar',
      approvedOn: new Date().toISOString().split('T')[0],
      notes: notes || o.notes,
    }))
    setApprovalModal(null)
    toast('Costing approved ✓')
  }

  const handleReject = (orderId: string, reason: string) => {
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o,
      costStatus: 'rejected',
      rejectedReason: reason,
      submittedCost: undefined,
      breakdown: undefined,
      submittedOn: undefined,
    }))
    setApprovalModal(null)
    toast('Costing rejected — vendor notified')
  }

  const handleConfirmDate = (orderId: string, date: string) => {
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o,
      confirmedInwardDate: date,
      inwardDateConfirmed: true,
    }))
    setConfirmDateModal(null)
    toast('Inward date confirmed ✓')
  }

  const posFor = (orderId: string) => poRecords.filter(p => p.subOrderId === orderId)

  const handleSubmitCost = (orderId: string, cost: number, breakdown: NonNullable<CostingOrder['breakdown']>, notes: string, vendorId: string, confirmedDate?: string) => {
    const v = vendors.find(vv => vv.id === vendorId)
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o, submittedCost: cost, breakdown, notes,
      costStatus: 'submitted', submittedOn: new Date().toISOString().split('T')[0],
      // store vendor confirmed date if provided at quote stage
      ...(confirmedDate ? { confirmedInwardDate: confirmedDate, inwardDateConfirmed: true } : {}),
      // if order had no vendor before, apply the selected vendor now
      ...(o.vendorId === '' && v ? { vendor: v.name, vendorLocation: v.location ?? '', vendorId: v.id } : {}),
    }))
    toast('Quote submitted ✓')
  }

  const counts = {
    'no-vendor': orders.filter(o => o.costStatus === 'no-vendor').length,
    pending:     orders.filter(o => o.costStatus === 'pending').length,
    submitted:   orders.filter(o => o.costStatus === 'submitted').length,
    approved:    orders.filter(o => o.costStatus === 'approved').length,
    rejected:    orders.filter(o => o.costStatus === 'rejected').length,
    escalated:   orders.filter(o => o.costStatus === 'escalated').length,
  }

  const filtered = filterStatus === 'all' ? orders : orders.filter(o => o.costStatus === filterStatus)
  const modalOrder = activeModal ? orders.find(o => o.id === activeModal) : null

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      {/* Summary cards — horizontal scroll on mobile, 6-col grid on desktop */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 mb-5 md:grid md:grid-cols-6 md:overflow-visible md:pb-0">
        {([
          { status: 'no-vendor' as CostStatus, label: 'No Vendor',        count: counts['no-vendor'], color: 'orange' },
          { status: 'pending'   as CostStatus, label: 'Pending Costing',   count: counts.pending,     color: 'amber'  },
          { status: 'submitted' as CostStatus, label: 'Awaiting Approval', count: counts.submitted,   color: 'blue'   },
          { status: 'approved'  as CostStatus, label: 'Approved',          count: counts.approved,    color: 'green'  },
          { status: 'rejected'  as CostStatus, label: 'Rejected',          count: counts.rejected,    color: 'rose'   },
          { status: 'escalated' as CostStatus, label: 'Escalated',         count: counts.escalated,   color: 'red'    },
        ] as const).map(({ status, label, count, color }) => {
          const bg   = { orange:'bg-orange-50 border-orange-200', amber:'bg-amber-50 border-amber-200', blue:'bg-violet-50 border-violet-200', green:'bg-green-50 border-green-200', rose:'bg-rose-50 border-rose-200', red:'bg-red-50 border-red-200' }[color]
          const text = { orange:'text-orange-700', amber:'text-amber-700', blue:'text-violet-700', green:'text-green-700', rose:'text-rose-700', red:'text-red-700' }[color]
          const dot  = { orange:'bg-orange-400', amber:'bg-amber-400', blue:'bg-violet-400', green:'bg-green-500', rose:'bg-rose-500', red:'bg-red-500' }[color]
          const ring = { orange:'ring-orange-400', amber:'ring-amber-400', blue:'ring-violet-400', green:'ring-green-500', rose:'ring-rose-400', red:'ring-red-400' }[color]
          const isActive = filterStatus === status
          return (
            <button key={status} onClick={() => setFilterStatus(isActive ? 'all' : status)}
              className={cn('rounded-xl border p-3 md:p-4 text-left transition-all hover:shadow-sm flex-shrink-0 min-w-[130px] md:min-w-0', bg, isActive && `ring-2 ring-offset-1 ${ring}`)}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dot)} />
                <span className="text-xs font-medium text-slate-500 leading-tight">{label}</span>
              </div>
              <p className={cn('text-xl md:text-2xl font-black', text)}>{count}</p>
              <p className="text-xs text-slate-400 mt-0.5">{count === 1 ? 'style' : 'styles'}</p>
            </button>
          )
        })}
      </div>

      {filterStatus !== 'all' && (
        <div className="flex items-center gap-2 mb-4">
          <CostStatusBadge status={filterStatus} />
          <button onClick={() => setFilterStatus('all')} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} style{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── Desktop table ── */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Style', 'Colour', 'Vendor', 'Qty', 'Target', 'Quoted', 'Variance', 'Breakdown', 'Inward Date', 'Status', 'Purchase Order', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-400 text-sm">No styles match this filter.</td></tr>
                : filtered.map(order => (
                  <>
                    <tr key={order.id} className={cn(
                      'border-b border-slate-100 last:border-0 transition-colors',
                      order.costStatus === 'escalated'  ? 'bg-red-50/40' :
                      order.costStatus === 'approved'   ? 'bg-green-50/30' :
                      order.costStatus === 'submitted'  ? 'bg-violet-50/20' :
                      order.costStatus === 'no-vendor'  ? 'bg-orange-50/30 hover:bg-orange-50/50' : 'hover:bg-slate-50'
                    )}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{order.styleCode}</p>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-36 truncate">{order.styleName}</p>
                        <p className="text-xs text-slate-400 font-mono">{order.id}</p>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs text-slate-600">{order.colour}</span></td>
                      <td className="px-4 py-3">
                        {order.vendorId ? (
                          <>
                            <p className="text-xs font-medium text-slate-700 leading-tight">{order.vendor}</p>
                            <p className="text-xs text-slate-400">{order.vendorLocation}</p>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                            <AlertCircle className="w-3 h-3" /> Not assigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className="text-sm font-medium text-slate-700">{order.orderQty.toLocaleString()}</span></td>
                      <td className="px-4 py-3"><span className="text-sm font-semibold text-slate-700">₹{order.targetPrice}</span></td>
                      <td className="px-4 py-3">
                        {order.submittedCost
                          ? <span className="text-sm font-bold text-slate-900">₹{order.submittedCost}</span>
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {order.submittedCost
                          ? <VarianceChip target={order.targetPrice} quoted={order.submittedCost} />
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {order.breakdown
                          ? <BreakdownBar breakdown={order.breakdown} />
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 min-w-[130px]">
                        {/* Vendor target (what we told vendor) */}
                        <p className="text-xs font-medium text-slate-700">
                          {new Date(order.vendorTargetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                        {/* Confirmed by vendor (PO date) */}
                        {order.inwardDateConfirmed && order.confirmedInwardDate ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-teal-600 flex-shrink-0" />
                            <span className={cn('text-[10px] font-semibold',
                              order.confirmedInwardDate > order.buyingExpectedDate
                                ? 'text-red-600' : 'text-teal-700'
                            )}>
                              {new Date(order.confirmedInwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} confirmed
                            </span>
                          </div>
                        ) : null}
                        {/* OTIF badge — shows buying deadline context */}
                        {(() => {
                          const refDate = order.confirmedInwardDate && order.inwardDateConfirmed
                            ? order.confirmedInwardDate : order.vendorTargetDate
                          const otifDiff = Math.ceil((new Date(refDate).getTime() - new Date(order.buyingExpectedDate).getTime()) / 86400000)
                          return otifDiff > 0
                            ? <span className="mt-0.5 inline-block text-[10px] font-semibold text-red-600">⚠ {otifDiff}d past OTIF</span>
                            : <span className="mt-0.5 inline-block text-[10px] text-slate-400">
                                OTIF {new Date(order.buyingExpectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <CostStatusBadge status={order.costStatus} />
                          {order.submittedOn && (
                            <p className="text-xs text-slate-400">
                              {order.costStatus === 'approved' ? 'Approved' : 'Submitted'}{' '}
                              {new Date(order.submittedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                          {order.approvedBy && <p className="text-xs text-slate-400">by {order.approvedBy}</p>}
                        </div>
                      </td>
                      {/* ── Purchase Order column ── */}
                      <td className="px-4 py-3">
                        {order.costStatus === 'approved' && (() => {
                          const pos     = posFor(order.id)
                          const nTotal  = pos.length
                          const nFailed = pos.filter(p => p.status === 'failed').length
                          const nDone   = pos.filter(p => p.status === 'complete').length
                          const nRaised = pos.filter(p => p.status === 'po-raised').length
                          const summaryLabel =
                            nFailed > 0       ? `${nFailed} Failed`
                            : nDone === nTotal ? `${nTotal}/${nTotal} Complete`
                            : nRaised > 0     ? `${nRaised} Raised`
                            : 'Requested'
                          const summaryColor =
                            nFailed > 0       ? 'bg-red-50 text-red-700 border-red-200'
                            : nDone === nTotal ? 'bg-green-50 text-green-700 border-green-200'
                            : nRaised > 0     ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'

                          if (nTotal === 0) return (
                            <button
                              onClick={() => setPoModalOrder(order)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 active:bg-violet-800 transition-colors whitespace-nowrap shadow-sm">
                              <Package className="w-3 h-3" /> Raise PO
                            </button>
                          )

                          return (
                            <div className="space-y-1">
                              <span className={cn(
                                'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap',
                                summaryColor
                              )}>
                                <Package className="w-2.5 h-2.5" />
                                {nTotal} PO{nTotal > 1 ? 's' : ''} · {summaryLabel}
                              </span>
                            </div>
                          )
                        })()}
                        {order.costStatus !== 'approved' && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* ── Costing actions column ── */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {order.costStatus === 'no-vendor' && (
                            <button onClick={() => setActiveModal(order.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap">
                              <Building2 className="w-3 h-3" /> Assign & Quote
                            </button>
                          )}
                          {(order.costStatus === 'pending' || order.costStatus === 'rejected') && (
                            <button onClick={() => setActiveModal(order.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap">
                              <IndianRupee className="w-3 h-3" />
                              {order.costStatus === 'rejected' ? 'Resubmit' : 'Submit Quote'}
                            </button>
                          )}
                          {(order.costStatus === 'submitted' || order.costStatus === 'escalated') && (
                            <button onClick={() => setApprovalModal(order.id)}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap',
                                order.costStatus === 'escalated'
                                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              )}>
                              <Check className="w-3 h-3" /> Review & Approve
                            </button>
                          )}
                          {order.costStatus === 'approved' && !order.inwardDateConfirmed && (
                            <button onClick={() => setConfirmDateModal(order.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap">
                              <CalendarCheck className="w-3 h-3" /> Confirm Date
                            </button>
                          )}
                          {order.costStatus === 'approved' && order.inwardDateConfirmed && (
                            <button onClick={() => setConfirmDateModal(order.id)}
                              className="flex items-center gap-1.5 px-2 py-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap">
                              <Check className="w-3 h-3" /> Date Confirmed
                            </button>
                          )}
                          {(order.notes || order.escalationReason || order.rejectedReason) && (
                            <button onClick={() => setExpandedRow(expandedRow === order.id ? null : order.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRow === order.id && (
                      <tr key={`${order.id}-notes`} className="bg-slate-50 border-b border-slate-100">
                        <td colSpan={12} className="px-6 py-3">
                          {order.escalationReason && (
                            <div className="flex gap-2 mb-2">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-red-700 font-medium">{order.escalationReason}</p>
                            </div>
                          )}
                          {order.notes && (
                            <div className="flex gap-2">
                              <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-slate-600 italic">{order.notes}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 text-sm">
            No styles match this filter.
          </div>
        ) : filtered.map(order => {
          const diff = Math.ceil((new Date(order.buyingExpectedDate).getTime() - Date.now()) / 86400000)
          const variance = order.submittedCost
            ? Math.round(((order.submittedCost - order.targetPrice) / order.targetPrice) * 100)
            : null
          const statusColors: Record<CostStatus, string> = {
            'no-vendor':  'border-orange-200 bg-orange-50/40',
            'pending':    'border-amber-200 bg-amber-50/30',
            'submitted':  'border-violet-200 bg-violet-50/20',
            'approved':   'border-green-200 bg-green-50/20',
            'rejected':   'border-red-200 bg-red-50/30',
            'escalated':  'border-amber-200 bg-amber-50/30',
          }
          const topBarColors: Record<CostStatus, string> = {
            'no-vendor':  'bg-orange-400',
            'pending':    'bg-amber-400',
            'submitted':  'bg-violet-400',
            'approved':   'bg-green-500',
            'rejected':   'bg-red-500',
            'escalated':  'bg-amber-500',
          }
          return (
            <div key={order.id} className={cn('bg-white rounded-xl border shadow-sm overflow-hidden', statusColors[order.costStatus])}>
              <div className={cn('h-1', topBarColors[order.costStatus])} />
              <div className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{order.styleCode}</p>
                    <p className="text-xs text-slate-400 truncate">{order.styleName}</p>
                    <p className="text-xs text-slate-400 font-mono">{order.id}</p>
                  </div>
                  <CostStatusBadge status={order.costStatus} />
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-xl p-3 mb-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Target</p>
                    <p className="text-sm font-bold text-slate-800">₹{order.targetPrice}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Quoted</p>
                    {order.submittedCost
                      ? <p className={cn('text-sm font-bold', variance !== null && variance > 0 ? 'text-red-600' : 'text-green-600')}>₹{order.submittedCost}</p>
                      : <p className="text-sm font-bold text-slate-300">—</p>
                    }
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">OTIF</p>
                    <p className={cn('text-xs font-bold', diff < 0 ? 'text-red-600' : diff <= 14 ? 'text-amber-600' : 'text-green-700')}>
                      {diff < 0 ? `${Math.abs(diff)}d late` : `${diff}d left`}
                    </p>
                    {order.inwardDateConfirmed && order.confirmedInwardDate && (
                      <p className="text-[10px] text-teal-600 font-medium mt-0.5">✓ confirmed</p>
                    )}
                  </div>
                </div>

                {/* Vendor + colour row */}
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                  {order.vendorId ? (
                    <span className="font-medium text-slate-700">{order.vendor}</span>
                  ) : (
                    <span className="text-orange-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> No vendor assigned
                    </span>
                  )}
                  <span className="text-slate-300">·</span>
                  <span>{order.colour}</span>
                  {variance !== null && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className={cn('font-semibold', variance > 0 ? 'text-red-600' : 'text-green-600')}>
                        {variance > 0 ? '+' : ''}{variance}% vs target
                      </span>
                    </>
                  )}
                </div>

                {/* Notes/escalation */}
                {(order.escalationReason || order.notes) && (
                  <div className={cn('rounded-lg px-3 py-2 text-xs mb-3', order.escalationReason ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600')}>
                    {order.escalationReason || order.notes}
                  </div>
                )}

                {/* Rejected reason */}
                {order.costStatus === 'rejected' && order.rejectedReason && (
                  <div className="rounded-lg px-3 py-2 text-xs mb-3 bg-red-50 text-red-700 border border-red-100">
                    <p className="font-semibold mb-0.5">Rejected</p>
                    <p>{order.rejectedReason}</p>
                  </div>
                )}

                {/* Action button */}
                <div className="flex flex-wrap items-center gap-2">
                  {order.costStatus === 'no-vendor' && (
                    <button onClick={() => setActiveModal(order.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors flex-1 justify-center">
                      <Building2 className="w-3 h-3" /> Assign & Quote
                    </button>
                  )}
                  {(order.costStatus === 'pending' || order.costStatus === 'rejected') && (
                    <button onClick={() => setActiveModal(order.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 active:bg-violet-800 transition-colors flex-1 justify-center">
                      <IndianRupee className="w-3 h-3" />
                      {order.costStatus === 'rejected' ? 'Resubmit Quote' : 'Submit Quote'}
                    </button>
                  )}
                  {(order.costStatus === 'submitted' || order.costStatus === 'escalated') && (
                    <button onClick={() => setApprovalModal(order.id)}
                      className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex-1 justify-center',
                        order.costStatus === 'escalated'
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      )}>
                      <Check className="w-3 h-3" /> Review & Approve
                    </button>
                  )}
                  {order.costStatus === 'approved' && !order.inwardDateConfirmed && (
                    <button onClick={() => setConfirmDateModal(order.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors flex-1 justify-center">
                      <CalendarCheck className="w-3 h-3" /> Confirm Inward Date
                    </button>
                  )}
                  {order.costStatus === 'approved' && (() => {
                    const pos = posFor(order.id)
                    if (!order.inwardDateConfirmed) return null
                    return pos.length === 0 ? (
                      <button onClick={() => setPoModalOrder(order)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 active:bg-violet-800 transition-colors flex-1 justify-center">
                        <Package className="w-3 h-3" /> Raise PO
                      </button>
                    ) : (
                      <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {pos.length} PO{pos.length > 1 ? 's' : ''} raised
                      </span>
                    )
                  })()}
                  {order.costStatus === 'approved' && order.approvedBy && (
                    <span className="text-xs text-slate-400">✓ {order.approvedBy}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 hidden md:flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {['bg-violet-400','bg-purple-400','bg-amber-400','bg-pink-400','bg-teal-400'].map(c => (
              <span key={c} className={cn('w-2.5 h-2.5 rounded-sm', c)} />
            ))}
          </div>
          Breakdown bar: Fabric · CMT · Trims · Print · Packaging
        </div>
        <span>·</span>
        <span>All costs submitted by POC are logged on behalf of the vendor</span>
      </div>

      {modalOrder && (
        <CostSubmitModal order={modalOrder} vendors={vendors} onClose={() => setActiveModal(null)} onSubmit={handleSubmitCost} />
      )}

      {approvalModal && orders.find(o => o.id === approvalModal) && (
        <CostApprovalModal
          order={orders.find(o => o.id === approvalModal)!}
          onClose={() => setApprovalModal(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {confirmDateModal && orders.find(o => o.id === confirmDateModal) && (
        <ConfirmInwardModal
          order={orders.find(o => o.id === confirmDateModal)!}
          onClose={() => setConfirmDateModal(null)}
          onConfirm={handleConfirmDate}
        />
      )}

      {poModalOrder && (
        <RequestPOModal
          order={poModalOrder}
          onClose={() => setPoModalOrder(null)}
          onSubmit={newPOs => setPoRecords(prev => [...prev, ...newPOs])}
        />
      )}

      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {savedToast}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLING VIEW  (Portfolio tab — POC-scoped)
// ═══════════════════════════════════════════════════════════════════════════════

type SamplingPOCAction =
  | { type: 'approve';      stageId: StageId; remarks: string }
  | { type: 'reject';       stageId: StageId; remarks: string; revisionNotes: string }
  | { type: 'track';        stageId: 'fd-status' | 'gpt'; date: string; notes: string; certNo?: string; result?: 'pass' | 'fail' }
  | { type: 'pps-designer'; stageId: 'pps'; remarks: string }
  | { type: 'pps-fittech';  stageId: 'pps'; remarks: string }

// ─── Sample Detail Modal (POC-capable) ───────────────────────────────────────

function SampleDetailModal({
  order, onClose, onAction, pocName,
}: {
  order:    SamplingOrder
  onClose:  () => void
  onAction: (orderId: string, action: SamplingPOCAction) => void
  pocName:  string
}) {
  const activeIdx = getActiveStageIdx(order)
  const initStage = STAGE_IDS[Math.min(activeIdx, STAGE_IDS.length - 1)]

  const [tab,         setTab]         = useState<StageId>(initStage)
  const [remarks,     setRemarks]     = useState('')
  const [revNotes,    setRevNotes]    = useState('')
  const [trackDate,   setTrackDate]   = useState('')
  const [trackNotes,  setTrackNotes]  = useState('')
  const [trackCert,   setTrackCert]   = useState('')
  const [trackResult, setTrackResult] = useState<'pass' | 'fail'>('pass')
  const [saved,       setSaved]       = useState(false)

  const sc     = cfg(tab)
  const stage  = getStage(order, tab)
  const status = stageCurrentStatus(stage)

  const doAction = (action: SamplingPOCAction) => {
    setSaved(true)
    setTimeout(() => { onAction(order.id, action); onClose() }, 900)
  }

  if (saved) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-xs w-full">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
        <p className="font-bold text-slate-900">Saved!</p>
        <p className="text-xs text-slate-400 mt-1">{order.styleCode} · {sc.label}</p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <FlaskConical className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-slate-900">{order.styleCode}</span>
              <span className="text-slate-400 text-sm">{order.colour}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', TIER_COLOR[order.tier])}>
                {order.tier}
              </span>
            </div>
            <p className="text-xs text-slate-500">{order.styleName} · {order.vendor} · {order.vendorLocation}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Stage tabs ── */}
        <div className="flex border-b border-slate-100 overflow-x-auto flex-shrink-0 bg-slate-50/50">
          {STAGE_CONFIG.map((s, i) => {
            const st       = stageCurrentStatus(getStage(order, s.id))
            const done     = st === 'approved' || st === 'pass' || st === 'received'
            const rejected = st === 'rejected' || st === 'fail'
            const pending  = st === 'submitted'
            const isActive = s.id === tab
            return (
              <button
                key={s.id}
                onClick={() => { setTab(s.id); setRemarks(''); setRevNotes('') }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all',
                  isActive   ? 'border-violet-500 text-violet-700 bg-white' :
                  done       ? 'border-transparent text-green-600 hover:bg-white' :
                  rejected   ? 'border-transparent text-red-500 hover:bg-white' :
                  pending    ? 'border-transparent text-violet-400 hover:bg-white' :
                  i < activeIdx ? 'border-transparent text-amber-500 hover:bg-white' :
                               'border-transparent text-slate-400 hover:bg-white'
                )}
              >
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  done       ? 'bg-green-500' :
                  rejected   ? 'bg-red-400' :
                  pending    ? 'bg-violet-400' :
                  i === activeIdx ? 'bg-amber-400' :
                  i < activeIdx   ? 'bg-amber-300' : 'bg-slate-300'
                )} />
                {s.short}
                {i === activeIdx && !done && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded font-semibold">NOW</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Content ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Stage banner */}
          <div className={cn('flex items-start justify-between gap-3 px-4 py-3 rounded-xl border', sc.bg, sc.border)}>
            <div>
              <p className={cn('text-sm font-bold', sc.text)}>{sc.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{sc.desc}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sc.bg, sc.text)}>
                {status === 'approved' || status === 'pass' ? '✓ Done' :
                 status === 'received'                      ? '✓ Received' :
                 status === 'submitted'                     ? 'Submitted' :
                 status === 'rejected' || status === 'fail' ? '✗ Rejected' :
                 status === 'revision-required'             ? 'Revision Req.' : 'Not Started'}
              </span>
              {sc.owner !== 'poc' && (
                <span className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                  on behalf of{' '}
                  {sc.owner === 'dual' ? 'Designer + Fit Tech' :
                   sc.owner === 'designer' ? 'Designer' : 'Fit Technician'}
                </span>
              )}
            </div>
          </div>

          {/* ── TRACKING STAGE (FD / GPT) ── */}
          {sc.isTracking && (stage.id === 'fd-status' || stage.id === 'gpt') && (() => {
            const entry  = stage.entry
            const isDone = entry.status !== 'not-started'
            return (
              <div className="space-y-3">
                {isDone && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-green-700 mb-1">✓ Already logged — {fmtDate(entry.completedDate)}</p>
                    {entry.notes && <p className="text-xs text-green-600">{entry.notes}</p>}
                    {entry.certificateNo && <p className="text-xs text-green-600 mt-0.5">Certificate: {entry.certificateNo}</p>}
                    {entry.testResult && (
                      <p className={cn('text-xs font-semibold mt-0.5', entry.testResult === 'pass' ? 'text-green-700' : 'text-red-600')}>
                        Result: {entry.testResult.toUpperCase()}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    {tab === 'fd-status' ? 'Fabric Received Date' : 'GPT Completed Date'}
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input type="date" value={trackDate} onChange={e => setTrackDate(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Notes</label>
                  <textarea value={trackNotes} onChange={e => setTrackNotes(e.target.value)} rows={2}
                    placeholder={tab === 'fd-status' ? 'Fabric lot, shade variation, quantity received…' : 'Lab conditions, test scope, notes…'}
                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                </div>
                {tab === 'gpt' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Certificate Number</label>
                      <input type="text" value={trackCert} onChange={e => setTrackCert(e.target.value)}
                        placeholder="GPT-2026-XXXX"
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Test Result</label>
                      <div className="flex gap-2">
                        {(['pass', 'fail'] as const).map(r => (
                          <button key={r} onClick={() => setTrackResult(r)}
                            className={cn(
                              'flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                              trackResult === r
                                ? r === 'pass' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            )}>
                            {r === 'pass' ? '✓ Pass' : '✗ Fail'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <button
                  disabled={!trackDate}
                  onClick={() => doAction({
                    type: 'track',
                    stageId: tab as 'fd-status' | 'gpt',
                    date: trackDate, notes: trackNotes,
                    ...(tab === 'gpt' ? { certNo: trackCert || undefined, result: trackResult } : {}),
                  })}
                  className={cn(
                    'w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2',
                    trackDate ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}>
                  <Send className="w-3.5 h-3.5" /> {isDone ? 'Update' : 'Log'} {sc.label}
                </button>
              </div>
            )
          })()}

          {/* ── PPS DUAL APPROVAL ── */}
          {tab === 'pps' && stage.id === 'pps' && !sc.isTracking && (() => {
            const last = stage.entries[stage.entries.length - 1]
            return (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 font-medium">Round {last.round} · Submitted {fmtDate(last.submittedDate)}</p>

                {/* Designer block */}
                <div className={cn('rounded-xl border p-4', last.designerStatus === 'approved' ? 'bg-green-50 border-green-200' : 'bg-pink-50 border-pink-200')}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-800">Designer Approval</p>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                      last.designerStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-pink-100 text-pink-700'
                    )}>
                      {last.designerStatus === 'approved' ? '✓ Approved' : 'Pending'}
                    </span>
                  </div>
                  {last.designerDate && (
                    <p className="text-xs text-slate-500 mb-2">
                      by {last.designerBy} on {fmtDate(last.designerDate)}
                      {last.designerOnBehalf && <span className="ml-1 text-amber-600 font-medium">(via POC)</span>}
                    </p>
                  )}
                  {last.designerStatus !== 'approved' && (
                    <>
                      <div className="mb-2">
                        <label className="text-xs font-medium text-slate-600 block mb-1">Remarks</label>
                        <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)}
                          placeholder="Designer sign-off remarks…"
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-pink-500" />
                      </div>
                      <button
                        onClick={() => doAction({ type: 'pps-designer', stageId: 'pps', remarks })}
                        className="w-full py-2 bg-pink-600 text-white text-xs font-bold rounded-lg hover:bg-pink-700 flex items-center justify-center gap-1.5">
                        <Check className="w-3 h-3" /> Approve as Designer (on behalf)
                      </button>
                    </>
                  )}
                </div>

                {/* Fit Tech block */}
                <div className={cn('rounded-xl border p-4', last.fitTechStatus === 'approved' ? 'bg-green-50 border-green-200' : 'bg-violet-50 border-violet-200')}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-800">Fit Technician Approval</p>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                      last.fitTechStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'
                    )}>
                      {last.fitTechStatus === 'approved' ? '✓ Approved' : 'Pending'}
                    </span>
                  </div>
                  {last.fitTechDate && (
                    <p className="text-xs text-slate-500 mb-2">
                      by {last.fitTechBy} on {fmtDate(last.fitTechDate)}
                      {last.fitTechOnBehalf && <span className="ml-1 text-amber-600 font-medium">(via POC)</span>}
                    </p>
                  )}
                  {last.fitTechStatus !== 'approved' && (
                    <>
                      <div className="mb-2">
                        <label className="text-xs font-medium text-slate-600 block mb-1">Remarks</label>
                        <input type="text" value={revNotes} onChange={e => setRevNotes(e.target.value)}
                          placeholder="Fit tech measurement / fit remarks…"
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      </div>
                      <button
                        onClick={() => doAction({ type: 'pps-fittech', stageId: 'pps', remarks: revNotes })}
                        className="w-full py-2 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 flex items-center justify-center gap-1.5">
                        <Check className="w-3 h-3" /> Approve as Fit Technician (on behalf)
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* ── REGULAR APPROVAL STAGE ── */}
          {!sc.isTracking && tab !== 'pps' &&
           stage.id !== 'pps' && stage.id !== 'fd-status' && stage.id !== 'gpt' && (() => {
            const entries = stage.entries
            const last    = entries[entries.length - 1]
            const isDone  = last.status === 'approved'
            return (
              <div className="space-y-3">
                {/* History rounds */}
                {entries.length > 1 && entries.slice(0, -1).map(e => (
                  <div key={e.round} className={cn(
                    'rounded-xl border px-4 py-3 text-xs',
                    e.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  )}>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-slate-700">Round {e.round}</span>
                      <span className={e.status === 'approved' ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                        {e.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                      </span>
                    </div>
                    {e.remarks     && <p className="text-slate-600 italic">"{e.remarks}"</p>}
                    {e.revisionNotes && <p className="text-slate-500 mt-1">Revision: {e.revisionNotes}</p>}
                  </div>
                ))}

                {/* Current round */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Round {last.round}</span>
                    {last.submittedDate && <span className="text-slate-400">Submitted {fmtDate(last.submittedDate)}</span>}
                    {last.isOnBehalf && (
                      <span className="text-amber-600 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">via POC</span>
                    )}
                  </div>
                  {last.remarks && <p className="text-slate-600 italic">"{last.remarks}"</p>}
                  {last.measurementNotes && (
                    <div className="mt-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 font-mono text-violet-700 text-xs">
                      {last.measurementNotes}
                    </div>
                  )}
                </div>

                {isDone ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium text-center">
                    ✓ Approved {fmtDate(last.approvedDate)} by {last.approvedBy}
                    {last.isOnBehalf && <span className="ml-1 text-green-600">(via POC)</span>}
                  </div>
                ) : (last.status === 'submitted' || last.status === 'not-started') ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Remarks</label>
                      <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
                        placeholder="Approval / rejection notes…"
                        className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Revision Notes
                        <span className="text-slate-400 font-normal ml-1">(required to send back)</span>
                      </label>
                      <textarea value={revNotes} onChange={e => setRevNotes(e.target.value)} rows={2}
                        placeholder="What needs to be changed? Be specific…"
                        className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => doAction({ type: 'approve', stageId: tab, remarks })}
                        className="flex-1 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        disabled={!revNotes}
                        onClick={() => doAction({ type: 'reject', stageId: tab, remarks, revisionNotes: revNotes })}
                        className={cn(
                          'flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-1.5',
                          revNotes
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}>
                        <RotateCcw className="w-3.5 h-3.5" /> Send Back
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-sm">Waiting for vendor to submit sample</div>
                )}
              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}

// ─── Stage Quick Action Modal ─────────────────────────────────────────────────

type QuickModalState =
  | { type: 'reject';   orderId: string; stageId: Exclude<StageId, 'pps' | 'fd-status' | 'gpt'>; round: number }
  | { type: 'gpt-pass'; orderId: string }
  | { type: 'fd';       orderId: string }

function StageQuickModal({
  state, onClose, onSubmit,
}: {
  state:    QuickModalState
  onClose:  () => void
  onSubmit: (action: SamplingPOCAction) => void
}) {
  const [certNo,   setCertNo]   = useState('')
  const [notes,    setNotes]    = useState('')
  const [revNotes, setRevNotes] = useState('')
  const [remarks,  setRemarks]  = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0])

  const handleSubmit = () => {
    if (state.type === 'reject') {
      onSubmit({ type: 'reject', stageId: state.stageId, revisionNotes: revNotes, remarks })
    } else if (state.type === 'gpt-pass') {
      onSubmit({ type: 'track', stageId: 'gpt', result: 'pass', date, certNo: certNo || undefined, notes })
    } else {
      onSubmit({ type: 'track', stageId: 'fd-status', date, notes })
    }
    onClose()
  }

  const title =
    state.type === 'reject'   ? `Request Revision — ${cfg(state.stageId).label}`
    : state.type === 'gpt-pass' ? 'Log GPT Pass Certificate'
    : 'Mark Fabric as Received'
  const canSubmit = state.type === 'reject' ? revNotes.trim().length > 0
    : state.type === 'gpt-pass' ? certNo.trim().length > 0
    : true

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <p className="font-bold text-slate-900 text-sm">{title}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {state.type === 'reject' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Revision Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={revNotes} onChange={e => setRevNotes(e.target.value)} rows={3}
                  placeholder="Describe what needs to be changed..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Remarks (optional)</label>
                <input value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="Additional comments..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </>
          )}
          {state.type === 'gpt-pass' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Certificate No. <span className="text-red-500">*</span>
                </label>
                <input value={certNo} onChange={e => setCertNo(e.target.value)}
                  placeholder="GPT-2026-XXXXX"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Test Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </>
          )}
          {state.type === 'fd' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Received Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Fabric received at factory from mill"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className={cn(
              'flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-colors',
              canSubmit
                ? state.type === 'reject'
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}>
            {state.type === 'reject' ? 'Request Revision'
              : state.type === 'gpt-pass' ? 'Log Pass'
              : 'Mark Received'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sampling View ────────────────────────────────────────────────────────────

function SamplingView() {
  const { currentUser } = useCurrentUser()
  const [orders,          setOrders]          = useState<SamplingOrder[]>(SAMPLING_ORDERS)
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [stageFilter,     setStageFilter]     = useState<StageId | 'all'>('all')
  const [quickModal,      setQuickModal]      = useState<QuickModalState | null>(null)
  const [editingPromise,  setEditingPromise]  = useState<{ orderId: string; stageId: StageId } | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const setPromisedDate = useCallback((orderId: string, stageId: StageId, date: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const updated: Partial<Record<StageId, string>> = { ...o.promisedDates }
      if (date) updated[stageId] = date; else delete updated[stageId]
      return { ...o, promisedDates: updated }
    }))
    setEditingPromise(null)
  }, [])

  const selectedOrder = orders.find(o => o.id === selectedId) ?? null

  const filtered = useMemo(() => {
    if (stageFilter === 'all') return orders
    return orders.filter(o => {
      const st = stageCurrentStatus(getStage(o, stageFilter))
      return st !== 'approved' && st !== 'pass' && st !== 'received'
    })
  }, [orders, stageFilter])

  const summary = useMemo(() => ({
    total:     orders.length,
    inProg:    orders.filter(o => !isOrderComplete(o)).length,
    complete:  orders.filter(o => isOrderComplete(o)).length,
    attention: orders.filter(o => {
      const idx = getActiveStageIdx(o)
      if (idx >= STAGE_IDS.length) return false
      return stageCurrentStatus(getStage(o, STAGE_IDS[idx])) === 'submitted'
    }).length,
  }), [orders])

  const applyAction = useCallback((orderId: string, action: SamplingPOCAction) => {
    const today = new Date().toISOString().split('T')[0]
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order
      const stages = order.stages.map(stage => {

        if (action.type === 'track' && (stage.id === 'fd-status' || stage.id === 'gpt') && stage.id === action.stageId) {
          return {
            ...stage,
            entry: {
              status: (action.result ?? 'received') as TrackingEntry['status'],
              completedDate: action.date,
              ...(action.notes   ? { notes: action.notes }              : {}),
              ...(action.certNo  ? { certificateNo: action.certNo }     : {}),
              ...(action.result  ? { testResult: action.result }        : {}),
            },
          }
        }

        if (action.type === 'pps-designer' && stage.id === 'pps') {
          const entries = [...stage.entries]
          const last = { ...entries[entries.length - 1] }
          last.designerStatus   = 'approved'
          last.designerBy       = `${currentUser.name} (on behalf)`
          last.designerDate     = today
          last.designerRemarks  = action.remarks || undefined
          last.designerOnBehalf = true
          if (last.fitTechStatus === 'approved') last.status = 'approved'
          entries[entries.length - 1] = last
          return { ...stage, entries }
        }

        if (action.type === 'pps-fittech' && stage.id === 'pps') {
          const entries = [...stage.entries]
          const last = { ...entries[entries.length - 1] }
          last.fitTechStatus    = 'approved'
          last.fitTechBy        = `${currentUser.name} (on behalf)`
          last.fitTechDate      = today
          last.fitTechRemarks   = action.remarks || undefined
          last.fitTechOnBehalf  = true
          if (last.designerStatus === 'approved') last.status = 'approved'
          entries[entries.length - 1] = last
          return { ...stage, entries }
        }

        if ((action.type === 'approve' || action.type === 'reject') &&
            stage.id !== 'pps' && stage.id !== 'fd-status' && stage.id !== 'gpt' &&
            stage.id === action.stageId) {
          const entries = [...stage.entries]
          const last = { ...entries[entries.length - 1] }
          if (action.type === 'approve') {
            last.status       = 'approved'
            last.approvedDate = today
            last.approvedBy   = `${currentUser.name} (POC)`
            last.isOnBehalf   = true
            last.remarks      = action.remarks || undefined
            entries[entries.length - 1] = last
          } else {
            last.status        = 'rejected'
            last.revisionNotes = action.revisionNotes
            last.remarks       = action.remarks || undefined
            entries[entries.length - 1] = last
            entries.push({ round: last.round + 1, status: 'not-started' })
          }
          return { ...stage, entries }
        }

        return stage
      })
      return { ...order, stages }
    }))
  }, [currentUser.name])

  // ── Inline stage cell renderer ──────────────────────────────────────────────
  const renderStageCell = (order: SamplingOrder, stageId: StageId) => {
    const stage      = getStage(order, stageId)
    const status     = stageCurrentStatus(stage)
    const activeIdx  = getActiveStageIdx(order)
    const thisIdx    = STAGE_IDS.indexOf(stageId)
    const isDone     = status === 'approved' || status === 'pass' || status === 'received'
    const isFail     = status === 'fail'
    const isFuture   = thisIdx > activeIdx && !isDone

    // ── Completed ──
    if (isDone) {
      let doneDate: string | undefined
      if (stage.id === 'fd-status' || stage.id === 'gpt') doneDate = stage.entry.completedDate
      else if (stage.id === 'pps') {
        const last = stage.entries[stage.entries.length - 1] as PPSEntry
        doneDate = last.designerDate ?? last.fitTechDate
      } else {
        const last = (stage.entries as ApprovalEntry[])[stage.entries.length - 1]
        doneDate = last.approvedDate
      }
      return (
        <div className="flex flex-col items-center gap-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          {doneDate && <span className="text-[9px] text-slate-400 leading-tight">{fmtDate(doneDate)}</span>}
        </div>
      )
    }

    // ── GPT failed ──
    if (isFail && stageId === 'gpt') {
      const entry = (stage as { id: 'gpt'; entry: TrackingEntry }).entry
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-red-500 text-xs font-bold">✗</span>
          {entry.completedDate && <span className="text-[9px] text-slate-400">{fmtDate(entry.completedDate)}</span>}
        </div>
      )
    }

    // ── Not yet reached ──
    if (isFuture) return <span className="text-slate-200 text-sm select-none">·</span>

    // ── FD: Mark Fabric Received ──
    if (stageId === 'fd-status') return (
      <button
        onClick={e => { e.stopPropagation(); setQuickModal({ type: 'fd', orderId: order.id }) }}
        className="text-[10px] px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold whitespace-nowrap leading-tight">
        Mark<br />Received
      </button>
    )

    // ── GPT: Pass / Fail ──
    if (stageId === 'gpt') return (
      <div className="flex flex-col gap-1 items-center">
        <button
          onClick={e => { e.stopPropagation(); setQuickModal({ type: 'gpt-pass', orderId: order.id }) }}
          className="text-[10px] px-2 py-0.5 bg-teal-500 hover:bg-teal-600 text-white rounded font-semibold w-full text-center">
          ✓ Pass
        </button>
        <button
          onClick={e => { e.stopPropagation(); applyAction(order.id, { type: 'track', stageId: 'gpt', result: 'fail', date: today, notes: '' }) }}
          className="text-[10px] px-2 py-0.5 bg-red-400 hover:bg-red-500 text-white rounded font-semibold w-full text-center">
          ✗ Fail
        </button>
      </div>
    )

    // ── PPS: dual designer + fit-tech approval ──
    if (stageId === 'pps') {
      const s    = stage as { id: 'pps'; entries: PPSEntry[] }
      const last = s.entries[s.entries.length - 1]
      if (last.status === 'not-started') return <span className="text-[10px] text-slate-300">Awaiting</span>
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-400 w-3 font-bold shrink-0">D</span>
            {last.designerStatus === 'approved'
              ? <CheckCircle2 className="w-3 h-3 text-green-500" />
              : <button
                  onClick={e => { e.stopPropagation(); applyAction(order.id, { type: 'pps-designer', stageId: 'pps', remarks: '' }) }}
                  className="text-[10px] px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded font-bold">✓</button>
            }
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-400 w-3 font-bold shrink-0">F</span>
            {last.fitTechStatus === 'approved'
              ? <CheckCircle2 className="w-3 h-3 text-green-500" />
              : <button
                  onClick={e => { e.stopPropagation(); applyAction(order.id, { type: 'pps-fittech', stageId: 'pps', remarks: '' }) }}
                  className="text-[10px] px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded font-bold">✓</button>
            }
          </div>
        </div>
      )
    }

    // ── Approval stages: LD, S/O, FS, PPF ──
    const as      = stage as { id: Exclude<StageId, 'pps' | 'fd-status' | 'gpt'>; entries: ApprovalEntry[] }
    const last    = as.entries[as.entries.length - 1]
    const sid     = stageId as Exclude<StageId, 'pps' | 'fd-status' | 'gpt'>

    if (last.status === 'not-started') return <span className="text-[10px] text-slate-300">Awaiting</span>

    if (last.status === 'submitted') return (
      <div className="space-y-1">
        <p className="text-[9px] text-slate-400 leading-tight">R{last.round}{last.submittedDate ? ` · ${fmtDate(last.submittedDate)}` : ''}</p>
        <div className="flex gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); applyAction(order.id, { type: 'approve', stageId: sid, remarks: '' }) }}
            className="text-[10px] px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded font-bold">
            ✓
          </button>
          <button
            onClick={e => { e.stopPropagation(); setQuickModal({ type: 'reject', orderId: order.id, stageId: sid, round: last.round }) }}
            className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-bold">
            ↩
          </button>
        </div>
      </div>
    )

    if (last.status === 'rejected' || last.status === 'revision-required') return (
      <span className="text-[10px] text-orange-500 font-medium leading-tight">R{last.round}<br/>rejected</span>
    )

    return <span className="text-[10px] text-slate-400">{status}</span>
  }

  return (
    <div className="px-6 py-6">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Styles',  val: summary.total,     cls: 'text-slate-700', bg: 'bg-white'    },
          { label: 'In Progress',   val: summary.inProg,    cls: 'text-violet-700',  bg: 'bg-violet-50'  },
          { label: 'Completed',     val: summary.complete,  cls: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Needs Action',  val: summary.attention, cls: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(({ label, val, cls, bg }) => (
          <div key={label} className={cn('rounded-xl border border-slate-200 px-4 py-3', bg)}>
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={cn('text-2xl font-black', cls)}>{val}</p>
          </div>
        ))}
      </div>

      {/* ── Stage filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-xs text-slate-500 font-medium mr-1">Filter by stage:</span>
        <button
          onClick={() => setStageFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            stageFilter === 'all'
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          )}>
          All
        </button>
        {STAGE_CONFIG.map(s => (
          <button key={s.id}
            onClick={() => setStageFilter(s.id === stageFilter ? 'all' : s.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              stageFilter === s.id
                ? cn(s.bg, s.text, s.border)
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            )}>
            {s.short}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} styles</span>
      </div>

      {/* ── Table (desktop) ── */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Style</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Vendor</th>
                {STAGE_CONFIG.map(s => (
                  <th key={s.id}
                    className={cn('px-2 py-2.5 text-center text-xs font-bold tracking-wide whitespace-nowrap', s.text)}
                    title={s.label}>
                    {s.short}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Inward Date</th>
                <th className="px-2 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">No styles in this stage.</td></tr>
                : filtered.map(order => {
                  const complete = isOrderComplete(order)
                  return (
                    <tr key={order.id} className={cn(
                      'border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors',
                      complete && 'opacity-60'
                    )}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{order.styleCode}</p>
                        <p className="text-xs text-slate-400 max-w-36 truncate">{order.styleName}</p>
                        <p className="text-xs text-slate-400">{order.colour}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700">{order.vendor}</p>
                        <p className="text-xs text-slate-400">{order.vendorLocation}</p>
                      </td>
                      {STAGE_IDS.map(sid => {
                        const promised  = order.promisedDates?.[sid]
                        const stStatus  = stageCurrentStatus(getStage(order, sid))
                        const stDone    = stStatus === 'approved' || stStatus === 'pass' || stStatus === 'received'
                        const overdue   = !!promised && !stDone && promised < today
                        const isEditing = editingPromise?.orderId === order.id && editingPromise?.stageId === sid
                        return (
                          <td key={sid} className="px-2 py-3 text-center align-middle min-w-[72px]">
                            <div className="flex flex-col items-center gap-0.5">
                              {renderStageCell(order, sid)}
                              {/* Promised date row */}
                              {isEditing
                                ? <input
                                    type="date"
                                    autoFocus
                                    defaultValue={promised ?? ''}
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => setPromisedDate(order.id, sid, e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') setPromisedDate(order.id, sid, e.currentTarget.value)
                                      if (e.key === 'Escape') setEditingPromise(null)
                                    }}
                                    className="w-[70px] text-[8px] border border-violet-300 rounded px-1 py-0.5 bg-white outline-none mt-0.5"
                                  />
                                : <button
                                    disabled={stDone}
                                    onClick={e => { e.stopPropagation(); if (!stDone) setEditingPromise({ orderId: order.id, stageId: sid }) }}
                                    title={promised ? `Due: ${promised}` : 'Set promised date'}
                                    className={cn(
                                      'text-[9px] leading-tight transition-colors mt-0.5',
                                      stDone     ? 'cursor-default text-transparent select-none'
                                      : overdue  ? 'text-red-400 hover:text-red-500 font-medium'
                                      : promised ? 'text-slate-300 hover:text-slate-500'
                                                 : 'text-slate-200 hover:text-violet-400'
                                    )}>
                                    {stDone   ? '·'
                                     : promised ? new Date(promised + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                               : '+ due'}
                                  </button>
                              }
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700">
                          {new Date(order.inwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                        <DaysLeft dateStr={order.inwardDate} />
                      </td>
                      {/* Detail icon — opens full history modal */}
                      <td className="px-2 py-3">
                        <button
                          onClick={() => setSelectedId(order.id)}
                          title="View full stage history"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-3">
        {filtered.map(order => {
          const idx      = getActiveStageIdx(order)
          const complete = isOrderComplete(order)
          const activeSC = complete ? null : cfg(STAGE_IDS[idx])
          return (
            <div key={order.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer"
              onClick={() => setSelectedId(order.id)}>
              <div className={cn('h-1', activeSC ? activeSC.dot : complete ? 'bg-green-500' : 'bg-slate-200')} />
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{order.styleCode}</p>
                    <p className="text-xs text-slate-400 max-w-48 truncate">{order.styleName}</p>
                    <p className="text-xs text-slate-400">{order.colour}</p>
                  </div>
                  <DaysLeft dateStr={order.inwardDate} />
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {STAGE_IDS.map((sid, i) => {
                    const st   = stageCurrentStatus(getStage(order, sid))
                    const done = st === 'approved' || st === 'pass' || st === 'received'
                    const rej  = st === 'rejected' || st === 'fail'
                    const pend = st === 'submitted'
                    return (
                      <div key={sid} className={cn(
                        'w-3 h-3 rounded-full border',
                        done ? 'bg-green-500 border-green-400' :
                        rej  ? 'bg-red-400 border-red-300' :
                        pend ? 'bg-violet-400 border-violet-300' :
                        i === idx ? 'bg-amber-400 border-amber-300' :
                                    'bg-slate-100 border-slate-200'
                      )} />
                    )
                  })}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{order.vendor} · {order.colour}</span>
                  {complete
                    ? <span className="text-green-600 font-medium">Complete ✓</span>
                    : activeSC && (
                      <span className={cn('font-medium px-2 py-0.5 rounded-full border', activeSC.bg, activeSC.text, activeSC.border)}>
                        {activeSC.label}
                      </span>
                    )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedOrder && (
        <SampleDetailModal
          order={selectedOrder}
          onClose={() => setSelectedId(null)}
          onAction={applyAction}
          pocName={currentUser.name}
        />
      )}
      {quickModal && (
        <StageQuickModal
          state={quickModal}
          onClose={() => setQuickModal(null)}
          onSubmit={action => { applyAction(quickModal.orderId, action); setQuickModal(null) }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE PLACEHOLDER VIEW  (Production / Inspection / ASN)
// ═══════════════════════════════════════════════════════════════════════════════

const TAB_STAGE_META: Record<string, {
  stages: string[]
  icon: React.ComponentType<{ className?: string }>
  emptyMsg: string
  color: string
  badge: string
}> = {
  production: {
    stages:   ['production'],
    icon:     Factory,
    emptyMsg: 'No styles currently in production.',
    color:    'text-violet-700',
    badge:    'bg-violet-100 text-violet-700',
  },
  inspection: {
    stages:   ['fi'],
    icon:     ScanLine,
    emptyMsg: 'No styles awaiting final inspection.',
    color:    'text-orange-600',
    badge:    'bg-orange-100 text-orange-700',
  },
  asn: {
    stages:   ['asn'],
    icon:     Truck,
    emptyMsg: 'No styles have an ASN in progress.',
    color:    'text-teal-600',
    badge:    'bg-teal-100 text-teal-700',
  },
}

// Per-row editable qty state
type RowEdits = Record<string, { cut: string; sewn: string; packed: string; dirty: boolean }>

function InlineQtyCell({
  value, orderId, field, orderQty, initCut, initSewn, initPacked, edits, setEdits, onCommit,
}: {
  value: number
  orderId: string
  field: 'cut' | 'sewn' | 'packed'
  orderQty: number
  initCut: number
  initSewn: number
  initPacked: number
  edits: RowEdits
  setEdits: React.Dispatch<React.SetStateAction<RowEdits>>
  onCommit: (orderId: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const editing  = !!edits[orderId]
  const current  = edits[orderId]?.[field] ?? String(value)
  const isPacked = field === 'packed'

  // Activate row edit mode, then focus THIS cell's input on next paint
  const activate = () => {
    setEdits(p => {
      if (p[orderId]) return p           // already open — don't reset values
      return { ...p, [orderId]: { cut: String(initCut), sewn: String(initSewn), packed: String(initPacked), dirty: false } }
    })
    // Focus this specific input after React re-renders
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  if (!editing) {
    return (
      <td className="px-3 py-0 text-right cursor-text select-none group" onClick={activate}>
        <span className={cn(
          'text-sm font-medium group-hover:bg-slate-100 rounded px-2 py-1 inline-block transition-colors',
          isPacked ? 'text-green-700' : 'text-slate-700'
        )}>
          {value.toLocaleString()}
        </span>
      </td>
    )
  }

  return (
    <td className="px-2 py-1.5 text-right">
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={orderQty}
        value={current}
        onChange={e => setEdits(p => ({
          ...p,
          [orderId]: { ...p[orderId], [field]: e.target.value, dirty: true },
        }))}
        onBlur={() => onCommit(orderId)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(orderId) }}
        className={cn(
          'w-16 text-right px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors',
          isPacked
            ? 'border-green-300 focus:ring-green-400 text-green-700 bg-green-50'
            : 'border-violet-300 focus:ring-violet-400 text-slate-700 bg-violet-50/40'
        )}
      />
    </td>
  )
}

function StageView({ tabKey }: { tabKey: string }) {
  const meta = TAB_STAGE_META[tabKey]

  // ── API data ────────────────────────────────────────────────────────────────
  const { data: rawOrders, loading: stageLoading } = useSubOrders()
  const { data: rawVendors } = useVendors()
  const { data: rawUsers  } = useUsers()
  const vendorMap = useMemo(() => new Map(rawVendors.map(v => [v.id, v])), [rawVendors])
  const userMap   = useMemo(() => new Map(rawUsers.map(u => [u.id, u])), [rawUsers])
  const apiOrders = useMemo(
    () => rawOrders
      .filter(o => meta.stages.includes(o.currentStage))
      .map(o => apiOrderToSubOrder(o, vendorMap, userMap)),
    [rawOrders, vendorMap, userMap, meta.stages],
  )

  const [orders, setOrders]   = useState<SubOrder[]>([])
  const [edits, setEdits]     = useState<RowEdits>({})
  const [savedId, setSavedId] = useState<string | null>(null)
  const [historyOrder, setHistoryOrder] = useState<SubOrder | null>(null)

  // Seed local orders once API data loads (preserve any in-flight edits)
  useEffect(() => {
    setOrders(prev => {
      if (prev.length === 0) return apiOrders
      // Merge: keep local edits for rows already present, add any new rows
      const prevMap = new Map(prev.map(o => [o.id, o]))
      return apiOrders.map(o => prevMap.get(o.id) ?? o)
    })
  }, [apiOrders])

  const Icon = meta.icon

  // Blur-triggered silent commit (no flash, no history entry)
  const commitRow = useCallback((orderId: string) => {
    setEdits(prev => {
      const row = prev[orderId]
      if (!row) return prev
      setOrders(os => os.map(o => o.id !== orderId ? o : {
        ...o,
        cutQty:    Math.min(parseInt(row.cut)    || 0, o.orderQty),
        sewingQty: Math.min(parseInt(row.sewn)   || 0, o.orderQty),
        packedQty: Math.min(parseInt(row.packed) || 0, o.orderQty),
      }))
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }, [])

  // Update button — saves values AND appends a history entry
  const saveRow = useCallback((orderId: string) => {
    setEdits(prev => {
      const row = prev[orderId]
      if (!row || !row.dirty) return prev
      const cut    = Math.min(parseInt(row.cut)    || 0, 99999)
      const sewn   = Math.min(parseInt(row.sewn)   || 0, 99999)
      const packed = Math.min(parseInt(row.packed) || 0, 99999)
      setOrders(os => os.map(o => {
        if (o.id !== orderId) return o
        const entry = {
          date:       new Date().toISOString().split('T')[0],
          cutQty:     cut,
          sewingQty:  sewn,
          packedQty:  packed,
          updatedBy:  'Parthipan Kumar',
        }
        return { ...o, cutQty: cut, sewingQty: sewn, packedQty: packed, productionHistory: [entry, ...o.productionHistory] }
      }))
      setSavedId(orderId)
      setTimeout(() => setSavedId(null), 1800)
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }, [])

  if (stageLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="px-4 md:px-6 py-16 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Icon className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm">{meta.emptyMsg}</p>
      </div>
    )
  }

  const urgencyLabel = (diff: number) =>
    diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today' : `${diff}d left`
  const urgencyClass = (diff: number) =>
    diff < 0 ? 'bg-red-100 text-red-700' : diff <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'

  return (
    <div className="px-3 md:px-5 py-4">

      {/* ── Desktop table ── */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left">Style</th>
              <th className="px-4 py-2.5 text-left">Colour · Category</th>
              <th className="px-4 py-2.5 text-left">Vendor</th>
              <th className="px-4 py-2.5 text-right">Ordered</th>
              <th className="px-4 py-2.5 text-right">Cut</th>
              <th className="px-4 py-2.5 text-right">Sewn</th>
              <th className="px-4 py-2.5 text-right">Packed</th>
              <th className="px-4 py-2.5 text-right">ASN</th>
              <th className="px-4 py-2.5 text-right">GRN</th>
              <th className="px-4 py-2.5 text-left w-36">Progress</th>
              <th className="px-4 py-2.5 text-left">Inward</th>
              <th className="px-4 py-2.5 text-right w-24"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const diff      = Math.ceil((new Date(order.buyingExpectedInwardDate).getTime() - Date.now()) / 86400000)
              const pct       = order.orderQty > 0 ? Math.round((order.packedQty / order.orderQty) * 100) : 0
              const barColor  = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-violet-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200'
              const isEditing = !!edits[order.id]
              const isDirty   = edits[order.id]?.dirty === true
              const justSaved = savedId === order.id
              return (
                <tr key={order.id} className={cn(
                  'border-b border-slate-100 last:border-0 transition-colors',
                  justSaved ? 'bg-green-50' : isEditing ? 'bg-violet-50/30' : 'hover:bg-slate-50/60'
                )}>
                  {/* Style — clickable → history drawer */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setHistoryOrder(order)}
                      className="text-left group"
                    >
                      <p className="font-semibold text-slate-900 text-sm group-hover:text-violet-700 transition-colors">{order.styleCode}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[9rem] group-hover:text-violet-500 transition-colors">{order.styleName}</p>
                      <p className="text-[10px] text-slate-300 font-mono mt-0.5 truncate max-w-[9rem]">{order.id}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p>{order.colour}</p>
                    <p className="text-slate-400">{order.category}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">{order.vendor.name}</p>
                    <p className="text-xs text-slate-400">{order.vendor.location}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-500">{order.orderQty.toLocaleString()}</td>
                  <InlineQtyCell value={order.cutQty}    orderId={order.id} field="cut"    orderQty={order.orderQty} initCut={order.cutQty} initSewn={order.sewingQty} initPacked={order.packedQty} edits={edits} setEdits={setEdits} onCommit={commitRow} />
                  <InlineQtyCell value={order.sewingQty} orderId={order.id} field="sewn"   orderQty={order.orderQty} initCut={order.cutQty} initSewn={order.sewingQty} initPacked={order.packedQty} edits={edits} setEdits={setEdits} onCommit={commitRow} />
                  <InlineQtyCell value={order.packedQty} orderId={order.id} field="packed" orderQty={order.orderQty} initCut={order.cutQty} initSewn={order.sewingQty} initPacked={order.packedQty} edits={edits} setEdits={setEdits} onCommit={commitRow} />
                  {/* ASN qty */}
                  <td className="px-4 py-3 text-right">
                    {order.dispatchedQty > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-blue-700">{order.dispatchedQty.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">{Math.round(order.dispatchedQty / (order.orderQty || 1) * 100)}%</p>
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  {/* GRN qty */}
                  <td className="px-4 py-3 text-right">
                    {order.grnQty > 0 ? (
                      <div>
                        <p className={cn('text-sm font-medium', order.grnQty >= order.orderQty ? 'text-teal-600' : 'text-teal-500')}>{order.grnQty.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">{Math.round(order.grnQty / (order.orderQty || 1) * 100)}%</p>
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(order.buyingExpectedInwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block whitespace-nowrap', urgencyClass(diff))}>
                      {urgencyLabel(diff)}
                    </span>
                  </td>
                  {/* Update CTA */}
                  <td className="px-3 py-3 text-right">
                    {justSaved ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                      </span>
                    ) : (
                      <button
                        disabled={!isDirty}
                        onClick={() => saveRow(order.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                          isDirty
                            ? 'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 shadow-sm'
                            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        )}
                      >
                        Update
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards — inline number inputs ── */}
      <div className="md:hidden space-y-2">
        {orders.map(order => {
          const diff     = Math.ceil((new Date(order.buyingExpectedInwardDate).getTime() - Date.now()) / 86400000)
          const pct      = order.orderQty > 0 ? Math.round((order.packedQty / order.orderQty) * 100) : 0
          const barColor = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-violet-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200'
          const topColor = diff < 0 ? 'bg-red-400' : diff <= 7 ? 'bg-amber-400' : 'bg-slate-200'
          const justSaved = savedId === order.id
          const isDirty   = edits[order.id]?.dirty === true
          const row       = edits[order.id]
          const cutVal    = row ? row.cut    : String(order.cutQty)
          const sewnVal   = row ? row.sewn   : String(order.sewingQty)
          const packedVal = row ? row.packed : String(order.packedQty)

          const activate = () => {
            if (!edits[order.id])
              setEdits(p => ({ ...p, [order.id]: { cut: String(order.cutQty), sewn: String(order.sewingQty), packed: String(order.packedQty), dirty: false } }))
          }

          return (
            <div key={order.id} className={cn(
              'rounded-xl border shadow-sm overflow-hidden transition-colors',
              justSaved ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
            )}>
              <div className={cn('h-1', topColor)} />
              <div className="px-4 py-3">
                {/* Style — clickable → history drawer */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <button onClick={() => setHistoryOrder(order)} className="text-left min-w-0">
                    <p className="text-sm font-bold text-violet-700">{order.styleCode}</p>
                    <p className="text-xs text-slate-400 truncate">{order.styleName} · {order.colour}</p>
                  </button>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0', urgencyClass(diff))}>
                    {urgencyLabel(diff)}
                  </span>
                </div>

                {/* Qty inputs grid */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'Ordered', value: String(order.orderQty), readonly: true,  field: null,            color: 'bg-slate-50 border-slate-200 text-slate-500' },
                    { label: 'Cut',     value: cutVal,                 readonly: false, field: 'cut'    as const, color: 'bg-violet-50/60 border-violet-200 text-slate-700' },
                    { label: 'Sewn',    value: sewnVal,                readonly: false, field: 'sewn'   as const, color: 'bg-violet-50/60 border-violet-200 text-slate-700' },
                    { label: 'Packed',  value: packedVal,              readonly: false, field: 'packed' as const, color: 'bg-green-50 border-green-200 text-green-700' },
                  ].map(({ label, value, readonly, field, color }) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-medium">{label}</span>
                      <input
                        type="number" readOnly={readonly} value={value} min={0} max={order.orderQty}
                        onFocus={readonly ? undefined : activate}
                        onChange={readonly || !field ? undefined : e => setEdits(p => ({
                          ...p,
                          [order.id]: { ...(p[order.id] ?? { cut: String(order.cutQty), sewn: String(order.sewingQty), packed: String(order.packedQty), dirty: false }), [field]: e.target.value, dirty: true },
                        }))}
                        onBlur={readonly ? undefined : () => commitRow(order.id)}
                        onKeyDown={readonly ? undefined : e => { if (e.key === 'Enter') saveRow(order.id) }}
                        className={cn('w-full text-center text-sm font-semibold border rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors', color)}
                      />
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                </div>

                {/* Vendor + Update */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
                    <Building2 className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{order.vendor.name} · {order.vendor.location}</span>
                  </div>
                  {justSaved ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                  ) : (
                    <button
                      disabled={!isDirty}
                      onClick={() => saveRow(order.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0',
                        isDirty
                          ? 'bg-violet-600 text-white active:bg-violet-800'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      )}
                    >
                      Update
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Production History Drawer ── */}
      {historyOrder && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setHistoryOrder(null)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-full sm:w-96 z-50 bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 flex-shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{historyOrder.styleCode}</p>
                <p className="text-xs text-slate-500 truncate">{historyOrder.styleName} · {historyOrder.colour}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-400">{historyOrder.vendor.name}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-400">{historyOrder.orderQty.toLocaleString()} pcs ordered</span>
                </div>
              </div>
              <button onClick={() => setHistoryOrder(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current snapshot */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Status</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Cut',    val: historyOrder.cutQty,    color: 'text-violet-700' },
                  { label: 'Sewn',   val: historyOrder.sewingQty, color: 'text-violet-700' },
                  { label: 'Packed', val: historyOrder.packedQty, color: 'text-green-700'  },
                ].map(({ label, val, color }) => {
                  const p = historyOrder.orderQty > 0 ? Math.round((val / historyOrder.orderQty) * 100) : 0
                  return (
                    <div key={label} className="bg-white rounded-xl border border-slate-200 p-2.5 text-center">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className={cn('text-base font-bold', color)}>{val.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{p}%</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* History list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Update History</p>

              {historyOrder.productionHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No updates recorded yet.</div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3.5 top-2 bottom-2 w-px bg-slate-200" />

                  <div className="space-y-4">
                    {historyOrder.productionHistory.map((entry, i) => {
                      const prev = historyOrder.productionHistory[i + 1]
                      const cutDiff    = prev ? entry.cutQty    - prev.cutQty    : null
                      const sewnDiff   = prev ? entry.sewingQty - prev.sewingQty : null
                      const packedDiff = prev ? entry.packedQty - prev.packedQty : null

                      return (
                        <div key={i} className="flex gap-3 relative">
                          {/* Dot */}
                          <div className="w-7 h-7 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center flex-shrink-0 z-10">
                            <Factory className="w-3 h-3 text-violet-600" />
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            {/* Date + by */}
                            <div className="flex items-baseline justify-between gap-2 mb-1.5">
                              <p className="text-xs font-semibold text-slate-700">
                                {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              <p className="text-xs text-slate-400 truncate max-w-[9rem]">
                                {entry.onBehalfOf ? `${entry.updatedBy} (on behalf of ${entry.onBehalfOf})` : entry.updatedBy}
                              </p>
                            </div>

                            {/* Qty row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {[
                                { label: 'Cut',    val: entry.cutQty,    diff: cutDiff,    color: 'bg-violet-50 text-violet-800' },
                                { label: 'Sewn',   val: entry.sewingQty, diff: sewnDiff,   color: 'bg-violet-50 text-violet-800' },
                                { label: 'Packed', val: entry.packedQty, diff: packedDiff, color: 'bg-green-50 text-green-800'   },
                              ].map(({ label, val, diff: d, color }) => (
                                <div key={label} className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium', color)}>
                                  <span className="text-slate-500">{label}</span>
                                  <span className="font-bold">{val.toLocaleString()}</span>
                                  {d !== null && d !== 0 && (
                                    <span className={cn('text-[10px] font-semibold', d > 0 ? 'text-green-600' : 'text-red-500')}>
                                      {d > 0 ? `+${d}` : d}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {entry.reason && (
                              <p className="text-xs text-slate-400 italic mt-1">{entry.reason}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASN VIEW
// ═══════════════════════════════════════════════════════════════════════════════

type AsnStatus = 'APPROVED' | 'HOLD' | 'PENDING'

type AsnRecord = {
  id: string
  styleCode: string
  colour: string
  asnApproval: AsnStatus
  asnRemarks?: string
  poQty: number
  plQty: number
  invoiceQty: number
  poRate: number
  invoiceRate: number
  invoiceValueSystem: number
  invoiceValueVendor: number
  asnAppliedDate: string
  systemCheck: 'Pass' | 'Fail' | 'Pending'
  location: string
  poNumber: string
  invoiceDate: string
  invoiceNo: string
  asnMonthWeek: string
  asnMonth: string
  model: 'WOVEN' | 'KNIT' | 'DENIM'
  sourcingPoc: string
  vendor: string
  registerEmail: string
  fabricateCode: string
  asnCheckedBy: string
  asnCommentDate?: string
  shipmentNo?: number  // which shipment of this PO (1, 2, 3...)
}

const ASN_RECORDS: AsnRecord[] = [
  {
    id: 'NN-1747296527827-7495', styleCode: 'NN301-041', colour: 'RED',
    asnApproval: 'APPROVED', poQty: 64, plQty: 64, invoiceQty: 64,
    poRate: 339, invoiceRate: 339, invoiceValueSystem: 22781, invoiceValueVendor: 21696,
    asnAppliedDate: '2026-01-01', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02413M', invoiceDate: '2025-12-27', invoiceNo: 'GST/25-26/319',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'PESOS VISION', registerEmail: 'MEENUPESOS VISION9',
    fabricateCode: 'NN-1747296527827-7495', asnCheckedBy: 'sandeep.p@wrogn.com', asnCommentDate: '2026-01-01',
  },
  {
    id: 'NN-1750508009793-7033', styleCode: 'NN321-800(DROP-02)', colour: 'BLUE/WHITE',
    asnApproval: 'APPROVED', poQty: 75, plQty: 49, invoiceQty: 49,
    poRate: 292, invoiceRate: 292, invoiceValueSystem: 14308, invoiceValueVendor: 14308,
    asnAppliedDate: '2026-01-28', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02003M', invoiceDate: '2026-01-27', invoiceNo: 'BS/25-26/605',
    asnMonthWeek: '(2.5) JAN WEEK-4', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'BS FASHION', registerEmail: 'BSFASHIONSNAUTINATI',
    fabricateCode: 'NN-1750508009793-7033', asnCheckedBy: 'sandeep.p@wrogn.com', asnCommentDate: '2026-01-28',
  },
  {
    id: 'NN-1750059496327-1105', styleCode: 'NN321-517CW2', colour: 'PEACH',
    asnApproval: 'APPROVED', poQty: 100, plQty: 100, invoiceQty: 100,
    poRate: 355, invoiceRate: 355, invoiceValueSystem: 35500, invoiceValueVendor: 35500,
    asnAppliedDate: '2026-01-01', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02474M', invoiceDate: '2026-01-01', invoiceNo: 'JB/0203/25-26',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'MAHESH B', vendor: 'SUMICOT', registerEmail: 'V.SINGH41435@GMAIL.COM',
    fabricateCode: 'NN-1750059496327-1105', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-01',
  },
  {
    id: 'NN-1750068189917-46', styleCode: 'NN321-018(DROP-02)', colour: 'MULTICOLOR',
    asnApproval: 'APPROVED', poQty: 110, plQty: 96, invoiceQty: 96,
    poRate: 254, invoiceRate: 254, invoiceValueSystem: 25603, invoiceValueVendor: 24384,
    asnAppliedDate: '2026-01-15', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02391M', invoiceDate: '2026-01-15', invoiceNo: 'SCPL/0975/26-26',
    asnMonthWeek: '(2.5) JAN WEEK-3', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'SOUL CLOTHING PVT.LTD', registerEmail: 'RAHUL@SOULCLOTHING.IN',
    fabricateCode: 'NN-1750068189917-46', asnCheckedBy: 'sandeep.p@wrogn.com', asnCommentDate: '2026-01-15',
  },
  {
    id: 'NN-1750418279777-7912', styleCode: 'NN321-510', colour: 'PEACH',
    asnApproval: 'APPROVED', poQty: 90, plQty: 90, invoiceQty: 90,
    poRate: 360, invoiceRate: 360, invoiceValueSystem: 32400, invoiceValueVendor: 32400,
    asnAppliedDate: '2026-01-01', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02317M', invoiceDate: '2026-01-01', invoiceNo: 'AF/158/25-26',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'ARIHANT FASHIONS', registerEmail: 'ARIHANTFASHIONS20',
    fabricateCode: 'NN-1750418279777-7912', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-01',
  },
  {
    id: 'NN-1750742676480-3811', styleCode: 'NNNGCS00017', colour: 'BLUE AND WHITE',
    asnApproval: 'APPROVED', poQty: 72, plQty: 72, invoiceQty: 72,
    poRate: 398, invoiceRate: 398, invoiceValueSystem: 28656, invoiceValueVendor: 28656,
    asnAppliedDate: '2026-01-02', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02363M', invoiceDate: '2026-01-02', invoiceNo: 'SC/2025-26/D252',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'SUMAN CREATION', registerEmail: 'SUMANCREATION2026',
    fabricateCode: 'NN-1750742676480-3811', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-02',
  },
  {
    id: 'NN-1750742686450-9048', styleCode: 'NNNGCS00018', colour: 'LIGHT BLUE AND PINK',
    asnApproval: 'APPROVED', poQty: 72, plQty: 72, invoiceQty: 72,
    poRate: 413, invoiceRate: 413, invoiceValueSystem: 29736, invoiceValueVendor: 29736,
    asnAppliedDate: '2026-01-02', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02344M', invoiceDate: '2026-01-02', invoiceNo: 'SC/2025-26/D247',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'SUMAN CREATION', registerEmail: 'SUMANCREATION2026',
    fabricateCode: 'NN-1750742686450-9048', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-02',
  },
  {
    id: 'NN-1750742691463-453', styleCode: 'NNNBBW00001', colour: 'LIGHT BLUE',
    asnApproval: 'APPROVED', poQty: 75, plQty: 67, invoiceQty: 67,
    poRate: 322, invoiceRate: 322, invoiceValueSystem: 21574, invoiceValueVendor: 21574,
    asnAppliedDate: '2026-01-05', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02345M', invoiceDate: '2026-01-05', invoiceNo: 'SC/2025-26/D260',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'SUMAN CREATION', registerEmail: 'SUMANCREATION2026',
    fabricateCode: 'NN-1750742691463-453', asnCheckedBy: 'sandeep.p@wrogn.com', asnCommentDate: '2026-01-05',
  },
  {
    id: 'NN-1750742711178-6997', styleCode: 'NNNBBW00002', colour: 'DARK BLUE',
    asnApproval: 'APPROVED', poQty: 72, plQty: 60, invoiceQty: 60,
    poRate: 309, invoiceRate: 309, invoiceValueSystem: 18540, invoiceValueVendor: 18540,
    asnAppliedDate: '2026-01-06', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02346M', invoiceDate: '2026-01-06', invoiceNo: 'SC/2025-26/D264',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'SUMAN CREATION', registerEmail: 'SUMANCREATION2026',
    fabricateCode: 'NN-1750742711178-6997', asnCheckedBy: 'sandeep.p@wrogn.com', asnCommentDate: '2026-01-06',
  },
  {
    id: 'NN-1750742714610-9605', styleCode: 'NNNGBW00006', colour: 'DARK BLUE',
    asnApproval: 'APPROVED', poQty: 72, plQty: 72, invoiceQty: 72,
    poRate: 316, invoiceRate: 316, invoiceValueSystem: 22752, invoiceValueVendor: 22752,
    asnAppliedDate: '2026-01-01', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02351M', invoiceDate: '2025-12-31', invoiceNo: '96/25-26',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'VAVIYA APPARELS', registerEmail: 'VAVIYAAPPARELS2013',
    fabricateCode: 'NN-1750742714610-9605', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-01',
  },
  {
    id: 'NN-1750742714631-1210', styleCode: 'NNNBTW00019', colour: 'LIGHT BLUE',
    asnApproval: 'APPROVED', poQty: 72, plQty: 72, invoiceQty: 72,
    poRate: 232, invoiceRate: 232, invoiceValueSystem: 16704, invoiceValueVendor: 16704,
    asnAppliedDate: '2026-01-01', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02347M', invoiceDate: '2026-01-01', invoiceNo: 'SC/2025-26/D243',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'SUMAN CREATION', registerEmail: 'SUMANCREATION2026',
    fabricateCode: 'NN-1750742714631-1210', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-01',
  },
  {
    id: 'NN-1750742714640-5083', styleCode: 'NNNGBW090087', colour: 'MID BLUE',
    asnApproval: 'APPROVED', poQty: 72, plQty: 72, invoiceQty: 72,
    poRate: 316, invoiceRate: 316, invoiceValueSystem: 22752, invoiceValueVendor: 22752,
    asnAppliedDate: '2026-01-01', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02352M', invoiceDate: '2025-12-31', invoiceNo: '91/25-26',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'VAVIYA APPARELS', registerEmail: 'VAVIYAAPPARELS2013',
    fabricateCode: 'NN-1750742714640-5083', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-01',
  },
  {
    id: 'NN-1750742714646-9234', styleCode: 'NNNGBW090091', colour: 'LIGHT BLUE',
    asnApproval: 'APPROVED', poQty: 72, plQty: 72, invoiceQty: 72,
    poRate: 350, invoiceRate: 350, invoiceValueSystem: 25200, invoiceValueVendor: 25200,
    asnAppliedDate: '2026-01-01', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02353M', invoiceDate: '2025-12-31', invoiceNo: '100/25-26',
    asnMonthWeek: '(2.5) JAN WEEK-1', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'VAVIYA APPARELS', registerEmail: 'VAVIYAAPPARELS2013',
    fabricateCode: 'NN-1750742714646-9234', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-01',
  },
  {
    id: 'NN-1751413404264-3217', styleCode: 'NNNGCS100072 B(DROP)', colour: 'BLACK & GOLD',
    asnApproval: 'APPROVED', poQty: 90, plQty: 80, invoiceQty: 80,
    poRate: 375, invoiceRate: 375, invoiceValueSystem: 30000, invoiceValueVendor: 30000,
    asnAppliedDate: '2026-01-15', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02620M', invoiceDate: '2026-01-16', invoiceNo: '640',
    asnMonthWeek: '(2.5) JAN WEEK-3', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'NEW DESIGN WORLD', registerEmail: 'ROMASI54@GMAIL.COM',
    fabricateCode: 'NN-1751413404264-3217', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-15',
  },
  {
    id: 'NN-1751413404280-4523', styleCode: 'NNGDRS24856', colour: 'LIGHT BLUE',
    asnApproval: 'APPROVED', poQty: 90, plQty: 90, invoiceQty: 90,
    poRate: 266, invoiceRate: 266, invoiceValueSystem: 23940, invoiceValueVendor: 23940,
    asnAppliedDate: '2026-01-31', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02621M', invoiceDate: '2026-01-30', invoiceNo: '645',
    asnMonthWeek: '(2.5) JAN WEEK-5', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'NEW DESIGN WORLD', registerEmail: 'ROMASI54@GMAIL.COM',
    fabricateCode: 'NN-1751413404280-4523', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-31',
  },
  {
    id: 'NN-1752586884638-6795', styleCode: 'NN1BCS010002 (DROP-03)', colour: 'GREEN',
    asnApproval: 'APPROVED', poQty: 108, plQty: 92, invoiceQty: 92,
    poRate: 273, invoiceRate: 273, invoiceValueSystem: 25116, invoiceValueVendor: 25116,
    asnAppliedDate: '2026-01-28', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02017M', invoiceDate: '2026-01-27', invoiceNo: 'BS/25-26/601',
    asnMonthWeek: '(2.5) JAN WEEK-4', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'BS FASHION', registerEmail: 'BSFASHIONSNAUTINATI',
    fabricateCode: 'NN-1752586884638-6795', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-28',
  },
  {
    id: 'NN-1752587812190-3356', styleCode: 'NNNBCS010119 (DROP-02)', colour: 'NAVY, MULTICOLOUR',
    asnApproval: 'APPROVED', poQty: 108, plQty: 108, invoiceQty: 108,
    poRate: 131, invoiceRate: 131, invoiceValueSystem: 14148, invoiceValueVendor: 14148,
    asnAppliedDate: '2026-01-22', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02808M', invoiceDate: '2026-01-22', invoiceNo: '132/SMPL/25-26',
    asnMonthWeek: '(2.5) JAN WEEK-4', asnMonth: '(2.5) Jan26', model: 'WOVEN',
    sourcingPoc: 'MAHESH B', vendor: 'SHEKHAWATI MARKETING PV.', registerEmail: 'WAIKAR1986@GMAIL.COM',
    fabricateCode: 'NN-1752587812190-3356', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN', asnCommentDate: '2026-01-22',
  },
  {
    id: 'NN-1752619553789-6630', styleCode: 'NN301-093 (DROP-02)', colour: 'NAVY BLUE',
    asnApproval: 'APPROVED', poQty: 112, plQty: 112, invoiceQty: 112,
    poRate: 300, invoiceRate: 300, invoiceValueSystem: 35280, invoiceValueVendor: 33600,
    asnAppliedDate: '2026-02-23', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02439M', invoiceDate: '2026-02-19', invoiceNo: 'CVS/25-26/2748',
    asnMonthWeek: '(2.6) FEB WEEK-4', asnMonth: '(2.6) Feb26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'CVS ENTERPRISES', registerEmail: 'CVS.A39@GMAIL.COM',
    fabricateCode: 'NN-1752619553789-6630', asnCheckedBy: 'sandeep.p@wrogn.com', asnCommentDate: '2026-02-23',
  },
  {
    id: 'NN-1752619553789-HOLD1', styleCode: 'NN405-118', colour: 'DARK GREEN',
    asnApproval: 'HOLD',
    asnRemarks: 'Invoice rate mismatch — vendor quoted ₹412 vs PO rate ₹398. Pending clarification from accounts.',
    poQty: 96, plQty: 96, invoiceQty: 96,
    poRate: 398, invoiceRate: 412, invoiceValueSystem: 38208, invoiceValueVendor: 39552,
    asnAppliedDate: '2026-02-10', systemCheck: 'Fail', location: 'MUMBAI',
    poNumber: 'PPO-02501M', invoiceDate: '2026-02-08', invoiceNo: 'ARH/25-26/112',
    asnMonthWeek: '(2.6) FEB WEEK-2', asnMonth: '(2.6) Feb26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'ARIHANT FASHIONS', registerEmail: 'ARIHANTFASHIONS20',
    fabricateCode: 'NN-1752619553789-HOLD1', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN',
  },
  {
    id: 'NN-1752619553789-HOLD2', styleCode: 'NN398-200', colour: 'MUSTARD',
    asnApproval: 'HOLD',
    asnRemarks: 'Short shipment — PL qty 84 vs PO qty 120. Balance 36 pcs to be shipped separately.',
    poQty: 120, plQty: 84, invoiceQty: 84,
    poRate: 285, invoiceRate: 285, invoiceValueSystem: 34200, invoiceValueVendor: 23940,
    asnAppliedDate: '2026-02-14', systemCheck: 'Pass', location: 'MUMBAI',
    poNumber: 'PPO-02588M', invoiceDate: '2026-02-12', invoiceNo: 'IDS/26/0234',
    asnMonthWeek: '(2.6) FEB WEEK-3', asnMonth: '(2.6) Feb26', model: 'WOVEN',
    sourcingPoc: 'PARTHIPAN', vendor: 'IDS FASHION', registerEmail: 'IDSFASHION2026',
    fabricateCode: 'NN-1752619553789-HOLD2', asnCheckedBy: 'RAKESH.AWATI@TMRW.IN',
  },
]

// Orders that are dispatched/ready for ASN creation
const ASN_ELIGIBLE_ORDERS = [
  { poNumber: 'PPO-03011M', styleCode: 'NN407-221',  colour: 'PEACH',        vendor: 'ARIHANT FASHIONS',  poQty: 600, poRate: 265, model: 'WOVEN' as const, sourcingPoc: 'PARTHIPAN', location: 'MUMBAI' },
  { poNumber: 'PPO-03022M', styleCode: 'NN412-089',  colour: 'OLIVE',        vendor: 'IDS FASHION',       poQty: 450, poRate: 320, model: 'WOVEN' as const, sourcingPoc: 'PARTHIPAN', location: 'MUMBAI' },
  { poNumber: 'PPO-03045M', styleCode: 'NN409-155',  colour: 'YELLOW',       vendor: 'BS FASHION',        poQty: 720, poRate: 326, model: 'KNIT'  as const, sourcingPoc: 'MAHESH B',  location: 'MUMBAI' },
  { poNumber: 'PPO-03078M', styleCode: 'NN403-302',  colour: 'SKY BLUE',     vendor: 'DIV CREATIONS',     poQty: 380, poRate: 310, model: 'WOVEN' as const, sourcingPoc: 'PARTHIPAN', location: 'MUMBAI' },
  { poNumber: 'PPO-03099M', styleCode: 'NN415-078',  colour: 'NAVY MELANGE', vendor: 'CAARVI TEXTILES',   poQty: 550, poRate: 434, model: 'KNIT'  as const, sourcingPoc: 'PARTHIPAN', location: 'DELHI'  },
  { poNumber: 'PPO-03112M', styleCode: 'NN408-245',  colour: 'MAROON',       vendor: 'ARIHANT FASHIONS',  poQty: 280, poRate: 498, model: 'WOVEN' as const, sourcingPoc: 'PARTHIPAN', location: 'MUMBAI' },
  { poNumber: 'PPO-03134M', styleCode: 'NN401-190',  colour: 'CORAL',        vendor: 'AND DESIGN',        poQty: 900, poRate: 238, model: 'KNIT'  as const, sourcingPoc: 'MAHESH B',  location: 'JAIPUR' },
]

type AsnFormState = {
  poNumber: string
  invoiceNo: string
  invoiceDate: string
  invoiceRate: string
  plQty: string
  asnAppliedDate: string
  location: string
  asnRemarks: string
}

function AsnView() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'APPROVED' | 'HOLD'>('all')
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [records, setRecords]         = useState<AsnRecord[]>(ASN_RECORDS)

  // Create ASN drawer state
  const [createOpen, setCreateOpen]       = useState(false)
  const [orderSearch, setOrderSearch]     = useState('')
  const [selectedPO, setSelectedPO]       = useState<typeof ASN_ELIGIBLE_ORDERS[0] | null>(null)
  const [form, setForm]                   = useState<AsnFormState>({
    poNumber: '', invoiceNo: '', invoiceDate: '', invoiceRate: '',
    plQty: '', asnAppliedDate: new Date().toISOString().split('T')[0],
    location: 'MUMBAI', asnRemarks: '',
  })
  const [createSuccess, setCreateSuccess] = useState(false)

  const openCreate = () => {
    setSelectedPO(null)
    setOrderSearch('')
    setForm({ poNumber: '', invoiceNo: '', invoiceDate: '', invoiceRate: '', plQty: '', asnAppliedDate: new Date().toISOString().split('T')[0], location: 'MUMBAI', asnRemarks: '' })
    setCreateSuccess(false)
    setCreateOpen(true)
  }

  const selectOrder = (o: typeof ASN_ELIGIBLE_ORDERS[0]) => {
    setSelectedPO(o)
    setForm(f => ({ ...f, poNumber: o.poNumber, invoiceRate: String(o.poRate), location: o.location }))
  }

  // How many shipments already exist for a PO
  const shipmentsFor = (poNumber: string) => records.filter(r => r.poNumber === poNumber)

  // Remaining qty available to ship
  const shippedQty = (poNumber: string) => shipmentsFor(poNumber).reduce((s, r) => s + r.plQty, 0)

  const canSubmit = selectedPO && form.invoiceNo && form.invoiceDate && form.invoiceRate && form.plQty && parseInt(form.plQty) > 0

  const handleCreateASN = () => {
    if (!canSubmit || !selectedPO) return
    const existingShipments = shipmentsFor(selectedPO.poNumber).length
    const now = Date.now()
    const newRecord: AsnRecord = {
      id:                `FC-${now}`,
      styleCode:         selectedPO.styleCode,
      colour:            selectedPO.colour,
      asnApproval:       'PENDING',
      asnRemarks:        form.asnRemarks || undefined,
      poQty:             selectedPO.poQty,
      plQty:             parseInt(form.plQty),
      invoiceQty:        parseInt(form.plQty),
      poRate:            selectedPO.poRate,
      invoiceRate:       parseFloat(form.invoiceRate),
      invoiceValueSystem:  selectedPO.poRate * parseInt(form.plQty),
      invoiceValueVendor:  parseFloat(form.invoiceRate) * parseInt(form.plQty),
      asnAppliedDate:    form.asnAppliedDate,
      systemCheck:       'Pending',
      location:          form.location,
      poNumber:          form.poNumber,
      invoiceDate:       form.invoiceDate,
      invoiceNo:         form.invoiceNo,
      asnMonthWeek:      '', asnMonth: '',
      model:             selectedPO.model,
      sourcingPoc:       selectedPO.sourcingPoc,
      vendor:            selectedPO.vendor,
      registerEmail:     '',
      fabricateCode:     `FC-${now}`,
      asnCheckedBy:      '',
      shipmentNo:        existingShipments + 1,
    }
    setRecords(prev => [newRecord, ...prev])
    setCreateSuccess(true)
    setTimeout(() => { setCreateOpen(false); setCreateSuccess(false) }, 1600)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => {
      if (filterStatus !== 'all' && r.asnApproval !== filterStatus) return false
      if (q) {
        return (
          r.styleCode.toLowerCase().includes(q) ||
          r.vendor.toLowerCase().includes(q) ||
          r.poNumber.toLowerCase().includes(q) ||
          r.invoiceNo.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [filterStatus, search, records])

  const totalAll      = records.reduce((s, r) => s + r.invoiceQty, 0)
  const totalApproved = records.filter(r => r.asnApproval === 'APPROVED').reduce((s, r) => s + r.invoiceQty, 0)
  const totalHold     = records.filter(r => r.asnApproval === 'HOLD').reduce((s, r) => s + r.invoiceQty, 0)

  const approvedRecords = filtered.filter(r => r.asnApproval === 'APPROVED')
  const holdRecords     = filtered.filter(r => r.asnApproval === 'HOLD')
  const approvedValue   = approvedRecords.reduce((s, r) => s + r.invoiceValueSystem, 0)

  const fmt = (n: number) => n.toLocaleString('en-IN')

  const statusBadge = (s: AsnStatus) =>
    s === 'APPROVED'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />APPROVED</span>
      : s === 'HOLD'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />HOLD</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">PENDING</span>

  const sysCheckBadge = (c: 'Pass' | 'Fail' | 'Pending') =>
    c === 'Pass'
      ? <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Pass</span>
      : c === 'Fail'
      ? <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Fail</span>
      : <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500">Pending</span>

  const COLS = [
    'Style # / Colour',
    'Shipment',
    'ASN Approval',
    'ASN Remarks',
    'PO Qty',
    'PL Qty',
    'Inv Qty',
    'PO Rate',
    'Inv Rate',
    'Inv Val (Sys)',
    'Inv Val (Vend)',
    'ASN Date',
    'Sys Check',
    'Location',
    'PO Number',
    'Inv Date',
    'Invoice No.',
    'Month×Week',
    'ASN Month',
    'Model',
    'Sourcing POC',
    'Vendor',
    'Fabricate Code',
    'Checked By',
    'Comment Date',
    '',
  ]

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 min-h-0">
      {/* ── Left Sidebar ── */}
      <div className="hidden md:flex flex-col gap-2 w-60 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">ASN Approval</p>
          {(
            [
              { key: 'all',      label: 'All',      qty: totalAll,      dot: null },
              { key: 'APPROVED', label: 'APPROVED',  qty: totalApproved, dot: 'bg-green-500' },
              { key: 'HOLD',     label: 'HOLD',      qty: totalHold,     dot: 'bg-amber-500' },
            ] as const
          ).map(({ key, label, qty, dot }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors',
                filterStatus === key
                  ? 'bg-violet-600 text-white'
                  : 'hover:bg-slate-100 text-slate-700'
              )}
            >
              <span className="flex items-center gap-2">
                {dot && <span className={cn('w-2 h-2 rounded-full', dot)} />}
                {label}
              </span>
              <span className={cn(
                'text-xs font-semibold px-1.5 py-0.5 rounded',
                filterStatus === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              )}>{qty}</span>
            </button>
          ))}
        </div>

        {/* Summary strip */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Summary</p>
          <div>
            <p className="text-xs text-slate-500">Approved records</p>
            <p className="text-sm font-bold text-green-700">{approvedRecords.length} <span className="font-normal text-slate-500 text-xs">records</span></p>
            <p className="text-xs text-slate-600 mt-0.5">₹{fmt(approvedValue)} <span className="text-slate-400">inv value</span></p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Hold records</p>
            <p className="text-sm font-bold text-amber-700">{holdRecords.length} <span className="font-normal text-slate-500 text-xs">records</span></p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Mobile filter chips */}
        <div className="flex md:hidden gap-2 flex-wrap">
          {(['all', 'APPROVED', 'HOLD'] as const).map(k => (
            <button
              key={k}
              onClick={() => setFilterStatus(k)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                filterStatus === k
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >{k === 'all' ? 'All' : k}</button>
          ))}
        </div>

        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search style, vendor, PO, invoice…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          <span className="text-sm text-slate-500 shrink-0">{filtered.length} records</span>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors shrink-0">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Create ASN
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr>
                {COLS.map((c, i) => (
                  <th
                    key={i}
                    className={cn(
                      'px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide',
                      i === 0 && 'sticky left-0 bg-slate-50 z-20 min-w-[160px] shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]',
                      i >= 3 && i <= 9 && 'text-right',
                    )}
                  >{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => {
                const isExpanded = expandedRow === r.id
                const isHold     = r.asnApproval === 'HOLD'
                const plShort    = r.plQty < r.poQty
                const rateMismatch = r.invoiceRate !== r.poRate

                return (
                  <>
                    <tr
                      key={r.id}
                      className={cn(
                        'group hover:bg-slate-50 transition-colors cursor-pointer',
                        isHold && 'bg-amber-50/40',
                        isExpanded && 'bg-violet-50/30',
                      )}
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                    >
                      {/* Style # / Colour — sticky, explicit bg so it covers scrolled content */}
                      <td className={cn(
                        'sticky left-0 px-3 py-2.5 z-10 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]',
                        isHold ? 'bg-amber-50' : isExpanded ? 'bg-violet-50' : 'bg-white group-hover:bg-slate-50',
                      )}>
                        <div className="font-semibold text-slate-800">{r.styleCode}</div>
                        <div className="text-slate-400 text-[11px]">{r.colour}</div>
                      </td>
                      {/* Shipment # */}
                      <td className="px-3 py-2.5 text-center">
                        {r.shipmentNo
                          ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">{r.shipmentNo}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      {/* ASN Approval */}
                      <td className="px-3 py-2.5">{statusBadge(r.asnApproval)}</td>
                      {/* ASN Remarks */}
                      <td className="px-3 py-2.5 max-w-[160px]">
                        {r.asnRemarks
                          ? <span title={r.asnRemarks} className="text-slate-600 truncate block max-w-[150px]">{r.asnRemarks}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      {/* Qty columns */}
                      <td className="px-3 py-2.5 text-right text-slate-700">{fmt(r.poQty)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-medium', plShort ? 'text-amber-600' : 'text-slate-700')}>{fmt(r.plQty)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{fmt(r.invoiceQty)}</td>
                      {/* Rate columns */}
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{fmt(r.poRate)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-medium', rateMismatch ? 'text-red-600' : 'text-slate-700')}>₹{fmt(r.invoiceRate)}</td>
                      {/* Invoice value columns */}
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{fmt(r.invoiceValueSystem)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">₹{fmt(r.invoiceValueVendor)}</td>
                      {/* ASN Applied Date */}
                      <td className="px-3 py-2.5 text-slate-600">{r.asnAppliedDate}</td>
                      {/* System Check */}
                      <td className="px-3 py-2.5">{sysCheckBadge(r.systemCheck)}</td>
                      {/* Location */}
                      <td className="px-3 py-2.5 text-slate-600">{r.location}</td>
                      {/* PO Number */}
                      <td className="px-3 py-2.5 text-slate-700 font-medium">{r.poNumber}</td>
                      {/* Invoice Date */}
                      <td className="px-3 py-2.5 text-slate-600">{r.invoiceDate}</td>
                      {/* Invoice No */}
                      <td className="px-3 py-2.5 text-slate-700">{r.invoiceNo}</td>
                      {/* Month×Week */}
                      <td className="px-3 py-2.5 text-slate-600">{r.asnMonthWeek}</td>
                      {/* ASN Month */}
                      <td className="px-3 py-2.5 text-slate-600">{r.asnMonth}</td>
                      {/* Model */}
                      <td className="px-3 py-2.5 text-slate-600">{r.model}</td>
                      {/* Sourcing POC */}
                      <td className="px-3 py-2.5 text-slate-600">{r.sourcingPoc}</td>
                      {/* Vendor */}
                      <td className="px-3 py-2.5 text-slate-700 font-medium">{r.vendor}</td>
                      {/* Drishti Code */}
                      <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500 max-w-[140px]">
                        <span className="truncate block">{r.fabricateCode}</span>
                      </td>
                      {/* Checked By */}
                      <td className="px-3 py-2.5 text-slate-600">{r.asnCheckedBy}</td>
                      {/* Comment Date */}
                      <td className="px-3 py-2.5 text-slate-500">{r.asnCommentDate ?? '—'}</td>
                      {/* Expand chevron */}
                      <td className="px-3 py-2.5">
                        <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isExpanded && 'rotate-90')} />
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${r.id}-expanded`} className={cn(isHold ? 'bg-amber-50/60' : 'bg-violet-50/20')}>
                        <td colSpan={COLS.length} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-xs">
                            {[
                              ['Fabricate Code',        r.fabricateCode],
                              ['Style Code',          r.styleCode],
                              ['Colour',              r.colour],
                              ['Model',               r.model],
                              ['Vendor',              r.vendor],
                              ['Register Email',      r.registerEmail],
                              ['Sourcing POC',        r.sourcingPoc],
                              ['Location',            r.location],
                              ['PO Number',           r.poNumber],
                              ['Invoice No.',         r.invoiceNo],
                              ['Invoice Date',        r.invoiceDate],
                              ['ASN Applied Date',    r.asnAppliedDate],
                              ['ASN Month',           r.asnMonth],
                              ['ASN Month×Week',      r.asnMonthWeek],
                              ['ASN Checked By',      r.asnCheckedBy],
                              ['Comment Date',        r.asnCommentDate ?? '—'],
                              ['PO Qty',              fmt(r.poQty)],
                              ['PL Qty',              fmt(r.plQty)],
                              ['Invoice Qty',         fmt(r.invoiceQty)],
                              ['PO Rate',             `₹${fmt(r.poRate)}`],
                              ['Invoice Rate',        `₹${fmt(r.invoiceRate)}`],
                              ['Inv Value (System)',  `₹${fmt(r.invoiceValueSystem)}`],
                              ['Inv Value (Vendor)',  `₹${fmt(r.invoiceValueVendor)}`],
                              ['System Check',        r.systemCheck],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">{label}</p>
                                <p className="text-slate-700 font-semibold mt-0.5 break-all">{value}</p>
                              </div>
                            ))}
                            {r.asnRemarks && (
                              <div className="col-span-2 md:col-span-4">
                                <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">ASN Remarks</p>
                                <p className="text-amber-700 font-medium mt-0.5">{r.asnRemarks}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {/* Mobile summary strip */}
          <div className="flex gap-3 flex-wrap mb-2">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs">
              <span className="font-semibold text-green-700">{approvedRecords.length} Approved</span>
              <span className="text-slate-500 ml-1">· ₹{fmt(approvedValue)}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
              <span className="font-semibold text-amber-700">{holdRecords.length} Hold</span>
            </div>
          </div>

          {filtered.map(r => (
            <div
              key={r.id}
              className={cn(
                'rounded-xl border shadow-sm overflow-hidden bg-white',
                r.asnApproval === 'HOLD' ? 'border-amber-200' : 'border-slate-200'
              )}
            >
              <div className={cn('h-1', r.asnApproval === 'HOLD' ? 'bg-amber-400' : 'bg-green-400')} />
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{r.styleCode}</p>
                    <p className="text-xs text-slate-500">{r.colour}</p>
                  </div>
                  {statusBadge(r.asnApproval)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div><p className="text-slate-400">PO Qty</p><p className="font-semibold text-slate-700">{fmt(r.poQty)}</p></div>
                  <div><p className="text-slate-400">PL Qty</p><p className={cn('font-semibold', r.plQty < r.poQty ? 'text-amber-600' : 'text-slate-700')}>{fmt(r.plQty)}</p></div>
                  <div><p className="text-slate-400">Inv Qty</p><p className="font-semibold text-slate-700">{fmt(r.invoiceQty)}</p></div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{r.vendor}</span>
                  <span>{r.poNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-400">{r.asnAppliedDate}</span>
                  <span className="font-semibold text-slate-700">₹{fmt(r.invoiceValueSystem)}</span>
                </div>
                {r.asnRemarks && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{r.asnRemarks}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Create ASN Drawer ── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setCreateOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative ml-auto flex flex-col bg-white shadow-2xl w-full md:w-[500px] h-full rounded-l-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Success state */}
            {createSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-lg font-bold text-slate-900">ASN Created</p>
                <p className="text-sm text-slate-500 text-center">
                  Shipment {shipmentsFor(selectedPO?.poNumber ?? '').length} for {selectedPO?.styleCode} has been logged as PENDING.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Create ASN</p>
                    <p className="text-xs text-slate-500 mt-0.5">Select an order and fill shipment details</p>
                  </div>
                  <button onClick={() => setCreateOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* Step 1 — Select order */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      1 · Select Order
                    </p>
                    {selectedPO ? (
                      /* Selected order summary */
                      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-violet-900">{selectedPO.styleCode} · {selectedPO.colour}</p>
                            <p className="text-xs text-violet-600 mt-0.5">{selectedPO.poNumber} · {selectedPO.vendor}</p>
                          </div>
                          <button onClick={() => { setSelectedPO(null); setForm(f => ({ ...f, poNumber: '', invoiceRate: '', location: 'MUMBAI' })) }}
                            className="text-xs text-violet-500 underline hover:text-violet-700 flex-shrink-0">Change</button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3 text-xs text-center">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-slate-400 mb-0.5">PO Qty</p>
                            <p className="font-bold text-slate-800">{selectedPO.poQty.toLocaleString('en-IN')}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-slate-400 mb-0.5">Shipped</p>
                            <p className="font-bold text-amber-700">{shippedQty(selectedPO.poNumber).toLocaleString('en-IN')}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-slate-400 mb-0.5">Remaining</p>
                            <p className="font-bold text-green-700">{Math.max(0, selectedPO.poQty - shippedQty(selectedPO.poNumber)).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        {/* Existing shipments */}
                        {shipmentsFor(selectedPO.poNumber).length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide">Existing Shipments</p>
                            {shipmentsFor(selectedPO.poNumber).map((s, i) => (
                              <div key={s.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-1.5">
                                <span className="text-slate-500">Shipment {i + 1}</span>
                                <span className="font-medium text-slate-700">{s.plQty} pcs · {s.invoiceNo}</span>
                                <span className={cn('font-semibold', s.asnApproval === 'APPROVED' ? 'text-green-600' : s.asnApproval === 'HOLD' ? 'text-amber-600' : 'text-slate-400')}>
                                  {s.asnApproval}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-violet-500 mt-2 font-medium">
                          This will be Shipment {shipmentsFor(selectedPO.poNumber).length + 1}
                        </p>
                      </div>
                    ) : (
                      /* Order picker */
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="relative border-b border-slate-200">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="text" value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                            placeholder="Search style, PO number, vendor…"
                            className="w-full pl-9 pr-4 py-2.5 text-sm focus:outline-none text-slate-700 placeholder:text-slate-400"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {ASN_ELIGIBLE_ORDERS
                            .filter(o => {
                              const q = orderSearch.toLowerCase()
                              return !q || o.styleCode.toLowerCase().includes(q) || o.poNumber.toLowerCase().includes(q) || o.vendor.toLowerCase().includes(q)
                            })
                            .map(o => {
                              const shipped  = shippedQty(o.poNumber)
                              const remaining = Math.max(0, o.poQty - shipped)
                              const shipCount = shipmentsFor(o.poNumber).length
                              return (
                                <button key={o.poNumber} onClick={() => selectOrder(o)}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 text-left transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{o.styleCode} · {o.colour}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{o.poNumber} · {o.vendor}</p>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <p className="text-xs font-medium text-slate-700">{remaining} remaining</p>
                                    {shipCount > 0 && (
                                      <p className="text-[10px] text-violet-500">{shipCount} shipment{shipCount > 1 ? 's' : ''} done</p>
                                    )}
                                  </div>
                                </button>
                              )
                            })
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2 — Shipment details (only when order selected) */}
                  {selectedPO && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">2 · Shipment Details</p>

                      <div className="grid grid-cols-2 gap-3">
                        {/* PL Qty */}
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                            PL Qty <span className="font-normal text-slate-400">(Packing List quantity)</span>
                          </label>
                          <input type="number" min={1} max={selectedPO.poQty} value={form.plQty}
                            onChange={e => setForm(f => ({ ...f, plQty: e.target.value }))}
                            placeholder={`Max ${Math.max(0, selectedPO.poQty - shippedQty(selectedPO.poNumber))}`}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>

                        {/* Invoice No */}
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Invoice No.</label>
                          <input type="text" value={form.invoiceNo}
                            onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))}
                            placeholder="e.g. GST/25-26/448"
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>

                        {/* Invoice Date */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Invoice Date</label>
                          <input type="date" value={form.invoiceDate}
                            onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>

                        {/* ASN Applied Date */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1.5">ASN Applied Date</label>
                          <input type="date" value={form.asnAppliedDate}
                            onChange={e => setForm(f => ({ ...f, asnAppliedDate: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>

                        {/* Invoice Rate */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Invoice Rate (₹/pc)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                            <input type="number" min={0} step={0.5} value={form.invoiceRate}
                              onChange={e => setForm(f => ({ ...f, invoiceRate: e.target.value }))}
                              className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />
                          </div>
                          {form.invoiceRate && parseFloat(form.invoiceRate) !== selectedPO.poRate && (
                            <p className="text-xs text-amber-600 mt-1">
                              ⚠ Differs from PO rate ₹{selectedPO.poRate}
                            </p>
                          )}
                        </div>

                        {/* Location */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Location</label>
                          <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
                            {['MUMBAI', 'DELHI', 'BANGALORE', 'KOLKATA', 'JAIPUR', 'NOIDA', 'FARIDABAD'].map(l => (
                              <option key={l}>{l}</option>
                            ))}
                          </select>
                        </div>

                        {/* Remarks */}
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                            ASN Remarks <span className="font-normal text-slate-400">(optional)</span>
                          </label>
                          <textarea value={form.asnRemarks} onChange={e => setForm(f => ({ ...f, asnRemarks: e.target.value }))}
                            rows={2} placeholder="Any notes about this shipment…"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                          />
                        </div>
                      </div>

                      {/* Invoice value preview */}
                      {form.plQty && form.invoiceRate && (
                        <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Invoice Value</span>
                          <span className="font-bold text-slate-900 text-sm">
                            ₹{(parseInt(form.plQty) * parseFloat(form.invoiceRate)).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex gap-3">
                  <button onClick={() => setCreateOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleCreateASN} disabled={!canSubmit}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
                      canSubmit ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    )}>
                    <Send className="w-3.5 h-3.5" />
                    Submit ASN
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSPECTION VIEW
// ═══════════════════════════════════════════════════════════════════════════════

type FiStatus = 'not-scheduled' | 'scheduled' | 'pass' | 'fail' | 'partial-pass'

type FiRecord = {
  id: string
  styleCode: string
  styleName: string
  colour: string
  category: string
  vendor: string
  vendorLocation: string
  orderQty: number
  packedQty: number
  fiStatus: FiStatus
  scheduledDate?: string
  fiCompletedDate?: string
  fiQty?: number
  fiPassQty?: number
  majorDefects?: number
  minorDefects?: number
  inspector?: string
  fiNotes?: string
  inwardDate: string
  poNumber: string
  // FI Request form fields (filled when raising the inspection request)
  submissionType?: '1ST INSPECTION' | '2ND INSPECTION' | '3RD INSPECTION' | '4TH INSPECTION'
  vendorPlanDate?: string
  qaEmail?: string
  sourcingPocEmail?: string
  ppCommentsFileName?: string
  totalOrderQty?: number
  showSizeBreakup?: boolean
}

const FI_RECORDS: FiRecord[] = [
  {
    id: 'FI-001', styleCode: 'NN407-221', styleName: 'Girls Tiered Floral Dress',
    colour: 'PEACH', category: 'Wovens', vendor: 'ARIHANT FASHIONS', vendorLocation: 'KOLKATA',
    orderQty: 600, packedQty: 580, fiStatus: 'not-scheduled',
    inwardDate: '2026-06-25', poNumber: 'PPO-03011M',
  },
  {
    id: 'FI-002', styleCode: 'NN412-089', styleName: 'Boys Cargo Jogger',
    colour: 'OLIVE', category: 'Wovens', vendor: 'IDS FASHION', vendorLocation: 'NOIDA',
    orderQty: 450, packedQty: 420, fiStatus: 'not-scheduled',
    inwardDate: '2026-06-20', poNumber: 'PPO-03022M',
  },
  {
    id: 'FI-003', styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', category: 'Knits', vendor: 'BS FASHION', vendorLocation: 'KOLKATA',
    orderQty: 720, packedQty: 720, fiStatus: 'scheduled',
    scheduledDate: '2026-05-06', inspector: 'Rajesh Mehta',
    inwardDate: '2026-06-15', poNumber: 'PPO-03045M',
  },
  {
    id: 'FI-004', styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', category: 'Wovens', vendor: 'DIV CREATIONS', vendorLocation: 'FARIDABAD',
    orderQty: 380, packedQty: 380, fiStatus: 'scheduled',
    scheduledDate: '2026-05-08', inspector: 'Priya Sharma',
    inwardDate: '2026-06-20', poNumber: 'PPO-03078M',
  },
  {
    id: 'FI-005', styleCode: 'NN401-190', styleName: 'Girls Printed Balloon Dress',
    colour: 'CORAL', category: 'Knits', vendor: 'AND DESIGN', vendorLocation: 'JAIPUR',
    orderQty: 900, packedQty: 900, fiStatus: 'pass',
    scheduledDate: '2026-04-22', fiCompletedDate: '2026-04-22',
    fiQty: 900, fiPassQty: 900, majorDefects: 0, minorDefects: 3,
    inspector: 'Rajesh Mehta',
    fiNotes: 'Minor loose threads on 3 pcs — accepted within AQL. Cleared for dispatch.',
    inwardDate: '2026-06-12', poNumber: 'PPO-03134M',
  },
  {
    id: 'FI-006', styleCode: 'NN411-312', styleName: 'Boys Printed Bermuda Shorts',
    colour: 'COBALT', category: 'Wovens', vendor: 'PESOS VISION', vendorLocation: 'MUMBAI',
    orderQty: 650, packedQty: 650, fiStatus: 'pass',
    scheduledDate: '2026-04-18', fiCompletedDate: '2026-04-19',
    fiQty: 650, fiPassQty: 648, majorDefects: 0, minorDefects: 8,
    inspector: 'Priya Sharma',
    fiNotes: '2 pcs with slight colour variance — separated as B-grade.',
    inwardDate: '2026-06-01', poNumber: 'PPO-03099M',
  },
  {
    id: 'FI-007', styleCode: 'NN408-245', styleName: 'Girls Embroidered Sharara Set',
    colour: 'MAROON', category: 'Wovens', vendor: 'ARIHANT FASHIONS', vendorLocation: 'KOLKATA',
    orderQty: 280, packedQty: 280, fiStatus: 'partial-pass',
    scheduledDate: '2026-04-25', fiCompletedDate: '2026-04-25',
    fiQty: 280, fiPassQty: 230, majorDefects: 12, minorDefects: 22,
    inspector: 'Arun Kumar',
    fiNotes: 'Embroidery misalignment on 50 pcs. Balance 50 pcs held for rework — re-inspection to be scheduled.',
    inwardDate: '2026-06-25', poNumber: 'PPO-03112M',
  },
  {
    id: 'FI-008', styleCode: 'NN415-078', styleName: 'Boys French Terry Sweatshirt',
    colour: 'NAVY MELANGE', category: 'Knits', vendor: 'CAARVI TEXTILES', vendorLocation: 'DELHI',
    orderQty: 550, packedQty: 550, fiStatus: 'fail',
    scheduledDate: '2026-04-20', fiCompletedDate: '2026-04-20',
    fiQty: 550, fiPassQty: 0, majorDefects: 68, minorDefects: 102,
    inspector: 'Arun Kumar',
    fiNotes: 'Severe pilling on fabric surface — entire lot failed. Vendor to replace fabric and redo production. Re-FI mandatory.',
    inwardDate: '2026-07-05', poNumber: 'PPO-03099M',
  },
]

function FiStatusBadge({ status }: { status: FiStatus }) {
  const map: Record<FiStatus, { label: string; cls: string }> = {
    'not-scheduled': { label: 'Not Scheduled', cls: 'bg-slate-100 text-slate-600' },
    'scheduled':     { label: 'Scheduled',     cls: 'bg-violet-100 text-violet-700' },
    'pass':          { label: '✓ Pass',         cls: 'bg-green-100 text-green-700' },
    'partial-pass':  { label: 'Partial Pass',   cls: 'bg-amber-100 text-amber-700' },
    'fail':          { label: '✗ Failed',       cls: 'bg-red-100 text-red-700' },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', cls)}>
      {label}
    </span>
  )
}

function InspectionView() {
  const TODAY = new Date('2026-04-29')

  const [records, setRecords] = useState<FiRecord[]>(FI_RECORDS)
  const [filterStatus, setFilterStatus] = useState<FiStatus | 'all'>('all')
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [resultId, setResultId] = useState<string | null>(null)
  const [savedToast, setSavedToast] = useState<string | false>(false)

  // Schedule FI form state
  const [schedForm, setSchedForm] = useState({
    date: '', inspector: '', qty: '', notes: '',
    submissionType: '1ST INSPECTION' as FiRecord['submissionType'],
    vendorPlanDate: '',
    qaEmail: '',
    sourcingPocEmail: 'PARTHIPAN.KUMAR@TMRW.IN',
    ppCommentsFileName: '',
    totalOrderQty: '',
    showSizeBreakup: false,
  })
  const [ppFile, setPpFile] = useState<File | null>(null)
  // Submit Result form state
  const [resultForm, setResultForm] = useState({
    outcome: '' as '' | FiStatus,
    fiQty: '', fiPassQty: '', majorDefects: '', minorDefects: '', inspector: '', notes: '',
  })

  const schedulingRecord = useMemo(() => records.find(r => r.id === schedulingId) ?? null, [records, schedulingId])
  const resultRecord     = useMemo(() => records.find(r => r.id === resultId)     ?? null, [records, resultId])

  // Pre-fill result form when opening
  useEffect(() => {
    if (resultRecord) {
      setResultForm({
        outcome: '',
        fiQty: String(resultRecord.packedQty),
        fiPassQty: String(resultRecord.packedQty),
        majorDefects: '0',
        minorDefects: '0',
        inspector: resultRecord.inspector ?? '',
        notes: '',
      })
    }
  }, [resultRecord])

  // Pre-fill schedule form when opening
  useEffect(() => {
    if (schedulingRecord) {
      setSchedForm({
        date: '',
        inspector: '',
        qty: String(schedulingRecord.packedQty),
        notes: '',
        submissionType: schedulingRecord.submissionType ?? '1ST INSPECTION',
        vendorPlanDate: schedulingRecord.vendorPlanDate ?? '',
        qaEmail: schedulingRecord.qaEmail ?? '',
        sourcingPocEmail: schedulingRecord.sourcingPocEmail ?? 'PARTHIPAN.KUMAR@TMRW.IN',
        ppCommentsFileName: '',
        totalOrderQty: String(schedulingRecord.orderQty),
        showSizeBreakup: schedulingRecord.showSizeBreakup ?? false,
      })
      setPpFile(null)
    }
  }, [schedulingRecord])

  function showToast(msg: string) {
    setSavedToast(msg)
    setTimeout(() => setSavedToast(false), 3000)
  }

  function formatDate(iso?: string) {
    if (!iso) return 'Not set'
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  function daysLeft(iso: string) {
    const diff = Math.round((new Date(iso).getTime() - TODAY.getTime()) / 86400000)
    return diff
  }

  function daysLeftChip(iso: string) {
    const d = daysLeft(iso)
    if (d < 0)  return <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700">{Math.abs(d)}d late</span>
    if (d <= 14) return <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700">{d}d left</span>
    return <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500">{d}d left</span>
  }

  function defectRateColor(rate: number) {
    if (rate > 5) return 'text-red-600'
    if (rate >= 1) return 'text-amber-600'
    return 'text-green-600'
  }

  const filtered = useMemo(
    () => filterStatus === 'all' ? records : records.filter(r => r.fiStatus === filterStatus),
    [records, filterStatus]
  )

  // Summary counts
  const counts = useMemo(() => ({
    'not-scheduled': records.filter(r => r.fiStatus === 'not-scheduled').length,
    'scheduled':     records.filter(r => r.fiStatus === 'scheduled').length,
    'pass':          records.filter(r => r.fiStatus === 'pass').length,
    'partial-pass':  records.filter(r => r.fiStatus === 'partial-pass').length,
    'fail':          records.filter(r => r.fiStatus === 'fail').length,
  }), [records])

  const avgPassRate = useMemo(() => {
    const passed = records.filter(r => r.fiStatus === 'pass' && r.fiQty && r.fiPassQty)
    if (!passed.length) return 0
    const total = passed.reduce((s, r) => s + (r.fiPassQty! / r.fiQty!) * 100, 0)
    return Math.round(total / passed.length)
  }, [records])

  const nextScheduledDate = useMemo(() => {
    const scheduled = records.filter(r => r.fiStatus === 'scheduled' && r.scheduledDate)
      .sort((a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!))
    return scheduled[0]?.scheduledDate
  }, [records])

  function rowBg(status: FiStatus) {
    if (status === 'fail')         return 'bg-red-50/40'
    if (status === 'partial-pass') return 'bg-amber-50/30'
    if (status === 'pass')         return 'bg-green-50/20'
    if (status === 'scheduled')    return 'bg-violet-50/20'
    return ''
  }

  function handleScheduleSubmit() {
    if (!schedulingId || !schedForm.date) return
    setRecords(prev => prev.map(r =>
      r.id === schedulingId
        ? {
            ...r,
            fiStatus: 'scheduled',
            scheduledDate: schedForm.date,
            inspector: schedForm.inspector || r.inspector,
            fiNotes: schedForm.notes || r.fiNotes,
            submissionType: schedForm.submissionType,
            vendorPlanDate: schedForm.vendorPlanDate || r.vendorPlanDate,
            qaEmail: schedForm.qaEmail || r.qaEmail,
            sourcingPocEmail: schedForm.sourcingPocEmail || r.sourcingPocEmail,
            ppCommentsFileName: ppFile ? ppFile.name : r.ppCommentsFileName,
            totalOrderQty: schedForm.totalOrderQty ? parseInt(schedForm.totalOrderQty) : r.totalOrderQty,
            showSizeBreakup: schedForm.showSizeBreakup,
          }
        : r
    ))
    setSchedulingId(null)
    showToast('FI scheduled successfully')
  }

  function handleResultSubmit() {
    if (!resultId || !resultForm.outcome) return
    const fiQty = parseInt(resultForm.fiQty) || 0
    const fiPassQty = parseInt(resultForm.fiPassQty) || 0
    const majorDefects = parseInt(resultForm.majorDefects) || 0
    const minorDefects = parseInt(resultForm.minorDefects) || 0
    const today = TODAY.toISOString().split('T')[0]
    setRecords(prev => prev.map(r =>
      r.id === resultId
        ? {
            ...r,
            fiStatus: resultForm.outcome as FiStatus,
            fiQty, fiPassQty, majorDefects, minorDefects,
            fiCompletedDate: today,
            inspector: resultForm.inspector || r.inspector,
            fiNotes: resultForm.notes || r.fiNotes,
          }
        : r
    ))
    setResultId(null)
    showToast('Inspection result submitted')
  }

  const summaryCards = [
    {
      key: 'not-scheduled' as const,
      label: 'Not Scheduled',
      count: counts['not-scheduled'],
      sub: null,
      color: 'border-slate-200 bg-white',
      countColor: 'text-slate-700',
      dot: 'bg-slate-400',
    },
    {
      key: 'scheduled' as const,
      label: 'Scheduled',
      count: counts['scheduled'],
      sub: nextScheduledDate ? `Next: ${formatDate(nextScheduledDate)}` : null,
      color: 'border-violet-200 bg-violet-50',
      countColor: 'text-violet-700',
      dot: 'bg-violet-500',
    },
    {
      key: 'pass' as const,
      label: 'Passed',
      count: counts['pass'],
      sub: counts['pass'] ? `${avgPassRate}% avg pass rate` : null,
      color: 'border-green-200 bg-green-50',
      countColor: 'text-green-700',
      dot: 'bg-green-500',
    },
    {
      key: 'partial-pass' as const,
      label: 'Partial Pass',
      count: counts['partial-pass'],
      sub: null,
      color: 'border-amber-200 bg-amber-50',
      countColor: 'text-amber-700',
      dot: 'bg-amber-500',
    },
    {
      key: 'fail' as const,
      label: 'Failed',
      count: counts['fail'],
      sub: null,
      color: 'border-red-200 bg-red-50',
      countColor: 'text-red-700',
      dot: 'bg-red-500',
    },
  ]

  return (
    <div className="relative px-4 md:px-6 pb-8 pt-2">

      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {savedToast}
        </div>
      )}

      {/* Summary Cards */}
      <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-5 mb-5 no-scrollbar">
        {summaryCards.map(card => (
          <button
            key={card.key}
            onClick={() => setFilterStatus(prev => prev === card.key ? 'all' : card.key)}
            className={cn(
              'flex-shrink-0 w-44 md:w-auto rounded-xl border p-4 text-left transition-all',
              card.color,
              filterStatus === card.key ? 'ring-2 ring-offset-1 ring-slate-400' : 'hover:shadow-sm'
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className={cn('w-2 h-2 rounded-full', card.dot)} />
              <span className="text-xs font-semibold text-slate-500">{card.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', card.countColor)}>{card.count}</p>
            {card.sub && <p className="text-[11px] text-slate-500 mt-0.5">{card.sub}</p>}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Style', 'Colour · Category', 'Vendor', 'Ordered · Packed', 'FI Date', 'Status', 'Result', 'Defects', 'Inspector', 'Inward', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => {
                const defectRate = r.fiQty && (r.majorDefects !== undefined) && (r.minorDefects !== undefined)
                  ? ((r.majorDefects + r.minorDefects) / r.fiQty) * 100
                  : null
                return (
                  <tr key={r.id} className={cn('hover:bg-slate-50/60 transition-colors', rowBg(r.fiStatus))}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 text-xs">{r.styleCode}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight max-w-[160px]">{r.styleName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-700">{r.colour}</p>
                      <p className="text-[11px] text-slate-400">{r.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-700">{r.vendor}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />{r.vendorLocation}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-slate-600">{r.orderQty.toLocaleString('en-IN')}</p>
                      <p className={cn('text-xs font-semibold', r.packedQty < r.orderQty ? 'text-amber-600' : 'text-slate-700')}>
                        {r.packedQty.toLocaleString('en-IN')} packed
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {r.fiCompletedDate ? formatDate(r.fiCompletedDate) : r.scheduledDate ? formatDate(r.scheduledDate) : <span className="text-slate-400">Not set</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FiStatusBadge status={r.fiStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.fiQty !== undefined && r.fiPassQty !== undefined ? (
                        <p className={cn('text-xs font-semibold', r.fiPassQty === r.fiQty ? 'text-green-600' : r.fiPassQty === 0 ? 'text-red-600' : 'text-amber-600')}>
                          {r.fiPassQty} / {r.fiQty}
                        </p>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {defectRate !== null ? (
                        <div>
                          <p className={cn('text-xs font-semibold', defectRateColor(defectRate))}>{defectRate.toFixed(1)}%</p>
                          <p className="text-[10px] text-slate-400">{r.majorDefects} maj · {r.minorDefects} min</p>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-600">{r.inspector ?? <span className="text-slate-300">—</span>}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-slate-600">{formatDate(r.inwardDate)}</p>
                        {daysLeftChip(r.inwardDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.fiStatus === 'not-scheduled' && (
                        <button onClick={() => setSchedulingId(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 transition-colors whitespace-nowrap">
                          <Calendar className="w-3 h-3" />Schedule FI
                        </button>
                      )}
                      {r.fiStatus === 'scheduled' && (
                        <button onClick={() => setResultId(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 text-white text-[11px] font-semibold hover:bg-teal-700 transition-colors whitespace-nowrap">
                          <Check className="w-3 h-3" />Submit Result
                        </button>
                      )}
                      {r.fiStatus === 'pass' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-100 text-green-700 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />Cleared
                        </span>
                      )}
                      {r.fiStatus === 'partial-pass' && (
                        <button onClick={() => setSchedulingId(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 transition-colors whitespace-nowrap">
                          <RotateCcw className="w-3 h-3" />Re-inspect Balance
                        </button>
                      )}
                      {r.fiStatus === 'fail' && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-semibold">Failed</span>
                          <button onClick={() => setSchedulingId(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 transition-colors whitespace-nowrap">
                            <RotateCcw className="w-3 h-3" />Re-inspect
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(r => {
          const defectRate = r.fiQty && (r.majorDefects !== undefined) && (r.minorDefects !== undefined)
            ? ((r.majorDefects + r.minorDefects) / r.fiQty) * 100
            : null
          const barColor: Record<FiStatus, string> = {
            'not-scheduled': 'bg-slate-300',
            'scheduled':     'bg-violet-500',
            'pass':          'bg-green-500',
            'partial-pass':  'bg-amber-500',
            'fail':          'bg-red-500',
          }
          return (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className={cn('h-1', barColor[r.fiStatus])} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{r.styleCode}</p>
                    <p className="text-xs text-slate-500">{r.styleName}</p>
                  </div>
                  <FiStatusBadge status={r.fiStatus} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                  <div>
                    <span className="text-slate-400">Ordered: </span>
                    <span className="font-medium">{r.orderQty.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Packed: </span>
                    <span className={cn('font-medium', r.packedQty < r.orderQty ? 'text-amber-600' : '')}>
                      {r.packedQty.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {(r.scheduledDate || r.fiCompletedDate) && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{r.fiCompletedDate ? formatDate(r.fiCompletedDate) : formatDate(r.scheduledDate)}</span>
                    </div>
                  )}
                  {r.fiQty !== undefined && r.fiPassQty !== undefined && (
                    <div>
                      <span className="text-slate-400">Result: </span>
                      <span className={cn('font-semibold', r.fiPassQty === r.fiQty ? 'text-green-600' : r.fiPassQty === 0 ? 'text-red-600' : 'text-amber-600')}>
                        {r.fiPassQty} / {r.fiQty}
                      </span>
                    </div>
                  )}
                  {defectRate !== null && (
                    <div>
                      <span className="text-slate-400">Defect: </span>
                      <span className={cn('font-semibold', defectRateColor(defectRate))}>{defectRate.toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Inward: </span>
                    <span>{formatDate(r.inwardDate)}</span>
                    {daysLeftChip(r.inwardDate)}
                  </div>
                </div>
                <div>
                  {r.fiStatus === 'not-scheduled' && (
                    <button onClick={() => setSchedulingId(r.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">
                      <Calendar className="w-3.5 h-3.5" />Schedule FI
                    </button>
                  )}
                  {r.fiStatus === 'scheduled' && (
                    <button onClick={() => setResultId(r.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700">
                      <Check className="w-3.5 h-3.5" />Submit Result
                    </button>
                  )}
                  {r.fiStatus === 'pass' && (
                    <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />Cleared for Dispatch
                    </div>
                  )}
                  {r.fiStatus === 'partial-pass' && (
                    <button onClick={() => setSchedulingId(r.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600">
                      <RotateCcw className="w-3.5 h-3.5" />Re-inspect Balance
                    </button>
                  )}
                  {r.fiStatus === 'fail' && (
                    <button onClick={() => setSchedulingId(r.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                      <RotateCcw className="w-3.5 h-3.5" />Re-inspect
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Schedule FI Drawer */}
      {schedulingId && schedulingRecord && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSchedulingId(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative ml-auto flex flex-col bg-white shadow-2xl w-full md:w-[440px] h-full rounded-l-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">Schedule Final Inspection</p>
                <p className="text-xs text-slate-500 mt-0.5">{schedulingRecord.styleCode} · {schedulingRecord.colour}</p>
              </div>
              <button onClick={() => setSchedulingId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Style info */}
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                <p className="text-sm font-bold text-violet-900">{schedulingRecord.styleName}</p>
                <p className="text-xs text-violet-600 mt-0.5">{schedulingRecord.vendor} · {schedulingRecord.vendorLocation}</p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs">
                  <div>
                    <p className="text-slate-400">PO</p>
                    <p className="font-semibold text-slate-700">{schedulingRecord.poNumber}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Order Qty</p>
                    <p className="font-bold text-violet-700">{schedulingRecord.orderQty.toLocaleString('en-IN')} pcs</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Packed Qty</p>
                    <p className="font-bold text-violet-700">{schedulingRecord.packedQty.toLocaleString('en-IN')} pcs</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Inward</p>
                    <p className="font-semibold text-slate-700">{formatDate(schedulingRecord.inwardDate)}</p>
                  </div>
                </div>
              </div>

              {/* Section: Request Info */}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inspection Request</p>

              {/* Fabricate QR (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fabricate QR</label>
                <div className="w-full px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500 select-all">
                  {schedulingRecord.styleCode}-{schedulingRecord.colour.toUpperCase().replace(/\s+/g, '-')}
                </div>
              </div>

              {/* Submission Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Submission Type <span className="text-red-500">*</span></label>
                <select
                  value={schedForm.submissionType}
                  onChange={e => setSchedForm(f => ({ ...f, submissionType: e.target.value as typeof schedForm.submissionType }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                >
                  {(['1ST INSPECTION','2ND INSPECTION','3RD INSPECTION','4TH INSPECTION'] as const).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Inspection Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inspection Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={schedForm.date}
                  onChange={e => setSchedForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              {/* Vendor Plan Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vendor Plan Date</label>
                <input
                  type="date"
                  value={schedForm.vendorPlanDate}
                  onChange={e => setSchedForm(f => ({ ...f, vendorPlanDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
                <p className="text-[11px] text-slate-400 mt-1">Date vendor plans to be ready for inspection</p>
              </div>

              {/* Approved PPs Comments (PDF upload) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Approved PP Comments (PDF)</label>
                <label className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                  ppFile ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'
                )}>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null
                      setPpFile(file)
                      if (file) setSchedForm(f => ({ ...f, ppCommentsFileName: file.name }))
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {ppFile
                      ? <p className="text-xs font-medium text-violet-700 truncate">{ppFile.name}</p>
                      : <p className="text-xs text-slate-400">Click to upload PDF</p>
                    }
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium flex-shrink-0">PDF</span>
                </label>
              </div>

              {/* Section: Vendor Info */}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor Info</p>

              {/* Vendor UID (read-only / pre-filled) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vendor UID</label>
                <div className="w-full px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600 font-medium">
                  {schedulingRecord.vendor}
                </div>
              </div>

              {/* QA Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">QA Email</label>
                <input
                  type="email"
                  placeholder="qa@example.com"
                  value={schedForm.qaEmail}
                  onChange={e => setSchedForm(f => ({ ...f, qaEmail: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              {/* Sourcing POC Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sourcing POC Email</label>
                <input
                  type="email"
                  value={schedForm.sourcingPocEmail}
                  onChange={e => setSchedForm(f => ({ ...f, sourcingPocEmail: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              {/* Inspector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inspector Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Mehta"
                  value={schedForm.inspector}
                  onChange={e => setSchedForm(f => ({ ...f, inspector: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              {/* Section: Qty */}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity Details</p>

              {/* Size-wise toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Size-wise Qty Breakup</p>
                  <p className="text-[11px] text-slate-400">Show breakup by size</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSchedForm(f => ({ ...f, showSizeBreakup: !f.showSizeBreakup }))}
                  className={cn(
                    'relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0',
                    schedForm.showSizeBreakup ? 'bg-violet-600' : 'bg-slate-200'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    schedForm.showSizeBreakup ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </button>
              </div>

              {/* Total Order Qty with +/- stepper */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Total Order Qty</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSchedForm(f => ({ ...f, totalOrderQty: String(Math.max(0, parseInt(f.totalOrderQty || '0') - 1)) }))}
                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 text-lg font-medium flex-shrink-0"
                  >−</button>
                  <input
                    type="number"
                    value={schedForm.totalOrderQty}
                    onChange={e => setSchedForm(f => ({ ...f, totalOrderQty: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <button
                    type="button"
                    onClick={() => setSchedForm(f => ({ ...f, totalOrderQty: String(parseInt(f.totalOrderQty || '0') + 1) }))}
                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 text-lg font-medium flex-shrink-0"
                  >+</button>
                </div>
              </div>

              {/* Total PO Qty (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Total PO Qty</label>
                <div className="w-full px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600 font-medium">
                  {schedulingRecord.packedQty.toLocaleString('en-IN')} pcs
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Based on packed qty in system</p>
              </div>

              {/* Qty to Inspect */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Qty to Inspect</label>
                <input
                  type="number"
                  value={schedForm.qty}
                  onChange={e => setSchedForm(f => ({ ...f, qty: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              {/* Section: Attachments */}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attachments</p>

              {/* Image upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Images</label>
                <label className="flex flex-col items-center gap-2 px-3 py-5 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 cursor-pointer transition-colors">
                  <input type="file" accept="image/*" multiple className="hidden" />
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-base">📷</div>
                  <p className="text-xs text-slate-400">Click to upload product images</p>
                  <p className="text-[11px] text-slate-300">JPG, PNG, WEBP supported</p>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Any special instructions..."
                  value={schedForm.notes}
                  onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
              </div>
            </div>
            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
              <button
                onClick={handleScheduleSubmit}
                disabled={!schedForm.date}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
                  schedForm.date
                    ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                <CalendarCheck className="w-4 h-4" />
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Result Drawer */}
      {resultId && resultRecord && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setResultId(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative ml-auto flex flex-col bg-white shadow-2xl w-full md:w-[440px] h-full rounded-l-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">Submit Inspection Result</p>
                <p className="text-xs text-slate-500 mt-0.5">{resultRecord.styleCode} · {resultRecord.colour}</p>
              </div>
              <button onClick={() => setResultId(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Style info */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                <p className="text-sm font-bold text-teal-900">{resultRecord.styleName}</p>
                <p className="text-xs text-teal-600 mt-0.5">{resultRecord.vendor} · {resultRecord.vendorLocation}</p>
                {resultRecord.scheduledDate && (
                  <p className="text-xs text-teal-500 mt-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />Scheduled: {formatDate(resultRecord.scheduledDate)}
                  </p>
                )}
              </div>

              {/* Outcome selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Inspection Result <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: 'pass' as FiStatus,         label: 'Pass',         cls: 'border-green-300 bg-green-50 text-green-700', active: 'border-green-500 bg-green-100' },
                    { val: 'partial-pass' as FiStatus, label: 'Partial Pass', cls: 'border-amber-300 bg-amber-50 text-amber-700',  active: 'border-amber-500 bg-amber-100' },
                    { val: 'fail' as FiStatus,         label: 'Fail',         cls: 'border-red-300 bg-red-50 text-red-700',        active: 'border-red-500 bg-red-100' },
                  ]).map(opt => (
                    <button key={opt.val}
                      onClick={() => {
                        setResultForm(f => ({
                          ...f,
                          outcome: opt.val,
                          fiPassQty: opt.val === 'pass' ? f.fiQty : f.fiPassQty,
                        }))
                      }}
                      className={cn(
                        'py-3 rounded-xl border-2 text-xs font-bold transition-all',
                        resultForm.outcome === opt.val ? opt.active : opt.cls
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty Inspected */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Qty Inspected</label>
                  <input
                    type="number"
                    value={resultForm.fiQty}
                    onChange={e => setResultForm(f => ({ ...f, fiQty: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Qty Passed</label>
                  <input
                    type="number"
                    value={resultForm.fiPassQty}
                    onChange={e => setResultForm(f => ({ ...f, fiPassQty: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </div>

              {/* Defects */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Major Defects</label>
                  <input
                    type="number"
                    value={resultForm.majorDefects}
                    onChange={e => setResultForm(f => ({ ...f, majorDefects: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Minor Defects</label>
                  <input
                    type="number"
                    value={resultForm.minorDefects}
                    onChange={e => setResultForm(f => ({ ...f, minorDefects: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </div>

              {/* Inspector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inspector</label>
                <input
                  type="text"
                  value={resultForm.inspector}
                  onChange={e => setResultForm(f => ({ ...f, inspector: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Inspection observations..."
                  value={resultForm.notes}
                  onChange={e => setResultForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
                />
              </div>
            </div>
            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
              <button
                onClick={handleResultSubmit}
                disabled={!resultForm.outcome}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
                  resultForm.outcome
                    ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
                Submit Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function PortfolioContent() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'grid'

  const subtitles: Record<string, string> = {
    dashboard:         'Nautinati SS25',
    grid:              'Nautinati SS25',
    'vendor-assign':   'Assign vendors to new styles',
    costing:           'Cost submission & approval tracking',
    'pre-production':  'Sampling & pre-production approvals',
    production:        'Production quantity tracking',
    inspection:        'Final inspection requests & results',
    asn:               'Advance shipment notifications',
  }

  const tabTitle: Record<string, string> = {
    dashboard:         'Dashboard',
    grid:              'My Portfolio',
    'vendor-assign':   'Vendor Assignment',
    costing:           'Costing & PO',
    'pre-production':  'Pre-production',
    production:        'Production',
    inspection:        'Inspection',
    asn:               'ASN',
  }

  return (
    <>
      <Header title={tabTitle[tab] ?? 'My Portfolio'} subtitle={subtitles[tab] ?? ''} />
      {tab === 'vendor-assign'  ? <VendorAssignView />       :
       tab === 'costing'        ? <CostingView />             :
       tab === 'pre-production' ? <SamplingView />            :
       tab === 'production'     ? <StageView tabKey="production"  /> :
       tab === 'inspection'     ? <InspectionView />                 :
       tab === 'asn'            ? <AsnView />                          :
                                  <PortfolioGridView />}
    </>
  )
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={null}>
      <PortfolioContent />
    </Suspense>
  )
}
