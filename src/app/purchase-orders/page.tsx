'use client'
import { useState, useMemo, Suspense, useRef, Fragment } from 'react'
import {
  Package, Send, Upload, Download, RefreshCw, CheckCircle2,
  AlertCircle, X, FileText, Loader2, Eye, ChevronDown,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/user-context'
import {
  INITIAL_PO_RECORDS,
  getWH,
  type PORecord,
  type POStatus,
} from '@/lib/purchase-orders'

// ─── Status Badge ─────────────────────────────────────────────────────────────

function POStatusBadge({ status }: { status: POStatus }) {
  const map: Record<POStatus, { label: string; cls: string }> = {
    requested:   { label: 'Requested',   cls: 'bg-amber-50 text-amber-700 border-amber-200'  },
    pushing:     { label: 'Pushing...',  cls: 'bg-violet-50 text-violet-700 border-violet-200'     },
    'po-raised': { label: 'PO Raised',   cls: 'bg-teal-50 text-teal-700 border-teal-200'    },
    failed:      { label: 'Push Failed', cls: 'bg-red-50 text-red-700 border-red-200'        },
    complete:    { label: 'Complete',    cls: 'bg-green-50 text-green-700 border-green-200'  },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cls)}>
      {label}
    </span>
  )
}

// ─── Push Modal ───────────────────────────────────────────────────────────────

function PushModal({
  po,
  onClose,
  onSuccess,
  onFailure,
}: {
  po: PORecord
  onClose: () => void
  onSuccess: (poNumber: string) => void
  onFailure: (reason: string) => void
}) {
  const [pushing, setPushing]   = useState(false)
  const [result, setResult]     = useState<'success' | 'failed' | null>(null)
  const [poNumber, setPoNumber] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const totalQty   = po.totalQty
  const totalValue = po.totalValue

  function handlePush() {
    setPushing(true)
    setTimeout(() => {
      const rand = Math.random()
      if (rand < 0.85) {
        // Success
        const num = String(Math.floor(10000 + Math.random() * 90000))
        const generated = `PO-D365-26-${num}`
        setPoNumber(generated)
        setResult('success')
        setPushing(false)
        setTimeout(() => onSuccess(generated), 1500)
      } else {
        // Failure
        const msg = 'D365 API Error 500: Internal server error during PO creation. Please retry or enter manually.'
        setErrorMsg(msg)
        setResult('failed')
        setPushing(false)
      }
    }, 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Push to D365 — {po.styleCode} {po.colour}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{po.styleName} · {po.vendor}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* D365 Info Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Vendor D365 Code</span>
            <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
              {po.vendorCode}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Delivery</span>
            <span className="text-xs font-semibold text-slate-700">
              {new Date(po.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total Value</span>
            <span className="text-xs font-bold text-slate-900">
              ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Lines Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['SKU', 'WH Code', 'Qty', 'Unit Price ₹', 'Line Total ₹'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {po.lines.map((line, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-700">{line.sku}</td>
                    <td className="px-3 py-2">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {line.whCode}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{line.qty}</td>
                    <td className="px-3 py-2 text-slate-600">{line.unitPrice.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {line.lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-3 py-2 font-bold text-slate-700" colSpan={2}>
                    Total — {po.lines.length} lines
                  </td>
                  <td className="px-3 py-2 font-black text-slate-900">{totalQty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-400">—</td>
                  <td className="px-3 py-2 font-black text-slate-900">
                    ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {/* Idle state */}
          {!pushing && result === null && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {po.lines.length} lines · {totalQty.toLocaleString()} pcs · ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={handlePush}
                  className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700">
                  <Send className="w-4 h-4" /> Push to D365
                </button>
              </div>
            </div>
          )}

          {/* Pushing state */}
          {pushing && (
            <div className="flex items-center justify-center gap-3 py-2">
              <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
              <span className="text-sm font-medium text-violet-700">Pushing to D365...</span>
            </div>
          )}

          {/* Success state */}
          {result === 'success' && (
            <div className="flex items-center gap-3 py-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700">PO Created Successfully</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{poNumber}</p>
              </div>
              <p className="ml-auto text-xs text-slate-400">Closing...</p>
            </div>
          )}

          {/* Failure state */}
          {result === 'failed' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Push Failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { onFailure(errorMsg); onClose() }}
                  className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100">
                  Close
                </button>
                <button
                  onClick={() => { onFailure(errorMsg) }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700">
                  <FileText className="w-4 h-4" /> Manual Entry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Manual Entry Modal ───────────────────────────────────────────────────────

function ManualEntryModal({
  po,
  onClose,
  onSubmit,
}: {
  po: PORecord
  onClose: () => void
  onSubmit: (poNumber: string, pdfName: string) => void
}) {
  const [poNumber, setPoNumber] = useState('')
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileClick() {
    // Simulate file selection — in production this would be a real file input
    if (poNumber.trim()) {
      setFileName(`po-manual-${poNumber.trim().replace(/\s+/g, '-')}.pdf`)
    } else {
      setFileName('po-manual-upload.pdf')
    }
  }

  const canSubmit = poNumber.trim().length > 0 && fileName.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Manual PO Entry — {po.styleCode} {po.colour}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{po.styleName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Failure reason banner */}
          {po.failureReason && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">D365 Push Failure</p>
                <p className="text-xs text-amber-600">{po.failureReason}</p>
              </div>
            </div>
          )}

          {/* PO Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              PO Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={e => setPoNumber(e.target.value)}
              placeholder="e.g. PO-D365-26-10501"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              PO PDF <span className="text-red-500">*</span>
            </label>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={() => {}} />
            {fileName ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm font-medium text-green-700 font-mono">{fileName}</span>
                <button
                  onClick={() => setFileName('')}
                  className="ml-auto text-slate-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleFileClick}
                className="w-full px-4 py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50 transition-colors flex flex-col items-center gap-1.5">
                <Upload className="w-5 h-5" />
                <span className="text-sm font-medium">Click to select PO PDF</span>
                <span className="text-xs">PDF files only</span>
              </button>
            )}
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit(poNumber.trim(), fileName)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors',
              canSubmit
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}>
            <CheckCircle2 className="w-4 h-4" /> Save PO
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PDF Upload Modal ─────────────────────────────────────────────────────────

function PDFUploadModal({
  po,
  onClose,
  onUpload,
}: {
  po: PORecord
  onClose: () => void
  onUpload: (pdfName: string) => void
}) {
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileClick() {
    setFileName(`${po.poNumber ?? 'PO-upload'}.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Upload PO PDF
            </h2>
            <p className="font-mono text-xs text-slate-500 mt-0.5">{po.poNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Info */}
          <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
            <Eye className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-teal-700">
              D365 sync incomplete. Upload the PDF manually to mark this PO as complete.
            </p>
          </div>

          {/* File Upload */}
          <div>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={() => {}} />
            {fileName ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm font-medium text-green-700 font-mono">{fileName}</span>
                <button
                  onClick={() => setFileName('')}
                  className="ml-auto text-slate-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleFileClick}
                className="w-full px-4 py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors flex flex-col items-center gap-1.5">
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">Click to select PO PDF</span>
                <span className="text-xs">PDF files only</span>
              </button>
            )}
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={!fileName}
            onClick={() => fileName && onUpload(fileName)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors',
              fileName
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}>
            <Upload className="w-4 h-4" /> Upload PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

function PurchaseOrdersContent() {
  const { currentUser } = useCurrentUser()
  const isMIS = currentUser.role === 'sourcing-mis'

  const [records, setRecords]       = useState<PORecord[]>(INITIAL_PO_RECORDS)
  const [filter, setFilter]         = useState<POStatus | 'all'>('all')
  const [pushModal, setPushModal]   = useState<PORecord | null>(null)
  const [manualModal, setManualModal] = useState<PORecord | null>(null)
  const [pdfModal, setPdfModal]     = useState<PORecord | null>(null)
  const [toast, setToast]           = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return records
    return records.filter(r => r.status === filter)
  }, [records, filter])

  // Group by subOrderId — one group = one order, N rows = one per WH
  const grouped = useMemo(() => {
    const map = new Map<string, PORecord[]>()
    for (const r of filtered) {
      const arr = map.get(r.subOrderId) ?? []
      arr.push(r)
      map.set(r.subOrderId, arr)
    }
    return [...map.entries()].map(([subOrderId, recs]) => ({ subOrderId, recs }))
  }, [filtered])

  // collapsed set — default empty = all groups expanded
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const isExpanded      = (id: string) => !collapsedGroups.has(id)
  const toggleGroup     = (id: string) => setCollapsedGroups(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const counts = useMemo<Record<POStatus | 'all', number>>(() => ({
    all:          records.length,
    requested:    records.filter(r => r.status === 'requested').length,
    pushing:      records.filter(r => r.status === 'pushing').length,
    'po-raised':  records.filter(r => r.status === 'po-raised').length,
    failed:       records.filter(r => r.status === 'failed').length,
    complete:     records.filter(r => r.status === 'complete').length,
  }), [records])

  const handlePushSuccess = (poId: string, poNumber: string) => {
    const today = new Date().toISOString().split('T')[0]
    setRecords(prev => prev.map(r => r.id !== poId ? r : {
      ...r,
      status: 'po-raised',
      poNumber,
      poCreatedDate: today,
      d365PushedBy: currentUser.name,
      d365PushDate: today,
    }))
    setPushModal(null)
    showToast(`PO created: ${poNumber}`)
  }

  const handlePushFailure = (poId: string, reason: string) => {
    setRecords(prev => prev.map(r => r.id !== poId ? r : {
      ...r,
      status: 'failed',
      failureReason: reason,
      pushAttempts: (r.pushAttempts ?? 0) + 1,
      d365PushedBy: currentUser.name,
      d365PushDate: new Date().toISOString().split('T')[0],
    }))
    setPushModal(null)
    showToast('Push failed — manual entry required')
  }

  const handleManualEntry = (poId: string, poNumber: string, pdfName: string) => {
    const today = new Date().toISOString().split('T')[0]
    setRecords(prev => prev.map(r => r.id !== poId ? r : {
      ...r,
      status: 'complete',
      poNumber,
      poCreatedDate: today,
      manualPoEntry: true,
      pdfUrl: pdfName,
      pdfUploadedBy: currentUser.name,
      pdfUploadedDate: today,
    }))
    setManualModal(null)
    showToast(`PO ${poNumber} saved manually`)
  }

  const handlePDFUpload = (poId: string, pdfName: string) => {
    const today = new Date().toISOString().split('T')[0]
    setRecords(prev => prev.map(r => r.id !== poId ? r : {
      ...r,
      status: 'complete',
      pdfUrl: pdfName,
      pdfUploadedBy: currentUser.name,
      pdfUploadedDate: today,
    }))
    setPdfModal(null)
    showToast('PDF uploaded — PO complete')
  }

  const subtitle = isMIS
    ? `${counts.requested} ready to push · ${counts.failed} failed · ${counts['po-raised']} awaiting PDF`
    : 'PO status across your styles'

  const filterKeys: Array<{ label: string; val: POStatus | 'all'; cls: string; bg: string }> = [
    { label: 'All',       val: 'all',        cls: 'text-slate-700', bg: 'bg-white'    },
    { label: 'Ready',     val: 'requested',  cls: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Failed',    val: 'failed',     cls: 'text-red-700',   bg: 'bg-red-50'   },
    { label: 'PO Raised', val: 'po-raised',  cls: 'text-teal-700',  bg: 'bg-teal-50'  },
    { label: 'Complete',  val: 'complete',   cls: 'text-green-700', bg: 'bg-green-50' },
  ]

  const countFor = (val: POStatus | 'all'): number => {
    if (val === 'all') return counts.all
    return counts[val] ?? 0
  }

  return (
    <>
      <Header title="Purchase Orders" subtitle={subtitle} />
      <div className="px-6 py-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {filterKeys.map(({ label, val, cls, bg }) => (
            <button
              key={val}
              onClick={() => setFilter(filter === val ? 'all' : val)}
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-all',
                filter === val ? 'ring-2 ring-violet-400' : '',
                bg, 'border-slate-200'
              )}>
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className={cn('text-2xl font-black', cls)}>{countFor(val)}</p>
            </button>
          ))}
        </div>

        {/* Main table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    'Style', 'Vendor', 'D365 Code', 'Warehouse', 'SKU Lines',
                    'Total Qty', 'Total Value', 'Delivery', 'Requested By',
                    'Status',
                    isMIS ? 'Actions' : 'PO Number',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No records.
                    </td>
                  </tr>
                ) : (
                  grouped.map(({ subOrderId, recs }) => {
                    const first      = recs[0]
                    const expanded   = isExpanded(subOrderId)
                    const totalQty   = recs.reduce((s, r) => s + r.totalQty, 0)
                    const totalVal   = recs.reduce((s, r) => s + r.totalValue, 0)
                    const totalLines = recs.reduce((s, r) => s + r.lines.length, 0)
                    const nTotal     = recs.length
                    const nFailed    = recs.filter(r => r.status === 'failed').length
                    const nDone      = recs.filter(r => r.status === 'complete').length
                    const nRaised    = recs.filter(r => r.status === 'po-raised').length

                    const aggLabel =
                      nFailed > 0       ? `${nFailed}/${nTotal} Failed`
                      : nDone === nTotal ? `${nTotal}/${nTotal} Complete`
                      : nRaised > 0     ? `${nRaised}/${nTotal} Raised`
                      : `${nTotal}/${nTotal} Requested`
                    const aggColor =
                      nFailed > 0       ? 'bg-red-50 text-red-700 border-red-200'
                      : nDone === nTotal ? 'bg-green-50 text-green-700 border-green-200'
                      : nRaised > 0     ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'

                    return (
                      <Fragment key={subOrderId}>

                        {/* ── Order group header ── */}
                        <tr
                          className="bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                          onClick={() => toggleGroup(subOrderId)}>
                          {/* Style + expand chevron */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={cn(
                                'w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-150',
                                !expanded && '-rotate-90'
                              )} />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{first.styleCode}</p>
                                <p className="text-xs text-slate-400 max-w-[8rem] truncate">{first.styleName}</p>
                                <p className="text-xs text-slate-400">{first.colour} · {first.season}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-slate-700">{first.vendor}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
                              {first.vendorCode}
                            </span>
                          </td>
                          {/* Warehouse — aggregate count */}
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-500 font-medium">
                              {nTotal} warehouse{nTotal > 1 ? 's' : ''}
                            </span>
                          </td>
                          {/* SKU Lines — total */}
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-slate-700">{totalLines}</span>
                            <p className="text-xs text-slate-400">lines</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-slate-800">{totalQty.toLocaleString()}</span>
                            <p className="text-xs text-slate-400">pcs</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-slate-900">
                              ₹{totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-slate-700">
                              {new Date(first.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate-600">{first.requestedBy}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(first.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </p>
                          </td>
                          {/* Aggregate status badge */}
                          <td className="px-4 py-3">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap',
                              aggColor
                            )}>
                              {aggLabel}
                            </span>
                          </td>
                          {/* No actions at group level */}
                          <td className="px-4 py-3" />
                        </tr>

                        {/* ── Per-WH child rows ── */}
                        {expanded && recs.map((po, idx) => {
                          const w       = getWH(po.whCode)
                          const isLast  = idx === recs.length - 1
                          return (
                            <tr
                              key={po.id}
                              className={cn(
                                'border-b transition-colors',
                                isLast ? 'border-slate-200' : 'border-slate-100',
                                po.status === 'failed'   ? 'bg-red-50/40'  :
                                po.status === 'complete' ? 'bg-green-50/20' : 'bg-white hover:bg-slate-50/60'
                              )}>
                              {/* Indent column — tree connector */}
                              <td className="px-4 py-2.5 w-10">
                                <div className="flex items-center justify-end pr-1">
                                  <span className="text-slate-300 text-sm leading-none select-none">
                                    {isLast ? '└' : '├'}
                                  </span>
                                </div>
                              </td>
                              {/* Vendor + D365 — blank, inherited from parent */}
                              <td /><td />
                              {/* Warehouse */}
                              <td className="px-4 py-2.5">
                                {w ? (
                                  <>
                                    <p className="text-xs font-semibold text-slate-700">{w.city}</p>
                                    <p className="font-mono text-[10px] text-slate-400">{w.code}</p>
                                  </>
                                ) : (
                                  <span className="font-mono text-xs text-slate-400">{po.whCode}</span>
                                )}
                              </td>
                              {/* SKU Lines */}
                              <td className="px-4 py-2.5">
                                <span className="text-xs font-medium text-slate-600">{po.lines.length}</span>
                                <p className="text-xs text-slate-400">lines</p>
                              </td>
                              {/* Qty */}
                              <td className="px-4 py-2.5">
                                <span className="text-xs font-medium text-slate-700">{po.totalQty.toLocaleString()}</span>
                                <p className="text-xs text-slate-400">pcs</p>
                              </td>
                              {/* Value */}
                              <td className="px-4 py-2.5">
                                <span className="text-xs text-slate-700">
                                  ₹{po.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </td>
                              {/* Delivery + Requested By — blank */}
                              <td /><td />
                              {/* Per-WH status */}
                              <td className="px-4 py-2.5">
                                <div className="space-y-0.5">
                                  <POStatusBadge status={po.status} />
                                  {po.poNumber && (
                                    <p className="font-mono text-[10px] text-slate-600">{po.poNumber}</p>
                                  )}
                                  {po.manualPoEntry && (
                                    <p className="text-[10px] text-amber-600 font-medium">Manual entry</p>
                                  )}
                                  {po.pushAttempts && po.status === 'failed' && (
                                    <p className="text-[10px] text-red-500">Attempt {po.pushAttempts}</p>
                                  )}
                                </div>
                              </td>
                              {/* Per-WH actions */}
                              <td className="px-4 py-2.5">
                                {isMIS ? (
                                  <div className="flex flex-col gap-1.5">
                                    {po.status === 'requested' && (
                                      <button onClick={() => setPushModal(po)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 whitespace-nowrap">
                                        <Send className="w-3 h-3" /> Push to D365
                                      </button>
                                    )}
                                    {po.status === 'failed' && (
                                      <>
                                        <button onClick={() => setPushModal(po)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-slate-800 whitespace-nowrap">
                                          <RefreshCw className="w-3 h-3" /> Retry Push
                                        </button>
                                        <button onClick={() => setManualModal(po)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 whitespace-nowrap">
                                          <FileText className="w-3 h-3" /> Manual Entry
                                        </button>
                                      </>
                                    )}
                                    {po.status === 'po-raised' && (
                                      <button onClick={() => setPdfModal(po)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 whitespace-nowrap">
                                        <Upload className="w-3 h-3" /> Upload PDF
                                      </button>
                                    )}
                                    {po.status === 'complete' && po.pdfUrl && (
                                      <button className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 text-green-700 text-xs font-medium rounded-lg hover:bg-green-50 whitespace-nowrap">
                                        <Download className="w-3 h-3" /> {po.pdfUrl}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    {po.poNumber
                                      ? <p className="font-mono text-xs font-semibold text-slate-800">{po.poNumber}</p>
                                      : <span className="text-xs text-slate-400">—</span>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Failed details panel */}
        {filtered.some(r => r.status === 'failed') && (
          <div className="mt-4 space-y-2">
            {filtered.filter(r => r.status === 'failed').map(po => (
              <div
                key={po.id}
                className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">{po.styleCode} · {po.colour}</p>
                  <p className="text-xs text-red-600 mt-0.5">{po.failureReason}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modals */}
      {pushModal && (
        <PushModal
          po={pushModal}
          onClose={() => setPushModal(null)}
          onSuccess={poNumber => handlePushSuccess(pushModal.id, poNumber)}
          onFailure={reason => handlePushFailure(pushModal.id, reason)}
        />
      )}
      {manualModal && (
        <ManualEntryModal
          po={manualModal}
          onClose={() => setManualModal(null)}
          onSubmit={(poNumber, pdfName) => handleManualEntry(manualModal.id, poNumber, pdfName)}
        />
      )}
      {pdfModal && (
        <PDFUploadModal
          po={pdfModal}
          onClose={() => setPdfModal(null)}
          onUpload={pdfName => handlePDFUpload(pdfModal.id, pdfName)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {toast}
        </div>
      )}
    </>
  )
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersContent />
    </Suspense>
  )
}
