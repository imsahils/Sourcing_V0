'use client'
import { useState, useMemo } from 'react'
import {
  CheckCircle2, XCircle, Clock, AlertCircle, RotateCcw, MessageSquare,
  TrendingUp, TrendingDown, ShieldCheck, Info,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { useCostingStore, type CostingOrder } from '@/lib/costing-store'
import { useCurrentUser } from '@/lib/user-context'
import { deriveOpenCostingTotals } from '@/lib/vendor-costing'
import { cn } from '@/lib/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** The effective quoted unit cost for an order (submitted cost or derived total). */
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

/** What Buying is waiting on / has decided. Only orders Sourcing has approved appear here. */
type BuyingBucket = 'pending' | 'approved' | 'revision' | 'rejected'
function bucketOf(o: CostingOrder): BuyingBucket {
  if (o.buyingStatus === 'approved') return 'approved'
  if (o.buyingStatus === 'revision') return 'revision'
  if (o.buyingStatus === 'rejected') return 'rejected'
  return 'pending'
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ─── Review Drawer ──────────────────────────────────────────────────────────

type Action = 'approve' | 'revision' | 'reject'

function ReviewDrawer({
  order, onClose, onApprove, onRevision, onReject,
}: {
  order: CostingOrder
  onClose: () => void
  onApprove: (notes: string) => void
  onRevision: (feedback: string) => void
  onReject: (reason: string) => void
}) {
  const [action, setAction] = useState<Action>('approve')
  const [notes, setNotes] = useState('')
  const q = quotedCost(order)
  const v = variancePct(order)
  const totals = order.breakdown ? deriveOpenCostingTotals(order.breakdown) : null
  const b = order.breakdown
  const lineTotal = q * order.orderQty

  const needsNote = action === 'revision' || action === 'reject'
  const canSubmit = !needsNote || notes.trim().length > 0

  const submit = () => {
    if (action === 'approve') onApprove(notes)
    else if (action === 'revision') onRevision(notes)
    else onReject(notes)
  }

  const rows: [string, string][] = b ? [
    ['Main fabric', `₹${b.mainFabricPrice} × ${b.mainFabricConsumption}m = ₹${totals!.mainFabricCost}`],
    ['Trim fabric', `₹${b.trimFabricPrice} × ${b.trimFabricConsumption}m = ₹${totals!.trimFabricCost}`],
    ['Trims + thread', `₹${b.trimCostThread}`],
    ['CMP (cut-make-pack)', `₹${b.cmp}`],
    ['Value addition', `₹${b.valueAddition}`],
    ['Testing', `₹${b.testing}`],
    ['Logistics', `₹${b.logistic}`],
    ['Rejection', `${b.rejectionPct}% = ₹${totals!.rejectionAmt}`],
    ['Margin', `${b.marginPct}% = ₹${totals!.marginAmt}`],
  ] : []

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl animate-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">{order.styleName}</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {order.id} · {order.styleCode} · {order.colour}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Approval chain */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Approval Chain</p>
            <div className="flex items-center gap-2">
              {/* L1 Sourcing */}
              <div className="flex-1 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 1 · Sourcing
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{order.approvedBy || 'Sourcing'} · {order.approverRole || 'Sourcing POC'}</p>
                <p className="text-[11px] text-slate-400">{fmtDate(order.approvedOn)}</p>
              </div>
              <div className="text-slate-300">→</div>
              {/* L2 Buying */}
              <div className={cn('flex-1 rounded-lg border px-3 py-2.5',
                bucketOf(order) === 'approved' ? 'bg-green-50 border-green-200' :
                bucketOf(order) === 'rejected' ? 'bg-red-50 border-red-200' :
                bucketOf(order) === 'revision' ? 'bg-amber-50 border-amber-200' :
                'bg-violet-50 border-violet-200'
              )}>
                <div className={cn('flex items-center gap-1.5 text-xs font-semibold',
                  bucketOf(order) === 'approved' ? 'text-green-700' :
                  bucketOf(order) === 'rejected' ? 'text-red-700' :
                  bucketOf(order) === 'revision' ? 'text-amber-700' : 'text-violet-700'
                )}>
                  <ShieldCheck className="w-3.5 h-3.5" /> 2 · Buying
                </div>
                <p className="text-[11px] text-slate-500 mt-1 capitalize">
                  {bucketOf(order) === 'pending' ? 'Awaiting your decision' : bucketOf(order)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {order.buyingDecisionBy ? `${order.buyingDecisionBy} · ${fmtDate(order.buyingDecisionOn)}` : ''}
                </p>
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
            <div className={cn('rounded-lg px-3 py-2.5',
              v === null ? 'bg-slate-50' : v < 0 ? 'bg-green-50' : v <= 5 ? 'bg-amber-50' : 'bg-red-50')}>
              <p className="text-[11px] text-slate-500">Variance</p>
              <p className={cn('text-base font-bold flex items-center gap-1',
                v === null ? 'text-slate-900' : v < 0 ? 'text-green-700' : v <= 5 ? 'text-amber-700' : 'text-red-700')}>
                {v !== null && (v < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />)}
                {v === null ? '—' : `${v > 0 ? '+' : ''}${v}%`}
              </p>
            </div>
          </div>

          {/* Vendor + order line */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-0.5">Vendor</p>
              <p className="font-medium text-slate-900">{order.vendor}</p>
              <p className="text-slate-400">{order.vendorLocation}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-0.5">Order qty · value</p>
              <p className="font-medium text-slate-900">{order.orderQty.toLocaleString('en-IN')} pcs</p>
              <p className="text-slate-400">₹{lineTotal.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Cost breakdown */}
          {rows.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <p className="text-xs font-semibold text-slate-500 px-4 pt-3 pb-2 uppercase tracking-wide">Open Costing Breakdown</p>
              <div className="divide-y divide-slate-100">
                {rows.map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-700">{val}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50">
                  <span className="text-sm font-bold text-slate-700">Total / pc</span>
                  <span className="text-sm font-bold text-slate-900">₹{q}</span>
                </div>
              </div>
            </div>
          )}

          {/* Vendor / sourcing notes */}
          {order.notes && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 flex gap-2 text-xs text-slate-600">
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
              <span><span className="font-semibold">Sourcing note:</span> {order.notes}</span>
            </div>
          )}

          {/* Prior Buying feedback (if returned/decided) */}
          {order.buyingFeedback && bucketOf(order) !== 'pending' && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 flex gap-2 text-xs text-amber-800">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">Buying feedback:</span> {order.buyingFeedback}</span>
            </div>
          )}

          {/* Decision box — only when pending */}
          {bucketOf(order) === 'pending' && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Your Decision</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['approve', 'Approve', CheckCircle2, 'green'],
                  ['revision', 'Revise', RotateCcw, 'amber'],
                  ['reject', 'Reject', XCircle, 'red'],
                ] as const).map(([key, label, Icon, color]) => (
                  <button
                    key={key}
                    onClick={() => setAction(key)}
                    className={cn('flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors',
                      action === key
                        ? color === 'green' ? 'bg-green-600 text-white border-green-600'
                          : color === 'amber' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-red-600 text-white border-red-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  {action === 'approve' ? 'Approval remarks (optional)'
                    : action === 'revision' ? 'What should be revised? ' : 'Rejection reason '}
                  {needsNote && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    action === 'approve' ? 'e.g. Costing in line with plan — approved for PO.'
                      : action === 'revision' ? 'e.g. Fabric cost high vs benchmark — renegotiate CMP and resubmit.'
                      : 'e.g. Margin unviable at this quote; rejecting — re-source.'
                  }
                  className={cn('w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2',
                    action === 'reject' ? 'border-red-200 focus:ring-red-400'
                      : action === 'revision' ? 'border-amber-200 focus:ring-amber-400'
                      : 'border-slate-200 focus:ring-violet-400'
                  )}
                />
              </div>

              {action === 'revision' && (
                <p className="text-[11px] text-amber-700 flex gap-1.5">
                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  Sends the costing back to Sourcing for a revised quote.
                </p>
              )}

              <button
                disabled={!canSubmit}
                onClick={submit}
                className={cn('w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40',
                  action === 'approve' ? 'bg-green-600 hover:bg-green-700'
                    : action === 'revision' ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {action === 'approve' ? 'Approve Costing'
                  : action === 'revision' ? 'Send Back for Revision'
                  : 'Reject Costing'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Row ────────────────────────────────────────────────────────────────────

const BUCKET_BADGE: Record<BuyingBucket, { label: string; cls: string }> = {
  pending:  { label: 'Awaiting Buying', cls: 'bg-violet-100 text-violet-700' },
  approved: { label: 'Approved',        cls: 'bg-green-100 text-green-700' },
  revision: { label: 'Sent for Revision', cls: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejected',        cls: 'bg-red-100 text-red-700' },
}

function OrderRow({ order, onOpen }: { order: CostingOrder; onOpen: () => void }) {
  const v = variancePct(order)
  const bucket = bucketOf(order)
  const badge = BUCKET_BADGE[bucket]

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{order.styleCode}</p>
        <p className="text-xs text-slate-500 truncate max-w-56">{order.styleName} · {order.colour}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">{order.vendor}</p>
        <p className="text-slate-400">{order.vendorLocation}</p>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 text-right">{order.orderQty.toLocaleString('en-IN')}</td>
      <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{order.targetPrice}</td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">₹{quotedCost(order)}</td>
      <td className="px-4 py-3 text-right">
        {v === null ? <span className="text-slate-400">—</span> : (
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
            v < 0 ? 'bg-green-50 text-green-700' : v <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
            {v > 0 ? '+' : ''}{v}%
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 text-green-600">
          <CheckCircle2 className="w-3 h-3" /> Sourcing
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', badge.cls)}>{badge.label}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onOpen}
          className={cn('text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
            bucket === 'pending'
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'border border-slate-200 text-slate-600 hover:bg-slate-50')}
        >
          {bucket === 'pending' ? 'Review →' : 'View'}
        </button>
      </td>
    </tr>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BuyingApprovalsPage() {
  const { orders, buyingApprove, buyingRequestRevision, buyingReject } = useCostingStore()
  const { currentUser } = useCurrentUser()
  const [filter, setFilter] = useState<'all' | BuyingBucket>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const buyerName = currentUser.name && currentUser.name !== 'Guest' ? currentUser.name : 'Buying POC'

  // Only orders Sourcing (level 1) has signed off reach the Buying desk.
  const queue = useMemo(() =>
    orders.filter(o =>
      !o.isSplit && (o.costStatus === 'approved' || o.buyingStatus != null)
    ), [orders])

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, revision: 0, rejected: 0 }
    queue.forEach(o => { c[bucketOf(o)]++ })
    return c
  }, [queue])

  const filtered = filter === 'all' ? queue : queue.filter(o => bucketOf(o) === filter)
  const selected = selectedId ? queue.find(o => o.id === selectedId) ?? null : null

  const cards = [
    { key: 'pending',  label: 'Awaiting Buying', value: counts.pending,  icon: Clock,        color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
    { key: 'approved', label: 'Approved',        value: counts.approved, icon: CheckCircle2, color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
    { key: 'revision', label: 'Sent for Revision', value: counts.revision, icon: RotateCcw,  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
    { key: 'rejected', label: 'Rejected',        value: counts.rejected, icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  ] as const

  return (
    <>
      <Header title="Costing Approvals" subtitle={`Buying desk · ${counts.pending} awaiting your decision`} />

      {selected && (
        <ReviewDrawer
          order={selected}
          onClose={() => setSelectedId(null)}
          onApprove={notes => { buyingApprove(selected.id, buyerName, notes); setSelectedId(null) }}
          onRevision={fb => { buyingRequestRevision(selected.id, buyerName, fb); setSelectedId(null) }}
          onReject={reason => { buyingReject(selected.id, buyerName, reason); setSelectedId(null) }}
        />
      )}

      <div className="px-6 py-6">
        {/* Explainer */}
        <div className="flex gap-2 bg-violet-50 border border-violet-100 rounded-lg px-4 py-3 text-xs text-violet-700 mb-5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Two-level costing sign-off. Sourcing approves the vendor quote first (level&nbsp;1); it then arrives
            here for the Buying team (level&nbsp;2). Approve to lock costing for PO, or send back for revision / reject with feedback.
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {cards.map(({ key, label, value, icon: Icon, color, bg }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn('rounded-xl border px-5 py-4 flex items-center gap-4 text-left transition-all',
                bg, filter === key ? 'ring-2 ring-offset-1 ring-slate-300' : 'hover:shadow-sm')}
            >
              <Icon className={cn('w-5 h-5', color)} />
              <div>
                <p className={cn('text-2xl font-bold', color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
            {([
              ['all', `All (${queue.length})`],
              ['pending', `Awaiting (${counts.pending})`],
              ['approved', 'Approved'],
              ['revision', 'Revision'],
              ['rejected', 'Rejected'],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={cn('px-3 py-2 transition-colors', filter === key ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nothing here — all caught up!</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 text-left font-semibold">Style</th>
                  <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Target</th>
                  <th className="px-4 py-3 text-right font-semibold">Quoted</th>
                  <th className="px-4 py-3 text-right font-semibold">Variance</th>
                  <th className="px-4 py-3 text-left font-semibold">Level 1</th>
                  <th className="px-4 py-3 text-left font-semibold">Buying Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <OrderRow key={o.id} order={o} onOpen={() => setSelectedId(o.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
