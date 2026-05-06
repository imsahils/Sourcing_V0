'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck, User, MapPin, Calendar, CheckCircle2, XCircle,
  AlertCircle, Clock, ChevronRight, Plus, Info, AlertTriangle,
  BarChart3, FileText, Camera, ThumbsUp, ThumbsDown, Minus
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { FIStatusBadge } from '@/components/shared/StatusBadge'
import { subOrders } from '@/lib/data'
import { cn } from '@/lib/utils'

// ─── Mock inspectors ──────────────────────────────────────────────────────────

const inspectors = [
  { id: 'qi1', name: 'Rakesh Sharma',   zone: 'North — Delhi/NCR', available: true,  activeInspections: 1 },
  { id: 'qi2', name: 'Ananya Patel',    zone: 'West — Mumbai',     available: true,  activeInspections: 0 },
  { id: 'qi3', name: 'Suresh Kumar',    zone: 'South — Bengaluru', available: false, activeInspections: 3 },
  { id: 'qi4', name: 'Preethi Nair',    zone: 'East — Kolkata',    available: true,  activeInspections: 2 },
  { id: 'qi5', name: 'Mohammed Farhan', zone: 'North — Jaipur',    available: true,  activeInspections: 0 },
]

// ─── AQL checklist items ──────────────────────────────────────────────────────

const aqlChecklist = [
  { id: 'c1',  category: 'Measurements',     item: 'Check critical measurements vs. spec sheet (chest, length, sleeve)' },
  { id: 'c2',  category: 'Measurements',     item: 'Verify size label matches actual garment measurement' },
  { id: 'c3',  category: 'Fabric & Quality', item: 'Fabric weight / GSM — verify against approved standard' },
  { id: 'c4',  category: 'Fabric & Quality', item: 'Colour shade matching against approved lab dip / strike off' },
  { id: 'c5',  category: 'Fabric & Quality', item: 'Fabric defects — holes, pilling, runs, snags' },
  { id: 'c6',  category: 'Construction',     item: 'Seam allowance and stitch density (SPI check)' },
  { id: 'c7',  category: 'Construction',     item: 'Buttonholes, buttons, zips — functionality and alignment' },
  { id: 'c8',  category: 'Construction',     item: 'Hem alignment — even, straight, no waviness' },
  { id: 'c9',  category: 'Construction',     item: 'Print / embroidery placement — centred, no bleeding' },
  { id: 'c10', category: 'Labels & Trims',   item: 'Brand label — correct placement, stitching' },
  { id: 'c11', category: 'Labels & Trims',   item: 'Care label — correct care instructions present' },
  { id: 'c12', category: 'Labels & Trims',   item: 'Country of origin label — present and legible' },
  { id: 'c13', category: 'Labels & Trims',   item: 'Size label — correct for each garment' },
  { id: 'c14', category: 'Packing',          item: 'Carton dimensions correct — matches packing list' },
  { id: 'c15', category: 'Packing',          item: 'Correct qty per carton as per PO' },
  { id: 'c16', category: 'Packing',          item: 'Barcode / tag scannable and correct SKU' },
  { id: 'c17', category: 'Safety',           item: 'No sharp objects / needles (needle detection check)' },
  { id: 'c18', category: 'Safety',           item: 'No prohibited substances (if tested)' },
]

// ─── Assign Inspector Modal ───────────────────────────────────────────────────

function AssignInspectorModal({ fi, subOrderId, onClose, onAssign }: {
  fi: any; subOrderId: string; onClose: () => void; onAssign: (inspectorId: string, date: string) => void
}) {
  const [selectedInspector, setSelectedInspector] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const order = subOrders.find(s => s.id === subOrderId)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Assign Inspector & Schedule FI</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {subOrderId} · {order?.styleCode} · {fi.fiQty} pcs · {order?.vendor.location}
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Inspector list */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-2 block">Select Inspector</label>
            <div className="space-y-2">
              {inspectors.map(insp => (
                <button
                  key={insp.id}
                  onClick={() => insp.available && setSelectedInspector(insp.id)}
                  disabled={!insp.available}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                    selectedInspector === insp.id ? 'border-violet-500 bg-violet-50' :
                    insp.available ? 'border-slate-200 hover:border-violet-200 hover:bg-slate-50' :
                    'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {insp.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{insp.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{insp.zone}</p>
                  </div>
                  <div className="text-right">
                    {insp.available ? (
                      <span className="text-xs text-green-600 font-medium">Available</span>
                    ) : (
                      <span className="text-xs text-slate-400">{insp.activeInspections} active</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule date */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Scheduled Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-xs text-violet-700 flex gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            The POC and vendor will be notified once an inspector is assigned and date is confirmed.
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            disabled={!selectedInspector || !scheduledDate}
            onClick={() => onAssign(selectedInspector, scheduledDate)}
            className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Assign & Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inspector Checklist Modal ────────────────────────────────────────────────

function InspectorChecklistModal({ fi, subOrderId, onClose, onSubmit }: {
  fi: any; subOrderId: string; onClose: () => void; onSubmit: (result: 'pass' | 'fail' | 'hold', remarks: string) => void
}) {
  const order = subOrders.find(s => s.id === subOrderId)
  const [checks, setChecks] = useState<Record<string, 'pass' | 'fail' | 'na'>>({})
  const [remarks, setRemarks] = useState('')
  const [page, setPage] = useState<'checklist' | 'result'>('checklist')

  const categories = [...new Set(aqlChecklist.map(c => c.category))]
  const total   = aqlChecklist.length
  const done    = Object.keys(checks).length
  const fails   = Object.values(checks).filter(v => v === 'fail').length
  const pct     = Math.round((done / total) * 100)

  const toggleCheck = (id: string, val: 'pass' | 'fail' | 'na') => {
    setChecks(p => ({ ...p, [id]: p[id] === val ? undefined as any : val }))
  }

  const suggestedResult: 'pass' | 'fail' | 'hold' =
    fails >= 3 ? 'fail' : fails >= 1 ? 'hold' : 'pass'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">AQL Inspection Checklist</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {subOrderId} · {order?.styleCode} · {fi.fiQty} pcs · Round {fi.round}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Progress</p>
              <p className="text-lg font-bold text-violet-700">{done}/{total}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {page === 'checklist' ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {categories.map(cat => (
                <div key={cat}>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{cat}</h4>
                  <div className="space-y-2">
                    {aqlChecklist.filter(c => c.category === cat).map(check => (
                      <div key={check.id} className={cn(
                        'flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors',
                        checks[check.id] === 'pass' ? 'border-green-200 bg-green-50' :
                        checks[check.id] === 'fail' ? 'border-red-200 bg-red-50' :
                        checks[check.id] === 'na'   ? 'border-slate-100 bg-slate-50 opacity-60' :
                        'border-slate-200 bg-white'
                      )}>
                        <span className="text-xs text-slate-500 w-5 flex-shrink-0 mt-0.5">{check.id.replace('c', '')}</span>
                        <p className="text-sm text-slate-700 flex-1 leading-snug">{check.item}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleCheck(check.id, 'pass')}
                            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', checks[check.id] === 'pass' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-green-100 hover:text-green-600')}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleCheck(check.id, 'fail')}
                            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', checks[check.id] === 'fail' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600')}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleCheck(check.id, 'na')}
                            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-xs font-bold', checks[check.id] === 'na' ? 'bg-slate-400 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200')}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-4 text-xs flex-1">
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {Object.values(checks).filter(v => v === 'pass').length} Pass
                </span>
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <XCircle className="w-3.5 h-3.5" /> {fails} Fail
                </span>
              </div>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button
                onClick={() => setPage('result')}
                className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
              >
                Review Result →
              </button>
            </div>
          </>
        ) : (
          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Checked', value: done, color: 'text-violet-700', bg: 'bg-violet-50' },
                { label: 'Passed',  value: Object.values(checks).filter(v => v === 'pass').length, color: 'text-green-700', bg: 'bg-green-50' },
                { label: 'Failed',  value: fails, color: 'text-red-700', bg: 'bg-red-50' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={cn('rounded-xl px-4 py-3 text-center', bg)}>
                  <p className={cn('text-2xl font-bold', color)}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Suggested result */}
            <div className={cn(
              'flex items-center gap-3 px-4 py-3.5 rounded-xl border',
              suggestedResult === 'pass' ? 'bg-green-50 border-green-200' :
              suggestedResult === 'hold' ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            )}>
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center',
                suggestedResult === 'pass' ? 'bg-green-500' : suggestedResult === 'hold' ? 'bg-amber-500' : 'bg-red-500'
              )}>
                {suggestedResult === 'pass' ? <CheckCircle2 className="w-4 h-4 text-white" /> :
                 suggestedResult === 'hold' ? <AlertCircle className="w-4 h-4 text-white" /> :
                 <XCircle className="w-4 h-4 text-white" />}
              </div>
              <div>
                <p className={cn('text-sm font-semibold', suggestedResult === 'pass' ? 'text-green-800' : suggestedResult === 'hold' ? 'text-amber-800' : 'text-red-800')}>
                  Suggested: {suggestedResult.toUpperCase()}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {suggestedResult === 'pass' ? 'No major defects found' :
                   suggestedResult === 'hold' ? `${fails} minor defect(s) — hold for review` :
                   `${fails} critical defect(s) — recommend rejection`}
                </p>
              </div>
            </div>

            {/* Failed items */}
            {fails > 0 && (
              <div className="bg-white border border-red-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-700 mb-2">Failed Checkpoints</p>
                <div className="space-y-1">
                  {aqlChecklist.filter(c => checks[c.id] === 'fail').map(c => (
                    <p key={c.id} className="text-xs text-red-600 flex items-start gap-1.5">
                      <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />{c.item}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Inspector Remarks</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Add observations, corrective actions required, re-inspection conditions..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                rows={3}
              />
            </div>

            {/* Final result buttons */}
            <div className="grid grid-cols-3 gap-3">
              {(['pass', 'hold', 'fail'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => onSubmit(r, remarks)}
                  className={cn(
                    'py-3 rounded-xl font-bold text-sm transition-colors',
                    r === 'pass' ? 'bg-green-600 text-white hover:bg-green-700' :
                    r === 'hold' ? 'bg-amber-500 text-white hover:bg-amber-600' :
                    'bg-red-600 text-white hover:bg-red-700'
                  )}
                >
                  {r === 'pass' ? '✓ PASS' : r === 'hold' ? '⏸ HOLD' : '✕ FAIL'}
                </button>
              ))}
            </div>

            <button onClick={() => setPage('checklist')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              ← Back to checklist
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FI Request Card ──────────────────────────────────────────────────────────

function FICard({ fi, order, onAssign, onInspect }: {
  fi: any; order: any
  onAssign: () => void
  onInspect: () => void
}) {
  const [localStatus, setLocalStatus] = useState(fi.status)

  const statusColors: Record<string, string> = {
    new: 'border-l-violet-400', scheduled: 'border-l-purple-400',
    'in-progress': 'border-l-amber-400', pass: 'border-l-green-400',
    fail: 'border-l-red-400', hold: 'border-l-orange-400',
    'not-ready': 'border-l-slate-300',
  }

  return (
    <div className={cn('bg-white rounded-xl border-l-4 border border-slate-200 p-5 hover:shadow-md transition-shadow', statusColors[fi.status] ?? 'border-l-slate-300')}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{order.id}</span>
            <span className="text-sm font-semibold text-slate-900">{order.styleCode}</span>
            <span className="text-sm text-slate-500">· {order.colour}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{order.vendor.name} · {order.vendor.location}</p>
        </div>
        <FIStatusBadge status={fi.status} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
        <div><span className="text-slate-400">FI Qty</span><p className="font-semibold text-slate-900 mt-0.5">{fi.fiQty} pcs</p></div>
        <div><span className="text-slate-400">Round</span><p className="font-semibold text-slate-900 mt-0.5">#{fi.round}</p></div>
        <div><span className="text-slate-400">Requested</span><p className="font-semibold text-slate-900 mt-0.5">{new Date(fi.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p></div>
        <div><span className="text-slate-400">Inward Deadline</span><p className="font-semibold text-slate-900 mt-0.5">{new Date(order.buyingExpectedInwardDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p></div>
        {fi.assignedInspector && (
          <div className="col-span-2"><span className="text-slate-400">Inspector</span><p className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1"><User className="w-3 h-3 text-slate-400" />{fi.assignedInspector}</p></div>
        )}
        {fi.scheduledDate && (
          <div className="col-span-2"><span className="text-slate-400">Scheduled</span><p className="font-semibold text-violet-700 mt-0.5">{new Date(fi.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {(fi.status === 'new' || fi.status === 'not-ready') && (
          <button onClick={onAssign} className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 flex items-center justify-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Assign Inspector
          </button>
        )}
        {fi.status === 'scheduled' && (
          <button onClick={onInspect} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 flex items-center justify-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" /> Start Inspection
          </button>
        )}
        {fi.status === 'in-progress' && (
          <button onClick={onInspect} className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 flex items-center justify-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" /> Continue Checklist
          </button>
        )}
        {(fi.status === 'pass' || fi.status === 'fail' || fi.status === 'hold') && (
          <div className={cn('flex-1 py-2 rounded-lg text-xs font-semibold text-center', fi.status === 'pass' ? 'bg-green-100 text-green-700' : fi.status === 'fail' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
            {fi.status === 'pass' ? '✓ Passed' : fi.status === 'fail' ? '✕ Failed' : '⏸ On Hold'}
          </div>
        )}
        {fi.status !== 'pass' && fi.status !== 'fail' && (
          <button
            onClick={() => {}}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" /> Report
          </button>
        )}
      </div>

      {fi.remarks && (
        <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 leading-snug">{fi.remarks}</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QAPage() {
  const [assignModalData, setAssignModalData]   = useState<{ fi: any; subOrderId: string } | null>(null)
  const [checklistData,   setChecklistData]     = useState<{ fi: any; subOrderId: string } | null>(null)
  const [resolvedFIs,     setResolvedFIs]       = useState<Record<string, { inspector?: string; result?: string }>>({})
  const [activeTab, setActiveTab]               = useState<'all' | 'new' | 'scheduled' | 'completed'>('all')

  // Collect all FI requests from all SubOrders
  const allFIs = useMemo(() =>
    subOrders.flatMap(order =>
      order.fiRequests.map(fi => ({ fi, order }))
    ), [])

  // Add mock FI requests for SubOrders in production with none yet
  const pendingFIs = useMemo(() =>
    subOrders
      .filter(o => o.fiRequests.length === 0 && (o.sewingQty > 0 || o.cutQty > 0) && o.status !== 'completed')
      .map(o => ({
        fi: {
          id: `fi-mock-${o.id}`, requestedDate: new Date().toISOString().split('T')[0],
          status: 'new' as const, fiQty: o.sewingQty || o.cutQty, round: 1,
        },
        order: o,
      })), [])

  const combinedFIs = [...pendingFIs, ...allFIs]

  const tabs = [
    { key: 'all',       label: `All (${combinedFIs.length})` },
    { key: 'new',       label: `New / Unassigned (${combinedFIs.filter(x => x.fi.status === 'new' || x.fi.status === 'not-ready').length})` },
    { key: 'scheduled', label: `Scheduled / Active (${combinedFIs.filter(x => ['scheduled', 'in-progress'].includes(x.fi.status)).length})` },
    { key: 'completed', label: `Completed (${combinedFIs.filter(x => ['pass', 'fail', 'hold', 're-inspection'].includes(x.fi.status)).length})` },
  ]

  const filtered = combinedFIs.filter(x => {
    if (activeTab === 'all')       return true
    if (activeTab === 'new')       return ['new', 'not-ready'].includes(x.fi.status)
    if (activeTab === 'scheduled') return ['scheduled', 'in-progress'].includes(x.fi.status)
    if (activeTab === 'completed') return ['pass', 'fail', 'hold', 're-inspection'].includes(x.fi.status)
    return true
  })

  // Inspector workload
  const inspectorLoad = inspectors.map(i => ({
    ...i,
    assigned: Math.floor(Math.random() * 3),
  }))

  const passRate = combinedFIs.filter(x => (x.fi as any).result === 'pass').length
  const totalDone = combinedFIs.filter(x => ['pass', 'fail', 'hold'].includes((x.fi as any).status as string)).length

  return (
    <>
      <Header title="QA — Final Inspection" subtitle="QA Manager view · Nautinati SS25" />

      {assignModalData && (
        <AssignInspectorModal
          fi={assignModalData.fi}
          subOrderId={assignModalData.subOrderId}
          onClose={() => setAssignModalData(null)}
          onAssign={(inspectorId, date) => {
            setResolvedFIs(p => ({ ...p, [assignModalData.fi.id]: { inspector: inspectors.find(i => i.id === inspectorId)?.name } }))
            setAssignModalData(null)
          }}
        />
      )}

      {checklistData && (
        <InspectorChecklistModal
          fi={checklistData.fi}
          subOrderId={checklistData.subOrderId}
          onClose={() => setChecklistData(null)}
          onSubmit={(result, remarks) => {
            setResolvedFIs(p => ({ ...p, [checklistData.fi.id]: { result } }))
            setChecklistData(null)
          }}
        />
      )}

      <div className="px-6 py-6">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pending Assignment', value: combinedFIs.filter(x => x.fi.status === 'new').length, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Scheduled / Active', value: combinedFIs.filter(x => ['scheduled', 'in-progress'].includes(x.fi.status)).length, icon: ClipboardCheck, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
            { label: 'Passed', value: combinedFIs.filter(x => (x.fi as any).result === 'pass').length, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Failed / Hold', value: combinedFIs.filter(x => ['fail', 'hold'].includes((x.fi as any).result ?? '')).length, icon: AlertCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
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

        <div className="grid grid-cols-3 gap-5">
          {/* Main FI list */}
          <div className="col-span-2">
            {/* Tabs */}
            <div className="flex items-center gap-0.5 border-b border-slate-200 mb-4 overflow-x-auto">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={cn('px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                    activeTab === tab.key ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}>
                  {tab.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No FI requests in this category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(({ fi, order }) => (
                  <FICard
                    key={fi.id}
                    fi={fi}
                    order={order}
                    onAssign={() => setAssignModalData({ fi, subOrderId: order.id })}
                    onInspect={() => setChecklistData({ fi, subOrderId: order.id })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right panel — Inspector workload */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> Inspector Workload
              </h3>
              <div className="space-y-3">
                {inspectorLoad.map(insp => (
                  <div key={insp.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {insp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{insp.name}</p>
                      <p className="text-xs text-slate-400 truncate">{insp.zone}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-xs font-semibold', insp.available ? 'text-green-600' : 'text-slate-400')}>
                        {insp.activeInspections} active
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Season pass rate */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" /> SS25 FI Summary
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Requests', value: combinedFIs.length, color: 'text-slate-700' },
                  { label: 'Pass',           value: 0, color: 'text-green-600' },
                  { label: 'Fail',           value: 0, color: 'text-red-600' },
                  { label: 'Hold',           value: 0, color: 'text-amber-600' },
                  { label: 'Pending',        value: combinedFIs.filter(x => ['new', 'scheduled'].includes(x.fi.status)).length, color: 'text-violet-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={cn('text-sm font-bold', color)}>{value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">FI Pass Rate</span>
                    <span className="text-sm font-bold text-slate-600">—</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
