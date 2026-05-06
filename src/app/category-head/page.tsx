'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, BarChart3, TrendingUp, TrendingDown, Package,
  AlertTriangle, CheckCircle2, Clock, FileText, ChevronRight,
  Layers, Calendar, Target
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { StatusBadge, TierBadge } from '@/components/shared/StatusBadge'
import { subOrders } from '@/lib/data'
import { cn } from '@/lib/utils'

export default function CategoryHeadPage() {
  const router  = useRouter()
  const [view, setView] = useState<'dashboard' | 'approvals'>('dashboard')

  // Costing approvals waiting for Category Head
  const pendingCostings = subOrders.filter(o => o.costStatus === 'submitted' || (o.costStatus === 'escalated'))
  const approvedCostings = subOrders.filter(o => o.costStatus === 'approved')

  // Stats
  const totalOrders    = subOrders.length
  const overdue        = subOrders.filter(o => o.status === 'overdue').length
  const onTrack        = subOrders.filter(o => o.status === 'on-track').length
  const totalOrderValue = subOrders.reduce((s, o) => s + (o.closedCost || o.targetPrice) * o.orderQty, 0)
  const heroOrders     = subOrders.filter(o => o.tier === 'HERO')
  const tier1Orders    = subOrders.filter(o => o.tier === 'TIER-1')

  // Category breakdown
  const catBreakdown: Record<string, number> = {}
  subOrders.forEach(o => { catBreakdown[o.category] = (catBreakdown[o.category] ?? 0) + 1 })

  // Stage funnel
  const stageBreakdown: Record<string, number> = {}
  subOrders.forEach(o => { stageBreakdown[o.currentStage] = (stageBreakdown[o.currentStage] ?? 0) + 1 })

  return (
    <>
      <Header title="Category Head" subtitle="Megha Sharma · Nautinati · SS25 Season View" />
      <div className="px-6 py-6">

        {/* Quick tabs */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { key: 'dashboard', label: 'Season Dashboard' },
            { key: 'approvals', label: `Costing Approvals (${pendingCostings.length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setView(key as any)}
              className={cn('px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors',
                view === key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}>
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => router.push('/new-suborder')}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700"
          >
            <Plus className="w-4 h-4" /> New Order Brief
          </button>
        </div>

        {view === 'dashboard' && (
          <div className="space-y-5">
            {/* KPI strip */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Total SubOrders', value: totalOrders, icon: Package, color: 'text-slate-700', bg: 'bg-white' },
                { label: 'On Track', value: onTrack, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50' },
                { label: 'Overdue', value: overdue, icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50' },
                { label: 'Order Value', value: `₹${(totalOrderValue / 100000).toFixed(1)}L`, icon: Target, color: 'text-violet-700', bg: 'bg-violet-50' },
                { label: 'Hero + T1 Orders', value: heroOrders.length + tier1Orders.length, icon: TrendingUp, color: 'text-purple-700', bg: 'bg-purple-50' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={cn('rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3', bg)}>
                  <Icon className={cn('w-5 h-5 flex-shrink-0', color)} />
                  <div>
                    <p className={cn('text-xl font-bold', color)}>{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-5">
              {/* Season pipeline funnel */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" /> Pipeline Stages
                </h3>
                <div className="space-y-2.5">
                  {[
                    { key: 'order-brief', label: 'Order Brief',    color: 'bg-slate-400' },
                    { key: 'assigned',    label: 'Assigned',       color: 'bg-violet-400' },
                    { key: 'vendor',      label: 'Vendor',         color: 'bg-violet-500' },
                    { key: 'costing',     label: 'Costing',        color: 'bg-amber-500' },
                    { key: 'pre-prod',    label: 'Pre-Production', color: 'bg-purple-500' },
                    { key: 'production',  label: 'Production',     color: 'bg-violet-600' },
                    { key: 'fi',          label: 'Inspection',     color: 'bg-orange-500' },
                    { key: 'asn',         label: 'ASN',            color: 'bg-teal-500' },
                    { key: 'grn',         label: 'GRN',            color: 'bg-green-500' },
                  ].map(({ key, label, color }) => {
                    const count = stageBreakdown[key] ?? 0
                    const pct   = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-28 flex-shrink-0">{label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-700 w-5 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Category split */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-400" /> By Category
                </h3>
                <div className="space-y-3">
                  {Object.entries(catBreakdown).map(([cat, count]) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">{cat}</span>
                        <span className="text-xs font-bold text-slate-700">{count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(count / totalOrders) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tier breakdown */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-3">By Tier</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { tier: 'HERO',   count: heroOrders.length,   color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                      { tier: 'TIER-1', count: tier1Orders.length,  color: 'bg-violet-100 text-violet-700 border-violet-200' },
                      { tier: 'TIER-2', count: subOrders.filter(o => o.tier === 'TIER-2').length, color: 'bg-slate-100 text-slate-600 border-slate-200' },
                      { tier: 'TAIL',   count: subOrders.filter(o => o.tier === 'TAIL').length,   color: 'bg-slate-50 text-slate-500 border-slate-100' },
                    ].map(({ tier, count, color }) => (
                      <div key={tier} className={cn('rounded-lg border px-3 py-2 text-center text-xs font-semibold', color)}>
                        {tier} — {count}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hero + priority watchlist */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-slate-400" /> Priority Watchlist
                </h3>
                <div className="space-y-2">
                  {subOrders.filter(o => o.tier === 'HERO' || o.atRisk || o.status === 'overdue').slice(0, 6).map(o => {
                    const today  = new Date()
                    const inward = new Date(o.buyingExpectedInwardDate)
                    const diff   = Math.ceil((inward.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={o.id} onClick={() => router.push(`/portfolio/${o.id}`)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                        <TierBadge tier={o.tier} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">{o.styleCode}</p>
                          <p className="text-xs text-slate-400 truncate">{o.colour}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <StatusBadge status={o.status} />
                          <p className={cn('text-xs font-semibold mt-0.5', diff < 0 ? 'text-red-600' : diff <= 7 ? 'text-amber-600' : 'text-green-600')}>
                            {diff < 0 ? `${Math.abs(diff)}d late` : `${diff}d`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Overdue orders table */}
            {overdue > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-red-100 bg-red-50">
                  <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {overdue} Overdue SubOrders — immediate attention required
                  </h3>
                </div>
                <table className="w-full">
                  <tbody>
                    {subOrders.filter(o => o.status === 'overdue').map(o => {
                      const diff = Math.ceil((new Date(o.buyingExpectedInwardDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      return (
                        <tr key={o.id} onClick={() => router.push(`/portfolio/${o.id}`)} className="border-b border-slate-100 last:border-0 hover:bg-red-50 cursor-pointer">
                          <td className="px-4 py-3"><span className="font-mono text-xs text-violet-700">{o.id}</span></td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{o.styleCode}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{o.colour}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{o.vendor.name}</td>
                          <td className="px-4 py-3 text-xs capitalize text-slate-500">{o.currentStage.replace('-', ' ')}</td>
                          <td className="px-4 py-3 text-xs font-bold text-red-600">{Math.abs(diff)}d overdue</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{o.poc.name}</td>
                          <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-400" /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'approvals' && (
          <div className="space-y-4 max-w-3xl">
            {pendingCostings.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No costing approvals pending</p>
              </div>
            ) : (
              pendingCostings.map(o => {
                const withinTarget = o.closedCost !== undefined && o.closedCost <= o.targetPrice
                const isEscalated  = o.costStatus === 'escalated'
                return (
                  <div key={o.id} className={cn('bg-white rounded-xl border p-5', isEscalated ? 'border-red-200' : 'border-amber-200')}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{o.id}</span>
                          <span className="text-sm font-bold text-slate-900">{o.styleCode}</span>
                          <span className="text-sm text-slate-500">· {o.colour}</span>
                          {isEscalated && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Escalated</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{o.vendor.name} · POC: {o.poc.name}</p>
                      </div>
                      <TierBadge tier={o.tier} />
                    </div>

                    {/* Cost comparison */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-center">
                        <p className="text-xs text-slate-500 mb-1">Target</p>
                        <p className="font-bold text-slate-900">₹{o.targetPrice}</p>
                      </div>
                      <div className={cn('rounded-lg px-3 py-2.5 text-center', withinTarget ? 'bg-green-50' : 'bg-red-50')}>
                        <p className="text-xs text-slate-500 mb-1">Submitted</p>
                        <p className={cn('font-bold', withinTarget ? 'text-green-700' : 'text-red-700')}>
                          {o.closedCost ? `₹${o.closedCost}` : '—'}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-center">
                        <p className="text-xs text-slate-500 mb-1">Variance</p>
                        <p className={cn('font-bold', withinTarget ? 'text-green-700' : 'text-red-700')}>
                          {o.closedCost ? `${withinTarget ? '-' : '+'}₹${Math.abs(o.targetPrice - o.closedCost)}` : '—'}
                        </p>
                      </div>
                      <div className="bg-violet-50 rounded-lg px-3 py-2.5 text-center">
                        <p className="text-xs text-slate-500 mb-1">Order Value</p>
                        <p className="font-bold text-violet-700">₹{((o.closedCost || o.targetPrice) * o.orderQty / 1000).toFixed(0)}K</p>
                      </div>
                    </div>

                    {isEscalated && (
                      <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-xs text-red-700 mb-3 flex gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Cost above target — POC has escalated for your approval. Consider negotiation or exception approval.
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">
                        Reject & Renegotiate
                      </button>
                      {isEscalated && (
                        <button className="flex-1 py-2.5 rounded-lg border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50">
                          Approve with Exception
                        </button>
                      )}
                      <button className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                        ✓ Approve Costing
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </>
  )
}
