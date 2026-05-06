'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  AlertCircle, Clock, CheckCircle2, ArrowRight,
  Package, FlaskConical, Search, IndianRupee, Scissors, Truck,
  Inbox, ChevronDown, ChevronRight, TrendingUp,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { SubOrderPanel } from '@/app/portfolio/[id]/SubOrderDetailClient'
import { queueItems, subOrders } from '@/lib/data'
import { useSubOrders } from '@/lib/hooks/useSubOrders'
import { cn } from '@/lib/utils'
import type { QueueItem, SubOrder } from '@/lib/types'

// ─── Action meta ──────────────────────────────────────────────────────────────

const actionMeta: Record<QueueItem['actionType'], {
  icon: React.ComponentType<{ className?: string }>
  label: string
}> = {
  'production-update-overdue': { icon: Package,      label: 'Production'    },
  'pre-prod-overdue':          { icon: FlaskConical, label: 'Pre-Production' },
  'fi-needed':                 { icon: Search,       label: 'Inspection'    },
  'costing-due':               { icon: IndianRupee,  label: 'Costing'       },
  'sample-approval-pending':   { icon: Scissors,     label: 'Sampling'      },
  'asn-pending':               { icon: Truck,        label: 'ASN'           },
  'grn-pending':               { icon: Inbox,        label: 'GRN'           },
}

// Extract tab key from ctaRoute: '/portfolio/ID?tab=production' → 'production'
function tabFromRoute(ctaRoute: string): string {
  return ctaRoute.split('?tab=')[1] ?? 'overview'
}

// ─── Single queue row ─────────────────────────────────────────────────────────

function QueueRow({ item, subOrderMap, onOpen }: {
  item: QueueItem
  subOrderMap: Map<string, { buyingExpectedInwardDate: string; orderQty: number; packedQty: number }>
  onOpen: (subOrderId: string, tab: string) => void
}) {
  const meta       = actionMeta[item.actionType]
  const ActionIcon = meta.icon
  const subOrder   = subOrderMap.get(item.subOrderId)
  const isOverdue  = item.urgency === 'overdue'
  const tab        = tabFromRoute(item.ctaRoute)

  const inwardDate = subOrder?.buyingExpectedInwardDate
    ? new Date(subOrder.buyingExpectedInwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  return (
    <div
      onClick={() => onOpen(item.subOrderId, tab)}
      className={cn(
        'group flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors',
        'hover:bg-slate-50 dark:hover:bg-slate-800/60',
        'border-b border-slate-100 dark:border-slate-800 last:border-0',
      )}
    >
      {/* Stage icon pill */}
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
        isOverdue ? 'bg-red-50 dark:bg-red-900/30' : 'bg-amber-50 dark:bg-amber-900/30'
      )}>
        <ActionIcon className={cn('w-4 h-4', isOverdue ? 'text-red-500' : 'text-amber-500')} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.styleCode}
          </span>
          <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{item.colour}</span>
          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
            {item.subOrderId}
          </span>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
            isOverdue
              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          )}>
            {meta.label}
          </span>
          {isOverdue && item.daysOverdue && (
            <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/40 dark:text-red-400 px-2 py-0.5 rounded-full">
              {item.daysOverdue}d overdue
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-relaxed">
          {item.actionLabel}
        </p>

        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="font-medium text-slate-500 dark:text-slate-400">{item.vendorName}</span>
          {inwardDate && (
            <>
              <span>·</span>
              <span>Inward <strong className="text-slate-600 dark:text-slate-300">{inwardDate}</strong></span>
            </>
          )}
          {subOrder && (
            <>
              <span>·</span>
              <span>{subOrder.orderQty.toLocaleString()} pcs</span>
              {subOrder.packedQty > 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium ml-1">{subOrder.packedQty} packed</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hover CTA */}
      <button
        onClick={e => { e.stopPropagation(); onOpen(item.subOrderId, tab) }}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all',
          'opacity-0 group-hover:opacity-100',
          isOverdue
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-white'
        )}
      >
        {item.ctaLabel}
        <ArrowRight className="w-3 h-3" />
      </button>

      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0 group-hover:text-violet-400 transition-colors" />
    </div>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function QueueSection({
  title, subtitle, count, type, items, subOrderMap, defaultOpen = true, onOpen,
}: {
  title: string
  subtitle: string
  count: number
  type: 'overdue' | 'due-today' | 'on-track'
  items: QueueItem[]
  subOrderMap: Map<string, { buyingExpectedInwardDate: string; orderQty: number; packedQty: number }>
  defaultOpen?: boolean
  onOpen: (subOrderId: string, tab: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  const cfg = {
    overdue:    { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       icon: AlertCircle,  iconCls: 'text-red-500'   },
    'due-today':{ dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: Clock,        iconCls: 'text-amber-500' },
    'on-track': { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: CheckCircle2, iconCls: 'text-green-500' },
  }[type]
  const Icon = cfg.icon

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
        <Icon className={cn('w-4 h-4 flex-shrink-0', cfg.iconCls)} />
        <div className="flex-1 text-left min-w-0">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
          {subtitle && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{subtitle}</span>}
        </div>
        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold', cfg.badge)}>{count}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {type === 'on-track' ? (
            <div className="px-5 py-4 flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {count} SubOrders on track — no action needed right now.{' '}
                <a href="/portfolio?tab=grid" className="text-violet-600 hover:underline font-medium">
                  View in Portfolio →
                </a>
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-4 text-sm text-slate-400 dark:text-slate-500 text-center">
              Nothing here — all clear! 🎉
            </div>
          ) : (
            items.map(item => (
              <QueueRow key={item.subOrderId} item={item} subOrderMap={subOrderMap} onOpen={onOpen} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const { data: apiOrders } = useSubOrders()

  // Build a fast lookup from mock data (queue items are all mock IDs)
  const orderById = useMemo(() => {
    const map = new Map<string, SubOrder>()
    subOrders.forEach(o => map.set(o.id, o))
    return map
  }, [])

  const subOrderMap = useMemo(() => new Map(
    apiOrders.map(o => [o.id, {
      buyingExpectedInwardDate: o.buyingExpectedInwardDate ?? '',
      orderQty:  o.orderQty,
      packedQty: o.packedQty,
    }])
  ), [apiOrders])

  // ── Drawer state ─────────────────────────────────────────────────────────────
  const [drawerOrder,   setDrawerOrder]   = useState<SubOrder | null>(null)
  const [drawerTab,     setDrawerTab]     = useState<string>('overview')
  const [drawerVisible, setDrawerVisible] = useState(false)

  const openDrawer = useCallback((subOrderId: string, tab: string) => {
    const order = orderById.get(subOrderId)
    if (!order) return
    setDrawerOrder(order)
    setDrawerTab(tab)
    // mount first, then animate in next frame
    requestAnimationFrame(() => setDrawerVisible(true))
    document.body.style.overflow = 'hidden'
  }, [orderById])

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false)
    document.body.style.overflow = ''
    setTimeout(() => setDrawerOrder(null), 300)
  }, [])

  // Escape key closes drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeDrawer])

  // Restore scroll on unmount
  useEffect(() => () => { document.body.style.overflow = '' }, [])

  // ── Data ─────────────────────────────────────────────────────────────────────
  const overdueItems  = queueItems.filter(q => q.urgency === 'overdue')
  const dueTodayItems = queueItems.filter(q => q.urgency === 'due-today')
  const onTrackCount  = apiOrders.filter(s => s.status === 'on-track' || s.status === 'completed').length

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <>
      <Header title="My Queue" subtitle="Actions requiring your attention today" />

      <div className="px-4 md:px-6 py-6 max-w-3xl">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-5">
          {today}
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Overdue</span>
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{overdueItems.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Due Today</span>
            </div>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{dueTodayItems.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">On Track</span>
            </div>
            <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">{onTrackCount}</p>
          </div>
        </div>

        {/* Queue sections */}
        <QueueSection
          title="Overdue"
          subtitle="needs immediate attention"
          count={overdueItems.length}
          type="overdue"
          items={overdueItems}
          subOrderMap={subOrderMap}
          defaultOpen={true}
          onOpen={openDrawer}
        />
        <QueueSection
          title="Due Today"
          subtitle="action required by end of day"
          count={dueTodayItems.length}
          type="due-today"
          items={dueTodayItems}
          subOrderMap={subOrderMap}
          defaultOpen={true}
          onOpen={openDrawer}
        />
        <QueueSection
          title="On Track"
          subtitle="no action needed"
          count={onTrackCount}
          type="on-track"
          items={[]}
          subOrderMap={subOrderMap}
          defaultOpen={false}
          onOpen={openDrawer}
        />
      </div>

      {/* ── Right drawer ─────────────────────────────────────────────────────── */}
      {drawerOrder && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              'fixed inset-0 bg-black/30 dark:bg-black/50 z-40 transition-opacity duration-300',
              drawerVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            onClick={closeDrawer}
          />
          {/* Panel */}
          <div
            className={cn(
              'fixed top-0 right-0 h-full w-full md:w-[780px] md:max-w-[90vw]',
              'bg-white dark:bg-[#101828] shadow-2xl z-50 flex flex-col',
              'transition-transform duration-300 ease-out',
              drawerVisible ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            <SubOrderPanel
              order={drawerOrder}
              onClose={closeDrawer}
              initialTab={drawerTab as Parameters<typeof SubOrderPanel>[0]['initialTab']}
            />
          </div>
        </>
      )}
    </>
  )
}
