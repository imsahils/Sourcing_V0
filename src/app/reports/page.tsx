'use client'
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Download, TrendingUp, CheckCircle2, AlertTriangle, FileSpreadsheet,
  Flag, MessageSquare, ChevronDown, ChevronUp, Scissors, Package,
  Edit2, Save, IndianRupee, Info, X, Send, BarChart2, Layers,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { subOrders, vendors } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/user-context'
import {
  type VendorCostOrder,
  VENDOR_COSTING_ORDERS,
  resolveVendorKey,
} from '@/lib/vendor-costing'
import {
  type DPREntry,
  type ProductionOrder,
  INITIAL_PRODUCTION_ORDERS,
  todayStr,
  sortedLog,
  latestEntry,
  todayEntry,
  prevEntry,
  submittedToday,
  pct,
  daysLeft,
  fmtDate,
  fmtDateTime,
} from '@/lib/production'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: ProductionOrder['status']) {
  const map: Record<ProductionOrder['status'], string> = {
    'on-track':  'bg-violet-50 text-violet-700',
    'at-risk':   'bg-amber-50 text-amber-700',
    'delayed':   'bg-red-50 text-red-700',
    'completed': 'bg-green-50 text-green-700',
  }
  const labels: Record<ProductionOrder['status'], string> = {
    'on-track':  'On-Track',
    'at-risk':   'At-Risk',
    'delayed':   'Delayed',
    'completed': 'Completed',
  }
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded capitalize', map[status])}>
      {labels[status]}
    </span>
  )
}

function tierBadge(tier: ProductionOrder['tier']) {
  const map: Record<ProductionOrder['tier'], string> = {
    'HERO':   'bg-purple-100 text-purple-700',
    'TIER-1': 'bg-violet-100 text-violet-700',
    'TIER-2': 'bg-slate-100 text-slate-600',
    'TAIL':   'bg-slate-100 text-slate-400',
  }
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', map[tier])}>
      {tier}
    </span>
  )
}

function sortOrders(orders: ProductionOrder[]): ProductionOrder[] {
  const priority = (s: ProductionOrder['status']) =>
    s === 'delayed' ? 0 : s === 'at-risk' ? 1 : s === 'on-track' ? 2 : 3

  return [...orders].sort((a, b) => {
    const pa = priority(a.status)
    const pb = priority(b.status)
    if (pa !== pb) return pa - pb
    // For on-track: sort by days left ascending
    if (a.status === 'on-track' && b.status === 'on-track') {
      return daysLeft(a.inwardDate) - daysLeft(b.inwardDate)
    }
    return 0
  })
}

// ─── Mini progress bar ────────────────────────────────────────────────────────

function QtyCell({ qty, total, color }: { qty: number; total: number; color: string }) {
  const p = pct(qty, total)
  return (
    <div className="min-w-[80px]">
      <div className="flex items-center gap-1 mb-0.5">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', color)} style={{ width: `${p}%` }} />
        </div>
        <span className="text-xs font-medium text-slate-700 w-7 text-right">{p}%</span>
      </div>
      <p className="text-xs text-slate-400 text-right">{qty}</p>
    </div>
  )
}

// ─── History sub-table ────────────────────────────────────────────────────────

function HistorySubTable({ order }: { order: ProductionOrder }) {
  const log = sortedLog(order)
  return (
    <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 font-semibold">
            {['Date', 'Cut', '+Δ', 'Stitch', '+Δ', 'Finish', '+Δ', 'Pack', '+Δ', 'Submitted By', 'Remarks', ''].map((h, i) => (
              <th key={i} className="px-2 py-1.5 text-left whitespace-nowrap font-semibold text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {log.map((entry, idx) => {
            const prev = log[idx + 1]
            const delta = (cur: number, p: DPREntry | undefined, key: keyof DPREntry) =>
              p ? cur - (p[key] as number) : null

            const dCut   = delta(entry.cutQty,       prev, 'cutQty')
            const dStitch= delta(entry.stitchingQty,  prev, 'stitchingQty')
            const dFin   = delta(entry.finishingQty,  prev, 'finishingQty')
            const dPack  = delta(entry.packingQty,    prev, 'packingQty')

            const deltaCell = (d: number | null) =>
              d === null ? <span className="text-slate-400">—</span> :
              d === 0    ? <span className="text-slate-400">+0</span> :
                           <span className={d > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                             {d > 0 ? '+' : ''}{d}
                           </span>

            return (
              <tr key={entry.id} className="border-t border-slate-100 hover:bg-white">
                <td className="px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap">{fmtDate(entry.date)}</td>
                <td className="px-2 py-1.5 text-slate-700">{entry.cutQty}</td>
                <td className="px-2 py-1.5">{deltaCell(dCut)}</td>
                <td className="px-2 py-1.5 text-slate-700">{entry.stitchingQty}</td>
                <td className="px-2 py-1.5">{deltaCell(dStitch)}</td>
                <td className="px-2 py-1.5 text-slate-700">{entry.finishingQty}</td>
                <td className="px-2 py-1.5">{deltaCell(dFin)}</td>
                <td className="px-2 py-1.5 text-slate-700">{entry.packingQty}</td>
                <td className="px-2 py-1.5">{deltaCell(dPack)}</td>
                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                  {entry.submittedBy}
                  {entry.submittedByRole === 'sourcing-poc' && (
                    <span className="ml-1 text-violet-500 text-xs">(POC)</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-slate-500 max-w-[160px] truncate">{entry.remarks ?? '—'}</td>
                <td className="px-2 py-1.5">
                  {entry.isFlagged && <Flag className="w-3 h-3 text-red-500 inline" />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Log Modal ────────────────────────────────────────────────────────────────

type LogModalProps = {
  order: ProductionOrder
  onClose: () => void
  onSubmit: (entry: Omit<DPREntry, 'id' | 'orderId'>) => void
  loggerName: string
  loggerRole: 'vendor' | 'sourcing-poc'
}

function LogModal({ order, onClose, onSubmit, loggerName, loggerRole }: LogModalProps) {
  const prev = prevEntry(order)
  const [cut,    setCut]    = useState(prev?.cutQty       ?? 0)
  const [stitch, setStitch] = useState(prev?.stitchingQty ?? 0)
  const [finish, setFinish] = useState(prev?.finishingQty ?? 0)
  const [pack,   setPack]   = useState(prev?.packingQty   ?? 0)
  const [remarks, setRemarks] = useState('')

  function handleSubmit() {
    onSubmit({
      date:            todayStr(),
      cutQty:          cut,
      stitchingQty:    stitch,
      finishingQty:    finish,
      packingQty:      pack,
      remarks:         remarks.trim() || undefined,
      submittedBy:     loggerName,
      submittedByRole: loggerRole,
      submittedAt:     new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-base font-semibold text-slate-900">
            Log Production — {order.styleCode} {order.colour}
          </p>
          {loggerRole === 'sourcing-poc' && (
            <p className="text-xs text-slate-500 mt-0.5">Logging on behalf of {order.vendor}</p>
          )}
        </div>

        <div className="px-6 py-4 space-y-4">
          {prev && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-600">
              Previous: {fmtDate(prev.date)} — Cut: {prev.cutQty} · Stitch: {prev.stitchingQty} · Finish: {prev.finishingQty} · Pack: {prev.packingQty}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Cut Qty',          value: cut,    set: setCut    },
              { label: 'Stitching Qty',    value: stitch, set: setStitch },
              { label: 'Finishing Qty',    value: finish, set: setFinish },
              { label: 'Packing Qty',      value: pack,   set: setPack   },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={order.orderQty}
                  value={value}
                  onChange={e => set(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (optional)</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Add any notes…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Submit Log
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Note Modal ───────────────────────────────────────────────────────────────

type NoteModalProps = {
  order: ProductionOrder
  entry: DPREntry
  onClose: () => void
  onSave: (note: string, flagged: boolean) => void
}

function NoteModal({ order, entry, onClose, onSave }: NoteModalProps) {
  const [note,    setNote]    = useState(entry.pocNote ?? '')
  const [flagged, setFlagged] = useState(entry.isFlagged ?? false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-base font-semibold text-slate-900">Add Note — {order.styleCode}</p>
          <p className="text-xs text-slate-500 mt-0.5">Entry: {fmtDate(entry.date)}</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">POC Note</label>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note for this entry…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={flagged}
              onChange={e => setFlagged(e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm text-slate-700">Flag this entry for attention</span>
          </label>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(note, flagged); onClose() }}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── POC DPR View ─────────────────────────────────────────────────────────────

type POCDPRViewProps = {
  orders: ProductionOrder[]
  onSubmitEntry: (orderId: string, entry: Omit<DPREntry, 'id' | 'orderId'>) => void
  onSaveNote: (orderId: string, entryId: string, note: string, flagged: boolean) => void
  currentUserName: string
}

function POCDPRView({ orders, onSubmitEntry, onSaveNote, currentUserName }: POCDPRViewProps) {
  const [vendorFilter, setVendorFilter]   = useState('all')
  const [statusFilter, setStatusFilter]   = useState<'all' | ProductionOrder['status']>('all')
  const [logModal,     setLogModal]       = useState<string | null>(null)   // orderId
  const [noteModal,    setNoteModal]      = useState<string | null>(null)   // orderId
  const [expanded,     setExpanded]       = useState<Set<string>>(new Set())

  const today = todayStr()

  // Summary counts
  const nonCompleted    = orders.filter(o => o.status !== 'completed')
  const submittedCount  = nonCompleted.filter(o => submittedToday(o)).length
  const pendingCount    = nonCompleted.filter(o => !submittedToday(o)).length
  const atRiskDelayed   = orders.filter(o => o.status === 'at-risk' || o.status === 'delayed').length
  const completedCount  = orders.filter(o => o.status === 'completed').length

  const uniqueVendors = Array.from(new Set(orders.map(o => o.vendor))).sort()

  const filtered = sortOrders(
    orders.filter(o => {
      if (vendorFilter !== 'all' && o.vendor !== vendorFilter) return false
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      return true
    })
  )

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const logOrder   = orders.find(o => o.id === logModal)
  const noteOrder  = orders.find(o => o.id === noteModal)
  const noteEntry  = noteOrder ? latestEntry(noteOrder) : null

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'In Production',     value: nonCompleted.length,  color: 'text-slate-700',   bg: 'bg-white' },
          { label: 'Submitted Today',   value: submittedCount,        color: 'text-green-700',   bg: 'bg-green-50' },
          { label: 'Pending Today',     value: pendingCount,          color: 'text-amber-700',   bg: 'bg-amber-50' },
          { label: 'Delayed / At-Risk', value: atRiskDelayed,         color: 'text-red-700',     bg: 'bg-red-50' },
          { label: 'Completed',         value: completedCount,        color: 'text-violet-700',    bg: 'bg-violet-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl border border-slate-200 px-4 py-3', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={vendorFilter}
          onChange={e => setVendorFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All Vendors</option>
          {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <div className="flex items-center gap-1">
          {(['all', 'on-track', 'at-risk', 'delayed', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors',
                statusFilter === s
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              {s === 'all' ? 'All' : s === 'on-track' ? 'On-Track' : s === 'at-risk' ? 'At-Risk' : s === 'delayed' ? 'Delayed' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Style', 'Vendor', 'Ord Qty', 'Cut', 'Stitch', 'Finish', 'Pack', 'Inward', 'Today', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const latest  = latestEntry(order)
                const tEntry  = todayEntry(order)
                const dl      = daysLeft(order.inwardDate)
                const isExpanded = expanded.has(order.id)

                return (
                  <>
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      {/* Style */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="text-left group"
                        >
                          <p className="text-xs font-semibold text-violet-700 group-hover:underline">{order.styleCode}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[120px]">{order.styleName} · {order.colour}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {tierBadge(order.tier)}
                            {statusBadge(order.status)}
                          </div>
                        </button>
                      </td>
                      {/* Vendor */}
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-slate-700">{order.vendor}</p>
                        <p className="text-xs text-slate-400">{order.vendorLocation}</p>
                      </td>
                      {/* Ord Qty */}
                      <td className="px-3 py-2.5 text-xs font-medium text-slate-700 text-right">{order.orderQty}</td>
                      {/* Cut */}
                      <td className="px-3 py-2.5">
                        <QtyCell qty={latest?.cutQty ?? 0} total={order.orderQty} color="bg-violet-500" />
                      </td>
                      {/* Stitch */}
                      <td className="px-3 py-2.5">
                        <QtyCell qty={latest?.stitchingQty ?? 0} total={order.orderQty} color="bg-purple-500" />
                      </td>
                      {/* Finish */}
                      <td className="px-3 py-2.5">
                        <QtyCell qty={latest?.finishingQty ?? 0} total={order.orderQty} color="bg-indigo-500" />
                      </td>
                      {/* Pack */}
                      <td className="px-3 py-2.5">
                        <QtyCell qty={latest?.packingQty ?? 0} total={order.orderQty} color="bg-green-500" />
                      </td>
                      {/* Inward */}
                      <td className="px-3 py-2.5">
                        <p className="text-xs text-slate-700">{fmtDate(order.inwardDate)}</p>
                        <p className={cn('text-xs font-semibold', dl < 0 ? 'text-red-600' : dl <= 7 ? 'text-amber-600' : 'text-slate-500')}>
                          {dl < 0 ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
                        </p>
                      </td>
                      {/* Today */}
                      <td className="px-3 py-2.5">
                        {tEntry ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            ✓ {new Date(tEntry.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
                          </span>
                        ) : order.status === 'completed' ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            ⚠ Missing
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {!submittedToday(order) && order.status !== 'completed' && (
                            <button
                              onClick={() => setLogModal(order.id)}
                              className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Log
                            </button>
                          )}
                          {latest && (
                            <>
                              <button
                                onClick={() => {
                                  // Toggle flag on latest entry
                                  onSaveNote(order.id, latest.id, latest.pocNote ?? '', !(latest.isFlagged ?? false))
                                }}
                                title="Toggle flag"
                                className={cn('p-1.5 rounded-lg hover:bg-slate-100 transition-colors', latest.isFlagged ? 'text-red-500' : 'text-slate-400')}
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setNoteModal(order.id)}
                                title="Add note"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded history row */}
                    {isExpanded && (
                      <tr key={`${order.id}-history`}>
                        <td colSpan={10} className="p-0">
                          <HistorySubTable order={order} />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {logOrder && (
        <LogModal
          order={logOrder}
          onClose={() => setLogModal(null)}
          onSubmit={entry => onSubmitEntry(logOrder.id, entry)}
          loggerName={currentUserName}
          loggerRole="sourcing-poc"
        />
      )}
      {noteOrder && noteEntry && (
        <NoteModal
          order={noteOrder}
          entry={noteEntry}
          onClose={() => setNoteModal(null)}
          onSave={(note, flagged) => onSaveNote(noteOrder.id, noteEntry.id, note, flagged)}
        />
      )}
    </div>
  )
}

// ─── Vendor DPR Grid (spreadsheet-style) ─────────────────────────────────────

type RowDraft = {
  cut:     number
  stitch:  number
  finish:  number
  pack:    number
  remarks: string
  editing: boolean
  showHistory: boolean
}

type VendorDPRViewProps = {
  orders:          ProductionOrder[]
  vendorId:        string
  vendorName:      string
  onSubmitEntry:   (orderId: string, entry: Omit<DPREntry, 'id' | 'orderId'>) => void
  currentUserName: string
  vendorView:      'dpr' | 'costing'
}

// Thin inline progress bar used inside cells
function CellBar({ value, total, color }: { value: number; total: number; color: string }) {
  const p = pct(value, total)
  return (
    <div className="mt-1">
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-200', color)} style={{ width: `${p}%` }} />
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5 text-right">{p}%</p>
    </div>
  )
}

type BDraft = { fabric: string; cmt: string; trims: string; print: string; packaging: string; other: string }

function VendorDPRView({ orders, vendorId, vendorName, onSubmitEntry, currentUserName, vendorView }: VendorDPRViewProps) {
  // Match by DB UUID if available, fallback to case-insensitive name match
  const vendorOrders = orders.filter(o =>
    o.vendorId === vendorId ||
    o.vendor.toLowerCase() === vendorName.toLowerCase()
  )
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // ── Costing orders ────────────────────────────────────────────────────────
  const vendorKey = resolveVendorKey(vendorId, vendorName)
  const [costOrders, setCostOrders] = useState<VendorCostOrder[]>(
    () => VENDOR_COSTING_ORDERS[vendorKey] ?? []
  )
  const [quoteDrawer, setQuoteDrawer] = useState<string | null>(null)
  const quoteOrder = quoteDrawer ? costOrders.find(o => o.id === quoteDrawer) ?? null : null

  const [bDraft, setBDraft]           = useState<BDraft>({ fabric:'', cmt:'', trims:'', print:'0', packaging:'', other:'0' })
  const [bNotes, setBNotes]           = useState('')
  const [bPromisedDate, setBPromisedDate] = useState('')
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)
  const [quoteSuccess, setQuoteSuccess]       = useState(false)

  function openQuote(order: VendorCostOrder) {
    const ex = order.breakdown
    setBDraft({
      fabric:    ex ? String(ex.fabric)    : '',
      cmt:       ex ? String(ex.cmt)       : '',
      trims:     ex ? String(ex.trims)     : '',
      print:     ex ? String(ex.print)     : '0',
      packaging: ex ? String(ex.packaging) : '',
      other:     ex ? String(ex.other)     : '0',
    })
    setBNotes(order.notes ?? '')
    setBPromisedDate(order.promisedInwardDate ?? '')
    setQuoteSuccess(false)
    setQuoteDrawer(order.id)
  }

  function submitQuote() {
    if (!quoteOrder) return
    const n = (v: string) => parseFloat(v) || 0
    const total = n(bDraft.fabric) + n(bDraft.cmt) + n(bDraft.trims) + n(bDraft.print) + n(bDraft.packaging) + n(bDraft.other)
    if (total <= 0) return
    setQuoteSubmitting(true)
    setTimeout(() => {
      setCostOrders(prev => prev.map(o => o.id !== quoteOrder.id ? o : {
        ...o,
        costStatus: 'submitted',
        submittedCost: total,
        breakdown: { fabric: n(bDraft.fabric), cmt: n(bDraft.cmt), trims: n(bDraft.trims), print: n(bDraft.print), packaging: n(bDraft.packaging), other: n(bDraft.other) },
        notes: bNotes,
        promisedInwardDate: bPromisedDate || undefined,
      }))
      setQuoteSubmitting(false)
      setQuoteSuccess(true)
    }, 1200)
  }

  const bFields: { key: keyof BDraft; label: string; hint: string }[] = [
    { key: 'fabric',    label: 'Fabric Cost',         hint: 'Yarn / fabric / lining per piece' },
    { key: 'cmt',       label: 'CMT Charges',          hint: 'Cut, Make, Trim — labour cost' },
    { key: 'trims',     label: 'Trims & Accessories',  hint: 'Buttons, zippers, labels, patches' },
    { key: 'print',     label: 'Print / Embroidery',   hint: 'Enter 0 if not applicable' },
    { key: 'packaging', label: 'Packaging',            hint: 'Polybag, hanger, stickers' },
    { key: 'other',     label: 'Other Charges',        hint: 'Transport, overheads, misc' },
  ]

  function costStatusBadge(s: VendorCostOrder['costStatus']) {
    const map = {
      pending:   'bg-amber-100 text-amber-700',
      submitted: 'bg-violet-100 text-violet-700',
      approved:  'bg-green-100 text-green-700',
      escalated: 'bg-red-100 text-red-700',
    }
    return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', map[s])}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
  }

  function daysLeftChip(dateStr: string) {
    const diff = Math.ceil((new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0) return <span className="text-xs font-semibold text-red-600">{Math.abs(diff)}d overdue</span>
    if (diff <= 3) return <span className="text-xs font-semibold text-amber-600">{diff}d left</span>
    return <span className="text-xs font-semibold text-green-700">{diff}d left</span>
  }

  // Initialise one draft per order
  const initDraft = useCallback((order: ProductionOrder): RowDraft => {
    const te   = todayEntry(order)
    const pe   = prevEntry(order)
    const base = te ?? pe
    const alreadySubmitted = !!te || order.status === 'completed'
    return {
      cut:         base?.cutQty       ?? 0,
      stitch:      base?.stitchingQty ?? 0,
      finish:      base?.finishingQty ?? 0,
      pack:        base?.packingQty   ?? 0,
      remarks:     te?.remarks        ?? '',
      editing:     !alreadySubmitted,
      showHistory: false,
    }
  }, [])

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(
    () => Object.fromEntries(vendorOrders.map(o => [o.id, initDraft(o)]))
  )

  // Re-sync if orders update from outside (e.g. after submit)
  const prevOrdersRef = useRef(vendorOrders.map(o => o.id).join(','))
  useEffect(() => {
    const key = vendorOrders.map(o => o.id).join(',')
    if (key !== prevOrdersRef.current) {
      prevOrdersRef.current = key
      setDrafts(Object.fromEntries(vendorOrders.map(o => [o.id, initDraft(o)])))
    }
  }, [vendorOrders, initDraft])

  function setField<K extends keyof RowDraft>(id: string, key: K, value: RowDraft[K]) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function submitRow(order: ProductionOrder) {
    const d = drafts[order.id]
    if (!d) return
    onSubmitEntry(order.id, {
      date:            todayStr(),
      cutQty:          d.cut,
      stitchingQty:    d.stitch,
      finishingQty:    d.finish,
      packingQty:      d.pack,
      remarks:         d.remarks.trim() || undefined,
      submittedBy:     currentUserName,
      submittedByRole: 'vendor',
      submittedAt:     new Date().toISOString(),
    })
    setField(order.id, 'editing', false)
  }

  function submitAll() {
    vendorOrders.filter(o => drafts[o.id]?.editing && o.status !== 'completed')
      .forEach(o => submitRow(o))
  }

  const pendingCount = vendorOrders.filter(o => drafts[o.id]?.editing && o.status !== 'completed').length
  const allDone      = pendingCount === 0 && vendorOrders.length > 0

  if (vendorOrders.length === 0) {
    return (
      <div className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 px-5 py-8 text-center">
        No production orders assigned to your vendor.
      </div>
    )
  }

  const bTotal = ['fabric','cmt','trims','print','packaging','other'].reduce((s, k) => s + (parseFloat(bDraft[k as keyof BDraft]) || 0), 0)
  const pendingCost    = costOrders.filter(o => o.costStatus === 'pending').length
  const escalatedCost  = costOrders.filter(o => o.costStatus === 'escalated').length

  return (
    <div className="space-y-6">

      {/* ── Assigned Orders (Costing) ─────────────────────────────────────── */}
      {vendorView === 'costing' && <div>

        {/* Status summary tiles */}
        {costOrders.length > 0 && (() => {
          const counts = {
            escalated: costOrders.filter(o => o.costStatus === 'escalated').length,
            pending:   costOrders.filter(o => o.costStatus === 'pending').length,
            submitted: costOrders.filter(o => o.costStatus === 'submitted').length,
            approved:  costOrders.filter(o => o.costStatus === 'approved').length,
          }
          const tiles = [
            { key: 'escalated', label: 'Escalated',      count: counts.escalated, bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500'    },
            { key: 'pending',   label: 'Pending Quote',  count: counts.pending,   bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700', dot: 'bg-amber-400'  },
            { key: 'submitted', label: 'Under Review',   count: counts.submitted, bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700',dot: 'bg-violet-500' },
            { key: 'approved',  label: 'Approved',       count: counts.approved,  bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700', dot: 'bg-green-500'  },
          ]
          return (
            <div className="grid grid-cols-4 gap-3 mb-5">
              {tiles.map(t => (
                <div key={t.key} className={cn('rounded-xl border px-4 py-3', t.bg, t.border)}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', t.dot)} />
                    <p className="text-xs text-slate-500">{t.label}</p>
                  </div>
                  <p className={cn('text-2xl font-black', t.text)}>{t.count}</p>
                </div>
              ))}
            </div>
          )
        })()}

        <div className="flex items-center gap-2 mb-3">
          <IndianRupee className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-800">Orders Assigned to You</h2>
          <span className="text-xs text-slate-400">{costOrders.length} total</span>
        </div>

        {costOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No orders assigned yet
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sort: escalated → pending → submitted → approved */}
            {[...costOrders].sort((a, b) => {
              const priority: Record<string, number> = { escalated: 0, pending: 1, submitted: 2, approved: 3 }
              return (priority[a.costStatus] ?? 9) - (priority[b.costStatus] ?? 9)
            }).map(order => {
              const isPending    = order.costStatus === 'pending'
              const isSubmitted  = order.costStatus === 'submitted'
              const isApproved   = order.costStatus === 'approved'
              const isEscalated  = order.costStatus === 'escalated'

              const borderCls = isPending   ? 'border-amber-200'
                              : isSubmitted ? 'border-violet-200'
                              : isApproved  ? 'border-green-200'
                              : 'border-red-200'
              const barCls    = isPending   ? 'bg-amber-400'
                              : isSubmitted ? 'bg-violet-500'
                              : isApproved  ? 'bg-green-500'
                              : 'bg-red-500'

              const fmtDate = (d: string) =>
                new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

              const breakdownRow = order.breakdown ? (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                  {([['Fabric', order.breakdown.fabric], ['CMT', order.breakdown.cmt],
                     ['Trims', order.breakdown.trims],   ['Print', order.breakdown.print],
                     ['Packaging', order.breakdown.packaging], ['Other', order.breakdown.other],
                  ] as [string, number][]).filter(([, v]) => v > 0).map(([label, val]) => (
                    <span key={label}><span className="text-slate-400">{label} </span><span className="font-semibold">₹{val}</span></span>
                  ))}
                </div>
              ) : null

              return (
                <div key={order.id} className={cn('bg-white rounded-2xl border shadow-sm overflow-hidden', borderCls)}>
                  <div className={cn('h-1', barCls)} />

                  <div className="p-5">
                    {/* ── Top row: identity + CTA ── */}
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs text-slate-400">{order.id}</span>
                          {costStatusBadge(order.costStatus)}
                        </div>
                        <p className="text-sm font-bold text-slate-900">{order.styleCode} · {order.styleName}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{order.colour}</span>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{order.category}</span>
                          <span className="text-slate-400">· POC: {order.pocName}</span>
                        </div>
                      </div>

                      {/* CTA — one per status */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        {isPending && (
                          <button onClick={() => openQuote(order)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors">
                            <IndianRupee className="w-3.5 h-3.5" /> Submit Quote
                          </button>
                        )}
                        {isSubmitted && (
                          <>
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 text-xs font-semibold">
                              <Send className="w-3 h-3" /> Awaiting Review
                            </span>
                            <button onClick={() => openQuote(order)}
                              className="text-xs text-slate-400 hover:text-violet-600 underline underline-offset-2 transition-colors">
                              Revise quote
                            </button>
                          </>
                        )}
                        {isApproved && (
                          <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Quote Approved
                          </span>
                        )}
                        {isEscalated && (
                          <button onClick={() => openQuote(order)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
                            <IndianRupee className="w-3.5 h-3.5" /> Revise &amp; Resubmit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Escalation notice ── */}
                    {isEscalated && order.escalationNote && (
                      <div className="mt-3 flex gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-700 mb-0.5">Escalated by buyer</p>
                          <p className="text-red-600">{order.escalationNote}</p>
                        </div>
                      </div>
                    )}

                    {/* ── Stats row ── */}
                    <div className="mt-4 flex flex-wrap items-center gap-6 text-xs">
                      <div>
                        <p className="text-slate-400 mb-0.5">Order Qty</p>
                        <p className="font-bold text-slate-800">{order.orderQty.toLocaleString('en-IN')} pcs</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Your Quote</p>
                        <p className={cn('font-bold',
                          isApproved  ? 'text-green-700' :
                          isEscalated ? 'text-red-500 line-through' :
                          isSubmitted ? 'text-violet-700' : 'text-slate-300'
                        )}>
                          {order.submittedCost ? `₹${order.submittedCost} / pc` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Buyer Inward</p>
                        <p className="font-semibold text-slate-700">{fmtDate(order.inwardDate)}</p>
                      </div>
                      {order.promisedInwardDate && (() => {
                        const diffDays = Math.ceil((new Date(order.promisedInwardDate).getTime() - new Date(order.inwardDate).getTime()) / 86400000)
                        return (
                          <div>
                            <p className="text-slate-400 mb-0.5">Vendor Commit</p>
                            <p className={cn('font-semibold', diffDays > 0 ? 'text-amber-600' : 'text-green-700')}>
                              {fmtDate(order.promisedInwardDate)}
                            </p>
                            <span className={cn('text-xs font-semibold', diffDays > 0 ? 'text-amber-600' : 'text-green-700')}>
                              {diffDays > 0 ? `+${diffDays}d late` : diffDays === 0 ? 'on time' : `${Math.abs(diffDays)}d early`}
                            </span>
                          </div>
                        )
                      })()}
                      <div>
                        <p className="text-slate-400 mb-0.5">Costing Due</p>
                        <p className="font-semibold text-slate-700">{fmtDate(order.costingDueDate)}</p>
                        <span className="mt-0.5 block">{daysLeftChip(order.costingDueDate)}</span>
                      </div>
                      {isApproved && order.submittedCost && (
                        <div>
                          <p className="text-slate-400 mb-0.5">Order Value</p>
                          <p className="font-bold text-green-700">₹{(order.submittedCost * order.orderQty).toLocaleString('en-IN')}</p>
                        </div>
                      )}
                    </div>

                    {/* ── Breakdown preview ── */}
                    {order.breakdown && (isPending ? null : (
                      <div className={cn('mt-3 rounded-xl px-4 py-3',
                        isApproved  ? 'bg-green-50 border border-green-100' :
                        isEscalated ? 'bg-red-50 border border-red-100' :
                        'bg-violet-50'
                      )}>
                        <p className={cn('text-xs font-semibold mb-1.5',
                          isApproved ? 'text-green-700' : isEscalated ? 'text-red-600' : 'text-violet-700'
                        )}>
                          {isApproved ? 'Approved breakdown' : isEscalated ? 'Your previous breakdown' : 'Submitted breakdown'} · ₹{order.submittedCost} / pc
                        </p>
                        {breakdownRow}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>}

      {/* ── Daily Production Report ───────────────────────────────────────── */}
      {vendorView === 'dpr' && <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Daily Production Report</h2>
          <p className="text-xs text-slate-500 mt-0.5">{todayLabel} · Enter cumulative quantities to date</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={submitAll}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Submit All ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {allDone ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm font-medium text-green-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          All orders updated for today ✓
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {pendingCount} order{pendingCount !== 1 ? 's' : ''} pending update for today
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-48">Style</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-20">Order Qty</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-violet-600 uppercase tracking-wide whitespace-nowrap w-32">✂ Cut</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-purple-600 uppercase tracking-wide whitespace-nowrap w-32">🧵 Stitch</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-indigo-600 uppercase tracking-wide whitespace-nowrap w-32">👕 Finish</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-green-600 uppercase tracking-wide whitespace-nowrap w-32">📦 Pack</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Remarks</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Inward</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-24">Today</th>
                <th className="px-3 py-3 w-28" />
              </tr>

              {/* Previous-day reference row */}
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <td className="px-4 py-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">↑ Yesterday</span>
                </td>
                <td />
                {(['cutQty', 'stitchingQty', 'finishingQty', 'packingQty'] as const).map(field => (
                  <td key={field} className="px-3 py-1.5 text-center">
                    <div className="space-y-0.5">
                      {vendorOrders.map(o => {
                        const pe = prevEntry(o)
                        return pe ? (
                          <p key={o.id} className="text-[10px] text-slate-400">{pe[field]}</p>
                        ) : null
                      })}
                    </div>
                  </td>
                ))}
                <td colSpan={4} />
              </tr>
            </thead>

            <tbody>
              {vendorOrders.map((order, rowIdx) => {
                const d      = drafts[order.id]
                if (!d) return null
                const te     = todayEntry(order)
                const pe     = prevEntry(order)
                const dl     = daysLeft(order.inwardDate)
                const isComplete = order.status === 'completed'

                const rowBg = isComplete
                  ? 'bg-slate-50/50 opacity-60'
                  : d.editing
                  ? rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  : 'bg-green-50/30'

                // Editable number cell
                const numCell = (
                  field: 'cut' | 'stitch' | 'finish' | 'pack',
                  barColor: string
                ) => {
                  const val = d[field] as number
                  const prev = pe ? (
                    field === 'cut'    ? pe.cutQty :
                    field === 'stitch' ? pe.stitchingQty :
                    field === 'finish' ? pe.finishingQty :
                                        pe.packingQty
                  ) : 0

                  if (isComplete || !d.editing) {
                    // Read-only submitted cell
                    const submittedVal = te
                      ? (field === 'cut' ? te.cutQty : field === 'stitch' ? te.stitchingQty : field === 'finish' ? te.finishingQty : te.packingQty)
                      : val
                    return (
                      <td key={field} className={cn('px-3 py-2 text-center align-top', rowBg)}>
                        <p className="text-sm font-semibold text-slate-700">{submittedVal}</p>
                        <CellBar value={submittedVal} total={order.orderQty} color={barColor} />
                      </td>
                    )
                  }

                  return (
                    <td key={field} className={cn('px-2 py-2 align-top border-r border-slate-100 last:border-r-0', rowBg)}>
                      <input
                        type="number"
                        min={0}
                        max={order.orderQty}
                        value={val || ''}
                        placeholder={String(prev)}
                        onChange={e => setField(order.id, field, Number(e.target.value))}
                        className="w-full text-sm font-semibold text-slate-800 bg-transparent border-0 border-b-2 border-slate-200 focus:border-violet-400 focus:outline-none text-center px-1 py-0.5 placeholder:text-slate-300"
                      />
                      <CellBar value={val} total={order.orderQty} color={barColor} />
                    </td>
                  )
                }

                return (
                  <>
                    <tr
                      key={order.id}
                      className={cn('border-b border-slate-100 transition-colors', rowBg)}
                    >
                      {/* Style */}
                      <td className={cn('px-4 py-3 align-top', rowBg)}>
                        <p className="text-xs font-bold text-violet-700">{order.styleCode}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[150px]">{order.styleName}</p>
                        <p className="text-[10px] text-slate-400">{order.colour}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {statusBadge(order.status)}
                        </div>
                      </td>

                      {/* Order Qty */}
                      <td className={cn('px-3 py-3 text-right align-top', rowBg)}>
                        <p className="text-sm font-semibold text-slate-700">{order.orderQty}</p>
                        <p className="text-[10px] text-slate-400">pcs</p>
                      </td>

                      {/* Cut */}
                      {numCell('cut',    'bg-violet-500')}
                      {/* Stitch */}
                      {numCell('stitch', 'bg-purple-500')}
                      {/* Finish */}
                      {numCell('finish', 'bg-indigo-500')}
                      {/* Pack */}
                      {numCell('pack',   'bg-green-500')}

                      {/* Remarks */}
                      <td className={cn('px-2 py-2 align-top', rowBg)}>
                        {d.editing && !isComplete
                          ? <textarea
                              rows={2}
                              value={d.remarks}
                              onChange={e => setField(order.id, 'remarks', e.target.value)}
                              placeholder="Optional note…"
                              className="w-full text-xs text-slate-600 bg-transparent border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none placeholder:text-slate-300 min-w-[140px]"
                            />
                          : <p className="text-xs text-slate-500 italic">{d.remarks || '—'}</p>
                        }
                      </td>

                      {/* Inward */}
                      <td className={cn('px-3 py-3 align-top whitespace-nowrap', rowBg)}>
                        <p className="text-xs text-slate-700">{fmtDate(order.inwardDate)}</p>
                        <p className={cn('text-[10px] font-semibold mt-0.5', dl < 0 ? 'text-red-600' : dl <= 7 ? 'text-amber-600' : 'text-slate-400')}>
                          {dl < 0 ? `${Math.abs(dl)}d late` : `${dl}d left`}
                        </p>
                      </td>

                      {/* Today status */}
                      <td className={cn('px-3 py-3 text-center align-top', rowBg)}>
                        {isComplete ? (
                          <span className="text-xs text-slate-400">Done</span>
                        ) : te ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-[10px] text-green-600 font-medium">
                              {new Date(te.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className={cn('px-3 py-3 text-right align-top whitespace-nowrap', rowBg)}>
                        <div className="flex items-center justify-end gap-1">
                          {!isComplete && d.editing && (
                            <button
                              onClick={() => submitRow(order)}
                              className="flex items-center gap-1 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Save className="w-3 h-3" />
                              Save
                            </button>
                          )}
                          {!isComplete && !d.editing && (
                            <button
                              onClick={() => setField(order.id, 'editing', true)}
                              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => setField(order.id, 'showHistory', !d.showHistory)}
                            title="View history"
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {d.showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* History sub-row */}
                    {d.showHistory && (
                      <tr key={`${order.id}-hist`} className="border-b border-slate-100">
                        <td colSpan={10} className="p-0">
                          <HistorySubTable order={order} />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer legend */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-6 text-[10px] text-slate-400">
          <span>All quantities are <strong className="text-slate-500">cumulative</strong> (total produced to date, not today&apos;s addition)</span>
          <span className="ml-auto">Tab between cells · Save row to confirm · Submit All to send all pending</span>
        </div>
      </div>
      </>}

      {/* ── Submit Quote Drawer (costing view only) ──────────────────────────── */}
      {quoteDrawer && quoteOrder && (
        <div className="fixed inset-0 z-50 flex" onClick={() => { if (!quoteSuccess) setQuoteDrawer(null) }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative ml-auto flex flex-col bg-white shadow-2xl w-full md:w-[460px] h-full rounded-l-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {quoteSuccess ? (
              /* Success state */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Send className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-lg font-bold text-slate-900">Quote Submitted!</p>
                <p className="text-sm text-slate-500">
                  Your costing for <strong>{quoteOrder.styleCode}</strong> has been sent to {quoteOrder.pocName}.
                </p>
                <button
                  onClick={() => setQuoteDrawer(null)}
                  className="mt-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {quoteOrder.submittedCost ? 'Revise Your Quote' : 'Submit Your Quote'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{quoteOrder.id} · {quoteOrder.styleCode} · {quoteOrder.colour}</p>
                  </div>
                  <button onClick={() => setQuoteDrawer(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  {/* Reference strip — no buyer target shown to vendor */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Order Qty</p>
                      <p className="text-xl font-black text-slate-800">{quoteOrder.orderQty.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-slate-400">pieces</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Costing Due</p>
                      <p className="text-lg font-bold text-slate-800">
                        {new Date(quoteOrder.costingDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                      {daysLeftChip(quoteOrder.costingDueDate)}
                    </div>
                  </div>

                  <div className="flex gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-xs text-violet-700">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Enter your <strong className="mx-0.5">per-piece cost</strong> breakdown. The buyer sees each component.
                  </div>

                  {/* Breakdown inputs */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Your Cost Breakdown (₹ / piece)</p>
                    {bFields.map(({ key, label, hint }) => (
                      <div key={key} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-700">{label}</p>
                          <p className="text-xs text-slate-400">{hint}</p>
                        </div>
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                          <input
                            type="number" min="0" step="0.5"
                            value={bDraft[key]}
                            onChange={e => setBDraft(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-right"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Running total */}
                  {bTotal > 0 && (
                    <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Your Total Quote</p>
                      <p className="text-xl font-black text-slate-900">₹{bTotal.toFixed(0)} <span className="text-xs font-normal text-slate-400">per piece</span></p>
                    </div>
                  )}

                  {/* Promised inward date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      Your Promised Inward Date
                    </label>
                    <p className="text-xs text-slate-400 mb-2">
                      Buyer's expected inward: <strong className="text-slate-600">
                        {new Date(quoteOrder.inwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </strong>
                    </p>
                    <input
                      type="date"
                      value={bPromisedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setBPromisedDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    />
                    {bPromisedDate && (() => {
                      const buyerDate  = new Date(quoteOrder.inwardDate)
                      const vendorDate = new Date(bPromisedDate)
                      const diffDays   = Math.ceil((vendorDate.getTime() - buyerDate.getTime()) / 86400000)
                      if (diffDays <= 0) return (
                        <p className="text-xs text-green-600 font-medium mt-1.5">
                          {diffDays === 0 ? '✓ Matches buyer inward date' : `✓ ${Math.abs(diffDays)}d ahead of buyer inward date`}
                        </p>
                      )
                      return (
                        <p className="text-xs text-amber-600 font-medium mt-1.5">
                          ⚠ {diffDays}d after buyer inward date — buyer may request an earlier commitment
                        </p>
                      )
                    })()}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes (optional)</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Fabric cost elevated due to yarn dyed woven..."
                      value={bNotes}
                      onChange={e => setBNotes(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
                  <button
                    onClick={submitQuote}
                    disabled={bTotal <= 0 || quoteSubmitting}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
                      bTotal > 0 && !quoteSubmitting
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    <Send className="w-4 h-4" />
                    {quoteSubmitting ? 'Submitting…' : 'Submit Quote to Buyer'}
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

// ─── OTIF helpers ─────────────────────────────────────────────────────────────

function Minus({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14" /></svg>
}
function TrendingDown({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ReportsPageInner() {
  const { currentUser } = useCurrentUser()
  const searchParams    = useSearchParams()
  const isVendor        = currentUser.role === 'vendor'
  // Vendor uses ?view=dpr | ?view=costing; defaults to dpr
  const vendorView      = (searchParams.get('view') ?? 'dpr') as 'dpr' | 'costing'

  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>(INITIAL_PRODUCTION_ORDERS)
  const [activeReport, setActiveReport] = useState<'overview' | 'dpr' | 'otif' | 'fi' | 'category'>('overview')
  const [otifLevel,    setOtifLevel]    = useState<'overall' | 'poc' | 'vendor'>('overall')

  const dprDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const submitEntry = (orderId: string, entry: Omit<DPREntry, 'id' | 'orderId'>) => {
    setProductionOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const t = todayStr()
      const newEntry: DPREntry = { id: `dpr-${Date.now()}`, orderId, ...entry }
      return { ...o, dprLog: [...o.dprLog.filter(e => e.date !== t), newEntry] }
    }))
  }

  const saveNote = (orderId: string, entryId: string, note: string, flagged: boolean) => {
    setProductionOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      return { ...o, dprLog: o.dprLog.map(e => e.id !== entryId ? e : { ...e, pocNote: note || undefined, isFlagged: flagged }) }
    }))
  }

  const vendorTitle    = vendorView === 'costing' ? 'Order Costing' : 'Daily Production Report'
  const vendorSubtitle = vendorView === 'costing' ? 'Manage your price quotes' : `${dprDate} · Enter cumulative quantities`

  return (
    <>
      <Header
        title={isVendor ? vendorTitle : 'Reports & DPR'}
        subtitle={isVendor ? vendorSubtitle : `Daily Production Report · ${dprDate}`}
      />
      <div className="px-6 py-6">

        {isVendor ? (
          <VendorDPRView
            orders={productionOrders}
            vendorId={currentUser.vendorId ?? ''}
            vendorName={currentUser.department}
            onSubmitEntry={submitEntry}
            currentUserName={currentUser.name}
            vendorView={vendorView}
          />
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {[
                { key: 'overview',  label: 'Overview',                       icon: BarChart2       },
                { key: 'dpr',       label: 'Daily Production (DPR)',          icon: FileSpreadsheet },
                { key: 'otif',      label: 'OTIF Analysis',                   icon: TrendingUp      },
                { key: 'fi',        label: 'FI Summary',                      icon: CheckCircle2    },
                { key: 'category',  label: 'Category Breakdown',              icon: Layers          },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveReport(key as typeof activeReport)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                    activeReport === key
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
              <div className="flex-1" />
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium transition-colors">
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>

            {/* ── Overview tab ────────────────────────────────────────────── */}
            {activeReport === 'overview' && (() => {
              const total       = subOrders.length
              const overdueN    = subOrders.filter(s => s.status === 'overdue').length
              const attentionN  = subOrders.filter(s => s.status === 'needs-attention').length
              const onTrackN    = subOrders.filter(s => s.status === 'on-track').length
              const completedN  = subOrders.filter(s => s.status === 'completed').length
              const atRiskN     = subOrders.filter(s => s.atRisk).length
              const totalQty    = subOrders.reduce((a, s) => a + s.orderQty, 0)
              const dispatchQty = subOrders.reduce((a, s) => a + s.dispatchedQty, 0)
              const grnQtyN     = subOrders.reduce((a, s) => a + s.grnQty, 0)
              const avgOtif     = Math.round(vendors.reduce((a, v) => a + (v.otifScore ?? 0), 0) / vendors.length)

              const stageOrder  = ['vendor-assign', 'costing', 'pre-prod', 'production', 'fi', 'dispatched', 'grn']
              const stageLabels : Record<string, string> = {
                'vendor-assign': 'Vendor Assign', costing: 'Costing', 'pre-prod': 'Pre-Prod',
                production: 'Production', fi: 'Final Inspection', dispatched: 'Dispatched', grn: 'GRN',
              }
              const stageColors : Record<string, string> = {
                'vendor-assign': 'bg-slate-400',  costing: 'bg-amber-400',   'pre-prod': 'bg-blue-400',
                production: 'bg-violet-500', fi: 'bg-indigo-500', dispatched: 'bg-teal-500', grn: 'bg-green-500',
              }
              const stageCounts  = stageOrder.map(s => ({ stage: s, count: subOrders.filter(o => o.currentStage === s).length }))
              const atRiskOrders = subOrders.filter(s => s.atRisk)

              return (
                <div className="space-y-5">
                  {/* KPI Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: 'Total SubOrders', value: total,      color: 'text-violet-700', bg: 'bg-violet-50  border-violet-100' },
                      { label: 'Overdue',         value: overdueN,   color: 'text-red-700',    bg: 'bg-red-50     border-red-100'    },
                      { label: 'Needs Attention', value: attentionN, color: 'text-amber-700',  bg: 'bg-amber-50   border-amber-100'  },
                      { label: 'On-Track',        value: onTrackN,   color: 'text-green-700',  bg: 'bg-green-50   border-green-100'  },
                      { label: 'Completed',       value: completedN, color: 'text-slate-600',  bg: 'bg-slate-50   border-slate-200'  },
                      { label: 'At-Risk Flag',    value: atRiskN,    color: 'text-orange-700', bg: 'bg-orange-50  border-orange-100' },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={cn('rounded-xl border px-4 py-4', bg)}>
                        <p className={cn('text-3xl font-bold', color)}>{value}</p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Stage Pipeline + Qty Funnel */}
                  <div className="grid grid-cols-3 gap-5">
                    <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">Stage Pipeline</h3>
                      <p className="text-xs text-slate-400 mb-4">Distribution of SubOrders across production stages</p>
                      <div className="space-y-2.5">
                        {stageCounts.map(({ stage, count }) => (
                          <div key={stage} className="flex items-center gap-3">
                            <div className="w-28 text-xs font-medium text-slate-500 text-right flex-shrink-0">{stageLabels[stage]}</div>
                            <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden relative">
                              {count > 0 ? (
                                <div
                                  className={cn('h-full rounded-lg flex items-center px-2 transition-all', stageColors[stage])}
                                  style={{ width: `${Math.max((count / total) * 100, 8)}%` }}
                                >
                                  <span className="text-white text-xs font-bold">{count}</span>
                                </div>
                              ) : (
                                <span className="absolute left-2 top-0 bottom-0 flex items-center text-slate-400 text-xs">—</span>
                              )}
                            </div>
                            <div className="w-10 text-xs text-slate-400 font-medium">{Math.round((count / total) * 100)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">Quantity Funnel</h3>
                      <p className="text-xs text-slate-400 mb-4">Total units across key milestones</p>
                      <div className="space-y-4">
                        {[
                          { label: 'Ordered',    qty: totalQty,    pct: 100,                                               color: 'bg-violet-500' },
                          { label: 'Dispatched', qty: dispatchQty, pct: totalQty ? Math.round((dispatchQty / totalQty) * 100) : 0, color: 'bg-teal-500'   },
                          { label: "GRN'd",      qty: grnQtyN,     pct: totalQty ? Math.round((grnQtyN     / totalQty) * 100) : 0, color: 'bg-green-500'  },
                        ].map(({ label, qty, pct, color }) => (
                          <div key={label}>
                            <div className="flex justify-between text-xs text-slate-600 mb-1">
                              <span className="font-medium">{label}</span>
                              <span className="font-bold">{qty.toLocaleString()} pcs</span>
                            </div>
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-slate-400 text-right mt-0.5">{pct}%</p>
                          </div>
                        ))}
                        <div className="pt-3 border-t border-slate-100">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Fleet Avg OTIF</span>
                            <span className={cn('font-bold text-sm', avgOtif >= 75 ? 'text-green-600' : avgOtif >= 60 ? 'text-amber-600' : 'text-red-600')}>{avgOtif}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', avgOtif >= 75 ? 'bg-green-500' : avgOtif >= 60 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${avgOtif}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* At-Risk Orders */}
                  {atRiskOrders.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-semibold text-slate-900">At-Risk Orders</h3>
                        <span className="ml-auto text-xs text-slate-400">{atRiskOrders.length} SubOrders flagged</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              {['SubOrder ID', 'Style', 'Category', 'Stage', 'Status', 'Vendor', 'Inward Date'].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {atRiskOrders.map(o => {
                              const statusMap: Record<string, string> = {
                                'overdue': 'bg-red-50 text-red-700',
                                'needs-attention': 'bg-amber-50 text-amber-700',
                                'on-track': 'bg-green-50 text-green-700',
                                'completed': 'bg-slate-50 text-slate-600',
                              }
                              const statusLabel: Record<string, string> = {
                                'overdue': 'Overdue', 'needs-attention': 'Attention',
                                'on-track': 'On-Track', 'completed': 'Completed',
                              }
                              return (
                                <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                  <td className="px-4 py-3 text-xs font-mono text-violet-700 whitespace-nowrap">{o.id}</td>
                                  <td className="px-4 py-3">
                                    <p className="text-xs font-medium text-slate-900 whitespace-nowrap">{o.styleName}</p>
                                    <p className="text-xs text-slate-400">{o.styleCode} · {o.colour}</p>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{o.category}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600 capitalize whitespace-nowrap">{o.currentStage.replace('-', ' ')}</td>
                                  <td className="px-4 py-3">
                                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', statusMap[o.status] ?? 'bg-slate-50 text-slate-600')}>
                                      {statusLabel[o.status] ?? o.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{o.vendor.name}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{o.buyingExpectedInwardDate}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* DPR tab */}
            {activeReport === 'dpr' && (
              <POCDPRView
                orders={productionOrders}
                onSubmitEntry={submitEntry}
                onSaveNote={saveNote}
                currentUserName={currentUser.name}
              />
            )}

            {/* OTIF tab */}
            {activeReport === 'otif' && (
              <div className="space-y-5">
                {/* Sub-tab bar */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                  {([
                    { key: 'overall', label: 'Overall' },
                    { key: 'poc',     label: 'POC Level' },
                    { key: 'vendor',  label: 'Vendor Level' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setOtifLevel(key)}
                      className={cn(
                        'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        otifLevel === key
                          ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── Overall ──────────────────────────────────────────────── */}
                {otifLevel === 'overall' && (() => {
                  const avgOtif  = Math.round(vendors.reduce((a, v) => a + (v.otifScore ?? 0), 0) / vendors.length)
                  const avgFi    = Math.round(vendors.reduce((a, v) => a + (v.fiPassRate ?? 0), 0) / vendors.length)
                  const greenV   = vendors.filter(v => (v.otifScore ?? 0) >= 75).length
                  const atRiskV  = vendors.filter(v => subOrders.some(s => s.vendor.id === v.id && s.atRisk)).length

                  // ── Trendline data (weekly fleet avg, last 10 weeks of SS25) ──
                  const trendWeeks = ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6','Wk 7','Wk 8','Wk 9','Wk 10']
                  const trendData  = [58, 62, 55, 64, 69, 66, 71, 74, 72, avgOtif]
                  // SVG chart geometry
                  const cW = 460, cH = 100, padL = 44, padT = 12, padB = 28
                  const minV = 40, maxV = 100
                  const xStep = cW / (trendData.length - 1)
                  const ty = (v: number) => padT + cH - ((v - minV) / (maxV - minV)) * cH
                  const tx = (i: number) => padL + i * xStep
                  const pts: [number, number][] = trendData.map((v, i) => [tx(i), ty(v)])
                  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
                  const areaPath = `${linePath} L ${pts[pts.length-1][0].toFixed(1)} ${(padT+cH).toFixed(1)} L ${padL} ${(padT+cH).toFixed(1)} Z`
                  const target75Y = ty(75)
                  const svgW = padL + cW + 10
                  const svgH = padT + cH + padB

                  // ── Delay reason breakdown ──
                  const delayedOrders = subOrders.filter(s => s.status === 'overdue' || s.atRisk)
                  const dTotal = delayedOrders.length || 1
                  const delayReasons = [
                    { label: 'Late Fabric / Raw Material', pct: 0.34, color: 'bg-red-500',    light: 'text-red-600' },
                    { label: 'Production Capacity Crunch', pct: 0.25, color: 'bg-amber-500',  light: 'text-amber-600' },
                    { label: 'QC Rejection / Rework',      pct: 0.19, color: 'bg-orange-400', light: 'text-orange-600' },
                    { label: 'Vendor Unavailability',       pct: 0.12, color: 'bg-rose-400',   light: 'text-rose-600' },
                    { label: 'Design / Spec Changes',       pct: 0.07, color: 'bg-slate-400',  light: 'text-slate-600' },
                    { label: 'Logistics Delay',             pct: 0.03, color: 'bg-slate-300',  light: 'text-slate-500' },
                  ].map(r => ({ ...r, count: Math.max(1, Math.round(dTotal * r.pct)) }))
                  const maxCount = Math.max(...delayReasons.map(r => r.count))

                  return (
                    <div className="space-y-5">
                      {/* KPI Cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { label: 'Fleet Avg OTIF',      value: `${avgOtif}%`, color: avgOtif >= 75 ? 'text-green-700' : avgOtif >= 60 ? 'text-amber-700' : 'text-red-700', bg: avgOtif >= 75 ? 'bg-green-50' : avgOtif >= 60 ? 'bg-amber-50' : 'bg-red-50' },
                          { label: 'Avg FI Pass Rate',    value: `${avgFi}%`,   color: avgFi  >= 85 ? 'text-green-700' : 'text-amber-700', bg: avgFi >= 85 ? 'bg-green-50' : 'bg-amber-50' },
                          { label: 'High Performers ≥75', value: greenV,        color: 'text-violet-700', bg: 'bg-violet-50' },
                          { label: 'Vendors w/ At-Risk',  value: atRiskV,       color: atRiskV > 0 ? 'text-red-700' : 'text-green-700', bg: atRiskV > 0 ? 'bg-red-50' : 'bg-green-50' },
                        ].map(({ label, value, color, bg }) => (
                          <div key={label} className={cn('rounded-xl border border-slate-200 px-5 py-4', bg)}>
                            <p className={cn('text-3xl font-bold', color)}>{value}</p>
                            <p className="text-xs text-slate-500 mt-1">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* ── Trendline + Delay Reasons ─────────────────────── */}
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                        {/* SVG Trendline — 3 cols */}
                        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">OTIF Trendline</h3>
                              <p className="text-xs text-slate-500 mt-0.5">Weekly fleet average · SS25 season to date</p>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-shrink-0">
                              <span className="flex items-center gap-1.5">
                                <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg>
                                OTIF %
                              </span>
                              <span className="flex items-center gap-1.5">
                                <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
                                Target 75%
                              </span>
                            </div>
                          </div>
                          <div className="px-3 py-3">
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
                              <defs>
                                <linearGradient id="otifAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
                                </linearGradient>
                              </defs>
                              {/* Y-axis grid lines */}
                              {[40, 55, 70, 85, 100].map(val => (
                                <g key={val}>
                                  <line x1={padL} y1={ty(val)} x2={padL + cW} y2={ty(val)} stroke="#f1f5f9" strokeWidth="1" />
                                  <text x={padL - 6} y={ty(val) + 3.5} textAnchor="end" fontSize="7.5" fill="#94a3b8">{val}</text>
                                </g>
                              ))}
                              {/* Target 75% dashed reference */}
                              <line x1={padL} y1={target75Y} x2={padL + cW} y2={target75Y}
                                stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5 3" />
                              <text x={padL + cW + 3} y={target75Y + 3.5} fontSize="7" fill="#94a3b8">75%</text>
                              {/* Area fill */}
                              <path d={areaPath} fill="url(#otifAreaGrad)" />
                              {/* Trend line */}
                              <path d={linePath} fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              {/* Data points */}
                              {pts.map(([x, y], i) => {
                                const isLast = i === pts.length - 1
                                const v = trendData[i]
                                return (
                                  <g key={i}>
                                    {isLast
                                      ? <circle cx={x} cy={y} r="4.5" fill="#7c3aed" stroke="white" strokeWidth="1.5" />
                                      : <circle cx={x} cy={y} r="3" fill="white" stroke="#7c3aed" strokeWidth="1.8" />
                                    }
                                    {/* Value label on last point */}
                                    {isLast && (
                                      <text x={x} y={y - 8} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#7c3aed">{v}%</text>
                                    )}
                                    {/* Week label */}
                                    <text x={x} y={svgH - 4} textAnchor="middle" fontSize="7" fill="#94a3b8">{trendWeeks[i]}</text>
                                  </g>
                                )
                              })}
                            </svg>
                          </div>
                          {/* Mini trend summary */}
                          <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-6 text-xs">
                            <div>
                              <span className="text-slate-400">Season Low</span>
                              <span className="ml-2 font-bold text-red-600">{Math.min(...trendData)}%</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Season High</span>
                              <span className="ml-2 font-bold text-green-600">{Math.max(...trendData)}%</span>
                            </div>
                            <div>
                              <span className="text-slate-400">4-wk avg</span>
                              <span className="ml-2 font-bold text-violet-600">
                                {Math.round(trendData.slice(-4).reduce((a, b) => a + b, 0) / 4)}%
                              </span>
                            </div>
                            <div className="ml-auto flex items-center gap-1.5">
                              {trendData[trendData.length - 1] > trendData[trendData.length - 2]
                                ? <><TrendingUp className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 font-semibold">Improving</span></>
                                : <><TrendingDown className="w-3.5 h-3.5 text-red-500" /><span className="text-red-600 font-semibold">Declining</span></>
                              }
                            </div>
                          </div>
                        </div>

                        {/* Delay Reason Breakdown — 2 cols */}
                        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-900">Delay Reason Breakdown</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{delayedOrders.length} orders delayed or at-risk</p>
                          </div>
                          <div className="px-5 py-4 space-y-4">
                            {delayReasons.map((r, i) => (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs text-slate-700 font-medium leading-tight">{r.label}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className={cn('text-xs font-bold', r.light)}>{r.count}</span>
                                    <span className="text-[10px] text-slate-400">{Math.round((r.count / dTotal) * 100)}%</span>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full transition-all', r.color)}
                                    style={{ width: `${maxCount > 0 ? (r.count / maxCount) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-5 pb-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-amber-800">Top Issue</p>
                                <p className="text-xs text-amber-700 mt-0.5">{delayReasons[0].label} — affecting {delayReasons[0].count} orders</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── Vendor OTIF Table ──────────────────────────────── */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <h3 className="text-sm font-semibold text-slate-900">OTIF Performance by Vendor</h3>
                          <p className="text-xs text-slate-500 mt-0.5">On-Time In-Full delivery performance · SS25 season to date</p>
                        </div>
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Vendor', 'Location', 'OTIF Score', 'FI Pass Rate', 'Active Orders', 'At Risk', 'Trend'].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...vendors].sort((a, b) => (b.otifScore ?? 0) - (a.otifScore ?? 0)).map(v => {
                              const orders = subOrders.filter(s => s.vendor.id === v.id)
                              const active = orders.filter(s => s.status !== 'completed').length
                              const atRisk = orders.filter(s => s.atRisk).length
                              const otif   = v.otifScore ?? 0
                              return (
                                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{v.name}</td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{v.location}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn('h-full rounded-full', otif >= 75 ? 'bg-green-500' : otif >= 60 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${otif}%` }} />
                                      </div>
                                      <span className={cn('text-sm font-bold', otif >= 75 ? 'text-green-600' : otif >= 60 ? 'text-amber-600' : 'text-red-600')}>{otif}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={cn('text-sm font-semibold', (v.fiPassRate ?? 0) >= 85 ? 'text-green-600' : (v.fiPassRate ?? 0) >= 70 ? 'text-amber-600' : 'text-red-600')}>
                                      {v.fiPassRate ?? '—'}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">{active}</td>
                                  <td className="px-4 py-3">
                                    {atRisk > 0 ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">{atRisk} at risk</span> : <span className="text-xs text-slate-400">—</span>}
                                  </td>
                                  <td className="px-4 py-3">
                                    {otif >= 75 ? <TrendingUp className="w-4 h-4 text-green-500" /> : otif >= 60 ? <Minus className="w-4 h-4 text-amber-400" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* ── POC Level ────────────────────────────────────────────── */}
                {otifLevel === 'poc' && (() => {
                  type PocRow = {
                    id: string; name: string; initials: string
                    total: number; onTime: number; otRate: number; ifRate: number
                    otifScore: number; atRisk: number; overdue: number
                    avgVendorOtif: number; totalQty: number; dispatchedQty: number
                  }
                  const pocAvatarColors = ['bg-violet-600','bg-indigo-500','bg-sky-500','bg-teal-500','bg-rose-500','bg-amber-500']
                  const pocMap: Record<string, { name: string; initials: string; orders: typeof subOrders }> = {}
                  subOrders.forEach(s => {
                    const id = s.poc.id
                    if (!pocMap[id]) pocMap[id] = { name: s.poc.name, initials: s.poc.initials, orders: [] }
                    pocMap[id].orders.push(s)
                  })
                  const pocRows: PocRow[] = Object.entries(pocMap).map(([id, { name, initials, orders }]) => {
                    const total         = orders.length
                    const onTime        = orders.filter(s => s.status === 'on-track' || s.status === 'completed').length
                    const totalQty      = orders.reduce((a, s) => a + s.orderQty, 0)
                    const dispatchedQty = orders.reduce((a, s) => a + s.dispatchedQty, 0)
                    const otRate        = total    ? Math.round((onTime        / total)    * 100) : 0
                    const ifRate        = totalQty ? Math.round((dispatchedQty / totalQty) * 100) : 0
                    const otifScore     = Math.round((otRate * ifRate) / 100)
                    const atRisk        = orders.filter(s => s.atRisk).length
                    const overdue       = orders.filter(s => s.status === 'overdue').length
                    const vendorIds     = [...new Set(orders.map(s => s.vendor.id))]
                    const avgVendorOtif = vendorIds.length
                      ? Math.round(vendors.filter(v => vendorIds.includes(v.id)).reduce((a, v) => a + (v.otifScore ?? 0), 0) / vendorIds.length)
                      : 0
                    return { id, name, initials, total, onTime, otRate, ifRate, otifScore, atRisk, overdue, avgVendorOtif, totalQty, dispatchedQty }
                  }).sort((a, b) => b.otifScore - a.otifScore)

                  return (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">OTIF Performance by Sourcing POC</h3>
                          <p className="text-xs text-slate-500 mt-0.5">On-Time rate × In-Full rate · portfolio-level score per POC</p>
                        </div>
                        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
                          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />≥75 Good</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />50–74 Watch</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />&lt;50 Action</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['POC', 'Portfolio', 'On-Time Rate', 'In-Full Rate', 'OTIF Score', 'Overdue', 'At-Risk', 'Avg Vendor OTIF'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pocRows.map((row, rowIdx) => {
                              const otifColor = row.otifScore >= 75 ? 'text-green-600' : row.otifScore >= 50 ? 'text-amber-600' : 'text-red-600'
                              return (
                                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', pocAvatarColors[rowIdx % pocAvatarColors.length])}>
                                        {row.initials}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                                        <p className="text-xs text-slate-400">{row.total} orders</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-sm text-slate-700">{row.totalQty.toLocaleString()} pcs</td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                        <div className={cn('h-full rounded-full', row.otRate >= 75 ? 'bg-green-500' : row.otRate >= 50 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${row.otRate}%` }} />
                                      </div>
                                      <span className={cn('text-sm font-bold', row.otRate >= 75 ? 'text-green-600' : row.otRate >= 50 ? 'text-amber-600' : 'text-red-600')}>{row.otRate}%</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">{row.onTime}/{row.total} on schedule</p>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                        <div className={cn('h-full rounded-full', row.ifRate >= 75 ? 'bg-teal-500' : row.ifRate >= 40 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${Math.max(row.ifRate, 2)}%` }} />
                                      </div>
                                      <span className={cn('text-sm font-bold', row.ifRate >= 75 ? 'text-teal-600' : row.ifRate >= 40 ? 'text-amber-600' : 'text-red-600')}>{row.ifRate}%</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">{row.dispatchedQty.toLocaleString()}/{row.totalQty.toLocaleString()} pcs</p>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="relative w-10 h-10 flex-shrink-0">
                                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                          <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                                          <circle cx="18" cy="18" r="14" fill="none"
                                            stroke={row.otifScore >= 75 ? '#22c55e' : row.otifScore >= 50 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="4"
                                            strokeDasharray={`${(row.otifScore / 100) * 87.9} 87.9`}
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                        <span className={cn('absolute inset-0 flex items-center justify-center text-[10px] font-bold', otifColor)}>{row.otifScore}</span>
                                      </div>
                                      <div>
                                        <p className={cn('text-base font-bold leading-tight', otifColor)}>{row.otifScore}%</p>
                                        <p className="text-xs text-slate-400">OT × IF</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    {row.overdue > 0
                                      ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{row.overdue} overdue</span>
                                      : <span className="text-xs text-slate-300">—</span>}
                                  </td>
                                  <td className="px-4 py-4">
                                    {row.atRisk > 0
                                      ? <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{row.atRisk} at risk</span>
                                      : <span className="text-xs text-slate-300">—</span>}
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className={cn('text-sm font-semibold', row.avgVendorOtif >= 75 ? 'text-green-600' : row.avgVendorOtif >= 60 ? 'text-amber-600' : 'text-red-600')}>
                                      {row.avgVendorOtif}%
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* ── Vendor Level ──────────────────────────────────────────── */}
                {otifLevel === 'vendor' && (() => {
                  const vendorRows = vendors
                    .filter(v => subOrders.some(s => s.vendor.id === v.id))
                    .map(v => {
                      const orders        = subOrders.filter(s => s.vendor.id === v.id)
                      const total         = orders.length
                      const onTime        = orders.filter(s => s.status === 'on-track' || s.status === 'completed').length
                      const totalQty      = orders.reduce((a, s) => a + s.orderQty, 0)
                      const dispatchedQty = orders.reduce((a, s) => a + s.dispatchedQty, 0)
                      const otRate        = total    ? Math.round((onTime        / total)    * 100) : 0
                      const ifRate        = totalQty ? Math.round((dispatchedQty / totalQty) * 100) : 0
                      const otifScore     = Math.round((otRate * ifRate) / 100)
                      const atRisk        = orders.filter(s => s.atRisk).length
                      const overdue       = orders.filter(s => s.status === 'overdue').length
                      return {
                        id: v.id, name: v.name, location: v.location,
                        masterOtif: v.otifScore ?? 0, fiPassRate: v.fiPassRate ?? 0,
                        total, onTime, otRate, ifRate, otifScore, atRisk, overdue, totalQty, dispatchedQty,
                      }
                    })
                    .sort((a, b) => b.otifScore - a.otifScore)

                  return (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">OTIF Performance by Vendor</h3>
                          <p className="text-xs text-slate-500 mt-0.5">On-Time rate × In-Full rate · computed from active orders per vendor</p>
                        </div>
                        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
                          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />≥75 Good</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />50–74 Watch</span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />&lt;50 Action</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Vendor', 'Location', 'Portfolio', 'On-Time Rate', 'In-Full Rate', 'OTIF Score', 'Season OTIF', 'FI Pass Rate', 'At-Risk'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {vendorRows.map(row => {
                              const otifColor   = row.otifScore  >= 75 ? 'text-green-600'  : row.otifScore  >= 50 ? 'text-amber-600'  : 'text-red-600'
                              const masterColor = row.masterOtif >= 75 ? 'text-green-600'  : row.masterOtif >= 60 ? 'text-amber-600'  : 'text-red-600'
                              const borderL     = row.masterOtif >= 75 ? 'border-l-4 border-l-green-400' : row.masterOtif >= 60 ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-red-400'
                              const avatarBg    = row.masterOtif >= 75 ? 'bg-green-500'    : row.masterOtif >= 60 ? 'bg-amber-400'    : 'bg-red-500'
                              return (
                                <tr key={row.id} className={cn('border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors', borderL)}>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0', avatarBg)}>
                                        {row.name.slice(0, 2)}
                                      </div>
                                      <p className="text-xs font-semibold text-slate-900 whitespace-nowrap">{row.name}</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-xs text-slate-500">{row.location}</td>
                                  <td className="px-4 py-4 text-sm text-slate-700">{row.total} orders</td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                        <div className={cn('h-full rounded-full', row.otRate >= 75 ? 'bg-green-500' : row.otRate >= 50 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${row.otRate}%` }} />
                                      </div>
                                      <span className={cn('text-sm font-bold', row.otRate >= 75 ? 'text-green-600' : row.otRate >= 50 ? 'text-amber-600' : 'text-red-600')}>{row.otRate}%</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">{row.onTime}/{row.total} on schedule</p>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                        <div className={cn('h-full rounded-full', row.ifRate >= 75 ? 'bg-teal-500' : row.ifRate >= 40 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${Math.max(row.ifRate, 2)}%` }} />
                                      </div>
                                      <span className={cn('text-sm font-bold', row.ifRate >= 75 ? 'text-teal-600' : row.ifRate >= 40 ? 'text-amber-600' : 'text-red-600')}>{row.ifRate}%</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">{row.dispatchedQty.toLocaleString()}/{row.totalQty.toLocaleString()} pcs</p>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="relative w-10 h-10 flex-shrink-0">
                                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                          <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                                          <circle cx="18" cy="18" r="14" fill="none"
                                            stroke={row.otifScore >= 75 ? '#22c55e' : row.otifScore >= 50 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="4"
                                            strokeDasharray={`${(row.otifScore / 100) * 87.9} 87.9`}
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                        <span className={cn('absolute inset-0 flex items-center justify-center text-[10px] font-bold', otifColor)}>{row.otifScore}</span>
                                      </div>
                                      <div>
                                        <p className={cn('text-base font-bold leading-tight', otifColor)}>{row.otifScore}%</p>
                                        <p className="text-xs text-slate-400">OT × IF</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn('h-full rounded-full', row.masterOtif >= 75 ? 'bg-green-500' : row.masterOtif >= 60 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${row.masterOtif}%` }} />
                                      </div>
                                      <span className={cn('text-sm font-bold', masterColor)}>{row.masterOtif}%</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">Season avg</p>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className={cn('text-sm font-semibold', row.fiPassRate >= 85 ? 'text-green-600' : row.fiPassRate >= 70 ? 'text-amber-600' : 'text-red-600')}>
                                      {row.fiPassRate}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    {row.atRisk > 0
                                      ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{row.atRisk} at risk</span>
                                      : <span className="text-xs text-slate-300">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* FI tab */}
            {activeReport === 'fi' && (
              <div className="space-y-5">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'FI Requests', value: subOrders.flatMap(s => s.fiRequests).length,                              color: 'text-violet-700',  bg: 'bg-violet-50'  },
                    { label: 'Passed',       value: subOrders.flatMap(s => s.fiRequests).filter(f => f.result === 'pass').length, color: 'text-green-700', bg: 'bg-green-50' },
                    { label: 'Failed',       value: subOrders.flatMap(s => s.fiRequests).filter(f => f.result === 'fail').length, color: 'text-red-700',   bg: 'bg-red-50'   },
                    { label: 'Pending',      value: subOrders.flatMap(s => s.fiRequests).filter(f => !f.result).length,          color: 'text-amber-700', bg: 'bg-amber-50' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={cn('rounded-xl border border-slate-200 px-5 py-4', bg)}>
                      <p className={cn('text-3xl font-bold', color)}>{value}</p>
                      <p className="text-xs text-slate-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No active FI requests for Nautinati SS25 at this time.</p>
                  <p className="text-xs text-slate-400 mt-1">FI requests will appear here once raised from SubOrder pages.</p>
                </div>
              </div>
            )}

            {/* ── Category Breakdown tab ───────────────────────────────────── */}
            {activeReport === 'category' && (() => {
              const cats = [...new Set(subOrders.map(s => s.category))].sort()
              const statusColors: Record<string, string> = {
                'overdue':          'bg-red-500',
                'needs-attention':  'bg-amber-400',
                'on-track':         'bg-green-500',
                'completed':        'bg-slate-400',
              }
              const statusLabels: Record<string, string> = {
                'overdue': 'Overdue', 'needs-attention': 'Attention',
                'on-track': 'On-Track', 'completed': 'Completed',
              }
              return (
                <div className="space-y-5">
                  {/* Category Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cats.map(cat => {
                      const catOrders    = subOrders.filter(s => s.category === cat)
                      const totalQty     = catOrders.reduce((a, s) => a + s.orderQty, 0)
                      const dispatchQty  = catOrders.reduce((a, s) => a + s.dispatchedQty, 0)
                      const atRiskCount  = catOrders.filter(s => s.atRisk).length
                      const catVendorIds = [...new Set(catOrders.map(s => s.vendor.id))]
                      const catVendors   = vendors.filter(v => catVendorIds.includes(v.id))
                      const avgOtif      = catVendors.length
                        ? Math.round(catVendors.reduce((a, v) => a + (v.otifScore ?? 0), 0) / catVendors.length)
                        : 0
                      const statuses = ['overdue', 'needs-attention', 'on-track', 'completed']
                      const statusCounts = statuses.map(st => ({
                        st, count: catOrders.filter(s => s.status === st).length,
                      }))

                      return (
                        <div key={cat} className="bg-white rounded-xl border border-slate-200 p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">{cat}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">{catOrders.length} SubOrders · {catVendors.length} vendor{catVendors.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="text-right">
                              <p className={cn('text-xl font-bold', avgOtif >= 75 ? 'text-green-600' : avgOtif >= 60 ? 'text-amber-600' : 'text-red-600')}>{avgOtif}%</p>
                              <p className="text-xs text-slate-400">Avg OTIF</p>
                            </div>
                          </div>

                          {/* Status distribution */}
                          <div className="mb-3">
                            <p className="text-xs text-slate-500 mb-1.5 font-medium">Order Status Distribution</p>
                            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                              {statusCounts.map(({ st, count }) => count > 0 && (
                                <div
                                  key={st}
                                  className={statusColors[st]}
                                  style={{ flex: count }}
                                  title={`${statusLabels[st]}: ${count}`}
                                />
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2">
                              {statusCounts.filter(s => s.count > 0).map(({ st, count }) => (
                                <div key={st} className="flex items-center gap-1.5">
                                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColors[st])} />
                                  <span className="text-xs text-slate-500">{statusLabels[st]} <span className="font-semibold text-slate-700">({count})</span></span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Qty stats */}
                          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                            <div>
                              <p className="text-xs text-slate-400">Ordered</p>
                              <p className="text-sm font-bold text-slate-900">{totalQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">pcs</span></p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Dispatched</p>
                              <p className="text-sm font-bold text-slate-900">{dispatchQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">pcs</span></p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">At-Risk</p>
                              <p className={cn('text-sm font-bold', atRiskCount > 0 ? 'text-red-600' : 'text-slate-900')}>{atRiskCount}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Vendor performance by category */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h3 className="text-sm font-semibold text-slate-900">Vendor Performance by Category</h3>
                      <p className="text-xs text-slate-500 mt-0.5">OTIF & FI pass rate for vendors with active orders</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['Vendor', 'Location', 'Category Mix', 'OTIF Score', 'FI Pass Rate', 'Active Orders', 'At Risk'].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...vendors]
                            .filter(v => subOrders.some(s => s.vendor.id === v.id))
                            .sort((a, b) => (b.otifScore ?? 0) - (a.otifScore ?? 0))
                            .map(v => {
                              const vOrders  = subOrders.filter(s => s.vendor.id === v.id)
                              const vCats    = [...new Set(vOrders.map(s => s.category))]
                              const active   = vOrders.filter(s => s.status !== 'completed').length
                              const atRisk   = vOrders.filter(s => s.atRisk).length
                              const otif     = v.otifScore ?? 0
                              return (
                                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{v.name}</td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{v.location}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1 flex-wrap">
                                      {vCats.map(c => (
                                        <span key={c} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{c}</span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn('h-full rounded-full', otif >= 75 ? 'bg-green-500' : otif >= 60 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${otif}%` }} />
                                      </div>
                                      <span className={cn('text-sm font-bold', otif >= 75 ? 'text-green-600' : otif >= 60 ? 'text-amber-600' : 'text-red-600')}>{otif}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={cn('text-sm font-semibold', (v.fiPassRate ?? 0) >= 85 ? 'text-green-600' : 'text-amber-600')}>
                                      {v.fiPassRate ?? '—'}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">{active}</td>
                                  <td className="px-4 py-3">
                                    {atRisk > 0
                                      ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">{atRisk} at risk</span>
                                      : <span className="text-xs text-slate-400">—</span>
                                    }
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageInner />
    </Suspense>
  )
}
