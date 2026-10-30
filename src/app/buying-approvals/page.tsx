'use client'
import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import {
  CheckCircle2, XCircle, AlertCircle, RotateCcw, MessageSquare, ShieldCheck,
  TrendingUp, TrendingDown, Shirt, Search, ChevronDown, ChevronRight, X, Check, Info,
  Eye, EyeOff,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { useCostingStore, type CostingOrder, type CostingEvent, type CostingEventType } from '@/lib/costing-store'
import { useCurrentUser } from '@/lib/user-context'
import { deriveOpenCostingTotals } from '@/lib/vendor-costing'
import { cn } from '@/lib/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

function quotedCost(o: CostingOrder): number {
  if (typeof o.submittedCost === 'number') return o.submittedCost
  if (o.breakdown) return deriveOpenCostingTotals(o.breakdown).openCostingTotal
  return 0
}

function variancePct(o: CostingOrder): number | null {
  const q = quotedCost(o)
  if (!q || !o.targetPrice) return null
  return Math.round(((q - o.targetPrice) / o.targetPrice) * 1000) / 10
}

type BuyingBucket = 'pending' | 'approved' | 'revision' | 'rejected'
function bucketOf(o: CostingOrder): BuyingBucket {
  if (o.buyingStatus === 'approved') return 'approved'
  if (o.buyingStatus === 'revision') return 'revision'
  if (o.buyingStatus === 'rejected') return 'rejected'
  return 'pending'
}

function varianceBand(o: CostingOrder): string {
  const v = variancePct(o)
  if (v === null) return '—'
  if (v < 0) return 'Under target'
  if (v <= 5) return '0–5% over'
  return 'Above 5%'
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// The costing round in play right now (1-based).
function roundOf(o: CostingOrder): number {
  return o.round ?? (o.history?.length ? Math.max(...o.history.map(h => h.round)) : 1)
}

// Full audit trail — use the stored history, else synthesise one from the fields.
function timeline(o: CostingOrder): CostingEvent[] {
  if (o.history?.length) return o.history
  const ev: CostingEvent[] = []
  if (o.submittedOn) ev.push({ round: 1, type: 'submitted', by: o.vendor || 'Vendor', role: 'Vendor', date: o.submittedOn, cost: quotedCost(o), breakdown: o.breakdown })
  if (o.approvedOn) ev.push({ round: 1, type: 'sourcing-approved', by: o.approvedBy || 'Sourcing', role: o.approverRole || 'Sourcing POC', date: o.approvedOn })
  if (o.buyingDecisionOn) {
    const type: CostingEventType = o.buyingStatus === 'approved' ? 'buying-approved' : o.buyingStatus === 'rejected' ? 'rejected' : 'revision-requested'
    ev.push({ round: roundOf(o), type, by: o.buyingDecisionBy || 'Buying', role: 'Buying POC', date: o.buyingDecisionOn, comment: o.buyingFeedback })
  }
  return ev
}

const EVENT_META: Record<CostingEventType, { label: string; dot: string; text: string }> = {
  submitted:            { label: 'Costing submitted',   dot: 'bg-slate-400',  text: 'text-slate-600' },
  resubmitted:          { label: 'Revised quote',       dot: 'bg-blue-500',   text: 'text-blue-700' },
  'sourcing-approved':  { label: 'Sourcing approved',   dot: 'bg-green-500',  text: 'text-green-700' },
  'buying-approved':    { label: 'Buying approved',     dot: 'bg-green-600',  text: 'text-green-700' },
  'revision-requested': { label: 'Revision requested',  dot: 'bg-amber-500',  text: 'text-amber-700' },
  rejected:             { label: 'Rejected',            dot: 'bg-red-500',    text: 'text-red-700' },
}

// Map a colour name to a swatch hex for the product thumbnail.
const COLOUR_HEX: Record<string, string> = {
  black: '#1e293b', white: '#e2e8f0', navy: '#1e3a5f', 'navy melange': '#334155',
  blue: '#3b82f6', 'sky blue': '#7dd3fc', cobalt: '#1d4ed8', teal: '#14b8a6',
  'teal print': '#0d9488', red: '#dc2626', maroon: '#7f1d1d', burgundy: '#831843',
  coral: '#fb7185', peach: '#fdba74', yellow: '#facc15', olive: '#65783e',
  lavender: '#c4b5fd', multi: '#a855f7', green: '#16a34a', pink: '#ec4899',
}
function colourHex(colour: string): string {
  return COLOUR_HEX[colour.trim().toLowerCase()] ?? '#94a3b8'
}
function isLight(hex: string): boolean {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 165
}

function Thumb({ order, size = 40 }: { order: CostingOrder; size?: number }) {
  const hex = colourHex(order.colour)
  const light = isLight(hex)
  return (
    <div
      className="rounded-lg flex items-center justify-center flex-shrink-0 border border-black/5"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${hex}, ${hex}cc)` }}
      title={order.colour}
    >
      <Shirt className="w-1/2 h-1/2" style={{ color: light ? '#475569' : '#ffffff', opacity: 0.85 }} strokeWidth={1.6} />
    </div>
  )
}

// Open-costing component columns — hidden by default, revealed by the toggle.
const COST_HEADS = ['Main Fab', 'Trim Fab', 'Trims+Thr', 'CMP', 'Val Add', 'Testing', 'Logi', 'Rej', 'Margin']
function costCellsOf(b?: CostingOrder['breakdown']): (number | null)[] {
  if (!b) return COST_HEADS.map(() => null)
  const t = deriveOpenCostingTotals(b)
  return [t.mainFabricCost, t.trimFabricCost, b.trimCostThread, b.cmp, b.valueAddition, b.testing, b.logistic, t.rejectionAmt, t.marginAmt]
}
const costCells = (o: CostingOrder) => costCellsOf(o.breakdown)

const BUCKET_BADGE: Record<BuyingBucket, { label: string; cls: string }> = {
  pending:  { label: 'Awaiting', cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  approved: { label: 'Approved', cls: 'bg-green-50 text-green-700 border border-green-200' },
  revision: { label: 'Revision', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border border-red-200' },
}

// ─── Facet dropdown (order-grid style) ───────────────────────────────────────

function Facet({
  label, value, options, onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
          value ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
      >
        {value || label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto">
          <button onClick={() => { onChange(''); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">All {label}</button>
          {options.map(opt => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false) }}
              className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between',
                value === opt ? 'text-violet-700 font-semibold' : 'text-slate-700')}>
              {opt}
              {value === opt && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Comment modal (single or bulk; approve / revise / reject) ───────────────

type Action = 'approve' | 'revision' | 'reject'
const ACTION_META: Record<Action, { verb: string; cta: string; color: 'green' | 'amber' | 'red'; need: boolean }> = {
  approve:  { verb: 'Approve',  cta: 'Approve Costing',       color: 'green', need: false },
  revision: { verb: 'Revise',   cta: 'Send Back for Revision', color: 'amber', need: true },
  reject:   { verb: 'Reject',   cta: 'Reject Costing',        color: 'red',   need: true },
}

function CommentModal({
  action, count, onClose, onSubmit,
}: {
  action: Action
  count: number
  onClose: () => void
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const meta = ACTION_META[action]
  const canSubmit = !meta.need || note.trim().length > 0
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-sm">
            {meta.verb} costing · {count} {count === 1 ? 'item' : 'items'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {action === 'revision' && (
            <p className="text-[11px] text-amber-700 flex gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Sends {count === 1 ? 'this costing' : 'these costings'} back to Sourcing for a revised quote.
            </p>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">
              {action === 'approve' ? 'Remarks (optional)' : action === 'revision' ? 'What should be revised?' : 'Reason for rejection'}
              {meta.need && <span className="text-red-500"> *</span>}
              {count > 1 && <span className="text-slate-400 font-normal"> — applied to all {count} selected</span>}
            </label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={3} autoFocus
              placeholder={action === 'approve' ? 'e.g. Costing in line with plan — approved for PO.'
                : action === 'revision' ? 'e.g. Fabric cost high vs benchmark — renegotiate CMP and resubmit.'
                : 'e.g. Margin unviable at this quote; re-source.'}
              className={cn('w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2',
                meta.color === 'red' ? 'border-red-200 focus:ring-red-400'
                  : meta.color === 'amber' ? 'border-amber-200 focus:ring-amber-400'
                  : 'border-slate-200 focus:ring-violet-400')}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button disabled={!canSubmit} onClick={() => onSubmit(note)}
              className={cn('flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40',
                meta.color === 'green' ? 'bg-green-600 hover:bg-green-700'
                  : meta.color === 'amber' ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-red-600 hover:bg-red-700')}>
              {meta.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Open costing breakdown (shared) ─────────────────────────────────────────

function OpenCostingRows({ breakdown, total }: { breakdown: NonNullable<CostingOrder['breakdown']>; total: number }) {
  const t = deriveOpenCostingTotals(breakdown)
  const rows: [string, string][] = [
    ['Main fabric', `₹${breakdown.mainFabricPrice} × ${breakdown.mainFabricConsumption}m = ₹${t.mainFabricCost}`],
    ['Trim fabric', `₹${breakdown.trimFabricPrice} × ${breakdown.trimFabricConsumption}m = ₹${t.trimFabricCost}`],
    ['Trims + thread', `₹${breakdown.trimCostThread}`],
    ['CMP (cut-make-pack)', `₹${breakdown.cmp}`],
    ['Value addition', `₹${breakdown.valueAddition}`],
    ['Testing', `₹${breakdown.testing}`],
    ['Logistics', `₹${breakdown.logistic}`],
    ['Rejection', `${breakdown.rejectionPct}% = ₹${t.rejectionAmt}`],
    ['Margin', `${breakdown.marginPct}% = ₹${t.marginAmt}`],
  ]
  return (
    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-center justify-between px-3 py-1.5 text-xs">
          <span className="text-slate-500">{label}</span>
          <span className="font-medium text-slate-700">{val}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
        <span className="text-xs font-bold text-slate-700">Total / pc</span>
        <span className="text-xs font-bold text-slate-900">₹{total}</span>
      </div>
    </div>
  )
}

// ─── History timeline ────────────────────────────────────────────────────────

function HistoryTimeline({ order }: { order: CostingOrder }) {
  const events = timeline(order)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (events.length === 0) return null
  const multiRound = roundOf(order) > 1

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Costing History</p>
        {multiRound && (
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
            Round {roundOf(order)}
          </span>
        )}
      </div>
      <ol className="relative">
        {events.map((e, i) => {
          const meta = EVENT_META[e.type]
          const last = i === events.length - 1
          return (
            <li key={i} className="relative pl-6 pb-4 last:pb-0">
              {!last && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" />}
              <span className={cn('absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2 border-white', meta.dot)} />
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-xs font-semibold', meta.text)}>{meta.label}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">R{e.round}</span>
                {typeof e.cost === 'number' && (
                  <span className="text-[11px] font-semibold text-slate-700">₹{e.cost}/pc</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{e.by} · {e.role} · {fmtDate(e.date)}</p>
              {e.comment && (
                <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                  “{e.comment}”
                </p>
              )}
              {e.breakdown && (
                <div className="mt-1.5">
                  <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
                    className="text-[11px] font-medium text-violet-600 hover:text-violet-700">
                    {openIdx === i ? 'Hide open costing' : 'View open costing'}
                  </button>
                  {openIdx === i && (
                    <div className="mt-1.5">
                      <OpenCostingRows breakdown={e.breakdown} total={e.cost ?? quotedCost(order)} />
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ─── Detail drawer ───────────────────────────────────────────────────────────

function DetailDrawer({ order, onClose, onAct }: {
  order: CostingOrder
  onClose: () => void
  onAct: (action: Action) => void
}) {
  const q = quotedCost(order)
  const v = variancePct(order)
  const bucket = bucketOf(order)
  const round = roundOf(order)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 z-10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Thumb order={order} size={44} />
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{order.styleName}</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{order.styleCode} · {order.colour}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Approval chain */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-500 mb-3 uppercase tracking-wide">Approval Chain</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 1 · Sourcing
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{order.approvedBy || 'Sourcing'} · {order.approverRole || 'Sourcing POC'}</p>
                <p className="text-[11px] text-slate-400">{fmtDate(order.approvedOn)}</p>
              </div>
              <div className="text-slate-300">→</div>
              <div className={cn('flex-1 rounded-lg border px-3 py-2.5',
                bucket === 'approved' ? 'bg-green-50 border-green-200' :
                bucket === 'rejected' ? 'bg-red-50 border-red-200' :
                bucket === 'revision' ? 'bg-amber-50 border-amber-200' : 'bg-violet-50 border-violet-200')}>
                <div className={cn('flex items-center gap-1.5 text-xs font-semibold',
                  bucket === 'approved' ? 'text-green-700' : bucket === 'rejected' ? 'text-red-700' :
                  bucket === 'revision' ? 'text-amber-700' : 'text-violet-700')}>
                  <ShieldCheck className="w-3.5 h-3.5" /> 2 · Buying
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{bucket === 'pending' ? 'Awaiting your decision' : BUCKET_BADGE[bucket].label}</p>
                <p className="text-[11px] text-slate-400">{order.buyingDecisionBy ? `${order.buyingDecisionBy} · ${fmtDate(order.buyingDecisionOn)}` : ''}</p>
              </div>
            </div>
          </div>

          {/* Price summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] text-slate-500">Target</p>
              <p className="text-base font-bold text-slate-900">₹{order.targetPrice}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] text-slate-500">Quoted</p>
              <p className="text-base font-bold text-slate-900">₹{q}</p>
            </div>
            <div className={cn('rounded-lg px-3 py-2.5', v === null ? 'bg-slate-50' : v < 0 ? 'bg-green-50' : v <= 5 ? 'bg-amber-50' : 'bg-red-50')}>
              <p className="text-[11px] text-slate-500">Variance</p>
              <p className={cn('text-base font-bold flex items-center gap-1',
                v === null ? 'text-slate-900' : v < 0 ? 'text-green-700' : v <= 5 ? 'text-amber-700' : 'text-red-700')}>
                {v !== null && (v < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />)}
                {v === null ? '—' : `${v > 0 ? '+' : ''}${v}%`}
              </p>
            </div>
          </div>

          {/* Vendor + line */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-0.5">Vendor</p>
              <p className="font-medium text-slate-900">{order.vendor}</p>
              <p className="text-slate-400">{order.vendorLocation}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-0.5">Order qty · value</p>
              <p className="font-medium text-slate-900">{order.orderQty.toLocaleString('en-IN')} pcs</p>
              <p className="text-slate-400">₹{(q * order.orderQty).toLocaleString('en-IN')}</p>
            </div>
          </div>

          {order.breakdown && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                Open Costing {round > 1 && <span className="text-blue-600">· Current (Round {round})</span>}
              </p>
              <OpenCostingRows breakdown={order.breakdown} total={q} />
            </div>
          )}

          {/* Audit trail across rounds */}
          <HistoryTimeline order={order} />

          {order.notes && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 flex gap-2 text-xs text-slate-600">
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
              <span><span className="font-semibold">Sourcing note:</span> {order.notes}</span>
            </div>
          )}

          {order.buyingFeedback && bucket !== 'pending' && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 flex gap-2 text-xs text-amber-800">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">Buying feedback:</span> {order.buyingFeedback}</span>
            </div>
          )}

          {bucket === 'pending' && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => onAct('reject')} className="flex-1 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 flex items-center justify-center gap-1.5">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button onClick={() => onAct('revision')} className="flex-1 py-2.5 rounded-lg border border-amber-200 text-amber-600 text-sm font-semibold hover:bg-amber-50 flex items-center justify-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Revise
              </button>
              <button onClick={() => onAct('approve')} className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Round comment thread ─────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function RoundComments({ orderId, round, ender }: { orderId: string; round: number; ender: CostingEvent }) {
  const { addCostingReply } = useCostingStore()
  const { currentUser } = useCurrentUser()
  const [reply, setReply] = useState('')
  const [open, setOpen] = useState(false)

  const name = currentUser.name && currentUser.name !== 'Guest' ? currentUser.name : 'Buying POC'
  const role = currentUser.roleLabel || 'Buying POC'

  const send = () => {
    const text = reply.trim()
    if (!text) return
    addCostingReply(orderId, round, { by: name, role, date: new Date().toISOString().split('T')[0], text })
    setReply('')
    setOpen(false)
  }

  const Bubble = ({ by, r, date, text, isReply }: { by: string; r: string; date: string; text: string; isReply?: boolean }) => (
    <div className={cn('flex gap-2', isReply && 'ml-6')}>
      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
        {initials(by)}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">{by}</span> · {r} · {fmtDate(date)}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">{text}</p>
      </div>
    </div>
  )

  return (
    <div className="pl-7 space-y-2 max-w-3xl">
      {ender.comment && <Bubble by={ender.by} r={ender.role} date={ender.date} text={ender.comment} />}
      {(ender.replies ?? []).map((rp, i) => (
        <Bubble key={i} by={rp.by} r={rp.role} date={rp.date} text={rp.text} isReply />
      ))}
      {open ? (
        <div className="ml-6 flex items-start gap-2">
          <textarea
            value={reply} onChange={e => setReply(e.target.value)} rows={2} autoFocus
            placeholder="Write a response…"
            className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <div className="flex flex-col gap-1">
            <button onClick={send} disabled={!reply.trim()}
              className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40">Send</button>
            <button onClick={() => { setOpen(false); setReply('') }}
              className="px-3 py-1 rounded-lg text-slate-500 text-xs hover:bg-slate-100">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="ml-6 flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-700">
          <MessageSquare className="w-3 h-3" /> Reply
        </button>
      )}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ order, selected, showCosting, onToggle, onOpen, onAct }: {
  order: CostingOrder
  selected: boolean
  showCosting: boolean
  onToggle: () => void
  onOpen: () => void
  onAct: (action: Action) => void
}) {
  const v = variancePct(order)
  const bucket = bucketOf(order)
  const badge = BUCKET_BADGE[bucket]
  const isPending = bucket === 'pending'
  const round = roundOf(order)
  const [open, setOpen] = useState(false)
  const colSpan = 9 + (showCosting ? COST_HEADS.length : 0)

  // One summary entry per previous round: the quote then, and how it closed.
  const hist = order.history ?? []
  const priorRounds = Array.from({ length: Math.max(0, round - 1) }, (_, idx) => {
    const r = idx + 1
    const quote = hist.find(h => h.round === r && (h.type === 'submitted' || h.type === 'resubmitted'))
    const ender = hist.find(h => h.round === r && (h.type === 'revision-requested' || h.type === 'rejected'))
    return {
      round: r,
      cost: quote?.cost,
      breakdown: quote?.breakdown,
      outcome: ender?.type === 'rejected' ? 'Rejected' : 'Revised',
      ender,
    }
  })
  const hasHistory = priorRounds.length > 0

  return (
    <>
    <tr className={cn('border-b border-slate-100 transition-colors', open ? 'bg-violet-50/40' : selected ? 'bg-violet-50/50' : 'hover:bg-slate-50/60')}>
      <td className="pl-4 pr-1 py-3">
        {isPending && (
          <input type="checkbox" checked={selected} onChange={onToggle}
            className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOpen(o => !o)}
            disabled={!hasHistory}
            title={open ? 'Hide history' : 'Show costing history'}
            className={cn('p-0.5 rounded transition-colors flex-shrink-0',
              hasHistory ? 'text-slate-400 hover:text-violet-600 hover:bg-violet-50' : 'text-transparent cursor-default')}
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', open && 'rotate-90')} />
          </button>
          <button onClick={onOpen} className="flex items-center gap-3 text-left group">
            <Thumb order={order} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700">{order.styleCode}</p>
                {round > 1 && (
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 py-0.5">R{round}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate max-w-56">{order.styleName} · {order.colour}</p>
            </div>
          </button>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">{order.vendor}</p>
        <p className="text-slate-400">{order.vendorLocation}</p>
      </td>
      <td className="px-3 py-3 text-sm text-slate-700 text-right">{order.orderQty.toLocaleString('en-IN')}</td>
      <td className="px-3 py-3 text-sm text-slate-700 text-right">₹{order.targetPrice}</td>
      <td className="px-3 py-3 text-sm font-semibold text-slate-900 text-right">₹{quotedCost(order)}</td>
      {showCosting && costCells(order).map((val, i) => (
        <td key={i} className="px-3 py-3 text-xs text-slate-600 text-right bg-violet-50/30 whitespace-nowrap">
          {val === null ? '—' : `₹${val}`}
        </td>
      ))}
      <td className="px-3 py-3 text-right">
        {v === null ? <span className="text-slate-400">—</span> : (
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
            v < 0 ? 'bg-green-50 text-green-700' : v <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
            {v > 0 ? '+' : ''}{v}%
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', badge.cls)}>{badge.label}</span>
      </td>
      <td className="px-4 py-3">
        {isPending ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => onAct('approve')} title="Accept"
              className="w-7 h-7 rounded-lg border border-green-200 text-green-600 hover:bg-green-600 hover:text-white flex items-center justify-center transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onAct('revision')} title="Revise"
              className="w-7 h-7 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-500 hover:text-white flex items-center justify-center transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onAct('reject')} title="Reject"
              className="w-7 h-7 rounded-lg border border-red-200 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-right">
            <button onClick={onOpen} className="text-xs font-medium text-slate-500 hover:text-violet-700">View</button>
          </div>
        )}
      </td>
    </tr>
    {open && priorRounds.map(pr => {
      const ev = typeof pr.cost === 'number' ? Math.round(((pr.cost - order.targetPrice) / order.targetPrice) * 1000) / 10 : null
      return (
        <Fragment key={pr.round}>
          {/* Previous-round summary — same columns as the row above, greyed out */}
          <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
            <td className="pl-4 pr-1 py-2" />
            <td className="px-3 py-2">
              <div className="flex items-center gap-3 pl-7">
                <Thumb order={order} size={28} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">{order.styleCode}</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 rounded px-1 py-0.5">R{pr.round}</span>
                    <span className="text-[10px] font-medium text-amber-600">{pr.outcome}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-56">{order.styleName} · {order.colour}</p>
                </div>
              </div>
            </td>
            <td className="px-3 py-2 text-xs text-slate-400">
              <p className="font-medium">{order.vendor}</p>
              <p>{order.vendorLocation}</p>
            </td>
            <td className="px-3 py-2 text-xs text-slate-400 text-right">{order.orderQty.toLocaleString('en-IN')}</td>
            <td className="px-3 py-2 text-xs text-slate-400 text-right">₹{order.targetPrice}</td>
            <td className="px-3 py-2 text-xs text-slate-500 font-semibold text-right">{typeof pr.cost === 'number' ? `₹${pr.cost}` : '—'}</td>
            {showCosting && costCellsOf(pr.breakdown).map((val, j) => (
              <td key={j} className="px-3 py-2 text-right text-[11px] text-slate-400 whitespace-nowrap">{val === null ? '' : `₹${val}`}</td>
            ))}
            <td className="px-3 py-2 text-right text-xs text-slate-400">{ev === null ? '' : `${ev > 0 ? '+' : ''}${ev}%`}</td>
            <td className="px-3 py-2" />
            <td className="px-4 py-2" />
          </tr>
          {pr.ender?.comment && (
            <tr className="bg-slate-50 border-b border-slate-100">
              <td className="pl-4 pr-1" />
              <td colSpan={colSpan - 1} className="px-3 pb-3 pt-0">
                <RoundComments orderId={order.id} round={pr.round} ender={pr.ender} />
              </td>
            </tr>
          )}
        </Fragment>
      )
    })}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BuyingApprovalsPage() {
  const { orders, buyingApprove, buyingRequestRevision, buyingReject } = useCostingStore()
  const { currentUser } = useCurrentUser()

  const [tab, setTab] = useState<'all' | BuyingBucket>('pending')
  const [search, setSearch] = useState('')
  const [fSeason, setFSeason] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fVendor, setFVendor] = useState('')
  const [fVariance, setFVariance] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showCosting, setShowCosting] = useState(false)
  // modal: { action, ids } — ids drive single vs bulk
  const [modal, setModal] = useState<{ action: Action; ids: string[] } | null>(null)

  const buyerName = currentUser.name && currentUser.name !== 'Guest' ? currentUser.name : 'Buying POC'

  const queue = useMemo(() =>
    orders.filter(o => !o.isSplit && (o.costStatus === 'approved' || o.buyingStatus != null)), [orders])

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, revision: 0, rejected: 0 }
    queue.forEach(o => { c[bucketOf(o)]++ })
    return c
  }, [queue])

  const facetOpts = useMemo(() => ({
    season:   [...new Set(queue.map(o => o.season).filter(Boolean))].sort(),
    category: [...new Set(queue.map(o => o.category).filter(Boolean))].sort(),
    vendor:   [...new Set(queue.map(o => o.vendor).filter(Boolean))].sort(),
    variance: ['Under target', '0–5% over', 'Above 5%'],
  }), [queue])

  const filtered = useMemo(() => queue.filter(o => {
    if (tab !== 'all' && bucketOf(o) !== tab) return false
    if (fSeason && o.season !== fSeason) return false
    if (fCategory && o.category !== fCategory) return false
    if (fVendor && o.vendor !== fVendor) return false
    if (fVariance && varianceBand(o) !== fVariance) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(`${o.styleCode} ${o.styleName} ${o.colour} ${o.vendor}`.toLowerCase().includes(q))) return false
    }
    return true
  }), [queue, tab, fSeason, fCategory, fVendor, fVariance, search])

  const hasFilters = !!(search || fSeason || fCategory || fVendor || fVariance)
  const clearFilters = () => { setSearch(''); setFSeason(''); setFCategory(''); setFVendor(''); setFVariance('') }

  const detail = detailId ? queue.find(o => o.id === detailId) ?? null : null

  // Only pending rows in the current view are selectable for bulk actions.
  const selectablePending = filtered.filter(o => bucketOf(o) === 'pending')
  const allPendingSelected = selectablePending.length > 0 && selectablePending.every(o => selectedIds.has(o.id))
  const selectedCount = selectedIds.size

  const toggleOne = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () =>
    setSelectedIds(allPendingSelected ? new Set() : new Set(selectablePending.map(o => o.id)))

  const applyAction = (action: Action, ids: string[], note: string) => {
    ids.forEach(id => {
      if (action === 'approve') buyingApprove(id, buyerName, note)
      else if (action === 'revision') buyingRequestRevision(id, buyerName, note)
      else buyingReject(id, buyerName, note)
    })
    setSelectedIds(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n })
  }

  // Every decision goes through the comment step — optional for approve, required for revise/reject.
  const handleAct = (action: Action, ids: string[]) => setModal({ action, ids })

  const TABS: [typeof tab, string][] = [
    ['all', `All ${queue.length}`],
    ['pending', `Awaiting ${counts.pending}`],
    ['approved', `Approved ${counts.approved}`],
    ['revision', `Revision ${counts.revision}`],
    ['rejected', `Rejected ${counts.rejected}`],
  ]

  return (
    <>
      <Header title="Costing Approvals" subtitle={`Buying desk · ${counts.pending} awaiting your decision`} />

      {modal && (
        <CommentModal
          action={modal.action}
          count={modal.ids.length}
          onClose={() => setModal(null)}
          onSubmit={note => { applyAction(modal.action, modal.ids, note); setModal(null); setDetailId(null) }}
        />
      )}

      {detail && (
        <DetailDrawer
          order={detail}
          onClose={() => setDetailId(null)}
          onAct={action => handleAct(action, [detail.id])}
        />
      )}

      <div className="px-6 py-5 min-h-[calc(100vh-52px)] bg-slate-50">
        {/* Toolbar: search + grid-style facets */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-56 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search style, colour, vendor…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          <Facet label="Season"   value={fSeason}   options={facetOpts.season}   onChange={setFSeason} />
          <Facet label="Category" value={fCategory} options={facetOpts.category} onChange={setFCategory} />
          <Facet label="Vendor"   value={fVendor}   options={facetOpts.vendor}   onChange={setFVendor} />
          <Facet label="Variance" value={fVariance} options={facetOpts.variance} onChange={setFVariance} />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-2 text-xs text-slate-500 hover:text-slate-700">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <button
            onClick={() => setShowCosting(s => !s)}
            className={cn('ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
              showCosting ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
          >
            {showCosting ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showCosting ? 'Hide open costing' : 'Open costing columns'}
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn('px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                tab === key ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{hasFilters ? 'No items match the current filters.' : 'Nothing here — all caught up!'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className={cn('w-full', showCosting ? 'min-w-[1480px]' : 'min-w-[920px]')}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="pl-4 pr-1 py-2.5 w-9">
                    <input type="checkbox" checked={allPendingSelected} onChange={toggleAll}
                      disabled={selectablePending.length === 0}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer disabled:opacity-30" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">Style</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Vendor</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Target</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Quoted</th>
                  {showCosting && COST_HEADS.map(h => (
                    <th key={h} className="px-3 py-2.5 text-right font-semibold bg-violet-50/50 whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold">Variance</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Buying</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <Row
                    key={o.id}
                    order={o}
                    selected={selectedIds.has(o.id)}
                    showCosting={showCosting}
                    onToggle={() => toggleOne(o.id)}
                    onOpen={() => setDetailId(o.id)}
                    onAct={action => handleAct(action, [o.id])}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:left-[calc(50%+var(--ds-sidebar-width)/2)]">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex items-center gap-1.5 pl-4 pr-2 py-2">
            <span className="text-sm font-semibold text-slate-700 mr-1">{selectedCount} selected</span>
            <button onClick={() => handleAct('approve', [...selectedIds])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold">
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button onClick={() => handleAct('revision', [...selectedIds])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold">
              <RotateCcw className="w-3.5 h-3.5" /> Revise
            </button>
            <button onClick={() => handleAct('reject', [...selectedIds])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold">
              <X className="w-3.5 h-3.5" /> Reject
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="ml-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-medium">
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  )
}
