'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, Clock, CheckCircle2, ChevronDown, ChevronRight,
  TrendingDown, Users, Package, BarChart3, Filter
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { subOrders, vendors } from '@/lib/data'
import { cn } from '@/lib/utils'

// ─── Escalation card ──────────────────────────────────────────────────────────

function EscalationCard({ order }: { order: typeof subOrders[0] }) {
  const router = useRouter()
  const today  = new Date()
  const inward = new Date(order.buyingExpectedInwardDate)
  const diff   = Math.ceil((inward.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const reasons: string[] = []
  if (order.status === 'overdue') reasons.push('SubOrder is overdue')
  if (order.atRisk) reasons.push('Marked at-risk by POC')
  if (order.vendor.otifScore && order.vendor.otifScore < 65) reasons.push(`Low OTIF vendor (${order.vendor.otifScore}%)`)
  if (diff < 7 && order.packedQty < order.orderQty * 0.5) reasons.push('Less than 50% packed with <7 days to inward')

  return (
    <div
      className="bg-white rounded-lg border border-l-4 border-l-red-500 border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/portfolio/${order.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{order.id}</span>
            <span className="text-sm font-semibold text-slate-900">{order.styleCode}</span>
            <span className="text-sm text-slate-500">· {order.colour}</span>
          </div>
          <p className="text-xs text-slate-500 mb-2">POC: <strong className="text-slate-700">{order.poc.name}</strong> · Vendor: {order.vendor.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map(r => (
              <span key={r} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">{r}</span>
            ))}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <StatusBadge status={order.status} />
          <p className={cn('text-xs font-semibold mt-1.5', diff < 0 ? 'text-red-600' : diff <= 7 ? 'text-amber-600' : 'text-slate-500')}>
            {diff < 0 ? `${Math.abs(diff)}d overdue` : `${diff}d to inward`}
          </p>
        </div>
      </div>

      {/* Qty mini bar */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
          <span>Production progress</span>
          <span className="ml-auto font-medium text-slate-700">{order.packedQty}/{order.orderQty} packed</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', order.packedQty / order.orderQty >= 0.8 ? 'bg-green-500' : order.packedQty / order.orderQty >= 0.5 ? 'bg-violet-500' : 'bg-red-400')}
            style={{ width: `${order.orderQty > 0 ? Math.round((order.packedQty / order.orderQty) * 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── POC Summary row ──────────────────────────────────────────────────────────

function POCSummaryRow({ poc, orders }: { poc: string; orders: typeof subOrders }) {
  const overdue  = orders.filter(o => o.status === 'overdue').length
  const atRisk   = orders.filter(o => o.atRisk).length
  const onTrack  = orders.filter(o => o.status === 'on-track').length
  const initials = poc.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
      <div className="w-8 h-8 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{poc}</p>
        <p className="text-xs text-slate-500">{orders.length} SubOrders</p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className={cn('font-semibold', overdue > 0 ? 'text-red-600' : 'text-slate-400')}>
          {overdue} overdue
        </span>
        <span className="text-slate-300">|</span>
        <span className={cn('font-semibold', atRisk > 0 ? 'text-amber-600' : 'text-slate-400')}>
          {atRisk} at-risk
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-green-600 font-semibold">{onTrack} on-track</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerPage() {
  const [activeTab, setActiveTab] = useState<'escalations' | 'team' | 'overview'>('escalations')

  // Group by POC
  const pocGroups = useMemo(() => {
    const groups: Record<string, typeof subOrders> = {}
    subOrders.forEach(s => {
      const key = s.poc.name
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })
    return groups
  }, [])

  const escalations = subOrders.filter(s => s.status === 'overdue' || s.atRisk)
  const overdueCount  = subOrders.filter(s => s.status === 'overdue').length
  const atRiskCount   = subOrders.filter(s => s.atRisk).length
  const onTrackCount  = subOrders.filter(s => s.status === 'on-track' || s.status === 'completed').length
  const pendingCostings = subOrders.filter(s => s.costStatus === 'submitted').length

  const stageBreakdown: Record<string, number> = {}
  subOrders.forEach(s => { stageBreakdown[s.currentStage] = (stageBreakdown[s.currentStage] ?? 0) + 1 })

  const tabs = [
    { key: 'escalations', label: `Escalations (${escalations.length})` },
    { key: 'team',        label: `Team Overview (${Object.keys(pocGroups).length} POCs)` },
    { key: 'overview',    label: 'Portfolio Overview' },
  ]

  return (
    <>
      <Header title="Manager Queue" subtitle="Ahul Singh · Sourcing Manager · Nautinati" />
      <div className="px-6 py-6 max-w-5xl">
        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Escalations', value: overdueCount + atRiskCount, icon: AlertCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
            { label: 'At Risk', value: atRiskCount, icon: TrendingDown, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'On Track', value: onTrackCount, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Pending Costings', value: pendingCostings, icon: BarChart3, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
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

        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b border-slate-200 mb-5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Escalations */}
        {activeTab === 'escalations' && (
          <div className="space-y-3">
            {escalations.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">No escalations — all SubOrders on track!</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">{escalations.length} SubOrders need your attention</p>
                {escalations.map(o => <EscalationCard key={o.id} order={o} />)}
              </>
            )}
          </div>
        )}

        {/* Team */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{Object.keys(pocGroups).length} sourcing POC(s) in your team</p>
            {Object.entries(pocGroups).map(([poc, orders]) => (
              <div key={poc}>
                <POCSummaryRow poc={poc} orders={orders} />
                {/* SubOrder mini-list under each POC */}
                <div className="mt-2 ml-4 space-y-1">
                  {orders.map(o => (
                    <div key={o.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg text-xs border border-slate-100">
                      <span className="font-mono text-slate-500 w-32 flex-shrink-0">{o.id}</span>
                      <span className="font-medium text-slate-700 flex-1">{o.styleCode} · {o.colour}</span>
                      <span className="text-slate-500">{o.vendor.name.split(' ')[0]}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Stage funnel */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Portfolio by Stage</h3>
              <div className="space-y-3">
                {Object.entries(stageBreakdown).map(([stage, count]) => {
                  const stageNames: Record<string, string> = {
                    'order-brief': 'Order Brief', 'assigned': 'Assigned', 'vendor': 'Vendor',
                    'costing': 'Costing', 'pre-prod': 'Pre-Production', 'production': 'Production',
                    'fi': 'Final Inspection', 'asn': 'ASN', 'grn': 'GRN',
                  }
                  const stageColors: Record<string, string> = {
                    'order-brief': 'bg-slate-400', 'assigned': 'bg-violet-400', 'vendor': 'bg-violet-500',
                    'costing': 'bg-amber-500', 'pre-prod': 'bg-purple-500', 'production': 'bg-violet-600',
                    'fi': 'bg-orange-500', 'asn': 'bg-teal-500', 'grn': 'bg-green-500',
                  }
                  const pct = Math.round((count / subOrders.length) * 100)
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-32 flex-shrink-0">{stageNames[stage] ?? stage}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', stageColors[stage] ?? 'bg-violet-500')} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Vendor risk */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Vendor Risk Radar</h3>
              <div className="space-y-2">
                {[...vendors]
                  .filter(v => (v.otifScore ?? 100) < 70 || subOrders.some(s => s.vendor.id === v.id && s.atRisk))
                  .sort((a, b) => (a.otifScore ?? 0) - (b.otifScore ?? 0))
                  .map(v => {
                    const atRisk = subOrders.filter(s => s.vendor.id === v.id && s.atRisk).length
                    return (
                      <div key={v.id} className="flex items-center gap-3 px-3 py-2.5 bg-red-50 rounded-lg border border-red-100">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-900 flex-1">{v.name}</span>
                        <span className="text-xs text-slate-500">{v.location}</span>
                        <span className="text-xs font-semibold text-red-600">OTIF {v.otifScore}%</span>
                        {atRisk > 0 && <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{atRisk} at risk</span>}
                      </div>
                    )
                  })
                }
              </div>
            </div>

            {/* All orders table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">All SubOrders — Full View</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['ID', 'Style', 'POC', 'Vendor', 'Stage', 'Inward Date', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subOrders.map(o => (
                    <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer">
                      <td className="px-4 py-2.5"><span className="font-mono text-xs text-violet-700">{o.id}</span></td>
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-900">{o.styleCode}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{o.poc.name.split(' ')[0]}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{o.vendor.name.split(' ')[0]}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 capitalize">{o.currentStage.replace('-', ' ')}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {new Date(o.buyingExpectedInwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
