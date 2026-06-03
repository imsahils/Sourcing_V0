'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, Info, X, Calendar, Clock,
  Edit3, BarChart3, Upload, Building2, MapPin, IndianRupee,
  TrendingUp, TrendingDown, Minus, Send, Package, Star,
  ChevronRight, AlertTriangle, RotateCcw, FileText, Menu,
  FlaskConical, Truck, ChevronDown, ChevronUp, CheckCheck,
} from 'lucide-react'
import type { SubOrder, SampleRecord, SampleType, VendorRFQ, VendorRFQStatus } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { subOrders, vendors } from '@/lib/data'
import { useCurrentUser } from '@/lib/user-context'
import { useSidebar } from '@/lib/sidebar-context'
import { cn } from '@/lib/utils'
import {
  type CostStatus,
  type VendorCostOrder,
  type OpenCostingBreakdown,
  deriveOpenCostingTotals,
  VENDOR_NAME_TO_KEY,
  VENDOR_COSTING_ORDERS,
  resolveVendorKey,
} from '@/lib/vendor-costing'
import { useCostingStore } from '@/lib/costing-store'

// ─── Shared helpers ────────────────────────────────────────────────────────────

function daysLeft(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d     = new Date(dateStr); d.setHours(0,0,0,0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function DaysChip({ dateStr, label }: { dateStr: string; label?: string }) {
  const diff = daysLeft(dateStr)
  const cls = diff < 0 ? 'text-red-600' : diff <= 3 ? 'text-amber-600' : 'text-green-700'
  return (
    <span className={cn('text-xs font-semibold', cls)}>
      {label && <span className="text-slate-400 font-normal mr-1">{label}</span>}
      {diff < 0 ? `${Math.abs(diff)}d overdue` : `${diff}d left`}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR VIEW  (when currentUser.role === 'vendor')
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Vendor Costing Modal (vendor submits their own prices) ───────────────────

// Open costing draft — string values for React controlled inputs
type OCDraft = {
  mainFabricPrice: string; mainFabricConsumption: string
  trimFabricPrice: string; trimFabricConsumption: string
  trimCostThread: string; cmp: string; valueAddition: string
  testing: string; logistic: string
  rejectionPct: string; marginPct: string
}

const EMPTY_OC_DRAFT: OCDraft = {
  mainFabricPrice: '', mainFabricConsumption: '',
  trimFabricPrice: '', trimFabricConsumption: '',
  trimCostThread: '', cmp: '', valueAddition: '',
  testing: '', logistic: '', rejectionPct: '', marginPct: '',
}

function draftFromBreakdown(b: OpenCostingBreakdown): OCDraft {
  return {
    mainFabricPrice:       String(b.mainFabricPrice),
    mainFabricConsumption: String(b.mainFabricConsumption),
    trimFabricPrice:       String(b.trimFabricPrice),
    trimFabricConsumption: String(b.trimFabricConsumption),
    trimCostThread:        String(b.trimCostThread),
    cmp:                   String(b.cmp),
    valueAddition:         String(b.valueAddition),
    testing:               String(b.testing),
    logistic:              String(b.logistic),
    rejectionPct:          String(b.rejectionPct),
    marginPct:             String(b.marginPct),
  }
}

function draftToBreakdown(d: OCDraft): OpenCostingBreakdown {
  const n = (v: string) => parseFloat(v) || 0
  return {
    mainFabricPrice: n(d.mainFabricPrice), mainFabricConsumption: n(d.mainFabricConsumption),
    trimFabricPrice: n(d.trimFabricPrice), trimFabricConsumption: n(d.trimFabricConsumption),
    trimCostThread: n(d.trimCostThread), cmp: n(d.cmp), valueAddition: n(d.valueAddition),
    testing: n(d.testing), logistic: n(d.logistic),
    rejectionPct: n(d.rejectionPct), marginPct: n(d.marginPct),
  }
}

function calcOCTotal(d: OCDraft): number {
  return deriveOpenCostingTotals(draftToBreakdown(d)).openCostingTotal
}

function OpenCostingFormFields({ draft, setDraft }: {
  draft: OCDraft
  setDraft: (d: OCDraft) => void
}) {
  const n = (v: string) => parseFloat(v) || 0
  const mainFabricCost = n(draft.mainFabricPrice) * n(draft.mainFabricConsumption)
  const trimFabricCost = n(draft.trimFabricPrice) * n(draft.trimFabricConsumption)
  const ttlFabric      = mainFabricCost + trimFabricCost
  const ttlProduct     = ttlFabric + n(draft.trimCostThread) + n(draft.cmp) + n(draft.valueAddition)
  const rejAmt         = ttlProduct * (n(draft.rejectionPct) / 100)
  const mrgAmt         = ttlProduct * (n(draft.marginPct) / 100)
  const set = (k: keyof OCDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [k]: e.target.value })

  return (
    <div className="space-y-4">
      {/* Fabric */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Fabric</p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Main Fabric Price (₹/m)</label>
              <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                <input type="number" value={draft.mainFabricPrice} onChange={set('mainFabricPrice')} placeholder="0"
                  className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Consumption (m)</label>
              <input type="number" value={draft.mainFabricConsumption} onChange={set('mainFabricConsumption')} placeholder="0.00"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-right min-w-[72px]">
              <p className="text-[9px] text-slate-400">Main Fabric</p>
              <p className="text-sm font-bold text-violet-700">₹{mainFabricCost.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Trim Fabric Price (₹/m)</label>
              <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                <input type="number" value={draft.trimFabricPrice} onChange={set('trimFabricPrice')} placeholder="0"
                  className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Consumption (m)</label>
              <input type="number" value={draft.trimFabricConsumption} onChange={set('trimFabricConsumption')} placeholder="0.00"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-right min-w-[72px]">
              <p className="text-[9px] text-slate-400">Trim Fabric</p>
              <p className="text-sm font-bold text-violet-700">₹{trimFabricCost.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <div className="bg-slate-800 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <span className="opacity-70">TTL Fabric Cost</span>
            <span className="font-bold">₹{ttlFabric.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Processing */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Processing</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { k: 'trimCostThread' as const, label: 'Trim + Thread', hint: 'buttons, labels, thread' },
            { k: 'cmp'            as const, label: 'CMP',           hint: 'cut, make, pack' },
            { k: 'valueAddition'  as const, label: 'Value Addition',hint: 'embroidery, print' },
          ]).map(({ k, label, hint }) => (
            <div key={k}>
              <label className="text-[10px] text-slate-400 block mb-1">{label} <span className="text-slate-300">({hint})</span></label>
              <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                <input type="number" value={draft[k]} onChange={set(k)} placeholder="0"
                  className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <div className="bg-slate-800 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <span className="opacity-70">TTL Product Cost</span>
            <span className="font-bold">₹{ttlProduct.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Overheads */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Overheads & Margins</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { k: 'testing'  as const, label: 'Testing (₹)',  suffix: '₹', isRs: true  },
            { k: 'logistic' as const, label: 'Logistic (₹)', suffix: '₹', isRs: true  },
            { k: 'rejectionPct' as const, label: 'Rejection %', suffix: '%', isRs: false },
            { k: 'marginPct'    as const, label: 'Margin %',    suffix: '%', isRs: false },
          ]).map(({ k, label, suffix, isRs }) => (
            <div key={k}>
              <label className="text-[10px] text-slate-400 block mb-1">{label}</label>
              <div className="relative">
                {isRs && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>}
                <input type="number" value={draft[k]} onChange={set(k)} placeholder="0"
                  className={cn('w-full text-xs border border-slate-200 rounded-lg py-2 focus:outline-none focus:ring-1 focus:ring-violet-400',
                    isRs ? 'pl-6 pr-2' : 'pl-3 pr-6')} />
                {!isRs && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>}
              </div>
              {!isRs && draft[k] && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  = ₹{(ttlProduct * (parseFloat(draft[k]) || 0) / 100).toFixed(2)}/pc
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function VendorCostModal({
  order,
  onClose,
  onSubmit,
}: {
  order: VendorCostOrder
  onClose: () => void
  onSubmit: (id: string, cost: number, bd: OpenCostingBreakdown, notes: string, promisedDate: string) => void
}) {
  const [draft, setDraft]               = useState<OCDraft>(order.breakdown ? draftFromBreakdown(order.breakdown) : EMPTY_OC_DRAFT)
  const [notes, setNotes]               = useState(order.notes || '')
  const [promisedDate, setPromisedDate] = useState(order.promisedInwardDate ?? '')
  const [submitted, setSubmit]          = useState(false)

  const total = calcOCTotal(draft)

  const handleSubmit = () => {
    if (total <= 0) return
    setSubmit(true)
    setTimeout(() => {
      onSubmit(order.id, total, draftToBreakdown(draft), notes, promisedDate)
      onClose()
    }, 1200)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-bold text-slate-900 text-lg">Quote Submitted!</p>
          <p className="text-sm text-slate-500 mt-1">
            Your costing for <strong>{order.styleCode}</strong> has been sent to {order.pocName}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Submit Your Quote</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.id} · {order.styleCode} · {order.colour}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Reference strip — target price NOT shown to vendor */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Order Qty</p>
              <p className="text-xl font-black text-slate-800">{order.orderQty.toLocaleString()}</p>
              <p className="text-xs text-slate-400">pieces</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Costing Due</p>
              <p className="text-sm font-bold text-slate-800">
                {new Date(order.costingDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
              <DaysChip dateStr={order.costingDueDate} />
            </div>
          </div>

          <div className="flex gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-xs text-violet-700">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Fill in your <strong className="mx-0.5">open costing</strong> — fabric, processing, and overhead details. Your total will be calculated automatically.
          </div>

          <OpenCostingFormFields draft={draft} setDraft={setDraft} />

          {/* Running total */}
          {total > 0 && (
            <div className={cn('rounded-xl px-4 py-3 flex items-center justify-between',
              'bg-slate-900 text-white'
            )}>
              <div>
                <p className="text-[10px] font-medium opacity-70">Your Total Quote / piece</p>
                <p className="text-xl font-black">₹{total.toFixed(0)}</p>
              </div>
            </div>
          )}

          {/* Promised inward date */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">
              Your Promised Inward Date
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Buyer's expected inward: <strong className="text-slate-600">
                {new Date(order.inwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </strong>
            </p>
            <input type="date" value={promisedDate} min={new Date().toISOString().split('T')[0]}
              onChange={e => setPromisedDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
            {promisedDate && (() => {
              const diff = Math.ceil((new Date(promisedDate).getTime() - new Date(order.inwardDate).getTime()) / 86400000)
              if (diff === 0) return <p className="text-xs text-green-600 font-medium mt-1.5">✓ Matches buyer inward date</p>
              if (diff < 0) return <p className="text-xs text-green-600 font-medium mt-1.5">✓ {Math.abs(diff)}d ahead of buyer inward date</p>
              return <p className="text-xs text-amber-600 font-medium mt-1.5">⚠ {diff}d after buyer inward date — buyer may request an earlier commitment</p>
            })()}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Justification / Remarks <span className="text-xs text-slate-400">(optional)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Explain any cost drivers — fabric quality, print complexity, low MOQ surcharge…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-slate-700 placeholder:text-slate-400" />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={total <= 0}
            className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
              total > 0 ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}>
            <Send className="w-3.5 h-3.5" /> Submit to Buyer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Production Update Modal ──────────────────────────────────────────────────

function ProdUpdateModal({ order, onClose }: { order: typeof subOrders[0]; onClose: () => void }) {
  const [cut, setCut]       = useState(String(order.cutQty))
  const [sewing, setSewing] = useState(String(order.sewingQty))
  const [packed, setPacked] = useState(String(order.packedQty))
  const [saved, setSaved]   = useState(false)

  if (saved) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-sm w-full">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <p className="font-bold text-slate-900 text-lg">Updated!</p>
          <p className="text-sm text-slate-500 mt-1">Production quantities saved. Your buyer has been notified.</p>
          <button onClick={onClose} className="mt-5 w-full py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Update Production</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.styleCode} · {order.colour}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-xs text-violet-700 flex gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Enter <strong className="mx-0.5">cumulative totals to date</strong> — not just today's output.
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{order.orderQty}</p>
            <p className="text-xs text-slate-500">Total order quantity</p>
          </div>
          {[
            { label: 'Cut (total to date)',    value: cut,    setValue: setCut,    ring: 'focus:ring-violet-500' },
            { label: 'Sewing (total to date)', value: sewing, setValue: setSewing, ring: 'focus:ring-purple-500' },
            { label: 'Packed (total to date)', value: packed, setValue: setPacked, ring: 'focus:ring-green-500' },
          ].map(({ label, value, setValue, ring }) => (
            <div key={label}>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">{label}</label>
              <input type="number" value={value} onChange={e => setValue(e.target.value)} min="0" max={order.orderQty}
                className={cn('w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2', ring)}
              />
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <button onClick={() => setSaved(true)} className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700">
            Save Update
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cost status badge ────────────────────────────────────────────────────────

function CostBadge({ status }: { status: CostStatus }) {
  const map: Record<CostStatus, { label: string; cls: string }> = {
    pending:   { label: 'Quote Pending',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    submitted: { label: 'Submitted',         cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    approved:  { label: 'Approved',          cls: 'bg-green-50 text-green-700 border-green-200' },
    escalated: { label: 'Under Review',      cls: 'bg-red-50 text-red-700 border-red-200' },
  }
  const { label, cls } = map[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cls)}>{label}</span>
}

// ─── Sample Dispatch Modal ────────────────────────────────────────────────────

type DispatchDraft = {
  sampleType:  SampleType
  qty:         string
  dispatchDate: string
  courier:     string
  trackingNo:  string
  sentTo:      string
  notes:       string
}

function SampleDispatchModal({
  order,
  onClose,
  onSubmit,
}: {
  order: SubOrder
  onClose: () => void
  onSubmit: (orderId: string, sample: Omit<SampleRecord, 'id'>) => void
}) {
  // Pre-fill sentTo from next pending pre-prod stage approver if possible
  const nextPending = order.preProdStages.find(s => s.status === 'pending' || s.status === 'not-started')
  const defaultSentTo = nextPending?.approverRole ?? ''

  const [draft, setDraft] = useState<DispatchDraft>({
    sampleType:   'Fit Sample',
    qty:          '3',
    dispatchDate: new Date().toISOString().split('T')[0],
    courier:      '',
    trackingNo:   '',
    sentTo:       defaultSentTo,
    notes:        '',
  })
  const [submitted, setSubmitted] = useState(false)

  const sampleTypes: SampleType[] = ['Proto', 'Fit Sample', 'Size Set', 'PP Sample', 'Sealer', 'TOP']
  const couriers = ['DTDC', 'FedEx', 'Blue Dart', 'Delhivery', 'Ecom Express', 'Other']

  function handleSubmit() {
    if (!draft.courier || !draft.qty) return
    setSubmitted(true)
    setTimeout(() => {
      onSubmit(order.id, {
        type:         draft.sampleType,
        round:        (order.samples?.filter(s => s.type === draft.sampleType).length ?? 0) + 1,
        dispatchDate: draft.dispatchDate,
        sentTo:       draft.sentTo,
        courier:      draft.courier,
        trackingNo:   draft.trackingNo || undefined,
        qty:          parseInt(draft.qty) || 1,
        status:       'dispatched',
        comments:     draft.notes || '',
      })
      onClose()
    }, 1000)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-bold text-slate-900 text-lg">Sample Dispatched!</p>
          <p className="text-sm text-slate-500 mt-1">
            {draft.sampleType} for <strong>{order.styleCode}</strong> marked as dispatched via {draft.courier}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Mark Sample Dispatched</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.id} · {order.styleCode} · {order.colour}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Sample type */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Sample Type</label>
            <div className="flex flex-wrap gap-2">
              {sampleTypes.map(t => (
                <button key={t} onClick={() => setDraft(p => ({ ...p, sampleType: t }))}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    draft.sampleType === t
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dispatch date + qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Dispatch Date</label>
              <input type="date" value={draft.dispatchDate}
                onChange={e => setDraft(p => ({ ...p, dispatchDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">No. of Pieces</label>
              <input type="number" min="1" value={draft.qty}
                onChange={e => setDraft(p => ({ ...p, qty: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center font-bold"
              />
            </div>
          </div>

          {/* Sent to */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Sent To</label>
            <input type="text" value={draft.sentTo} placeholder="e.g. Priya M (Designer)"
              onChange={e => setDraft(p => ({ ...p, sentTo: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Courier */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Courier <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mb-2">
              {couriers.map(c => (
                <button key={c} onClick={() => setDraft(p => ({ ...p, courier: c }))}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    draft.courier === c
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Tracking number */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Tracking / Docket Number <span className="text-slate-400">(optional)</span></label>
            <input type="text" value={draft.trackingNo} placeholder="e.g. DTDC-1234567"
              onChange={e => setDraft(p => ({ ...p, trackingNo: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Notes <span className="text-slate-400">(optional)</span></label>
            <textarea rows={2} value={draft.notes} placeholder="Any notes for the reviewer…"
              onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!draft.courier || !draft.qty}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
              draft.courier && draft.qty
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}>
            <Truck className="w-3.5 h-3.5" /> Confirm Dispatch
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vendor View ──────────────────────────────────────────────────────────────

// ─── RFQ Response Modal (vendor submits quote or declines) ────────────────────

function RFQResponseModal({
  rfq,
  onClose,
  onSubmit,
  onDecline,
}: {
  rfq: VendorRFQ
  onClose: () => void
  onSubmit: (id: string, price: number, date: string, leadTime: number, capacity: number, notes: string) => void
  onDecline: (id: string, reason: string) => void
}) {
  const [mode, setMode]         = useState<'respond' | 'decline'>('respond')
  const [draft, setDraft]       = useState<OCDraft>(EMPTY_OC_DRAFT)
  const [date, setDate]         = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [capacity, setCapacity] = useState(String(rfq.orderQty))
  const [notes, setNotes]       = useState('')
  const [reason, setReason]     = useState('')
  const [done, setDone]         = useState(false)

  const total = calcOCTotal(draft)

  const handleSubmit = () => {
    if (total <= 0 || !date || !capacity) return
    setDone(true)
    setTimeout(() => onSubmit(rfq.id, total, date, Number(leadTime) || 0, Number(capacity), notes), 1200)
  }

  const handleDecline = () => {
    setDone(true)
    setTimeout(() => onDecline(rfq.id, reason), 1200)
  }

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-sm w-full">
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3', mode === 'respond' ? 'bg-green-100' : 'bg-slate-100')}>
            {mode === 'respond'
              ? <CheckCircle2 className="w-6 h-6 text-green-600" />
              : <X className="w-6 h-6 text-slate-500" />}
          </div>
          <p className="font-semibold text-slate-900 text-lg">{mode === 'respond' ? 'Quote Submitted!' : 'RFQ Declined'}</p>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'respond' ? 'The sourcing team will review your quote.' : 'The sourcing team has been notified.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900">Respond to RFQ</h3>
            <p className="text-xs text-slate-500 mt-0.5">{rfq.styleCode} · {rfq.styleName} · {rfq.colour}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Style brief — target price NOT shown to vendor */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Order Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                ['Style Code', rfq.styleCode],
                ['Colour', rfq.colour],
                ['Category', rfq.category],
                ['Fabric', rfq.fabricQuality],
                ['Order Qty', `${rfq.orderQty} pcs`],
                ['Handover Date', new Date(rfq.handoverDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
                ['Expires', new Date(rfq.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-slate-400">{l}</p>
                  <p className="text-sm font-medium text-slate-800">{v}</p>
                </div>
              ))}
            </div>
            {rfq.techPackUrl && (
              <a href={rfq.techPackUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 text-xs text-violet-600 hover:underline font-medium">
                <FileText className="w-3.5 h-3.5" />View Tech Pack
              </a>
            )}
            {rfq.notes && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-400 mb-1">Notes from Sourcing</p>
                <p className="text-xs text-slate-700">{rfq.notes}</p>
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setMode('respond')} className={cn('flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
              mode === 'respond' ? 'bg-violet-600 text-white border-violet-600' : 'text-slate-600 border-slate-200 hover:border-violet-300')}>
              Submit Quote
            </button>
            <button onClick={() => setMode('decline')} className={cn('flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
              mode === 'decline' ? 'bg-red-500 text-white border-red-500' : 'text-slate-600 border-slate-200 hover:border-red-200 hover:text-red-500')}>
              Decline
            </button>
          </div>

          {mode === 'respond' ? (
            <div className="space-y-4">
              <div className="flex gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-xs text-violet-700">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Fill in your <strong className="mx-0.5">open costing</strong> below. Your total quote will be calculated automatically.
              </div>

              <OpenCostingFormFields draft={draft} setDraft={setDraft} />

              {/* Total */}
              {total > 0 && (
                <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium opacity-70">Your Total Quote / piece</p>
                    <p className="text-xl font-black">₹{total.toFixed(0)}</p>
                  </div>
                </div>
              )}

              {/* Capacity + Date + Lead Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Capacity (pcs) *</label>
                  <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  {capacity && Number(capacity) < rfq.orderQty && (
                    <p className="text-xs text-amber-600 mt-1">⚠ {rfq.orderQty - Number(capacity)} pcs short — order may be split</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Lead Time (days)</label>
                  <input type="number" value={leadTime} onChange={e => setLeadTime(e.target.value)} placeholder="e.g. 60"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Promised Delivery Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Notes (optional)</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any conditions or clarifications..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Reason for declining (optional)</label>
              <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Factory at full capacity until end of June..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          {mode === 'respond' ? (
            <button onClick={handleSubmit} disabled={total <= 0 || !date || !capacity}
              className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />Submit Quote
            </button>
          ) : (
            <button onClick={handleDecline}
              className="px-5 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-1.5">
              Decline RFQ
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── RFQ Inbox (vendor-facing) ────────────────────────────────────────────────

function RFQInbox({ vendorId, companyName }: { vendorId: string; companyName: string }) {
  // Collect all RFQs sent to this vendor from across all sub-orders
  const allRFQs = subOrders.flatMap(s =>
    (s.vendorRFQs ?? []).filter(r =>
      r.vendor.id === vendorId || r.vendor.name.toLowerCase() === companyName.toLowerCase()
    ).map(r => ({ ...r, subOrderStyleName: s.styleName, subOrderSeason: s.season }))
  )

  // For demo: show all RFQs from NNKNTW250021 if no vendor match
  const rfqsToShow = allRFQs.length > 0 ? allRFQs
    : subOrders.flatMap(s => (s.vendorRFQs ?? []).map(r => ({ ...r, subOrderStyleName: s.styleName, subOrderSeason: s.season })))

  const [rfqs, setRfqs]     = useState(rfqsToShow)
  const [activeRFQ, setActiveRFQ] = useState<VendorRFQ | null>(null)

  const open     = rfqs.filter(r => r.status === 'sent')
  const responded = rfqs.filter(r => r.status === 'responded')
  const closed   = rfqs.filter(r => ['declined','accepted','rejected','expired','revoked'].includes(r.status))

  const handleSubmit = (id: string, price: number, date: string, leadTime: number, capacity: number, notes: string) => {
    setRfqs(prev => prev.map(r => r.id !== id ? r : {
      ...r, status: 'responded' as VendorRFQStatus, quotedPrice: price,
      vendorPromisedDate: date, leadTimeDays: leadTime, capacityQty: capacity,
      respondedAt: new Date().toISOString(),
    }))
    setActiveRFQ(null)
  }

  const handleDecline = (id: string, reason: string) => {
    setRfqs(prev => prev.map(r => r.id !== id ? r : {
      ...r, status: 'declined' as VendorRFQStatus, declineReason: reason, respondedAt: new Date().toISOString(),
    }))
    setActiveRFQ(null)
  }

  const statusStyles: Partial<Record<VendorRFQStatus, string>> = {
    sent:      'bg-blue-50 text-blue-700 border-blue-200',
    responded: 'bg-violet-50 text-violet-700 border-violet-200',
    declined:  'bg-red-50 text-red-600 border-red-200',
    accepted:  'bg-green-50 text-green-700 border-green-200',
    rejected:  'bg-slate-100 text-slate-500 border-slate-200',
    expired:   'bg-slate-100 text-slate-500 border-slate-200',
    revoked:   'bg-orange-50 text-orange-600 border-orange-200',
  }
  const statusLabels: Partial<Record<VendorRFQStatus, string>> = {
    sent: 'Awaiting Response', responded: 'Quote Submitted', declined: 'Declined',
    accepted: 'Order Confirmed', rejected: 'Not Selected', expired: 'Expired', revoked: 'Revoked',
  }

  return (
    <div>
      {activeRFQ && (
        <RFQResponseModal
          rfq={activeRFQ}
          onClose={() => setActiveRFQ(null)}
          onSubmit={handleSubmit}
          onDecline={handleDecline}
        />
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Awaiting Response', value: open.length,      color: 'blue'   },
          { label: 'Quotes Submitted',  value: responded.length, color: 'violet' },
          { label: 'Closed',            value: closed.length,    color: 'slate'  },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn('rounded-xl border p-4',
            color === 'blue' ? 'bg-blue-50 border-blue-200' :
            color === 'violet' ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'
          )}>
            <p className={cn('text-2xl font-black',
              color === 'blue' ? 'text-blue-700' :
              color === 'violet' ? 'text-violet-700' : 'text-slate-600'
            )}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* RFQ list */}
      {rfqs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <Send className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No RFQs received yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rfqs.map(rfq => (
            <div key={rfq.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-slate-900 text-sm">{rfq.styleName}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', statusStyles[rfq.status])}>
                        {statusLabels[rfq.status] ?? rfq.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{rfq.styleCode} · {rfq.colour} · {rfq.category}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span><span className="font-medium text-slate-700">{rfq.orderQty}</span> pcs</span>
                      <span>Target <span className="font-medium text-slate-700">₹{rfq.targetPrice}/pc</span></span>
                      <span>Handover <span className="font-medium text-slate-700">{new Date(rfq.handoverDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
                    </div>
                  </div>
                  {rfq.status === 'sent' && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-slate-400 mb-1">
                        Expires {new Date(rfq.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                      <button
                        onClick={() => setActiveRFQ(rfq)}
                        className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors"
                      >
                        Respond
                      </button>
                    </div>
                  )}
                </div>

                {/* Submitted quote summary */}
                {rfq.status === 'responded' && rfq.quotedPrice !== undefined && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Your Quote</p>
                      <p className="text-sm font-semibold text-violet-700">₹{rfq.quotedPrice}/pc</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Promised Date</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {rfq.vendorPromisedDate ? new Date(rfq.vendorPromisedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Capacity</p>
                      <p className="text-sm font-semibold text-slate-800">{rfq.capacityQty} pcs</p>
                    </div>
                  </div>
                )}

                {rfq.status === 'accepted' && (
                  <div className="mt-3 pt-3 border-t border-green-100 flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs font-medium">Order confirmed — you will receive further instructions from the sourcing team.</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── My Confirmed Orders (vendor-facing) ─────────────────────────────────────

function MyConfirmedOrders({ vendorId, companyName }: { vendorId: string; companyName: string }) {
  const myOrders = subOrders.filter(s =>
    s.vendor.id === vendorId || s.vendor.name.toLowerCase() === companyName.toLowerCase()
  )

  const stageLabel: Record<string, string> = {
    vendor: 'Vendor', costing: 'Costing', 'pre-prod': 'Pre-Production',
    production: 'Production', fi: 'Final Inspection', asn: 'ASN', grn: 'GRN',
  }

  if (myOrders.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 text-center">
        <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No confirmed orders yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {myOrders.map(order => (
        <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-bold text-slate-900 text-sm">{order.styleName}</p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium',
                  order.currentStage === 'production' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                  order.currentStage === 'costing'    ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  order.currentStage === 'pre-prod'   ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                )}>
                  {stageLabel[order.currentStage] ?? order.currentStage}
                </span>
              </div>
              <p className="text-xs text-slate-500">{order.id} · {order.styleCode} · {order.colour} · {order.season}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-400">Handover</p>
              <p className="text-sm font-semibold text-slate-800">
                {new Date(order.handoverDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{order.orderQty}</p>
              <p className="text-xs text-slate-400">Order Qty</p>
            </div>
            <div>
              <p className="text-lg font-bold text-violet-700">{order.cutQty}</p>
              <p className="text-xs text-slate-400">Cut</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{order.packedQty}</p>
              <p className="text-xs text-slate-400">Packed</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function VendorView() {
  const { currentUser } = useCurrentUser()
  const { toggle: toggleSidebar } = useSidebar()
  const vendorId    = currentUser.vendorId ?? ''
  const companyName = currentUser.department
  const vendorKey   = resolveVendorKey(vendorId, companyName)

  // Pull from shared costing store
  const { orders: allOrders, rfqs: storeRFQs, vendorSubmitRFQ } = useCostingStore()
  const storeVendorOrders = allOrders.filter(o => o.vendorId === vendorKey || o.vendorId === vendorId)

  // Costing orders assigned to this vendor — derive from store or fall back to mock
  const [costOrders, setCostOrders] = useState<VendorCostOrder[]>(() => {
    if (storeVendorOrders.length > 0) {
      return storeVendorOrders.map(o => ({
        id: o.id,
        styleCode: o.styleCode,
        styleName: o.styleName,
        colour: o.colour,
        category: o.category,
        orderQty: o.orderQty,
        targetPrice: o.targetPrice,
        costStatus: o.costStatus as VendorCostOrder['costStatus'],
        inwardDate: o.buyingExpectedDate,
        costingDueDate: o.vendorTargetDate,
        submittedCost: o.submittedCost,
        breakdown: o.breakdown,
        notes: o.notes,
        pocName: 'Parthipan Kumar',
        promisedInwardDate: o.confirmedInwardDate,
      }))
    }
    return VENDOR_COSTING_ORDERS[vendorKey] ?? []
  })
  const [costModal, setCostModal]   = useState<string | null>(null)

  // All orders for this vendor
  const myOrders = subOrders.filter(s =>
    s.vendor.id === vendorId || s.vendor.name.toLowerCase() === companyName.toLowerCase()
  )

  // Production orders (production / fi stage)
  const prodOrders = myOrders.filter(s =>
    s.currentStage === 'production' || s.currentStage === 'fi'
  )

  // Pre-production orders
  const preProdOrders = myOrders.filter(s => s.currentStage === 'pre-prod')

  const searchParams = useSearchParams()
  const viewParam    = (searchParams.get('view') as 'rfq' | 'pre-prod' | 'my-orders' | null)
  const vendorTab: 'rfq' | 'pre-prod' | 'my-orders' = viewParam ?? 'rfq'
  const [prodModal,       setProdModal]       = useState<string | null>(null)
  const [dispatchModal,   setDispatchModal]   = useState<string | null>(null)
  const [expandedPreProd, setExpandedPreProd] = useState<Set<string>>(new Set(preProdOrders.map(o => o.id)))
  const [preProdSamples,  setPreProdSamples]  = useState<Record<string, SampleRecord[]>>(
    () => Object.fromEntries(myOrders.map(o => [o.id, o.samples ?? []]))
  )
  const [toast, setToast] = useState<string | null>(null)

  function togglePreProd(id: string) {
    setExpandedPreProd(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleSampleDispatched(orderId: string, sample: Omit<SampleRecord, 'id'>) {
    const newSample: SampleRecord = { id: `s-${Date.now()}`, ...sample }
    setPreProdSamples(prev => ({ ...prev, [orderId]: [...(prev[orderId] ?? []), newSample] }))
    setToast(`${sample.type} dispatched via ${sample.courier} ✓`)
    setTimeout(() => setToast(null), 3500)
  }

  const pendingQuote = costOrders.filter(o => o.costStatus === 'pending').length
  const submitted    = costOrders.filter(o => o.costStatus === 'submitted').length
  const approved     = costOrders.filter(o => o.costStatus === 'approved').length

  const handleSubmitCost = (id: string, cost: number, bd: NonNullable<VendorCostOrder['breakdown']>, notes: string, promisedDate: string) => {
    // Find matching RFQ in the store and update it
    const matchingRFQ = storeRFQs.find(r => r.orderId === id && r.status !== 'cancelled')
    if (matchingRFQ) {
      vendorSubmitRFQ(matchingRFQ.id, cost, bd, notes, promisedDate)
    }
    // Also update local state for immediate UI feedback
    setCostOrders(prev => prev.map(o => o.id !== id ? o : {
      ...o, submittedCost: cost, breakdown: bd, notes, costStatus: 'submitted',
      promisedInwardDate: promisedDate || undefined,
    }))
    setToast('Quote submitted — buyer will review within 24 hours')
    setTimeout(() => setToast(null), 3500)
  }

  const costModalOrder  = costModal  ? costOrders.find(o => o.id === costModal)           : null
  const prodModalOrder  = prodModal  ? prodOrders.find(o => o.id === prodModal)            : null

  return (
    <>
      {/* Vendor top bar */}
      <div className="fixed top-0 left-0 md:left-60 right-0 z-20 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-3 shadow-sm">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-600 flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
            {currentUser.initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{companyName}</p>
            <p className="text-xs text-slate-500">Pre-Production · Nautinati AW 26</p>
          </div>
        </div>
        {preProdOrders.some(o => o.preProdStages.some(s => s.status === 'overdue')) && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full flex-shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-700">Stages overdue</span>
          </div>
        )}
      </div>

      <div className="pt-16 px-4 md:px-6 pb-10">
        {vendorTab === 'rfq' && <RFQInbox vendorId={vendorId} companyName={companyName} />}
        {vendorTab === 'my-orders' && <MyConfirmedOrders vendorId={vendorId} companyName={companyName} />}

        {vendorTab === 'pre-prod' && <>
        {/* ── Pre-prod summary strip ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'In Pre-Prod',      value: preProdOrders.length,                                                                         color: 'purple', icon: FlaskConical  },
            { label: 'Stages Pending',   value: preProdOrders.reduce((s, o) => s + o.preProdStages.filter(p => p.status === 'pending' || p.status === 'overdue').length, 0), color: 'amber',  icon: AlertCircle  },
            { label: 'Samples Sent',     value: Object.values(preProdSamples).flat().length,                                                   color: 'blue',   icon: Truck        },
          ].map(({ label, value, color, icon: Icon }) => {
            const bg   = { purple: 'bg-purple-50 border-purple-200', amber: 'bg-amber-50 border-amber-200', blue: 'bg-violet-50 border-violet-200' }[color]
            const txt  = { purple: 'text-purple-700', amber: 'text-amber-700', blue: 'text-violet-700' }[color]
            const iclr = { purple: 'text-purple-500', amber: 'text-amber-500', blue: 'text-violet-500' }[color]
            return (
              <div key={label} className={cn('rounded-xl border p-4', bg)}>
                <Icon className={cn('w-4 h-4 mb-2', iclr)} />
                <p className={cn('text-2xl font-black', txt)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            )
          })}
        </div>

        {/* ── Costing section — removed, lives at /reports?view=costing ── */}
        {false && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-800">Orders Awaiting Your Quote</h2>
            {pendingQuote > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{pendingQuote} pending</span>
            )}
          </div>

          {costOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No costing orders assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {costOrders.map(order => {
                const isOverdue = daysLeft(order.costingDueDate) < 0
                return (
                  <div key={order.id} className={cn(
                    'bg-white rounded-2xl border shadow-sm overflow-hidden',
                    order.costStatus === 'pending' && isOverdue ? 'border-red-200' :
                    order.costStatus === 'pending' ? 'border-amber-200' :
                    order.costStatus === 'approved' ? 'border-green-200' : 'border-slate-200'
                  )}>
                    {/* Status bar */}
                    <div className={cn('h-1',
                      order.costStatus === 'pending' && isOverdue ? 'bg-red-500' :
                      order.costStatus === 'pending' ? 'bg-amber-400' :
                      order.costStatus === 'approved' ? 'bg-green-500' :
                      order.costStatus === 'submitted' ? 'bg-violet-500' : 'bg-slate-300'
                    )} />

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-mono text-xs text-slate-400">{order.id}</p>
                            <CostBadge status={order.costStatus} />
                          </div>
                          <p className="text-base font-bold text-slate-900 leading-tight">{order.styleCode}</p>
                          <p className="text-sm text-slate-500 mt-0.5">{order.styleName}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{order.colour}</span>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{order.category}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-400 mb-0.5">Costing due</p>
                          <p className="text-sm font-semibold text-slate-800">
                            {new Date(order.costingDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                          <DaysChip dateStr={order.costingDueDate} />
                        </div>
                      </div>

                      {/* Key numbers */}
                      <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-50 rounded-xl p-3 text-center">
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Order Qty</p>
                          <p className="text-base font-bold text-slate-800">{order.orderQty.toLocaleString()} pcs</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Your Quote</p>
                          <p className={cn('text-base font-bold',
                            order.costStatus === 'approved'  ? 'text-green-700' :
                            order.costStatus === 'escalated' ? 'text-red-500 line-through' :
                            order.costStatus === 'submitted' ? 'text-violet-700' : 'text-slate-400'
                          )}>
                            {order.submittedCost ? `₹${order.submittedCost} / pc` : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Submitted breakdown preview */}
                      {order.breakdown && (() => {
                        const t = deriveOpenCostingTotals(order.breakdown)
                        return (
                          <div className="mb-3 bg-violet-50 rounded-xl px-3 py-2.5">
                            <p className="text-xs font-semibold text-violet-700 mb-1.5">Your submitted breakdown</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {[
                                { label: 'TTL Fabric',    val: t.ttlFabricCost },
                                { label: 'CMP',           val: order.breakdown.cmp },
                                { label: 'Trim + Thread', val: order.breakdown.trimCostThread },
                                { label: 'Value Addition',val: order.breakdown.valueAddition },
                                { label: 'Testing',       val: order.breakdown.testing },
                                { label: 'Logistic',      val: order.breakdown.logistic },
                                { label: `Rejection ${order.breakdown.rejectionPct}%`, val: t.rejectionAmt },
                                { label: `Margin ${order.breakdown.marginPct}%`,       val: t.marginAmt },
                              ].map(({ label, val }) => val > 0 && (
                                <div key={label} className="flex justify-between text-xs">
                                  <span className="text-violet-600">{label}</span>
                                  <span className="font-medium text-violet-800">₹{val.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {order.notes && (
                        <p className="text-xs text-slate-500 italic mb-3">"{order.notes}"</p>
                      )}

                      {/* Inward date context */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 border-t border-slate-100 pt-3 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Buyer inward: <strong className="text-slate-700 ml-1">
                            {new Date(order.inwardDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                          </strong>
                        </span>
                        {order.promisedInwardDate && (() => {
                          const diff = Math.ceil((new Date(order.promisedInwardDate).getTime() - new Date(order.inwardDate).getTime()) / 86400000)
                          return (
                            <span className={cn('flex items-center gap-1 font-medium', diff > 0 ? 'text-amber-600' : 'text-green-600')}>
                              · Your commit: <strong className="ml-1">
                                {new Date(order.promisedInwardDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                              </strong>
                              <span className="ml-1">({diff > 0 ? `+${diff}d` : diff === 0 ? 'on time' : `${Math.abs(diff)}d early`})</span>
                            </span>
                          )
                        })()}
                        <span className="text-slate-400">·</span>
                        <span>POC: <strong className="text-slate-700">{order.pocName}</strong></span>
                      </div>

                      {/* Action */}
                      {order.costStatus === 'pending' && (
                        <button onClick={() => setCostModal(order.id)}
                          className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                          <IndianRupee className="w-4 h-4" /> Submit Your Quote
                        </button>
                      )}
                      {order.costStatus === 'submitted' && (
                        <div className="flex gap-2">
                          <div className="flex-1 py-2.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-sm font-medium text-center">
                            Awaiting buyer review
                          </div>
                          <button onClick={() => setCostModal(order.id)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Revise
                          </button>
                        </div>
                      )}
                      {order.costStatus === 'approved' && (
                        <div className="py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium text-center flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Quote Approved — proceed to production
                        </div>
                      )}
                      {order.costStatus === 'escalated' && (
                        <div className="space-y-2">
                          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">Your quote is above target by more than 5% — it has been escalated for review. You may revise and resubmit.</p>
                          </div>
                          <button onClick={() => setCostModal(order.id)}
                            className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 flex items-center justify-center gap-2">
                            <RotateCcw className="w-4 h-4" /> Revise & Resubmit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        )} {/* end false costing block */}

        {/* ── Pre-Production section ── */}
        {preProdOrders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FlaskConical className="w-4 h-4 text-purple-500" />
              <h2 className="text-sm font-bold text-slate-800">Pre-Production Activities</h2>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{preProdOrders.length}</span>
            </div>

            <div className="space-y-3">
              {preProdOrders.map(order => {
                const isExpanded   = expandedPreProd.has(order.id)
                const samples      = preProdSamples[order.id] ?? []
                const pendingStages = order.preProdStages.filter(s => s.status === 'pending' || s.status === 'overdue').length
                const doneStages   = order.preProdStages.filter(s => s.status === 'approved').length
                const totalStages  = order.preProdStages.length

                const stageColor = (status: string) => ({
                  'approved':    'bg-green-500',
                  'pending':     'bg-amber-400',
                  'overdue':     'bg-red-500',
                  'not-started': 'bg-slate-200',
                  'rejected':    'bg-red-500',
                })[status] ?? 'bg-slate-200'

                const stageBadge = (status: string) => ({
                  'approved':    'bg-green-50 text-green-700 border-green-200',
                  'pending':     'bg-amber-50 text-amber-700 border-amber-200',
                  'overdue':     'bg-red-50 text-red-700 border-red-200',
                  'not-started': 'bg-slate-50 text-slate-500 border-slate-200',
                  'rejected':    'bg-red-50 text-red-700 border-red-200',
                })[status] ?? 'bg-slate-50 text-slate-500 border-slate-200'

                const sampleStatusBadge = (s: SampleRecord) => {
                  const map: Record<string, string> = {
                    dispatched:         'bg-blue-50 text-blue-700',
                    received:           'bg-violet-50 text-violet-700',
                    'under-review':     'bg-amber-50 text-amber-700',
                    approved:           'bg-green-50 text-green-700',
                    rejected:           'bg-red-50 text-red-700',
                    'revision-requested': 'bg-orange-50 text-orange-700',
                  }
                  return map[s.status] ?? 'bg-slate-50 text-slate-500'
                }

                const fmtD = (d: string) =>
                  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

                return (
                  <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="h-1 bg-purple-500" />

                    <div className="p-4">
                      {/* ── Order header ── */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-slate-400">{order.id}</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Pre-Prod</span>
                            {pendingStages > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{pendingStages} pending</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-900">{order.styleCode} · {order.styleName}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{order.colour}</span>
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{order.category}</span>
                            <span className="text-slate-400">· Inward: {fmtD(order.buyingExpectedInwardDate)}</span>
                          </div>
                        </div>

                        {/* Stage progress pill + expand */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Stages</p>
                            <p className="text-sm font-bold text-slate-700">{doneStages}/{totalStages}</p>
                          </div>
                          <button onClick={() => togglePreProd(order.id)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 transition-colors">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Stage progress bar */}
                      <div className="mt-3 flex items-center gap-1">
                        {order.preProdStages.map(s => (
                          <div key={s.id} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                            <div className={cn('h-full rounded-full', stageColor(s.status))} style={{ width: '100%' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Expanded detail ── */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 px-4 pb-4">

                        {/* Pre-prod stages checklist */}
                        <div className="pt-4 mb-4">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Stage Checklist</p>
                          <div className="space-y-2">
                            {order.preProdStages.map((stage, idx) => (
                              <div key={stage.id} className="flex items-start gap-3">
                                {/* Step number / tick */}
                                <div className={cn(
                                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5',
                                  stage.status === 'approved' ? 'bg-green-500 text-white' :
                                  stage.status === 'overdue'  ? 'bg-red-500 text-white' :
                                  stage.status === 'pending'  ? 'bg-amber-400 text-white' :
                                  'bg-slate-200 text-slate-500'
                                )}>
                                  {stage.status === 'approved' ? '✓' : idx + 1}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={cn('text-xs font-semibold',
                                      stage.status === 'approved' ? 'text-slate-500 line-through' : 'text-slate-800'
                                    )}>
                                      {stage.name}
                                    </p>
                                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium capitalize', stageBadge(stage.status))}>
                                      {stage.status.replace('-', ' ')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                    <span>Due: {fmtD(stage.plannedDate)}</span>
                                    {stage.actualDate && <span className="text-green-600">Done: {fmtD(stage.actualDate)}</span>}
                                    {stage.approvedBy && <span>By: {stage.approvedBy}</span>}
                                    {!stage.approvedBy && stage.approverRole && <span>Reviewer: {stage.approverRole}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sample log */}
                        <div className="border-t border-slate-100 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sample Log</p>
                            <button
                              onClick={() => setDispatchModal(order.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              <Truck className="w-3 h-3" /> Mark Dispatched
                            </button>
                          </div>

                          {samples.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">No samples dispatched yet</p>
                          ) : (
                            <div className="space-y-2">
                              {[...samples].reverse().map(s => (
                                <div key={s.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-bold text-slate-800">{s.type} <span className="text-slate-400 font-normal">· Round {s.round}</span></p>
                                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', sampleStatusBadge(s))}>
                                        {s.status.replace('-', ' ')}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                                      <span>Dispatched: <strong>{fmtD(s.dispatchDate)}</strong></span>
                                      <span>Qty: <strong>{s.qty} pcs</strong></span>
                                      {s.courier && <span>Via: <strong>{s.courier}</strong></span>}
                                      {s.trackingNo && <span className="font-mono text-slate-600">{s.trackingNo}</span>}
                                    </div>
                                    {s.sentTo && <p className="text-xs text-slate-400 mt-0.5">To: {s.sentTo}</p>}
                                    {s.comments && <p className="text-xs text-slate-500 italic mt-1">"{s.comments}"</p>}
                                    {s.revisionNotes && (
                                      <div className="mt-1.5 flex gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">
                                        <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-orange-700">{s.revisionNotes}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {preProdOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 text-center">
            <FlaskConical className="w-10 h-10 text-purple-200 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No orders in pre-production at the moment</p>
            <p className="text-xs text-slate-400 mt-1">Orders will appear here once they move into the pre-production stage</p>
          </div>
        )}
        </>}
      </div>

      {costModalOrder && (
        <VendorCostModal order={costModalOrder} onClose={() => setCostModal(null)} onSubmit={handleSubmitCost} />
      )}
      {prodModalOrder && (
        <ProdUpdateModal order={prodModalOrder} onClose={() => setProdModal(null)} />
      )}
      {dispatchModal && (() => {
        const dispatchOrder = myOrders.find(o => o.id === dispatchModal)
        return dispatchOrder ? (
          <SampleDispatchModal
            order={dispatchOrder}
            onClose={() => setDispatchModal(null)}
            onSubmit={handleSampleDispatched}
          />
        ) : null
      })()}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL VIEW  (sourcing-poc / sourcing-mgr / warehouse-ops)
// ═══════════════════════════════════════════════════════════════════════════════

function InternalVendorView() {
  const [filterVendor, setFilterVendor] = useState('all')
  const [activeModal, setActiveModal]   = useState<string | null>(null)
  const [costModal, setCostModal]       = useState<string | null>(null)

  const vendorStats = vendors.map(v => {
    const orders   = subOrders.filter(o => o.vendor.id === v.id)
    const active   = orders.filter(o => o.status !== 'completed')
    const costing  = orders.filter(o => o.costStatus === 'pending' || o.costStatus === 'submitted')
    const overdue  = orders.filter(o => o.status === 'overdue')
    return { vendor: v, orders, active, costing, overdue }
  }).filter(s => s.orders.length > 0)

  const displayed = filterVendor === 'all'
    ? vendorStats
    : vendorStats.filter(s => s.vendor.id === filterVendor)

  const totalActive  = subOrders.filter(o => o.status !== 'completed').length
  const totalCosting = subOrders.filter(o => o.costStatus === 'pending').length
  const totalOverdue = subOrders.filter(o => o.status === 'overdue').length

  const otifColor = (score?: number) =>
    !score ? 'text-slate-400' : score >= 75 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <>
      <Header title="Vendor Portal" subtitle={`${vendors.length} active vendors · Nautinati SS25`} />
      <div className="px-6 py-6">

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Orders',      value: totalActive,  color: 'bg-violet-50 border-violet-200',   text: 'text-violet-700'  },
            { label: 'Pending Costing',    value: totalCosting, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
            { label: 'Overdue',            value: totalOverdue, color: 'bg-red-50 border-red-200',     text: 'text-red-700'   },
            { label: 'Total Vendors',      value: vendors.length, color: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
          ].map(({ label, value, color, text }) => (
            <div key={label} className={cn('rounded-xl border p-4', color)}>
              <p className={cn('text-2xl font-black', text)}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-5">
          <label className="text-xs font-medium text-slate-500">Filter by vendor:</label>
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="all">All vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-slate-400">{displayed.length} vendor{displayed.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Vendor cards */}
        <div className="space-y-4">
          {displayed.map(({ vendor: v, orders, active, costing, overdue }) => (
            <div key={v.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Vendor header */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {v.name.slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{v.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{v.location}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-center">
                  {v.otifScore && (
                    <div>
                      <p className={cn('text-base font-black', otifColor(v.otifScore))}>{v.otifScore}%</p>
                      <p className="text-xs text-slate-400">OTIF</p>
                    </div>
                  )}
                  {v.fiPassRate && (
                    <div>
                      <p className="text-base font-black text-slate-700">{v.fiPassRate}%</p>
                      <p className="text-xs text-slate-400">FI Pass</p>
                    </div>
                  )}
                  <div>
                    <p className="text-base font-black text-slate-700">{orders.length}</p>
                    <p className="text-xs text-slate-400">Orders</p>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                {[
                  { label: 'Active',         value: active.length,  color: active.length > 0 ? 'text-violet-600' : 'text-slate-400'  },
                  { label: 'Pending Costing',value: costing.length, color: costing.length > 0 ? 'text-amber-600' : 'text-slate-400' },
                  { label: 'Overdue',        value: overdue.length, color: overdue.length > 0 ? 'text-red-600' : 'text-slate-400'   },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-4 py-3 text-center">
                    <p className={cn('text-lg font-bold', color)}>{value}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Orders mini-table */}
              {orders.length > 0 && (
                <div className="border-t border-slate-100">
                  {orders.map((order, i) => {
                    const costStatusCls: Record<string, string> = {
                      pending:   'bg-amber-50 text-amber-600',
                      submitted: 'bg-violet-50 text-violet-600',
                      approved:  'bg-green-50 text-green-600',
                      escalated: 'bg-red-50 text-red-600',
                    }
                    return (
                      <div key={order.id} className={cn(
                        'flex items-center gap-4 px-5 py-3 text-xs',
                        i < orders.length - 1 && 'border-b border-slate-50',
                        order.status === 'overdue' ? 'bg-red-50/30' : 'hover:bg-slate-50'
                      )}>
                        <span className="font-mono text-slate-400 w-28 flex-shrink-0">{order.id}</span>
                        <span className="text-slate-700 font-medium w-24 flex-shrink-0">{order.styleCode}</span>
                        <span className="text-slate-500 flex-1 truncate">{order.colour}</span>
                        <span className={cn('px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0',
                          order.currentStage === 'production' ? 'bg-violet-50 text-violet-600' :
                          order.currentStage === 'costing'    ? 'bg-amber-50 text-amber-600' :
                          'bg-slate-100 text-slate-500'
                        )}>
                          {order.currentStage.replace('-',' ')}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full font-medium flex-shrink-0', costStatusCls[order.costStatus])}>
                          ₹ {order.costStatus}
                        </span>
                        <span className={cn('flex-shrink-0 font-semibold',
                          order.status === 'overdue' ? 'text-red-600' : order.status === 'needs-attention' ? 'text-amber-600' : 'text-green-600'
                        )}>
                          {order.status.replace('-',' ')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — role-aware
// ═══════════════════════════════════════════════════════════════════════════════

export default function VendorPortalPage() {
  const { currentUser } = useCurrentUser()
  return currentUser.role === 'vendor' ? <VendorView /> : <InternalVendorView />
}
