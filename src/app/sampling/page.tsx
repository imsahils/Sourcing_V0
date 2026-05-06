'use client'
// Designer and Fit Technician portal — their personal approval queue.
// POC sampling lives under My Portfolio → Sampling tab.
import { useState, Suspense } from 'react'
import {
  CheckCircle2, X, Info, Send, Check, AlertCircle,
  Building2, ChevronRight, Star, Eye, Clock,
  FlaskConical, Ruler, RotateCcw, Truck, Package,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/user-context'
import {
  SAMPLING_ORDERS, STAGE_CONFIG, STAGE_IDS, cfg,
  getStage, stageCurrentStatus, getActiveStageIdx, isOrderComplete, fmtDate,
  type SamplingOrder, type SamplingStage, type StageId, type EntryStatus,
  type ApprovalEntry, type PPSEntry, type TrackingEntry,
} from '@/lib/sampling'

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_DISPLAY: Partial<Record<string, { label: string; bg: string; text: string; border: string }>> = {
  'not-started':       { label: 'Not Started',      bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-200'   },
  'submitted':         { label: 'Pending Review',    bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'   },
  'approved':          { label: 'Approved',          bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200'   },
  'rejected':          { label: 'Rejected',          bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'     },
  'revision-required': { label: 'Revision Required', bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200'  },
  'pass':              { label: 'Passed',            bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200'   },
  'fail':              { label: 'Failed',            bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'     },
  'received':          { label: 'Received',          bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200'    },
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_DISPLAY[status] ?? STATUS_DISPLAY['not-started']!
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', m.bg, m.text, m.border)}>
      {m.label}
    </span>
  )
}

const TIER_COLOR: Record<string, string> = {
  'HERO':   'bg-yellow-100 text-yellow-800 border-yellow-300',
  'TIER-1': 'bg-violet-100 text-violet-700 border-violet-200',
  'TIER-2': 'bg-slate-100 text-slate-600 border-slate-200',
  'TAIL':   'bg-slate-50 text-slate-400 border-slate-200',
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════

type ActionMode = 'approve' | 'reject' | 'pps-approve' | null

function SampleDetailModal({
  order, stageId: initialTab, onClose, onUpdate,
}: {
  order:    SamplingOrder
  stageId:  StageId
  onClose:  () => void
  onUpdate: (orderId: string, stageId: StageId, update: unknown) => void
}) {
  const { currentUser } = useCurrentUser()
  const role       = currentUser.role
  const isDesigner = role === 'designer'
  const isFitTech  = role === 'fit-technician'

  const [activeTab, setActiveTab]   = useState<StageId>(initialTab)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [form, setForm]             = useState<Record<string, string>>({})
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  const currentStage  = getStage(order, activeTab)
  const currentStatus = stageCurrentStatus(currentStage)
  const stageCfg      = cfg(activeTab)

  const canAct =
    (isDesigner && (stageCfg.owner === 'designer' || stageCfg.owner === 'dual')) ||
    (isFitTech  && (stageCfg.owner === 'fit-technician' || stageCfg.owner === 'dual'))

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      if (actionMode === 'approve' || actionMode === 'reject') {
        const stage  = currentStage as { id: typeof activeTab; entries: ApprovalEntry[] }
        const entries = [...stage.entries]
        const last   = { ...entries[entries.length - 1] }
        if (actionMode === 'approve') {
          last.status      = 'approved'
          last.approvedBy  = currentUser.name
          last.approvedDate = new Date().toISOString().split('T')[0]
          last.remarks     = form.remarks
          last.measurementNotes = form.measurements
        } else {
          last.status        = form.decision === 'revision' ? 'revision-required' : 'rejected'
          last.approvedBy    = currentUser.name
          last.remarks       = form.remarks
          last.revisionNotes = form.revisionNotes
          entries.push({ round: last.round + 1, status: 'not-started' })
        }
        entries[entries.length - (actionMode === 'reject' ? 2 : 1)] = last
        onUpdate(order.id, activeTab, { entries })
      } else if (actionMode === 'pps-approve') {
        const stage  = currentStage as { id: 'pps'; entries: PPSEntry[] }
        const entries = [...stage.entries]
        const last   = { ...entries[entries.length - 1] } as PPSEntry
        const decision = form.decision === 'approve' ? 'approved' : form.decision === 'revision' ? 'revision-required' : 'rejected'
        if (isDesigner) {
          last.designerStatus  = decision
          last.designerBy      = currentUser.name
          last.designerDate    = new Date().toISOString().split('T')[0]
          last.designerRemarks = form.remarks
        }
        if (isFitTech) {
          last.fitTechStatus    = decision
          last.fitTechBy        = currentUser.name
          last.fitTechDate      = new Date().toISOString().split('T')[0]
          last.fitTechRemarks   = form.remarks
        }
        if (last.designerStatus === 'approved' && last.fitTechStatus === 'approved') last.status = 'approved'
        entries[entries.length - 1] = last
        onUpdate(order.id, 'pps', { entries })
      }
      setSaving(false)
      setSaved(true)
      setTimeout(() => { setSaved(false); setActionMode(null); setForm({}) }, 1800)
    }, 800)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded border', TIER_COLOR[order.tier])}>{order.tier}</span>
              <span className="text-xs font-mono text-slate-400">{order.id}</span>
            </div>
            <h3 className="font-bold text-slate-900">{order.styleCode} · {order.styleName}</h3>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{order.colour}</span><span>·</span>
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{order.vendor}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Stage Tabs — only show stages this role can see */}
        <div className="flex border-b border-slate-100 flex-shrink-0 overflow-x-auto">
          {STAGE_IDS.filter(id => {
            const c = cfg(id)
            return (isDesigner && (c.owner === 'designer' || c.owner === 'dual')) ||
                   (isFitTech  && (c.owner === 'fit-technician' || c.owner === 'dual'))
          }).map(id => {
            const s      = getStage(order, id)
            const status = stageCurrentStatus(s)
            const c      = cfg(id)
            const isDone = status === 'approved'
            const isAttn = status === 'rejected' || status === 'revision-required'
            return (
              <button key={id}
                onClick={() => { setActiveTab(id); setActionMode(null); setForm({}) }}
                className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all',
                  activeTab === id ? cn(c.text, c.border.replace('border-', 'border-b-')) : 'border-transparent text-slate-400 hover:text-slate-600'
                )}>
                <span className={cn('w-5 h-5 rounded text-white text-xs flex items-center justify-center font-black',
                  isDone ? 'bg-green-500' : isAttn ? 'bg-red-500' : status === 'submitted' ? c.dot : 'bg-slate-200 text-slate-500'
                )}>
                  {isDone ? <Check className="w-3 h-3" /> : c.short.charAt(0)}
                </span>
                {c.short}
              </button>
            )
          })}
        </div>

        {/* Stage body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-bold text-slate-900">{stageCfg.label}</p><p className="text-xs text-slate-400">{stageCfg.desc}</p></div>
            <StatusBadge status={currentStatus} />
          </div>

          {/* PPS dual slot */}
          {activeTab === 'pps' && (() => {
            const last = ((currentStage as { id: 'pps'; entries: PPSEntry[] }).entries.slice(-1)[0]) as PPSEntry
            const myStatus = isDesigner ? last.designerStatus : last.fitTechStatus
            const myBy     = isDesigner ? last.designerBy     : last.fitTechBy
            const myDate   = isDesigner ? last.designerDate   : last.fitTechDate
            const myRem    = isDesigner ? last.designerRemarks : last.fitTechRemarks
            const role_    = isDesigner ? 'Designer' : 'Fit Technician'
            return (
              <div className="space-y-3">
                <div className={cn('rounded-xl border p-3 space-y-2', isDesigner ? 'bg-pink-50 border-pink-200' : 'bg-violet-50 border-violet-200')}>
                  <div className="flex items-center justify-between">
                    <p className={cn('text-xs font-bold', isDesigner ? 'text-pink-700' : 'text-violet-700')}>{role_} Approval</p>
                    <StatusBadge status={myStatus as string} />
                  </div>
                  {myStatus === 'approved' && <p className="text-xs text-slate-600">Approved by <strong>{myBy}</strong> on {fmtDate(myDate)}</p>}
                  {myRem && <p className="text-xs text-slate-600 italic">{myRem}</p>}
                </div>
                {last.submittedDate && <p className="text-xs text-slate-400">Sample submitted {fmtDate(last.submittedDate)}</p>}
                {!saved && myStatus === 'submitted' && canAct && (
                  actionMode === 'pps-approve' ? (
                    <ReviewForm form={form} setForm={setForm} isFitTech={isFitTech}
                      onCancel={() => setActionMode(null)} onSave={handleSave} saving={saving} />
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setActionMode('pps-approve')} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700"><CheckCircle2 className="w-4 h-4" /> Approve / Decide</button>
                    </div>
                  )
                )}
              </div>
            )
          })()}

          {/* Approval stage body */}
          {activeTab !== 'pps' && activeTab !== 'fd-status' && activeTab !== 'gpt' && (() => {
            const stage   = currentStage as { id: typeof activeTab; entries: ApprovalEntry[] }
            const entries = stage.entries
            const last    = entries[entries.length - 1]
            return (
              <div className="space-y-3">
                {entries.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Rounds</p>
                    {entries.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
                        <span className={cn('w-5 h-5 rounded-full flex items-center justify-center font-bold text-white', e.status === 'approved' ? 'bg-green-500' : e.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400')}>R{e.round}</span>
                        <StatusBadge status={e.status} />
                        {e.approvedBy && <span className="text-slate-400">by {e.approvedBy}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg px-3 py-2"><p className="text-xs text-slate-400">Submitted</p><p className="text-xs font-semibold">{fmtDate(last.submittedDate)}</p></div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2"><p className="text-xs text-slate-400">Decision</p><p className="text-xs font-semibold">{fmtDate(last.approvedDate)}</p></div>
                </div>
                {last.remarks && (
                  <div className={cn('flex gap-2 rounded-lg px-3 py-2.5 text-xs', last.status === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200')}>
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
                    <div>{last.approvedBy && <p className="font-semibold text-slate-700 mb-0.5">by {last.approvedBy}</p>}<p className="italic text-slate-600">{last.remarks}</p></div>
                  </div>
                )}
                {last.revisionNotes && (
                  <div className="flex gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div><p className="font-semibold text-orange-800 mb-0.5">Revision for vendor</p><p className="text-orange-700">{last.revisionNotes}</p></div>
                  </div>
                )}
                {last.measurementNotes && (
                  <div className="flex gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5 text-xs">
                    <Ruler className="w-3.5 h-3.5 text-violet-600 flex-shrink-0 mt-0.5" />
                    <div><p className="font-semibold text-violet-800 mb-0.5">Measurements</p><p className="text-violet-700 font-mono">{last.measurementNotes}</p></div>
                  </div>
                )}
                {!saved && last.status === 'submitted' && canAct && (
                  (actionMode === 'approve' || actionMode === 'reject') ? (
                    <ReviewForm form={form} setForm={setForm} isFitTech={isFitTech} isReject={actionMode === 'reject'}
                      onCancel={() => setActionMode(null)} onSave={handleSave} saving={saving} />
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setActionMode('approve')} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700"><CheckCircle2 className="w-4 h-4" /> Approve</button>
                      <button onClick={() => setActionMode('reject')}  className="flex-1 py-2.5 border border-red-300 bg-white text-red-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50"><RotateCcw className="w-4 h-4" /> Reject / Revise</button>
                    </div>
                  )
                )}
              </div>
            )
          })()}

          {saved && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" /><p className="text-sm font-semibold text-green-800">Decision saved</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewForm({ form, setForm, isFitTech, isReject, onCancel, onSave, saving }: {
  form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  isFitTech: boolean; isReject?: boolean; onCancel: () => void; onSave: () => void; saving: boolean
}) {
  const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500'
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200"><p className="text-xs font-bold text-slate-700">{isReject ? 'Reject / Request Revision' : 'Approve'}</p></div>
      <div className="px-4 py-3 space-y-3">
        {isReject && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">Decision <span className="text-red-500">*</span></p>
            <div className="flex gap-2">
              {([{ v: 'revision', l: 'Need Revision' }, { v: 'reject', l: 'Reject' }] as const).map(o => (
                <button key={o.v} onClick={() => setForm(p => ({ ...p, decision: o.v }))} className={cn('flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all', form.decision === o.v ? (o.v === 'reject' ? 'border-red-400 bg-red-50 text-red-700' : 'border-orange-400 bg-orange-50 text-orange-700') : 'border-slate-200 bg-white text-slate-500')}>{o.l}</button>
              ))}
            </div>
          </div>
        )}
        {isFitTech && !isReject && (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Measurement Notes</label>
            <textarea value={form.measurements || ''} onChange={e => setForm(p => ({ ...p, measurements: e.target.value }))} rows={2} placeholder="e.g. Chest: 36cm ✓  Sleeve: 58cm ✓" className={cn(inputCls, 'resize-none')} />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Remarks{isReject && <span className="text-red-500 ml-0.5">*</span>}</label>
          <textarea value={form.remarks || ''} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} rows={2} placeholder="Quality observations, colour match, construction notes…" className={cn(inputCls, 'resize-none')} />
        </div>
        {isReject && (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Revision Instructions for Vendor <span className="text-red-500">*</span></label>
            <textarea value={form.revisionNotes || ''} onChange={e => setForm(p => ({ ...p, revisionNotes: e.target.value }))} rows={2} placeholder="Specific changes vendor must make…" className={cn(inputCls, 'resize-none')} />
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={onSave} disabled={saving || (isReject && !form.decision)}
          className={cn('flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5', saving || (isReject && !form.decision) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-700')}>
          {saving ? <><Clock className="w-3 h-3 animate-spin" /> Saving…</> : <><Send className="w-3 h-3" /> Submit Decision</>}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

function SamplingContent() {
  const { currentUser } = useCurrentUser()
  const role       = currentUser.role
  const isDesigner = role === 'designer'
  const isFitTech  = role === 'fit-technician'

  const [orders,  setOrders]  = useState<SamplingOrder[]>(SAMPLING_ORDERS)
  const [modalId, setModalId] = useState<{ orderId: string; stageId: StageId } | null>(null)
  const [toast,   setToast]   = useState('')

  // Stages this role owns
  const myStages: StageId[] =
    isDesigner ? ['lab-dip', 'strike-off', 'pps'] :
    isFitTech  ? ['fit-sample', 'pps', 'pp-fit']  : []

  // Flat list of (order, stageId) pairs pending this role's action
  type PendingRow = { order: SamplingOrder; stageId: StageId; status: EntryStatus }
  const pendingRows: PendingRow[] = orders.flatMap(order =>
    myStages.flatMap(sid => {
      const s  = getStage(order, sid)
      const st = stageCurrentStatus(s)
      if (st === 'not-started' || st === 'approved' || st === 'pass') return []
      return [{ order, stageId: sid, status: st }]
    })
  )

  const doneCount    = orders.filter(o => isOrderComplete(o)).length
  const pendingCount = pendingRows.filter(r => r.status === 'submitted').length
  const attnCount    = pendingRows.filter(r => r.status === 'rejected' || r.status === 'revision-required').length

  const handleUpdate = (orderId: string, stageId: StageId, update: unknown) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const stages = o.stages.map(s => s.id !== stageId ? s : { ...s, ...(update as object) })
      return { ...o, stages }
    }))
    setToast('Decision saved')
    setTimeout(() => setToast(''), 3000)
  }

  const modalOrder = modalId ? orders.find(o => o.id === modalId.orderId) : null

  return (
    <div className="ml-60 min-h-screen bg-slate-50">
      <Header
        title="My Sample Queue"
        subtitle={`${pendingCount} pending review · ${attnCount} needs attention`}
      />

      <div className="px-6 py-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending Review',    count: pendingCount, bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',  dot: 'bg-amber-500'  },
            { label: 'Needs Attention',   count: attnCount,    bg: 'bg-red-50 border-red-200',       text: 'text-red-700',    dot: 'bg-red-500'    },
            { label: 'Styles Complete',   count: doneCount,    bg: 'bg-green-50 border-green-200',   text: 'text-green-700',  dot: 'bg-green-500'  },
          ].map(c => (
            <div key={c.label} className={cn('rounded-xl border p-4', c.bg)}>
              <div className="flex items-center gap-1.5 mb-2"><span className={cn('w-2 h-2 rounded-full', c.dot)} /><span className="text-xs font-medium text-slate-500">{c.label}</span></div>
              <p className={cn('text-2xl font-black', c.text)}>{c.count}</p>
            </div>
          ))}
        </div>

        {/* My stage labels */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">Your stages:</span>
          {myStages.map(id => {
            const c = cfg(id)
            return <span key={id} className={cn('text-xs font-bold px-2 py-1 rounded-lg border', c.bg, c.text, c.border)}>{c.label}</span>
          })}
        </div>

        {/* Pending list */}
        {pendingRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-green-200 p-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">All caught up</p>
            <p className="text-sm text-slate-400 mt-1">No samples are pending your review right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Awaiting Your Decision</p>
            {pendingRows.map(({ order, stageId, status }, i) => {
              const c     = cfg(stageId)
              const isAttn = status === 'rejected' || status === 'revision-required'
              return (
                <div key={`${order.id}-${stageId}-${i}`}
                  onClick={() => setModalId({ orderId: order.id, stageId })}
                  className={cn('bg-white rounded-xl border shadow-sm hover:shadow-md cursor-pointer transition-all',
                    isAttn ? 'border-red-200' : 'border-slate-200'
                  )}>
                  <div className="px-4 py-3.5 flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0', c.bg, c.text)}>{c.short}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {order.tier === 'HERO' && <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />}
                        <p className="text-sm font-bold text-slate-900">{order.styleCode}</p>
                        <span className="text-xs text-slate-400">·</span>
                        <p className="text-xs text-slate-500 truncate">{order.styleName}</p>
                      </div>
                      <p className="text-xs text-slate-400">{order.colour} · {order.vendor} · {order.vendorLocation}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={status} />
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', c.bg, c.text, c.border)}>{c.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalOrder && modalId && (
        <SampleDetailModal
          order={modalOrder}
          stageId={modalId.stageId}
          onClose={() => setModalId(null)}
          onUpdate={handleUpdate}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-green-400" />{toast}
        </div>
      )}
    </div>
  )
}

export default function SamplingPage() {
  return (
    <Suspense fallback={<div className="ml-60 flex items-center justify-center h-screen text-slate-400">Loading…</div>}>
      <SamplingContent />
    </Suspense>
  )
}
