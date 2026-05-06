'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, TrendingUp, TrendingDown, Minus, Star, Package, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { vendors, subOrders } from '@/lib/data'
import { cn } from '@/lib/utils'

// ─── Vendor score chip ────────────────────────────────────────────────────────

function ScoreChip({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? 'bg-green-50 text-green-700 border-green-200'
    : value >= 65 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200'
  const Icon = value >= 80 ? TrendingUp : value >= 65 ? Minus : TrendingDown
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border', color)}>
      <Icon className="w-3.5 h-3.5" />
      <div>
        <p className="text-sm font-bold leading-tight">{value}%</p>
        <p className="text-xs leading-tight opacity-75">{label}</p>
      </div>
    </div>
  )
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────

function VendorCard({ vendor }: { vendor: typeof vendors[0] }) {
  const vendorOrders  = subOrders.filter(s => s.vendor.id === vendor.id)
  const activeOrders  = vendorOrders.filter(s => s.status !== 'completed')
  const overdueOrders = vendorOrders.filter(s => s.status === 'overdue')
  const atRiskOrders  = vendorOrders.filter(s => s.atRisk)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {vendor.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm leading-tight">{vendor.name}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {vendor.location}
              </p>
            </div>
          </div>
        </div>
        {atRiskOrders.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            {atRiskOrders.length} At Risk
          </span>
        )}
      </div>

      {/* Scores */}
      <div className="flex gap-2 mb-4">
        {vendor.otifScore !== undefined && <ScoreChip value={vendor.otifScore} label="OTIF" />}
        {vendor.fiPassRate !== undefined && <ScoreChip value={vendor.fiPassRate} label="FI Pass" />}
      </div>

      {/* SubOrder stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">{vendorOrders.length}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
        <div className="text-center">
          <p className={cn('text-lg font-bold', activeOrders.length > 0 ? 'text-violet-700' : 'text-slate-400')}>{activeOrders.length}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="text-center">
          <p className={cn('text-lg font-bold', overdueOrders.length > 0 ? 'text-red-600' : 'text-slate-400')}>{overdueOrders.length}</p>
          <p className="text-xs text-slate-500">Overdue</p>
        </div>
      </div>
    </div>
  )
}

// ─── Vendor Performance Table ─────────────────────────────────────────────────

function VendorTable() {
  const rows = vendors.map(v => {
    const orders    = subOrders.filter(s => s.vendor.id === v.id)
    const completed = orders.filter(s => s.status === 'completed').length
    const overdue   = orders.filter(s => s.status === 'overdue').length
    const totalQty  = orders.reduce((sum, s) => sum + s.orderQty, 0)
    const packedQty = orders.reduce((sum, s) => sum + s.packedQty, 0)
    return { ...v, orders, completed, overdue, totalQty, packedQty }
  }).sort((a, b) => (b.otifScore ?? 0) - (a.otifScore ?? 0))

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Vendor Scoreboard — SS25</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Rank', 'Vendor', 'Location', 'OTIF', 'FI Pass', 'SubOrders', 'Overdue', 'Total Qty', 'Packed'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3">
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    i === 0 ? 'bg-yellow-400 text-yellow-900' :
                    i === 1 ? 'bg-slate-300 text-slate-700' :
                    i === 2 ? 'bg-amber-600 text-white' :
                    'bg-slate-100 text-slate-500'
                  )}>
                    {i < 3 ? <Star className="w-3 h-3" /> : i + 1}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">{row.name}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{row.location}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-sm font-semibold',
                    (row.otifScore ?? 0) >= 75 ? 'text-green-600' :
                    (row.otifScore ?? 0) >= 60 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {row.otifScore ?? '—'}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-sm font-semibold',
                    (row.fiPassRate ?? 0) >= 85 ? 'text-green-600' :
                    (row.fiPassRate ?? 0) >= 70 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {row.fiPassRate ?? '—'}%
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{row.orders.length}</td>
                <td className="px-4 py-3">
                  {row.overdue > 0
                    ? <span className="text-sm font-semibold text-red-600">{row.overdue}</span>
                    : <span className="text-sm text-slate-400">0</span>
                  }
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{row.totalQty.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${row.totalQty > 0 ? Math.min(100, Math.round((row.packedQty / row.totalQty) * 100)) : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{row.totalQty > 0 ? Math.round((row.packedQty / row.totalQty) * 100) : 0}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const [search, setSearch] = useState('')
  const [view, setView]     = useState<'cards' | 'table'>('cards')

  const filtered = useMemo(() =>
    vendors.filter(v =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.location.toLowerCase().includes(search.toLowerCase())
    ), [search])

  const avgOtif    = Math.round(vendors.reduce((s, v) => s + (v.otifScore ?? 0), 0) / vendors.length)
  const avgFiPass  = Math.round(vendors.reduce((s, v) => s + (v.fiPassRate ?? 0), 0) / vendors.length)
  const atRiskCount = vendors.filter(v => subOrders.some(s => s.vendor.id === v.id && s.atRisk)).length

  return (
    <>
      <Header title="Vendors" subtitle={`${vendors.length} active vendors · Nautinati SS25`} />
      <div className="px-6 py-6">
        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Vendors', value: vendors.length, icon: Package, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
            { label: 'Avg OTIF Score', value: `${avgOtif}%`, icon: TrendingUp, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
            { label: 'Avg FI Pass Rate', value: `${avgFiPass}%`, icon: Star, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Vendors At Risk', value: atRiskCount, icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={cn('rounded-xl border px-5 py-4 flex items-center gap-4', bg, border)}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-white', border, 'border')}>
                <Icon className={cn('w-4.5 h-4.5', color)} />
              </div>
              <div>
                <p className={cn('text-2xl font-bold', color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            />
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setView('cards')} className={cn('px-3 py-2 text-xs font-medium transition-colors', view === 'cards' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')}>Cards</button>
            <button onClick={() => setView('table')} className={cn('px-3 py-2 text-xs font-medium transition-colors', view === 'table' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')}>Scoreboard</button>
          </div>
        </div>

        {view === 'cards' ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(v => <VendorCard key={v.id} vendor={v} />)}
          </div>
        ) : (
          <VendorTable />
        )}
      </div>
    </>
  )
}
