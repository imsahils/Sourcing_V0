'use client'
import { useState, useMemo } from 'react'
import { Edit2, Save, X, AlertTriangle, Check, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import type { SubOrder } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
type RowEdits = {
  sourcingNote?:       string
  productionStatus?:   string
  closedCost?:         string
  vendorPromisedDate?: string
  labDipStatus?:       string
  strikeOffStatus?:    string
}

const EDIT_COLS = [
  'closedCost', 'sourcingNote', 'productionStatus',
  'grnPlanRev', 'labDip', 'strikeOff',
] as const
type EditCol = typeof EDIT_COLS[number]

// ─── Dropdown options ─────────────────────────────────────────────────────────
const PROD_OPTIONS = [
  '', '1.1) ORDER PLACED', '1.2) PO GENERATED',
  '2.1) LAB DIP', '2.2) STRIKE OFF', '2.3) FIT SAMPLE', '2.4) FPT', '2.5) PP SAMPLE',
  '3.1) CUTTING', '3.2) STITCHING', '3.3) PACKING',
  '4.1) DISPATCHED', '5.1) GRN DONE',
]
const APPROVAL_OPTIONS = ['', 'PENDING', 'APPROVED', 'REJECTED', 'NOT APPLICABLE']

// ─── Stage labels ─────────────────────────────────────────────────────────────
const ORDER_MODE: Record<string, { label: string; color: string }> = {
  'order-brief': { label: 'ORDER BRIEF',    color: '#78716C' },
  'assigned':    { label: 'ASSIGNED',       color: '#1D4ED8' },
  'vendor':      { label: 'VENDOR',         color: '#1D4ED8' },
  'costing':     { label: 'COSTING',        color: '#92400E' },
  'pre-prod':    { label: 'PRE-PROD',       color: '#6D28D9' },
  'production':  { label: 'PRODUCTION',     color: '#1D4ED8' },
  'fi':          { label: 'FI',             color: '#B45309' },
  'asn':         { label: 'ASN & DISPATCH', color: '#15803D' },
  'grn':         { label: 'GRN',            color: '#2E7D52' },
}

const STAGE_GROUPS: { label: string; stages: string[]; color: string }[] = [
  { label: 'Briefing',    stages: ['order-brief'],                color: '#78716C' },
  { label: 'Assignment',  stages: ['assigned', 'vendor'],         color: '#1D4ED8' },
  { label: 'Costing',     stages: ['costing'],                    color: '#92400E' },
  { label: 'Pre-Prod',    stages: ['pre-prod'],                   color: '#6D28D9' },
  { label: 'Production',  stages: ['production'],                 color: '#1D4ED8' },
  { label: 'FI & Dispatch', stages: ['fi', 'asn'],               color: '#B45309' },
  { label: 'GRN',         stages: ['grn'],                        color: '#2E7D52' },
]

// ─── Date / math helpers ──────────────────────────────────────────────────────
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthOffset(dateStr: string): number {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return -1
  // offset from Aug (month index 7) wrapping to next year
  return (d.getMonth() - 7 + 12) % 12
}
function monthKey(dateStr: string): string {
  if (!dateStr) return 'REVISED DATE-?'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'REVISED DATE-?'
  const off = monthOffset(dateStr)
  const prefix = `(${2 + Math.floor(off / 10)}.${off % 10})`
  return `${prefix} ${MONTHS_SHORT[d.getMonth()]}'${String(d.getFullYear()).slice(2)}`
}
function weekKey(dateStr: string): string {
  if (!dateStr) return 'REVISED DATE-?'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'REVISED DATE-?'
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay()
  const week = Math.ceil((d.getDate() + firstDay) / 7)
  const off = monthOffset(dateStr)
  const prefix = `(${2 + Math.floor(off / 10)}.${off % 10})`
  return `${prefix} ${MONTHS[d.getMonth()]} WEEK-${week}`
}
function weekLabel(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay()
  const week = Math.ceil((d.getDate() + firstDay) / 7)
  const offset = (d.getMonth() + 1 - 8 + 12) % 12
  return `(${2 + Math.floor(offset / 10)}.${offset % 10}) ${MONTHS[d.getMonth()]} WK${week}`
}
function diffDays(a: string, b: string) {
  const da = new Date(a); da.setHours(0,0,0,0)
  const db = new Date(b); db.setHours(0,0,0,0)
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}
function fmtDate(d: string) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}
function penaltyPct(delay: number) {
  if (delay <= 0) return 0
  if (delay > 20) return 21
  return Math.ceil(delay / 7)
}
function fiResult(order: SubOrder) {
  const latest = [...(order.fiRequests ?? [])].sort((a,b) => b.round - a.round)[0]
  if (!latest) return { date: '—', status: '—' }
  return {
    date:   latest.scheduledDate ? fmtDate(latest.scheduledDate) : '—',
    status: latest.result ? latest.result.toUpperCase() : latest.status.toUpperCase(),
  }
}
function defaultProdStatus(order: SubOrder) {
  const m: Record<string,string> = {
    'order-brief': '1.1) ORDER PLACED',  'assigned':   '1.2) PO GENERATED',
    'vendor':      '1.2) PO GENERATED',  'costing':    '2.1) LAB DIP',
    'pre-prod':    '2.3) FIT SAMPLE',
    'production':  order.packedQty > 0 ? '3.3) PACKING' : order.sewingQty > 0 ? '3.2) STITCHING' : '3.1) CUTTING',
    'fi':          '4.1) DISPATCHED',    'asn':         '4.1) DISPATCHED',
    'grn':         '5.1) GRN DONE',
  }
  return m[order.currentStage] ?? ''
}

// ─── Table style helpers ──────────────────────────────────────────────────────
const GH = (bg: string, color = '#fff'): React.CSSProperties => ({
  padding: '5px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', background: bg, color, whiteSpace: 'nowrap',
  borderRight: '2px solid rgba(255,255,255,0.25)',
})
const TH = (sticky = false, left = 0, editable = false): React.CSSProperties => ({
  padding: '6px 10px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em',
  textTransform: 'uppercase', whiteSpace: 'nowrap',
  color: editable ? 'var(--ds-primary-dark)' : 'var(--ds-text-tertiary)',
  background: editable ? 'rgba(204,120,92,0.06)' : 'var(--ds-bg-subtle)',
  borderBottom: '1px solid var(--ds-border)',
  position: sticky ? 'sticky' : undefined, left: sticky ? left : undefined,
  zIndex: sticky ? 3 : 1,
  boxShadow: sticky ? '2px 0 5px rgba(0,0,0,0.07)' : undefined,
})
const IS: React.CSSProperties = {
  width: '100%', padding: '3px 6px', fontSize: 11.5, fontFamily: 'inherit',
  border: '1.5px solid var(--ds-primary)', borderRadius: 3,
  background: '#fff', outline: 'none', boxSizing: 'border-box',
}

// ─── Filter Rail helpers ──────────────────────────────────────────────────────
function RailSection({
  id, label, open, onToggle, children,
}: {
  id: string; label: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--ds-border)' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
          color: 'var(--ds-text-tertiary)',
        }}
      >
        {label}
        {open
          ? <ChevronDown size={12} style={{ color: 'var(--ds-text-tertiary)' }} />
          : <ChevronRight size={12} style={{ color: 'var(--ds-text-tertiary)' }} />}
      </button>
      {open && <div style={{ paddingBottom: 8 }}>{children}</div>}
    </div>
  )
}

function RailRow({
  active, label, count, onClick, dot, indent = 0, isQty = false,
}: {
  active: boolean; label: string; count: number; onClick: () => void
  dot?: string; indent?: number; isQty?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 7,
        padding: `5px 14px 5px ${14 + indent * 12}px`,
        background: active ? 'rgba(204,120,92,0.09)' : 'none',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        borderLeft: active ? '3px solid var(--ds-primary)' : '3px solid transparent',
      }}
    >
      {dot && (
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      )}
      <span style={{
        flex: 1, fontSize: 12.5, fontWeight: active ? 600 : 400,
        color: active ? 'var(--ds-primary-dark)' : 'var(--ds-text-secondary)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: 'right',
        color: active ? 'var(--ds-primary)' : 'var(--ds-text-tertiary)',
      }}>
        {isQty && count > 99 ? count.toLocaleString('en-IN') : count}
      </span>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TrackerView({ orders }: { orders: SubOrder[] }) {

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editMode,  setEditMode]  = useState(false)
  const [edits,     setEdits]     = useState<Map<string, RowEdits>>(new Map())
  const [savedRows, setSavedRows] = useState<Set<string>>(new Set())
  const [showSaved, setShowSaved] = useState(false)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [fAssign,   setFAssign]   = useState<'all'|'unassigned'|'assigned'>('all')
  const [fCategory, setFCategory] = useState('')
  const [fStageGrp, setFStageGrp] = useState('')   // stage-group label
  const [fMonth,    setFMonth]    = useState('')
  const [fWeek,     setFWeek]     = useState('')
  const [openSecs,  setOpenSecs]  = useState(new Set(['assign', 'grids', 'grnmonth', 'category']))
  const [showFilters, setShowFilters] = useState(true)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  const toggleSec = (id: string) =>
    setOpenSecs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleMonth = (mk: string) =>
    setExpandedMonths(prev => { const n = new Set(prev); n.has(mk) ? n.delete(mk) : n.add(mk); return n })

  // ── Derived filter data (from ALL orders) ─────────────────────────────────
  const categories = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of orders) m.set(o.category, (m.get(o.category) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [orders])

  const stageGroupCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of orders) {
      for (const g of STAGE_GROUPS) {
        if (g.stages.includes(o.currentStage)) {
          m.set(g.label, (m.get(g.label) ?? 0) + 1)
          break
        }
      }
    }
    return m
  }, [orders])

  const assignCounts = useMemo(() => {
    let unassigned = 0, assigned = 0
    for (const o of orders) {
      if (o.vendor.id === 'unassigned') unassigned++
      else assigned++
    }
    return { unassigned, assigned }
  }, [orders])

  // GRN month → week hierarchy with qty sums (computed from ALL orders)
  const grnMonthData = useMemo(() => {
    const monthMap = new Map<string, { qty: number; weeks: Map<string, number> }>()
    for (const o of orders) {
      const mk = monthKey(o.buyingExpectedInwardDate)
      const wk = weekKey(o.buyingExpectedInwardDate)
      if (!monthMap.has(mk)) monthMap.set(mk, { qty: 0, weeks: new Map() })
      const m = monthMap.get(mk)!
      m.qty += o.orderQty
      m.weeks.set(wk, (m.weeks.get(wk) ?? 0) + o.orderQty)
    }
    return Array.from(monthMap.entries()).sort((a, b) => {
      if (a[0] === 'REVISED DATE-?') return 1
      if (b[0] === 'REVISED DATE-?') return -1
      return a[0].localeCompare(b[0])
    })
  }, [orders])

  // ── Filtered orders (for table) ───────────────────────────────────────────
  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (fAssign === 'unassigned' && o.vendor.id !== 'unassigned') return false
      if (fAssign === 'assigned'   && o.vendor.id === 'unassigned') return false
      if (fCategory && o.category !== fCategory) return false
      if (fStageGrp) {
        const grp = STAGE_GROUPS.find(g => g.label === fStageGrp)
        if (grp && !grp.stages.includes(o.currentStage)) return false
      }
      if (fMonth) {
        if (fWeek) {
          if (weekKey(o.buyingExpectedInwardDate) !== fWeek) return false
        } else {
          if (monthKey(o.buyingExpectedInwardDate) !== fMonth) return false
        }
      }
      return true
    })
  }, [orders, fAssign, fCategory, fStageGrp, fMonth, fWeek])

  const activeFilterCount = [
    fAssign !== 'all', !!fCategory, !!fStageGrp, !!fMonth,
  ].filter(Boolean).length

  const clearAll = () => {
    setFAssign('all'); setFCategory(''); setFStageGrp(''); setFMonth(''); setFWeek('')
  }

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const dirty = edits.size

  const set = (orderId: string, field: keyof RowEdits, value: string) =>
    setEdits(prev => { const n = new Map(prev); n.set(orderId, { ...(n.get(orderId) ?? {}), [field]: value }); return n })

  const get = (order: SubOrder, field: keyof RowEdits, fallback: string): string =>
    (edits.get(order.id)?.[field] as string | undefined) ?? fallback

  const handleSave = () => {
    setSavedRows(new Set(edits.keys()))
    setEdits(new Map())
    setEditMode(false)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 3000)
    setTimeout(() => setSavedRows(new Set()), 4000)
  }
  const handleDiscard = () => { setEdits(new Map()); setEditMode(false) }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const moveTo = (row: number, col: EditCol) => {
    const el = document.querySelector<HTMLElement>(`[data-nav="${row}-${col}"]`)
    if (el) { el.focus(); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }
  }

  const onNav = (e: React.KeyboardEvent, row: number, col: EditCol) => {
    const ci = EDIT_COLS.indexOf(col)
    const maxRow = filtered.length - 1
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        ci > 0 ? moveTo(row, EDIT_COLS[ci - 1]) : row > 0 && moveTo(row - 1, EDIT_COLS[EDIT_COLS.length - 1])
      } else {
        ci < EDIT_COLS.length - 1 ? moveTo(row, EDIT_COLS[ci + 1]) : row < maxRow && moveTo(row + 1, EDIT_COLS[0])
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      if (e.target instanceof HTMLInputElement) { e.preventDefault(); row < maxRow && moveTo(row + 1, col) }
    } else if (e.key === 'ArrowUp') {
      if (e.target instanceof HTMLInputElement) { e.preventDefault(); row > 0 && moveTo(row - 1, col) }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', position: 'relative', minHeight: 400 }}>

      {/* ══ FILTER SIDEBAR ════════════════════════════════════════════════════ */}
      {showFilters && (
        <div style={{
          width: 252, flexShrink: 0,
          borderRight: '1px solid var(--ds-border)',
          background: 'var(--ds-surface)',
          overflowY: 'auto',
          position: 'sticky', top: 52, alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - 52px)',
        }}>

          {/* Sidebar header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--ds-border)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <SlidersHorizontal size={13} color="var(--ds-text-tertiary)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ds-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1 }}>
              Filters
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                style={{ fontSize: 10.5, color: 'var(--ds-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* ── Assignment Status ── */}
          <RailSection id="assign" label={`Assignment Status`} open={openSecs.has('assign')} onToggle={() => toggleSec('assign')}>
            <RailRow active={fAssign==='all'} label="All" count={orders.length}
              onClick={() => setFAssign('all')} />
            <RailRow active={fAssign==='unassigned'} label="Unassigned" count={assignCounts.unassigned}
              dot="#F59E0B" onClick={() => setFAssign(fAssign==='unassigned' ? 'all' : 'unassigned')} />
            <RailRow active={fAssign==='assigned'} label="Assigned" count={assignCounts.assigned}
              dot="#22C55E" onClick={() => setFAssign(fAssign==='assigned' ? 'all' : 'assigned')} />
          </RailSection>

          {/* ── Category / Order Grids ── */}
          <RailSection id="category" label="Category" open={openSecs.has('category')} onToggle={() => toggleSec('category')}>
            <RailRow active={fCategory===''} label="All categories" count={orders.length}
              onClick={() => setFCategory('')} />
            {categories.map(([cat, cnt]) => (
              <RailRow key={cat} active={fCategory===cat} label={cat} count={cnt}
                onClick={() => setFCategory(fCategory===cat ? '' : cat)} />
            ))}
          </RailSection>

          {/* ── Stage ── */}
          <RailSection id="grids" label="Stage" open={openSecs.has('grids')} onToggle={() => toggleSec('grids')}>
            <RailRow active={fStageGrp===''} label="All stages" count={orders.length}
              onClick={() => setFStageGrp('')} />
            {STAGE_GROUPS.map(g => {
              const cnt = stageGroupCounts.get(g.label) ?? 0
              if (cnt === 0) return null
              return (
                <RailRow key={g.label} active={fStageGrp===g.label} label={g.label} count={cnt}
                  dot={g.color} onClick={() => setFStageGrp(fStageGrp===g.label ? '' : g.label)} />
              )
            })}
          </RailSection>

          {/* ── GRN Month ── */}
          <RailSection id="grnmonth" label="GRN Delivery Month" open={openSecs.has('grnmonth')} onToggle={() => toggleSec('grnmonth')}>
            <RailRow active={fMonth===''} label="All" count={orders.reduce((s,o) => s+o.orderQty,0)}
              onClick={() => { setFMonth(''); setFWeek('') }} isQty />
            {grnMonthData.map(([mk, data]) => {
              const isMonthActive = fMonth === mk
              const isExpanded = expandedMonths.has(mk)
              const weeks = Array.from(data.weeks.entries()).sort((a,b) => a[0].localeCompare(b[0]))
              return (
                <div key={mk}>
                  {/* Month row */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={() => toggleMonth(mk)}
                      style={{
                        padding: '5px 4px 5px 14px', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--ds-text-tertiary)', flexShrink: 0,
                      }}
                    >
                      {isExpanded
                        ? <ChevronDown size={11} />
                        : <ChevronRight size={11} />}
                    </button>
                    <button
                      onClick={() => { setFMonth(isMonthActive ? '' : mk); setFWeek('') }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 7,
                        padding: '5px 14px 5px 2px', background: isMonthActive ? 'rgba(204,120,92,0.09)' : 'none',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderLeft: isMonthActive ? '3px solid var(--ds-primary)' : '3px solid transparent',
                      }}
                    >
                      <span style={{
                        flex: 1, fontSize: 12.5, fontWeight: isMonthActive ? 700 : mk === 'REVISED DATE-?' ? 600 : 500,
                        color: mk === 'REVISED DATE-?' ? '#B91C1C' : isMonthActive ? 'var(--ds-primary-dark)' : 'var(--ds-text-secondary)',
                      }}>
                        {mk}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: isMonthActive ? 'var(--ds-primary)' : 'var(--ds-text-tertiary)',
                      }}>
                        {data.qty.toLocaleString('en-IN')}
                      </span>
                    </button>
                  </div>

                  {/* Week rows (expanded) */}
                  {isExpanded && weeks.map(([wk, qty]) => {
                    const isWeekActive = fWeek === wk
                    return (
                      <RailRow key={wk}
                        active={isWeekActive}
                        label={wk.replace(/^\([^)]+\)\s*/, '')}  // strip prefix for compactness
                        count={qty}
                        indent={2}
                        isQty
                        onClick={() => {
                          if (isWeekActive) { setFWeek('') }
                          else { setFMonth(mk); setFWeek(wk) }
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </RailSection>

          {/* Summary */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--ds-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--ds-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Summary</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ds-text-primary)' }}>{filtered.length}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ds-text-tertiary)' }}>styles shown</div>
            {activeFilterCount > 0 && (
              <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ds-primary)' }}>
                {orders.length - filtered.length} filtered out
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800, color: '#B91C1C' }}>
              {filtered.filter(o => o.vendor.id === 'unassigned').length}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ds-text-tertiary)' }}>unassigned</div>
          </div>
        </div>
      )}

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* ── Edit mode bar ─────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 52, zIndex: 40, display: 'flex', alignItems: 'center',
          gap: 10, padding: '7px 14px',
          background: showSaved ? 'var(--ds-success-bg)'
                    : dirty > 0 ? '#FFF8F5'
                    : editMode  ? '#FFF8F5'
                    : 'var(--ds-bg-subtle)',
          borderBottom: `1px solid ${showSaved ? 'var(--ds-success-border)' : dirty > 0 ? '#F3C9B7' : 'var(--ds-border)'}`,
          fontSize: 12.5,
        }}>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            title={showFilters ? 'Hide filters' : 'Show filters'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11.5,
              border: `1px solid ${showFilters ? 'var(--ds-primary)' : 'var(--ds-border)'}`,
              background: showFilters ? 'rgba(204,120,92,0.08)' : '#fff',
              color: showFilters ? 'var(--ds-primary-dark)' : 'var(--ds-text-tertiary)',
              fontWeight: 500, flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={11} />
            {activeFilterCount > 0 && (
              <span style={{
                background: 'var(--ds-primary)', color: '#fff',
                borderRadius: 10, fontSize: 9, fontWeight: 700,
                padding: '0px 5px', lineHeight: '14px',
              }}>{activeFilterCount}</span>
            )}
          </button>

          {showSaved ? (
            <><Check size={14} color="var(--ds-success)" />
              <span style={{ color: 'var(--ds-success)', fontWeight: 600 }}>Changes saved successfully</span></>
          ) : editMode ? (
            <>
              <span style={{ fontSize: 11.5, color: 'var(--ds-primary-dark)', fontWeight: 500 }}>
                ✎ Edit mode — Tab / ↑↓ to navigate
              </span>
              {dirty > 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--ds-primary)', fontWeight: 600 }}>
                  · {dirty} row{dirty > 1 ? 's' : ''} changed
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={handleDiscard} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid var(--ds-border)', background: '#fff', color: 'var(--ds-text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <X size={12} /> Discard
                </button>
                <button onClick={handleSave} disabled={dirty === 0} style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: dirty > 0 ? 'var(--ds-primary)' : 'var(--ds-border)', color: dirty > 0 ? '#fff' : 'var(--ds-text-tertiary)', fontSize: 12, fontWeight: 600, cursor: dirty > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
                  <Save size={12} /> Save changes
                </button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11.5, color: 'var(--ds-text-tertiary)' }}>
                {filtered.length} of {orders.length} styles
                {activeFilterCount > 0 && <span style={{ color: 'var(--ds-primary)', marginLeft: 4, fontWeight: 500 }}>· {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>}
              </span>
              <button
                onClick={() => setEditMode(true)}
                style={{ marginLeft: 'auto', padding: '5px 16px', borderRadius: 6, border: '1px solid var(--ds-primary)', background: 'var(--ds-primary-light)', color: 'var(--ds-primary-dark)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit2 size={12} /> Edit
              </button>
            </>
          )}
        </div>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                <th colSpan={3} style={{ ...GH('#1C1917', '#FAF9F6'), position: 'sticky', left: 0, zIndex: 4 }}>Core</th>
                <th colSpan={4} style={GH('#CC785C')}>Order</th>
                <th colSpan={4} style={GH('#B5633E')}>Production</th>
                <th colSpan={5} style={GH('#2E7D52')}>ASN / GRN</th>
                <th colSpan={5} style={GH('#1D4ED8')}>TAT &amp; Delays</th>
                <th colSpan={3} style={GH('#92400E')}>Inspection</th>
                <th colSpan={3} style={GH('#6D28D9')}>Pre-Production</th>
                <th colSpan={4} style={GH('#78716C')}>Meta</th>
              </tr>
              <tr>
                <th style={TH(true, 0)}>Style #</th>
                <th style={TH(true, 90)}>Colour</th>
                <th style={{ ...TH(true, 190), borderRight: '2px solid var(--ds-border-strong)' }}>Vendor</th>
                <th style={TH()}>Mode</th>
                <th style={TH()}>Qty</th>
                <th style={TH(false,0,true)}>Closed Cost</th>
                <th style={TH(false,0,true)}>Sourcing Note</th>
                <th style={TH(false,0,true)}>Prod Status</th>
                <th style={TH()}>Cut</th>
                <th style={TH()}>Sewn</th>
                <th style={{ ...TH(), borderRight: '2px solid var(--ds-border-strong)' }}>Packed</th>
                <th style={TH()}>ASN Qty</th>
                <th style={TH()}>GRN Qty</th>
                <th style={TH()}>Bal GRN</th>
                <th style={TH()}>Short</th>
                <th style={{ ...TH(), borderRight: '2px solid var(--ds-border-strong)' }}>Bal Dispatch</th>
                <th style={TH(false,0,true)}>GRN Plan Rev</th>
                <th style={TH()}>GRN Wk</th>
                <th style={TH()}>GRN Delay</th>
                <th style={TH()}>Disp Delay</th>
                <th style={{ ...TH(), borderRight: '2px solid var(--ds-border-strong)' }}>Penalty</th>
                <th style={TH()}>FI Date</th>
                <th style={TH()}>FI Result</th>
                <th style={{ ...TH(), borderRight: '2px solid var(--ds-border-strong)' }}>Handover</th>
                <th style={TH(false,0,true)}>Lab Dip</th>
                <th style={TH(false,0,true)}>Strike Off</th>
                <th style={{ ...TH(), borderRight: '2px solid var(--ds-border-strong)' }}>S/Off Plan</th>
                <th style={TH()}>POC</th>
                <th style={TH()}>Type</th>
                <th style={TH()}>Merch</th>
                <th style={TH()}>Code</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((order, rowIdx) => {
                const fi          = fiResult(order)
                const today       = new Date().toISOString().split('T')[0]
                const grnDelay    = order.grnQty >= order.orderQty ? 0 : diffDays(order.buyingExpectedInwardDate, today)
                const dispDelay   = order.dispatchedQty >= order.orderQty ? 0 : diffDays(order.vendorPromisedDate ?? '', today)
                const pPct        = penaltyPct(grnDelay)
                const pRs         = pPct > 0 && order.closedCost ? Math.round(order.closedCost * order.orderQty * pPct / 100) : 0
                const balGRN      = order.orderQty - order.grnQty
                const grnShort    = Math.max(0, balGRN)
                const balDispatch = order.orderQty - order.dispatchedQty

                const isSaved  = savedRows.has(order.id)
                const isDirty  = edits.has(order.id)
                const stripeBg = rowIdx % 2 === 0 ? 'var(--ds-surface)' : 'var(--ds-bg)'
                const rowBg    = isSaved ? '#EDFAF4' : isDirty ? '#FFF9F7' : stripeBg

                const cost      = get(order, 'closedCost',       String(order.closedCost ?? ''))
                const note      = get(order, 'sourcingNote',     '')
                const prodSt    = get(order, 'productionStatus', defaultProdStatus(order))
                const grnPlan   = get(order, 'vendorPromisedDate', order.vendorPromisedDate ?? '')
                const labDip    = get(order, 'labDipStatus',     order.preProdStages.find(s => s.name === 'Lab Dip')?.status?.toUpperCase() ?? '')
                const strikeOff = get(order, 'strikeOffStatus',  order.preProdStages.find(s => s.name === 'Strike Off')?.status?.toUpperCase() ?? '')

                const approvalColor = (s: string) =>
                  s === 'APPROVED' ? '#2E7D52' : s === 'REJECTED' ? '#B91C1C' : s === 'PENDING' ? '#B45309' : 'var(--ds-text-tertiary)'
                const fiColor = fi.status === 'PASS' ? '#2E7D52' : fi.status === 'FAIL' ? '#B91C1C' : 'var(--ds-text-secondary)'

                const S: React.CSSProperties = {
                  padding: '5px 10px', borderBottom: '1px solid var(--ds-border)',
                  position: 'sticky', fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
                  background: rowBg,
                }
                const R = (extra?: React.CSSProperties): React.CSSProperties => ({
                  padding: '5px 10px', borderBottom: '1px solid var(--ds-border)',
                  fontSize: 11.5, whiteSpace: 'nowrap', background: rowBg, ...extra,
                })
                const E = (extra?: React.CSSProperties): React.CSSProperties => ({
                  padding: editMode ? '3px 5px' : '5px 10px',
                  borderBottom: '1px solid var(--ds-border)', fontSize: 11.5, whiteSpace: 'nowrap',
                  background: editMode ? (isDirty ? '#FFF4EF' : 'rgba(204,120,92,0.04)') : rowBg,
                  ...extra,
                })
                const nav = (col: EditCol) => (e: React.KeyboardEvent) => onNav(e, rowIdx, col)

                return (
                  <tr key={order.id}>
                    <td style={{ ...S, left: 0, zIndex: 1, minWidth: 90 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {order.atRisk && <AlertTriangle size={10} color="#B91C1C" />}
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#CC785C', fontWeight: 700 }}>
                          {order.styleCode}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...S, left: 90, zIndex: 1, minWidth: 100 }}>
                      <span style={{ color: 'var(--ds-text-secondary)', fontSize: 11 }}>{order.colour}</span>
                    </td>
                    <td style={{ ...S, left: 190, zIndex: 1, minWidth: 130, borderRight: '2px solid var(--ds-border-strong)' }}>
                      {order.vendor.id === 'unassigned'
                        ? <span style={{ color: '#F59E0B', fontStyle: 'italic', fontSize: 11 }}>Unassigned</span>
                        : <span style={{ fontSize: 11 }}>{order.vendor.name}</span>}
                    </td>
                    <td style={R()}>
                      <span style={{ fontWeight: 700, fontSize: 10, color: ORDER_MODE[order.currentStage]?.color ?? '#78716C' }}>
                        {ORDER_MODE[order.currentStage]?.label ?? order.currentStage.toUpperCase()}
                      </span>
                    </td>
                    <td style={R({ textAlign: 'right', fontWeight: 600 })}>{order.orderQty}</td>

                    {/* Closed Cost */}
                    <td style={E({ textAlign: 'right', minWidth: 90 })}>
                      {editMode ? (
                        <input data-nav={`${rowIdx}-closedCost`} type="number" value={cost}
                          onChange={e => set(order.id, 'closedCost', e.target.value)}
                          onKeyDown={nav('closedCost')}
                          style={{ ...IS, width: 80, textAlign: 'right' }} />
                      ) : cost ? (
                        <span style={{ fontFamily: 'monospace' }}>₹{cost}</span>
                      ) : <span style={{ color: 'var(--ds-text-tertiary)' }}>—</span>}
                    </td>

                    {/* Sourcing Note */}
                    <td style={E({ minWidth: 140, maxWidth: 180 })}>
                      {editMode ? (
                        <input data-nav={`${rowIdx}-sourcingNote`} type="text" value={note}
                          onChange={e => set(order.id, 'sourcingNote', e.target.value)}
                          onKeyDown={nav('sourcingNote')}
                          placeholder="Add note…" style={{ ...IS, minWidth: 130 }} />
                      ) : note ? (
                        <span style={{ color: 'var(--ds-text-secondary)', display: 'block', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
                      ) : <span style={{ color: 'var(--ds-text-tertiary)', fontStyle: 'italic' }}>—</span>}
                    </td>

                    {/* Prod Status */}
                    <td style={E({ minWidth: 130 })}>
                      {editMode ? (
                        <select data-nav={`${rowIdx}-productionStatus`} value={prodSt}
                          onChange={e => set(order.id, 'productionStatus', e.target.value)}
                          onKeyDown={nav('productionStatus')}
                          style={{ ...IS, cursor: 'pointer' }}>
                          {PROD_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, color: prodSt.startsWith('4') || prodSt.startsWith('5') ? '#2E7D52' : prodSt.startsWith('3') ? '#1D4ED8' : 'var(--ds-text-secondary)' }}>
                          {prodSt || '—'}
                        </span>
                      )}
                    </td>

                    <td style={R({ textAlign: 'right' })}>{order.cutQty    > 0 ? order.cutQty    : '—'}</td>
                    <td style={R({ textAlign: 'right' })}>{order.sewingQty > 0 ? order.sewingQty : '—'}</td>
                    <td style={R({ textAlign: 'right', borderRight: '2px solid var(--ds-border-strong)' })}>{order.packedQty > 0 ? order.packedQty : '—'}</td>

                    <td style={R({ textAlign: 'right' })}>{order.dispatchedQty > 0 ? order.dispatchedQty : '—'}</td>
                    <td style={R({ textAlign: 'right', fontWeight: order.grnQty > 0 ? 600 : 400 })}>{order.grnQty > 0 ? order.grnQty : '—'}</td>
                    <td style={R({ textAlign: 'right' })}>
                      <span style={{ color: balGRN > 0 ? '#B91C1C' : '#2E7D52', fontWeight: balGRN > 0 ? 600 : 400 }}>{balGRN > 0 ? balGRN : '✓'}</span>
                    </td>
                    <td style={R({ textAlign: 'right' })}>
                      {grnShort > 0 ? <span style={{ color: '#B91C1C', fontWeight: 600 }}>{grnShort}</span> : '—'}
                    </td>
                    <td style={R({ textAlign: 'right', borderRight: '2px solid var(--ds-border-strong)' })}>
                      {balDispatch > 0 ? <span style={{ color: '#B45309' }}>{balDispatch}</span> : <span style={{ color: '#2E7D52' }}>✓</span>}
                    </td>

                    {/* GRN Plan Rev */}
                    <td style={E({ minWidth: 120 })}>
                      {editMode ? (
                        <input data-nav={`${rowIdx}-grnPlanRev`} type="date" value={grnPlan}
                          onChange={e => set(order.id, 'vendorPromisedDate', e.target.value)}
                          onKeyDown={nav('grnPlanRev')}
                          style={{ ...IS, width: 130 }} />
                      ) : <span style={{ fontWeight: 600 }}>{fmtDate(grnPlan)}</span>}
                    </td>

                    <td style={R()}>
                      <span style={{ fontSize: 10.5, color: 'var(--ds-text-secondary)' }}>{weekLabel(grnPlan)}</span>
                    </td>
                    <td style={R({ textAlign: 'right' })}>
                      {grnDelay > 0 ? <span style={{ color: grnDelay > 20 ? '#B91C1C' : '#B45309', fontWeight: 600 }}>{grnDelay}d</span> : <span style={{ color: '#2E7D52' }}>—</span>}
                    </td>
                    <td style={R({ textAlign: 'right' })}>
                      {dispDelay > 0 ? <span style={{ color: dispDelay > 20 ? '#B91C1C' : '#B45309', fontWeight: 600 }}>{dispDelay}d</span> : '—'}
                    </td>
                    <td style={R({ borderRight: '2px solid var(--ds-border-strong)' })}>
                      {pPct > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontWeight: 700, color: pPct >= 21 ? '#B91C1C' : '#B45309' }}>{pPct}%</span>
                          <span style={{ fontSize: 10, color: 'var(--ds-text-secondary)' }}>₹{pRs.toLocaleString('en-IN')}</span>
                        </div>
                      ) : '—'}
                    </td>

                    <td style={R()}>{fi.date}</td>
                    <td style={R()}>
                      <span style={{ fontWeight: 600, fontSize: 11, color: fiColor }}>{fi.status}</span>
                    </td>
                    <td style={R({ borderRight: '2px solid var(--ds-border-strong)' })}>{fmtDate(order.handoverDate ?? '')}</td>

                    {/* Lab Dip */}
                    <td style={E({ minWidth: 110 })}>
                      {editMode ? (
                        <select data-nav={`${rowIdx}-labDip`} value={labDip}
                          onChange={e => set(order.id, 'labDipStatus', e.target.value)}
                          onKeyDown={nav('labDip')}
                          style={{ ...IS, cursor: 'pointer' }}>
                          {APPROVAL_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                        </select>
                      ) : <span style={{ fontWeight: 600, fontSize: 11, color: approvalColor(labDip) }}>{labDip || '—'}</span>}
                    </td>

                    {/* Strike Off */}
                    <td style={E({ minWidth: 110 })}>
                      {editMode ? (
                        <select data-nav={`${rowIdx}-strikeOff`} value={strikeOff}
                          onChange={e => set(order.id, 'strikeOffStatus', e.target.value)}
                          onKeyDown={nav('strikeOff')}
                          style={{ ...IS, cursor: 'pointer' }}>
                          {APPROVAL_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                        </select>
                      ) : <span style={{ fontWeight: 600, fontSize: 11, color: approvalColor(strikeOff) }}>{strikeOff || '—'}</span>}
                    </td>

                    <td style={R({ borderRight: '2px solid var(--ds-border-strong)' })}>
                      {fmtDate(order.preProdStages.find(s => s.name === 'Strike Off')?.plannedDate ?? '')}
                    </td>

                    <td style={R()}>{order.poc?.name ?? '—'}</td>
                    <td style={R()}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                        background: order.orderType === 'NEW' ? 'var(--ds-info-bg)' : 'var(--ds-bg-subtle)',
                        color:      order.orderType === 'NEW' ? 'var(--ds-info)'    : 'var(--ds-text-secondary)',
                        border: `1px solid ${order.orderType === 'NEW' ? 'var(--ds-info-border)' : 'var(--ds-border)'}`,
                      }}>{order.orderType}</span>
                    </td>
                    <td style={R()}>
                      <span style={{ fontSize: 11, color: 'var(--ds-text-secondary)' }}>{order.category}</span>
                    </td>
                    <td style={R()}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--ds-primary)' }}>{order.id}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ds-text-tertiary)', fontSize: 13 }}>
              No orders match the current filters.
              {activeFilterCount > 0 && (
                <button onClick={clearAll} style={{ display: 'block', margin: '10px auto 0', fontSize: 12.5, color: 'var(--ds-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '7px 14px', fontSize: 11, color: 'var(--ds-text-tertiary)', borderTop: '1px solid var(--ds-border)', background: 'var(--ds-bg-subtle)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {editMode ? (
            <>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--ds-border)', background: '#fff', fontSize: 10 }}>Tab</kbd> next cell</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--ds-border)', background: '#fff', fontSize: 10 }}>Shift+Tab</kbd> previous</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--ds-border)', background: '#fff', fontSize: 10 }}>↑ ↓</kbd> move row</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--ds-border)', background: '#fff', fontSize: 10 }}>Enter</kbd> next row</span>
              <span style={{ marginLeft: 'auto', color: 'var(--ds-primary)' }}>Editable: Closed Cost · Sourcing Note · Prod Status · GRN Plan Date · Lab Dip · Strike Off</span>
            </>
          ) : (
            <span>Click <strong>Edit</strong> to update this tracker · Use filters on the left to narrow results</span>
          )}
        </div>
      </div>
    </div>
  )
}
