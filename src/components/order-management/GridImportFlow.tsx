'use client'
//
// ─── Grid Import Flow (Phase B) ────────────────────────────────────────────
// Two-step UI: drag-drop a file → see a validation preview → confirm import.
//
// This module exports two thin pieces that the OTB "New Order" page composes:
//   • <UploadDropzone>       — drag-drop zone (idle state)
//   • <ValidationPreview>    — preview screen shown after parsing
//
// Both are pure presentational; parsing and validation are owned by the
// caller (see grid-excel.ts and grid-validation.ts).
//

import { useRef, useState } from 'react'
import {
  Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, X, Info, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExcelParseResult } from '@/lib/grid-excel'
import type { GridImportSummary, RowValidation } from '@/lib/grid-validation'

// ─── UploadDropzone ────────────────────────────────────────────────────────
export function UploadDropzone({
  onFile,
  onTemplate,
  isParsing,
  error,
}: {
  onFile: (file: File) => void
  onTemplate: () => void
  isParsing: boolean
  error?: string | null
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    // 10 MB cap per PRD §5.2 Step 2
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10 MB.')
      return
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      alert('Only .xlsx, .xls, or .csv files are supported.')
      return
    }
    onFile(file)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !isParsing && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 transition-all',
          isParsing
            ? 'border-violet-200 bg-violet-50/40 cursor-wait'
            : dragOver
            ? 'border-violet-500 bg-violet-50 scale-[1.005] cursor-copy'
            : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30 cursor-pointer',
        )}
      >
        {isParsing ? (
          <>
            <div className="w-12 h-12 rounded-full border-[3px] border-violet-600 border-t-transparent animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Parsing your file…</p>
              <p className="text-xs text-slate-400 mt-1">Mapping columns · validating rows</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Upload className="w-7 h-7 text-violet-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900">Drop your Order Grid file here</p>
              <p className="text-xs text-slate-500 mt-1">
                Excel (.xlsx, .xls) or CSV — max 10 MB
              </p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700"
            >
              Browse files
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onTemplate() }}
              className="flex items-center gap-1 text-xs text-violet-600 hover:underline font-medium"
            >
              <Download className="w-3 h-3" /> Download template first
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p><span className="font-semibold">Couldn&apos;t parse the file.</span> {error}</p>
        </div>
      )}
    </div>
  )
}


// ─── ValidationPreview ─────────────────────────────────────────────────────
//
// Shown after a file is parsed and validated. Lets the user inspect what's
// about to be imported, then confirm or cancel.

export function ValidationPreview({
  parseMeta,
  perRow,
  summary,
  rows,
  onConfirm,
  onCancel,
}: {
  parseMeta: ExcelParseResult['meta']
  perRow:    RowValidation[]
  summary:   GridImportSummary
  rows:      Array<{ id: string; styleCode: string; styleName: string; orderQty: string }>
  onConfirm: () => void
  onCancel:  () => void
}) {
  const [showAll,   setShowAll]   = useState(false)
  const [showSkip,  setShowSkip]  = useState(false)
  const [showWarn,  setShowWarn]  = useState(true)
  const [showUnmap, setShowUnmap] = useState(false)

  const skipped  = perRow.filter(v => v.willSkip)
  const warnings = perRow.filter(v => !v.willSkip && v.hasWarnings)
  const ready    = perRow.filter(v => !v.willSkip && !v.hasWarnings)

  const rowById = new Map(rows.map(r => [r.id, r]))
  const visibleRows = showAll ? perRow : perRow.slice(0, 10)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <button onClick={onCancel}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors mt-0.5"
            title="Back to upload">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-900">{parseMeta.fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Sheet <span className="font-medium text-slate-600">{parseMeta.sheetName}</span>
              {parseMeta.sheetCount > 1 && <> (of {parseMeta.sheetCount})</>}
              {' · '}
              Mapped {parseMeta.mappedCount} of {parseMeta.headerCount} columns
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          label="Total rows" value={summary.total}
          tone="neutral"
        />
        <SummaryCard
          label="Ready" value={summary.ready}
          tone="green"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        />
        <SummaryCard
          label="With warnings" value={summary.warnings}
          tone="amber"
          icon={<AlertCircle className="w-3.5 h-3.5" />}
          subtitle="Imported, flagged for review"
        />
        <SummaryCard
          label="Will be skipped" value={summary.skipped}
          tone="red"
          icon={<X className="w-3.5 h-3.5" />}
          subtitle="Style Code missing"
        />
      </div>

      {/* Duplicate hint (replenishment) */}
      {summary.duplicates > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            <span className="font-semibold">{summary.duplicates} rows</span> share a Style Code with
            another row in this file or an active grid — that&apos;s allowed (replenishment scenario).
          </p>
        </div>
      )}

      {/* Skipped rows section */}
      {skipped.length > 0 && (
        <CollapsibleSection
          title={`${skipped.length} rows will be skipped`}
          subtitle="Style Code is missing on these — they cannot be imported"
          tone="red"
          open={showSkip}
          onToggle={() => setShowSkip(s => !s)}
        >
          <ul className="text-xs text-slate-700 space-y-1">
            {skipped.map(v => {
              const r = rowById.get(v.rowId)
              return (
                <li key={v.rowId} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-50/60 border border-red-100">
                  <X className="w-3 h-3 text-red-500 shrink-0" />
                  <span className="text-slate-500">Row {perRow.indexOf(v) + 1}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-700 truncate flex-1">{r?.styleName || <em className="text-slate-400">No style name</em>}</span>
                </li>
              )
            })}
          </ul>
        </CollapsibleSection>
      )}

      {/* Warning rows section */}
      {warnings.length > 0 && (
        <CollapsibleSection
          title={`${warnings.length} rows have warnings`}
          subtitle="These will be imported and flagged for inline correction"
          tone="amber"
          open={showWarn}
          onToggle={() => setShowWarn(s => !s)}
        >
          <ul className="text-xs space-y-2">
            {(showAll ? warnings : warnings.slice(0, 8)).map(v => {
              const r = rowById.get(v.rowId)
              return (
                <li key={v.rowId} className="px-3 py-2 rounded-md bg-amber-50/40 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-violet-700 text-xs">{r?.styleCode || '—'}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-600 truncate flex-1">{r?.styleName || <em className="text-slate-400">No style name</em>}</span>
                  </div>
                  <ul className="ml-1 space-y-0.5">
                    {v.issues.slice(0, 3).map((iss, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-amber-800">
                        <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span><span className="font-semibold">{iss.field}:</span> {iss.message}</span>
                      </li>
                    ))}
                    {v.issues.length > 3 && (
                      <li className="text-[10px] text-amber-600">+{v.issues.length - 3} more</li>
                    )}
                  </ul>
                </li>
              )
            })}
          </ul>
          {warnings.length > 8 && !showAll && (
            <button onClick={() => setShowAll(true)} className="text-xs text-violet-600 hover:underline mt-2">
              Show all {warnings.length} warnings
            </button>
          )}
        </CollapsibleSection>
      )}

      {/* All-rows preview */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-700">
            All {summary.total} rows
            {!showAll && summary.total > 10 && <span className="text-slate-400 font-normal"> (showing first 10)</span>}
          </p>
          {summary.total > 10 && (
            <button onClick={() => setShowAll(s => !s)} className="text-xs text-violet-600 hover:underline">
              {showAll ? 'Show first 10 only' : `View all ${summary.total}`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-[360px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-12">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Style Code</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Style Name</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Qty</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issues</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((v, i) => {
                const r = rowById.get(v.rowId)
                const idx = perRow.indexOf(v)
                return (
                  <tr key={v.rowId} className={cn(
                    'border-b border-slate-100 last:border-b-0',
                    v.willSkip ? 'bg-red-50/40'
                    : v.hasWarnings ? 'bg-amber-50/30'
                    : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  )}>
                    <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {v.willSkip ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                          <X className="w-2.5 h-2.5" /> SKIP
                        </span>
                      ) : v.hasWarnings ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          <AlertCircle className="w-2.5 h-2.5" /> WARN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                          <CheckCircle2 className="w-2.5 h-2.5" /> OK
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-violet-700">{r?.styleCode || <span className="text-red-500 font-normal italic">missing</span>}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[280px] truncate" title={r?.styleName}>{r?.styleName || '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r?.orderQty || '—'}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-500 truncate max-w-[260px]" title={v.issues.map(i => i.message).join(' / ')}>
                      {v.issues.length === 0 ? <span className="text-slate-300">—</span> : `${v.issues.length} issue${v.issues.length>1?'s':''}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unmapped headers (only shown if any) */}
      {parseMeta.unmappedHeaders.length > 0 && (
        <CollapsibleSection
          title={`${parseMeta.unmappedHeaders.length} columns ignored`}
          subtitle="These columns from the Excel file aren't tracked by the OMS yet — they'll come from MDM in Phase 2"
          tone="neutral"
          open={showUnmap}
          onToggle={() => setShowUnmap(s => !s)}
        >
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {parseMeta.unmappedHeaders.slice(0, 30).join(', ')}
            {parseMeta.unmappedHeaders.length > 30 && <span className="text-slate-400"> …and {parseMeta.unmappedHeaders.length - 30} more</span>}
          </p>
        </CollapsibleSection>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-5 py-3.5 sticky bottom-2">
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{ready.length + warnings.length}</span> rows will be imported
          {summary.skipped > 0 && (
            <> · <span className="text-red-600 font-medium">{summary.skipped} skipped</span></>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onConfirm}
            disabled={ready.length + warnings.length === 0}
            className={cn('px-5 py-2 rounded-xl text-xs font-bold transition-colors',
              ready.length + warnings.length > 0
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}>
            Import as Draft
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── Tiny helpers (private to this file) ───────────────────────────────────
function SummaryCard({ label, value, tone, icon, subtitle }: {
  label: string; value: number;
  tone: 'neutral' | 'green' | 'amber' | 'red'
  icon?: React.ReactNode
  subtitle?: string
}) {
  const map = {
    neutral: 'bg-white border-slate-200 text-slate-900',
    green:   'bg-green-50/40 border-green-200 text-green-800',
    amber:   'bg-amber-50/40 border-amber-200 text-amber-800',
    red:     'bg-red-50/40 border-red-200 text-red-800',
  }
  return (
    <div className={cn('rounded-2xl border p-3', map[tone])}>
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {icon}{label}
      </div>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
      {subtitle && <p className="text-[10px] opacity-60 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function CollapsibleSection({ title, subtitle, tone, open, onToggle, children }: {
  title: string; subtitle?: string;
  tone: 'red' | 'amber' | 'neutral'; open: boolean;
  onToggle: () => void; children: React.ReactNode
}) {
  const toneMap = {
    red:     { bg: 'bg-red-50/30',   border: 'border-red-200',   text: 'text-red-800'   },
    amber:   { bg: 'bg-amber-50/30', border: 'border-amber-200', text: 'text-amber-800' },
    neutral: { bg: 'bg-slate-50/40', border: 'border-slate-200', text: 'text-slate-700' },
  }
  const t = toneMap[tone]
  return (
    <div className={cn('rounded-2xl border overflow-hidden', t.bg, t.border)}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors">
        <div className="text-left">
          <p className={cn('text-sm font-semibold', t.text)}>{title}</p>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}
