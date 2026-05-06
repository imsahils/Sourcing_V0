'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Search, Filter, MapPin, Calendar, User, AlertCircle, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { FIStatusBadge } from '@/components/shared/StatusBadge'
import { subOrders } from '@/lib/data'
import { cn } from '@/lib/utils'
import type { FIRequest } from '@/lib/types'

interface FIRow extends FIRequest {
  subOrderId: string
  styleCode: string
  colour: string
  vendorName: string
  vendorLocation: string
}

export default function InspectionsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const allFIs: FIRow[] = useMemo(() =>
    subOrders.flatMap(s =>
      s.fiRequests.map(fi => ({
        ...fi,
        subOrderId: s.id,
        styleCode: s.styleCode,
        colour: s.colour,
        vendorName: s.vendor.name,
        vendorLocation: s.vendor.location,
      }))
    ), [])

  // Also show SubOrders where FI is due but not yet requested
  const fiNeeded = useMemo(() =>
    subOrders.filter(s =>
      s.fiRequests.length === 0 &&
      (s.sewingQty > 0 || s.cutQty > 0) &&
      s.status !== 'completed'
    ), [])

  const filtered = useMemo(() => {
    let list = allFIs
    if (filter !== 'all') list = list.filter(f => f.status === filter)
    if (search) list = list.filter(f =>
      f.subOrderId.toLowerCase().includes(search.toLowerCase()) ||
      f.styleCode.toLowerCase().includes(search.toLowerCase()) ||
      f.vendorName.toLowerCase().includes(search.toLowerCase())
    )
    return list
  }, [allFIs, filter, search])

  const pending  = allFIs.filter(f => !f.result).length
  const passed   = allFIs.filter(f => f.result === 'pass').length
  const failed   = allFIs.filter(f => f.result === 'fail').length

  return (
    <>
      <Header title="Inspections" subtitle={`Final Inspection tracker · ${allFIs.length} requests · ${fiNeeded.length} pending request`} />
      <div className="px-6 py-6">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total FI Requests', value: allFIs.length, icon: ClipboardCheck, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
            { label: 'Pending / Active', value: pending, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Passed', value: passed, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Failed / Hold', value: failed, icon: AlertCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', bg)}>
              <Icon className={cn('w-5 h-5 flex-shrink-0', color)} />
              <div>
                <p className={cn('text-2xl font-bold', color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FI Needed banner */}
        {fiNeeded.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">{fiNeeded.length} SubOrder(s) ready for FI — no request raised yet</h3>
            </div>
            <div className="space-y-2">
              {fiNeeded.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100 cursor-pointer hover:border-amber-300 transition-colors"
                  onClick={() => router.push(`/portfolio/${s.id}?tab=inspection`)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500">{s.id}</span>
                    <span className="text-sm font-medium text-slate-900">{s.styleCode} · {s.colour}</span>
                    <span className="text-xs text-slate-500">{s.vendor.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{s.sewingQty} in sewing · {s.packedQty} packed</span>
                    <button className="text-violet-600 font-medium hover:underline flex items-center gap-1">
                      Raise FI <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All FI requests */}
        <div className="flex items-center gap-3 mb-4">
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
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
            {['all', 'new', 'scheduled', 'in-progress', 'pass', 'fail', 'hold'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn('px-3 py-2 capitalize transition-colors', filter === s ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && allFIs.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <ClipboardCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No FI requests yet for this season</p>
            <p className="text-xs text-slate-400 mt-1">FI requests will appear here once raised from SubOrder pages</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No FI requests match the current filter.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['SubOrder', 'Style · Colour', 'Vendor', 'Requested', 'Scheduled', 'Inspector', 'FI Qty', 'Status', 'Result'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(fi => (
                    <tr
                      key={fi.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                      onClick={() => router.push(`/portfolio/${fi.subOrderId}?tab=inspection`)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-violet-700">{fi.subOrderId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{fi.styleCode}</p>
                        <p className="text-xs text-slate-400">{fi.colour}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-700 font-medium">{fi.vendorName}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{fi.vendorLocation}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {new Date(fi.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {fi.scheduledDate ? new Date(fi.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <User className="w-3 h-3 text-slate-400" />
                          {fi.assignedInspector || <span className="text-slate-400 italic">Unassigned</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{fi.fiQty}</td>
                      <td className="px-4 py-3"><FIStatusBadge status={fi.status} /></td>
                      <td className="px-4 py-3">
                        {fi.result ? (
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded',
                            fi.result === 'pass' ? 'bg-green-100 text-green-700' :
                            fi.result === 'fail' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {fi.result.toUpperCase()}
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  )
}
