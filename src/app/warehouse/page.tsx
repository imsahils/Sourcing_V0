'use client'
import { useState, useMemo } from 'react'
import {
  Package, CheckCircle2, AlertCircle, Clock, Truck,
  Building2, BarChart3, Filter, Search, ChevronRight, Info, X
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { subOrders } from '@/lib/data'
import { cn } from '@/lib/utils'

// ─── GRN Modal ────────────────────────────────────────────────────────────────

function GRNModal({ order, onClose }: { order: typeof subOrders[0]; onClose: () => void }) {
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState(
    order.poNumbers.map(po => ({ ...po, received: String(po.qty), shortage: '0', damage: '0', remarks: '' }))
  )
  const [step, setStep] = useState<'entry' | 'confirm' | 'done'>('entry')

  const totalReceived = entries.reduce((s, e) => s + Number(e.received || 0), 0)
  const totalExpected = entries.reduce((s, e) => s + e.qty, 0)
  const totalShortage = entries.reduce((s, e) => s + Number(e.shortage || 0), 0)
  const totalDamage   = entries.reduce((s, e) => s + Number(e.damage || 0), 0)
  const discrepancy   = totalExpected - totalReceived - totalShortage

  if (step === 'done') {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <p className="font-bold text-slate-900 text-xl">GRN Recorded!</p>
          <p className="text-sm text-slate-500 mt-2">{totalReceived} pcs received across {entries.length} warehouses.</p>
          {totalShortage > 0 && (
            <p className="text-sm text-amber-600 mt-1">⚠ {totalShortage} pcs shortage logged — POC & vendor notified.</p>
          )}
          {totalDamage > 0 && (
            <p className="text-sm text-red-600 mt-1">🔴 {totalDamage} pcs damaged — debit note process initiated.</p>
          )}
          <button onClick={onClose} className="mt-6 w-full py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900">{step === 'entry' ? 'Record GRN' : 'Confirm GRN'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{order.id} · {order.styleCode} · {order.colour} · {order.vendor.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {step === 'entry' ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Received date */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Date Received <span className="text-red-500">*</span></label>
                <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>

              {/* ASN reference */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Expected (from ASN)</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-lg font-bold text-slate-900">{totalExpected}</p><p className="text-xs text-slate-500">Expected</p></div>
                  <div><p className="text-lg font-bold text-violet-700">{order.dispatchedQty || totalExpected}</p><p className="text-xs text-slate-500">Dispatched</p></div>
                  <div><p className="text-lg font-bold text-green-700">{order.grnQty || 0}</p><p className="text-xs text-slate-500">Already GRN'd</p></div>
                </div>
              </div>

              {/* Per-PO entry */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700">Quantities Received (by PO / Warehouse)</p>
                {entries.map((entry, i) => (
                  <div key={entry.poNumber} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{entry.warehouse} — {entry.poNumber}</p>
                        <p className="text-xs text-slate-500">Expected: {entry.qty} pcs</p>
                      </div>
                      <Building2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Received', key: 'received' as const, color: 'focus:ring-green-500' },
                        { label: 'Shortage', key: 'shortage' as const, color: 'focus:ring-amber-500' },
                        { label: 'Damaged', key: 'damage' as const, color: 'focus:ring-red-500' },
                      ].map(({ label, key, color }) => (
                        <div key={key}>
                          <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                          <input
                            type="number"
                            value={entry[key]}
                            onChange={e => {
                              const newEntries = [...entries]
                              newEntries[i] = { ...newEntries[i], [key]: e.target.value }
                              setEntries(newEntries)
                            }}
                            className={cn('w-full border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center focus:outline-none focus:ring-2', color)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={entry.remarks}
                        onChange={e => {
                          const newEntries = [...entries]
                          newEntries[i] = { ...newEntries[i], remarks: e.target.value }
                          setEntries(newEntries)
                        }}
                        placeholder="Remarks (optional)"
                        className="w-full border border-slate-100 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-slate-50"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Running totals */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-xl p-3">
                {[
                  { label: 'Expected',  value: totalExpected,  color: 'text-slate-700' },
                  { label: 'Received',  value: totalReceived,  color: 'text-green-700' },
                  { label: 'Shortage',  value: totalShortage,  color: 'text-amber-600' },
                  { label: 'Damaged',   value: totalDamage,    color: 'text-red-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={cn('text-lg font-bold', color)}>{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2 flex-shrink-0">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={() => setStep('confirm')} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
                Review & Confirm →
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex gap-2 text-sm text-green-800">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Confirming GRN will update the SubOrder to GRN stage and send notifications to the POC.
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-bold text-slate-900 mb-4">GRN Summary</p>
              {entries.map(e => (
                <div key={e.poNumber} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                  <span className="text-slate-600">{e.warehouse} — {e.poNumber}</span>
                  <span className="font-bold text-slate-900">{e.received} recv{Number(e.shortage) > 0 ? ` / ${e.shortage} short` : ''}{Number(e.damage) > 0 ? ` / ${e.damage} dmg` : ''}</span>
                </div>
              ))}
              <div className="pt-3 mt-1 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-green-50 rounded-lg px-3 py-2 text-center">
                  <p className="font-bold text-green-700 text-lg">{totalReceived}</p>
                  <p className="text-green-600">Total Received</p>
                </div>
                {(totalShortage > 0 || totalDamage > 0) && (
                  <div className="bg-amber-50 rounded-lg px-3 py-2 text-center">
                    <p className="font-bold text-amber-700 text-lg">{totalShortage + totalDamage}</p>
                    <p className="text-amber-600">Discrepancy</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('entry')} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600">← Back</button>
              <button onClick={() => setStep('done')} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700">
                Confirm GRN ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const [grnOrder, setGrnOrder] = useState<typeof subOrders[0] | null>(null)
  const [search, setSearch]   = useState('')
  const [warehouse, setWarehouse] = useState('All')

  // Orders with dispatched qty or packed qty — ready for GRN
  const readyForGRN = useMemo(() =>
    subOrders.filter(o =>
      (o.dispatchedQty > 0 || o.packedQty > 0) &&
      o.grnQty < o.orderQty &&
      o.status !== 'completed'
    ), [])

  const completed = useMemo(() =>
    subOrders.filter(o => o.currentStage === 'grn' || o.grnQty >= o.orderQty), [])

  const filtered = readyForGRN.filter(o =>
    search === '' ||
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    o.styleCode.toLowerCase().includes(search.toLowerCase()) ||
    o.vendor.name.toLowerCase().includes(search.toLowerCase())
  )

  const warehouses = ['All', ...Array.from(new Set(subOrders.flatMap(o => o.poNumbers.map(p => p.warehouse))))]

  const totalExpectedToday = readyForGRN.reduce((s, o) => s + o.dispatchedQty + o.packedQty, 0)

  return (
    <>
      <Header title="Warehouse — GRN" subtitle={`${readyForGRN.length} shipments pending receipt`} />

      {grnOrder && <GRNModal order={grnOrder} onClose={() => setGrnOrder(null)} />}

      <div className="px-6 py-6">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pending GRN',     value: readyForGRN.length, icon: Clock,        color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'GRN Completed',   value: completed.length,   icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Pcs Expected',    value: totalExpectedToday, icon: Package,      color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
            { label: 'Vendors',         value: new Set(readyForGRN.map(o => o.vendor.id)).size, icon: Truck, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
              <div>
                <p className={cn('text-2xl font-bold', color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search SubOrder, style, vendor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            />
          </div>
          <select
            value={warehouse}
            onChange={e => setWarehouse(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {warehouses.map(w => <option key={w}>{w}</option>)}
          </select>
        </div>

        {/* Pending GRN table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Pending Receipt</h3>
            <span className="text-xs text-slate-400">{filtered.length} shipment(s)</span>
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No shipments pending receipt.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['SubOrder', 'Style · Colour', 'Vendor', 'Warehouses', 'Dispatched', 'GRN Status', 'Action'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const grnPct = o.orderQty > 0 ? Math.round((o.grnQty / o.orderQty) * 100) : 0
                  const today  = new Date()
                  const inward = new Date(o.buyingExpectedInwardDate)
                  const diff   = Math.ceil((inward.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

                  return (
                    <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-violet-700">{o.id}</p>
                        <p className={cn('text-xs font-semibold mt-0.5', diff < 0 ? 'text-red-600' : diff <= 3 ? 'text-amber-600' : 'text-green-600')}>
                          {diff < 0 ? `${Math.abs(diff)}d late` : `${diff}d`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{o.styleCode}</p>
                        <p className="text-xs text-slate-400">{o.colour}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{o.vendor.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {o.poNumbers.map(p => (
                            <span key={p.poNumber} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {p.warehouse} {p.qty}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-violet-700">{o.dispatchedQty || o.packedQty}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${grnPct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{grnPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setGrnOrder(o)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors"
                        >
                          Record GRN <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Completed GRNs */}
        {completed.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Recently Completed GRNs</h3>
            </div>
            <table className="w-full">
              <tbody>
                {completed.map(o => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3"><span className="font-mono text-xs text-slate-500">{o.id}</span></td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{o.styleCode}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{o.colour}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{o.vendor.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">✓ GRN Complete</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
