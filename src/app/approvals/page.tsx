'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, XCircle, Clock, AlertCircle, ImageIcon,
  ChevronDown, Filter, MessageSquare, Upload, Info, Layers
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { PreProdStageBadge } from '@/components/shared/StatusBadge'
import { subOrders } from '@/lib/data'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalItem {
  subOrderId:  string
  styleCode:   string
  styleName:   string
  colour:      string
  vendorName:  string
  stageId:     string
  stageName:   string
  status:      'pending' | 'approved' | 'rejected' | 'not-started'
  plannedDate: string
  actualDate?: string
  submittedBy?: string
  approverRole: string
  remarks?:    string
}

// ─── Approval Modal ───────────────────────────────────────────────────────────

function ApprovalModal({
  item, onClose, onApprove, onReject
}: {
  item: ApprovalItem
  onClose: () => void
  onApprove: (remarks: string) => void
  onReject:  (reason: string) => void
}) {
  const [remarks, setRemarks]   = useState('')
  const [rejReason, setRejReason] = useState('')
  const [mode, setMode]         = useState<'review' | 'reject'>('review')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">{item.stageName} — Review</h3>
              <p className="text-xs text-slate-500 mt-0.5">{item.subOrderId} · {item.styleCode} · {item.colour}</p>
            </div>
            <PreProdStageBadge status={item.status as any} />
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Sample photo area */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl h-44 flex flex-col items-center justify-center gap-2 text-slate-400">
            <ImageIcon className="w-10 h-10" />
            <p className="text-sm">Sample photos submitted by vendor</p>
            <p className="text-xs">Click to view full resolution</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-1">Submitted by</p>
              <p className="font-medium text-slate-900">{item.submittedBy || item.vendorName}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-1">Planned date</p>
              <p className="font-medium text-slate-900">{new Date(item.plannedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-1">Vendor</p>
              <p className="font-medium text-slate-900">{item.vendorName}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-slate-500 mb-1">Approver role</p>
              <p className="font-medium text-slate-900">{item.approverRole}</p>
            </div>
          </div>

          {mode === 'reject' ? (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-xs text-red-700 flex gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Rejecting will send the sample back to the vendor with your reason. They will need to resubmit.
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={rejReason}
                  onChange={e => setRejReason(e.target.value)}
                  placeholder="e.g. Colour shade not matching approved lab dip, shade too dark"
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('review')} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Back</button>
                <button
                  disabled={!rejReason.trim()}
                  onClick={() => onReject(rejReason)}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40"
                >
                  Reject Sample
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Approval Remarks (optional)</label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Approved — shade matches perfectly, proceed to production"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('reject')} className="flex-1 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">
                  Reject
                </button>
                <button onClick={() => onApprove(remarks)} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                  ✓ Approve
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({
  item, onAction
}: {
  item: ApprovalItem & { _resolved?: 'approved' | 'rejected' }
  onAction: (item: ApprovalItem) => void
}) {
  const router = useRouter()
  const daysUntil = Math.ceil((new Date(item.plannedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isResolved = item._resolved

  return (
    <div className={cn(
      'bg-white rounded-xl border p-5 transition-all',
      isResolved === 'approved' ? 'border-green-200 opacity-60' :
      isResolved === 'rejected' ? 'border-red-200 opacity-60' :
      item.status === 'pending' ? 'border-amber-200 hover:shadow-md' :
      'border-slate-200 hover:shadow-sm'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{item.subOrderId}</span>
            <span className="text-sm font-semibold text-slate-900">{item.styleCode}</span>
            <span className="text-sm text-slate-500">· {item.colour}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-64">{item.styleName} · {item.vendorName}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {isResolved ? (
            <span className={cn('text-xs font-semibold px-2 py-1 rounded-full',
              isResolved === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {isResolved === 'approved' ? '✓ Approved' : '✕ Rejected'}
            </span>
          ) : (
            <PreProdStageBadge status={item.status as any} />
          )}
        </div>
      </div>

      {/* Stage chip */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full',
          item.stageName.includes('PP') ? 'bg-purple-100 text-purple-700' :
          item.stageName.includes('Fit') ? 'bg-violet-100 text-violet-700' :
          item.stageName.includes('Lab') ? 'bg-amber-100 text-amber-700' :
          item.stageName.includes('Strike') ? 'bg-orange-100 text-orange-700' :
          'bg-slate-100 text-slate-600'
        )}>
          <Layers className="w-3 h-3" />
          {item.stageName}
        </span>
        <span className="text-xs text-slate-400">Approver: {item.approverRole}</span>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
        <span>Planned: <strong className="text-slate-700">{new Date(item.plannedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong></span>
        {item.actualDate && <span>Submitted: <strong className="text-slate-700">{new Date(item.actualDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong></span>}
        {!isResolved && (
          <span className={cn('font-semibold ml-auto', daysUntil < 0 ? 'text-red-600' : daysUntil <= 2 ? 'text-amber-600' : 'text-slate-400')}>
            {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil}d left`}
          </span>
        )}
      </div>

      {/* Actions */}
      {!isResolved && item.status === 'pending' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/portfolio/${item.subOrderId}?tab=samples`)}
            className="flex-1 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            View SubOrder
          </button>
          <button
            onClick={() => onAction(item)}
            className="flex-1 py-2 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            Review & Decide →
          </button>
        </div>
      )}

      {!isResolved && item.status === 'approved' && (
        <div className="text-xs text-green-600 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Already approved
        </div>
      )}

      {item.remarks && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 text-xs text-slate-500">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
          {item.remarks}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [filter, setFilter]   = useState<string>('all')
  const [resolved, setResolved] = useState<Record<string, 'approved' | 'rejected'>>({})
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null)

  // Build approval queue from all SubOrders' preProdStages
  const allItems: ApprovalItem[] = useMemo(() =>
    subOrders.flatMap(s =>
      s.preProdStages
        .filter(stage => ['Lab Dip', 'Strike Off', 'Fit Sample', 'PP Sample', 'PP Fit', 'GPT'].some(n => stage.name.includes(n)))
        .map(stage => ({
          subOrderId:   s.id,
          styleCode:    s.styleCode,
          styleName:    s.styleName,
          colour:       s.colour,
          vendorName:   s.vendor.name,
          stageId:      stage.id,
          stageName:    stage.name,
          status:       stage.status as any,
          plannedDate:  stage.plannedDate,
          actualDate:   stage.actualDate,
          submittedBy:  s.vendor.name,
          approverRole: stage.approverRole || '—',
          remarks:      stage.remarks,
        }))
    ), [])

  const myRole   = 'Designer' // Simulate current user role
  const pending  = allItems.filter(i => i.status === 'pending' && !resolved[i.stageId])
  const approved = allItems.filter(i => i.status === 'approved' || resolved[i.stageId] === 'approved')
  const rejected = allItems.filter(i => i.status === 'rejected' || resolved[i.stageId] === 'rejected')

  const filtered = filter === 'all' ? allItems :
                   filter === 'pending' ? allItems.filter(i => i.status === 'pending' && !resolved[i.stageId]) :
                   filter === 'approved' ? allItems.filter(i => i.status === 'approved' || resolved[i.stageId] === 'approved') :
                   allItems.filter(i => resolved[i.stageId] === 'rejected' || i.status === 'rejected')

  const handleApprove = (remarks: string) => {
    if (!selectedItem) return
    setResolved(p => ({ ...p, [selectedItem.stageId]: 'approved' }))
    setSelectedItem(null)
  }
  const handleReject = (reason: string) => {
    if (!selectedItem) return
    setResolved(p => ({ ...p, [selectedItem.stageId]: 'rejected' }))
    setSelectedItem(null)
  }

  return (
    <>
      <Header title="Sample Approvals" subtitle={`${myRole} view · ${pending.length} pending decisions`} />

      {selectedItem && (
        <ApprovalModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      <div className="px-6 py-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Pending Decision', value: pending.length, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Approved', value: approved.length, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Rejected', value: rejected.length, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={cn('rounded-xl border px-5 py-4 flex items-center gap-4', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
              <div>
                <p className={cn('text-2xl font-bold', color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Role + filter bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
            <span className="text-xs font-medium text-violet-700">Viewing as: Designer</span>
            <span className="text-violet-300">·</span>
            <button className="text-xs text-violet-600 hover:underline">Switch role</button>
          </div>

          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-xs ml-auto">
            {[
              { key: 'all',      label: `All (${allItems.length})` },
              { key: 'pending',  label: `Pending (${pending.length})` },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={cn('px-3 py-2 transition-colors', filter === key ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stage filter chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {['Lab Dip', 'Strike Off', 'Fit Sample', 'PP Sample', 'Fit', 'GPT'].map(stage => (
            <button key={stage} className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
              {stage}
            </button>
          ))}
        </div>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">All caught up — no pending approvals!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(item => (
              <ApprovalCard
                key={item.stageId}
                item={{ ...item, _resolved: resolved[item.stageId] }}
                onAction={setSelectedItem}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
