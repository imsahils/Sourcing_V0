'use client'
import { useState, useRef, useCallback } from 'react'
import {
  Upload, Download, Plus, Trash2, Eye, EyeOff, CheckCircle2,
  FileSpreadsheet, ChevronRight, Clock, AlertCircle,
  X, Search, ArrowLeft, Send, RotateCcw, Pencil, Check
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type GridRow = {
  id: string
  disabled: boolean
  styleCode: string
  styleName: string
  gender: string
  productGroup: string
  type: string
  subType: string
  season: string
  drop: string
  fabric: string
  ageGroup: string
  colorFamily: string
  pantone: string
  activeSizes: string
  sizeRatio: string
  orderQty: string
  mrp: string
  targetPrice: string
  // Warehouse split
  whBhw: string   // Bhiwandi / Mumbai
  whDel: string   // Delhi NCR
  whBlr: string   // Bangalore
  handoverDate: string
  designer: string
  notes: string
}

type ImportRecord = {
  id: string
  name: string
  date: string
  rowCount: number
  status: 'submitted' | 'draft' | 'processing'
  season: string
}

type Step = 'grid' | 'review'

// ─── Options ──────────────────────────────────────────────────────────────────
const GENDER_OPTIONS   = ['BOYS', 'GIRLS', 'UNISEX', 'MEN', 'WOMEN', 'INFANTS', 'KIDS']
const PRODUCT_OPTIONS  = ['OUTER_WEAR', 'TOP_WEAR', 'BOTTOM_WEAR', 'CLOTHING_SET', 'WINTER_WEAR', 'INNERWEAR', 'ACCESSORIES']
const TYPE_OPTIONS     = ['JACKETS', 'T-SHIRTS', 'SHIRTS', 'SWEATSHIRTS', 'HOODIES', 'TROUSERS', 'JEANS', 'SHORTS', 'DRESSES', 'LEGGINGS', 'SETS']
const SEASON_OPTIONS   = ['AW 26', 'SS 26', 'SS 27', 'AW 27']
const DROP_OPTIONS     = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
const FABRIC_OPTIONS   = ['POLYESTER','COTTON','COTTON BLEND','RAYON','MODAL','NYLON','POLY VISCOSE','POLYCOTTON','DENIM','FLEECE','TERRY']
const AGE_OPTIONS      = ['3M-2Y','2-8Y','2-10Y','0-2Y','4-8Y','1-5Y','NA']
const DESIGNER_OPTIONS = ['SUBASHREE','PRIYA M','MEGHA S','RAHUL K','ANANYA B']

const IMPORT_HISTORY: ImportRecord[] = [
  { id: 'og-001', name: 'NN AW26 Outer Wear Batch 1',  date: '26 Feb 2026', rowCount: 42, status: 'submitted',  season: 'AW 26' },
  { id: 'og-002', name: 'NN SS26 Knits Batch 2',        date: '18 Feb 2026', rowCount: 28, status: 'submitted',  season: 'SS 26' },
  { id: 'og-003', name: 'NN SS26 Woven Bottoms',        date: '10 Feb 2026', rowCount: 15, status: 'processing', season: 'SS 26' },
  { id: 'og-004', name: 'NN AW26 Infants Range',        date: '03 Feb 2026', rowCount: 33, status: 'submitted',  season: 'AW 26' },
  { id: 'og-005', name: 'NN SS26 Girls Dresses Draft',  date: '28 Jan 2026', rowCount: 9,  status: 'draft',      season: 'SS 26' },
]

const SAMPLE_IMPORT: GridRow[] = [
  { id: 'r1', disabled: false, styleCode: 'NNNBOW00740', styleName: 'RED DISNEY CARS PRINTED PUFFER JACKET WITH HOOD',              gender: 'BOYS',  productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '2-10Y', colorFamily: 'RED',    pantone: '', activeSizes: '2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio: '1:1:1:1:1:1', orderQty: '400', mrp: '1299', targetPrice: '390', whBhw: '200', whDel: '120', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
  { id: 'r2', disabled: false, styleCode: 'NNNBOW00741', styleName: 'BLUE OMBRE COLORBLOCK PUFFER JACKET WITH HOOD',                gender: 'BOYS',  productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '2-10Y', colorFamily: 'BLUE',   pantone: '', activeSizes: '2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio: '1:1:1:1:1:1', orderQty: '400', mrp: '1299', targetPrice: '390', whBhw: '200', whDel: '120', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
  { id: 'r3', disabled: false, styleCode: 'NNNBOW00742', styleName: 'BLACK AND YELLOW COLOURBLOCK PUFFER JACKET WITH HOOD',         gender: 'BOYS',  productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '2-10Y', colorFamily: 'BLACK',  pantone: '', activeSizes: '2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio: '1:1:1:1:1:1', orderQty: '400', mrp: '1299', targetPrice: '390', whBhw: '200', whDel: '120', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
  { id: 'r4', disabled: false, styleCode: 'NNNBOW00743', styleName: 'BLACK VARSITY MICKEY MOUSE BOMBER JACKET',                    gender: 'BOYS',  productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '2-10Y', colorFamily: 'BLACK',  pantone: '', activeSizes: '2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio: '1:1:1:1:1:1', orderQty: '400', mrp: '1499', targetPrice: '450', whBhw: '200', whDel: '120', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
  { id: 'r5', disabled: false, styleCode: 'NNNGOW00744', styleName: 'YELLOW MINNIE POLKA PRINTED PUFFER JACKET WITH DETACHABLE HOOD', gender: 'GIRLS', productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '2-10Y', colorFamily: 'YELLOW', pantone: '', activeSizes: '2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio: '1:1:1:1:1:1', orderQty: '400', mrp: '1499', targetPrice: '450', whBhw: '200', whDel: '120', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
  { id: 'r6', disabled: false, styleCode: 'NNNGOW00745', styleName: 'BLUE MINNIE AND DAISY PRINTED PUFFER JACKET WITH DETACHABLE HOOD', gender: 'GIRLS', productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '2-10Y', colorFamily: 'BLUE',   pantone: '', activeSizes: '2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio: '1:1:1:1:1:1', orderQty: '400', mrp: '1499', targetPrice: '450', whBhw: '200', whDel: '120', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
  { id: 'r7', disabled: false, styleCode: 'NNIBOW00748', styleName: 'BLUE AND GREEN COLOURBLOCK PUFFER JACKET WITH HOOD',           gender: 'BOYS',  productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '3M-2Y', colorFamily: 'BLUE',   pantone: '', activeSizes: '3-6M;6-9M;9-12M;12-18M;18-24M',  sizeRatio: '2:2:3:3:3',     orderQty: '400', mrp: '1199', targetPrice: '360', whBhw: '180', whDel: '140', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
  { id: 'r8', disabled: false, styleCode: 'NNIBOW00749', styleName: 'NAVY BEAR APPLIQUE PUFFER JACKET WITH HOOD',                  gender: 'BOYS',  productGroup: 'OUTER_WEAR', type: 'JACKETS', subType: 'JACKET', season: 'AW 26', drop: 'JULY', fabric: 'POLYESTER', ageGroup: '3M-2Y', colorFamily: 'NAVY',   pantone: '', activeSizes: '3-6M;6-9M;9-12M;12-18M;18-24M',  sizeRatio: '2:2:3:3:3',     orderQty: '400', mrp: '1199', targetPrice: '360', whBhw: '180', whDel: '140', whBlr: '80', handoverDate: '25/02/2026', designer: 'SUBASHREE', notes: '' },
]

const EMPTY_ROW = (): GridRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  disabled: false,
  styleCode: '', styleName: '', gender: '', productGroup: '', type: '', subType: '',
  season: 'AW 26', drop: 'JULY', fabric: '', ageGroup: '', colorFamily: '', pantone: '',
  activeSizes: '', sizeRatio: '', orderQty: '', mrp: '', targetPrice: '',
  whBhw: '', whDel: '', whBlr: '',
  handoverDate: '', designer: '', notes: '',
})

// ─── Inline editable cell ─────────────────────────────────────────────────────
type CellProps = {
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'select' | 'number'
  options?: string[]
  rowDisabled?: boolean
  placeholder?: string
  align?: 'left' | 'right'
  className?: string
}

function Cell({ value, onChange, type = 'text', options, rowDisabled, placeholder, align = 'left', className }: CellProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null)

  const start = () => {
    if (rowDisabled) return
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  const done = () => setEditing(false)

  const base = cn(
    'border-r border-slate-100 text-xs',
    rowDisabled && 'opacity-40 bg-slate-50/60',
    className
  )

  if (editing && !rowDisabled) {
    return (
      <td className={base}>
        {type === 'select' && options ? (
          <select
            ref={inputRef}
            value={value}
            autoFocus
            onChange={e => { onChange(e.target.value); done() }}
            onBlur={done}
            className="w-full px-2 py-1.5 text-xs bg-violet-50 border-b-2 border-violet-500 outline-none"
          >
            <option value="">—</option>
            {options.map(o => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <input
            ref={inputRef}
            type={type === 'number' ? 'number' : 'text'}
            value={value}
            autoFocus
            onChange={e => onChange(e.target.value)}
            onBlur={done}
            onKeyDown={e => (e.key === 'Enter' || e.key === 'Tab') && done()}
            placeholder={placeholder}
            className={cn('w-full px-2.5 py-1.5 text-xs bg-violet-50 border-b-2 border-violet-500 outline-none', align === 'right' && 'text-right')}
          />
        )}
      </td>
    )
  }

  return (
    <td className={cn(base, !rowDisabled && 'cursor-cell hover:bg-violet-50/40 group')} onClick={start}>
      <div className={cn('px-2.5 py-1.5 min-h-[30px] flex items-center gap-1', align === 'right' && 'justify-end', rowDisabled && 'line-through')}>
        {value
          ? <span className="truncate">{value}</span>
          : <span className="text-slate-300">{placeholder || '—'}</span>
        }
        {value && !rowDisabled && <Pencil className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />}
      </div>
    </td>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NewSubOrderPage() {
  const [step, setStep]             = useState<Step>('grid')
  const [gridName, setGridName]     = useState('')
  const [editingName, setEditingName] = useState(false)
  const [rows, setRows]             = useState<GridRow[]>([])
  const [dragOver, setDragOver]     = useState(false)
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [submitted, setSubmitted]   = useState(false)
  const [searchQ, setSearchQ]       = useState('')
  const fileRef                     = useRef<HTMLInputElement>(null)

  // ── Row mutations ────────────────────────────────────────────────────────────
  const updateRow = useCallback((id: string, field: keyof GridRow, val: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, [field]: val } : r)), [])

  const toggleRow = (id: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, disabled: !r.disabled } : r))

  const deleteRow = (id: string) =>
    setRows(p => p.filter(r => r.id !== id))

  const addRow = () =>
    setRows(p => [...p, EMPTY_ROW()])

  // ── Import sim ────────────────────────────────────────────────────────────────
  const runImport = () => {
    setImportState('loading')
    setTimeout(() => {
      setRows(SAMPLE_IMPORT)
      if (!gridName) setGridName('NN AW26 Outer Wear Batch 1')
      setImportState('done')
    }, 1400)
  }

  // ── Template download ─────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csv = 'styleCode,styleName,gender,productGroup,type,subType,season,drop,fabric,ageGroup,colorFamily,pantone,activeSizes,sizeRatio,orderQty,mrp,targetPrice,handoverDate,designer,notes\n'
    const a   = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'Fabricate_OrderGrid_Template.csv' })
    a.click()
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const q           = searchQ.toLowerCase()
  const visible     = rows.filter(r => !q || r.styleCode.toLowerCase().includes(q) || r.styleName.toLowerCase().includes(q))
  const activeRows  = rows.filter(r => !r.disabled)
  const totalQty    = activeRows.reduce((s, r) => s + (parseInt(r.orderQty) || 0), 0)
  const readyToSend = gridName.trim().length > 0 && activeRows.length > 0

  // ── Success ───────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <>
        <Header title="Order Brief" subtitle="Submitted" />
        <div className="px-6 py-16 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900">{gridName} submitted!</h2>
            <p className="text-sm text-slate-500 mt-1">{activeRows.length} styles · {totalQty.toLocaleString()} pcs · Added to sourcing queue</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-lg space-y-2">
            {activeRows.slice(0, 6).map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="w-32 font-mono text-xs font-semibold text-violet-700 shrink-0">{r.styleCode || '—'}</span>
                <span className="text-slate-600 truncate flex-1 text-xs">{r.styleName || '—'}</span>
                <span className="text-slate-400 text-xs shrink-0">{(parseInt(r.orderQty)||0).toLocaleString()} pcs</span>
              </div>
            ))}
            {activeRows.length > 6 && <p className="text-xs text-slate-400 text-center pt-1">+{activeRows.length - 6} more styles</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setSubmitted(false); setStep('grid'); setRows([]); setGridName(''); setImportState('idle') }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              New Order Grid
            </button>
            <button className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
              View in Portfolio →
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Review step ───────────────────────────────────────────────────────────────
  if (step === 'review') {
    const groups = Array.from(new Set(activeRows.map(r => r.productGroup || 'Uncategorised')))
    return (
      <>
        <Header title="Order Brief" subtitle={gridName} />
        <div className="px-6 py-6 max-w-5xl">
          <button onClick={() => setStep('grid')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Grid
          </button>

          {/* Header card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">{gridName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeRows.length} styles ·&nbsp;
                  {rows.filter(r => r.disabled).length > 0 && <>{rows.filter(r => r.disabled).length} disabled · </>}
                  <span className="font-semibold text-slate-700">{totalQty.toLocaleString()} total pcs</span>
                </p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">Ready to Submit</span>
            </div>

            {groups.map(pg => {
              const pgRows = activeRows.filter(r => (r.productGroup || 'Uncategorised') === pg)
              const pgQty  = pgRows.reduce((s, r) => s + (parseInt(r.orderQty) || 0), 0)
              return (
                <div key={pg} className="mb-5 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{pg}</span>
                    <span className="text-xs text-slate-400">{pgRows.length} styles · {pgQty.toLocaleString()} pcs</span>
                  </div>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {['Style Code','Style Name','Gender','Age Grp','Colour','Active Sizes','Size Ratio','Qty','MRP ₹','Target ₹','BHW','DEL','BLR','Inward Date','Designer'].map((h, hi) => (
                            <th key={h} className={cn('px-3 py-2 text-left font-semibold border-r border-slate-100 last:border-r-0 whitespace-nowrap text-xs',
                              (hi >= 10 && hi <= 12) ? 'text-amber-700 bg-amber-50' : 'text-slate-600'
                            )}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pgRows.map((r, i) => {
                          const total = parseInt(r.orderQty) || 0
                          const split = (parseInt(r.whBhw)||0) + (parseInt(r.whDel)||0) + (parseInt(r.whBlr)||0)
                          const hasWh = r.whBhw || r.whDel || r.whBlr
                          const mismatch = hasWh && total > 0 && split !== total
                          return (
                          <tr key={r.id} className={cn('border-t border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                            <td className="px-3 py-2 font-mono font-semibold text-violet-700 border-r border-slate-100 whitespace-nowrap">{r.styleCode}</td>
                            <td className="px-3 py-2 text-slate-700 border-r border-slate-100 max-w-[200px] truncate">{r.styleName}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{r.gender}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{r.ageGroup}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{r.colorFamily}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{r.activeSizes}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100">{r.sizeRatio}</td>
                            <td className="px-3 py-2 font-bold text-slate-900 border-r border-slate-100 text-right">{(parseInt(r.orderQty||'0')).toLocaleString()}</td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100 text-right">₹{r.mrp}</td>
                            <td className="px-3 py-2 text-green-700 font-semibold border-r border-slate-100 text-right">₹{r.targetPrice}</td>
                            {/* Warehouse split */}
                            <td className={cn('px-3 py-2 border-r border-amber-100 text-right font-medium', mismatch ? 'bg-red-50 text-red-700' : 'bg-amber-50/40 text-amber-800')}>{r.whBhw || '—'}</td>
                            <td className={cn('px-3 py-2 border-r border-amber-100 text-right font-medium', mismatch ? 'bg-red-50 text-red-700' : 'bg-amber-50/40 text-amber-800')}>{r.whDel  || '—'}</td>
                            <td className={cn('px-3 py-2 border-r border-slate-100 text-right font-medium', mismatch ? 'bg-red-50 text-red-700' : 'bg-amber-50/40 text-amber-800')}>
                              {r.whBlr || '—'}
                              {mismatch && <span className="ml-1 text-[9px] text-red-500 font-bold">≠{total}</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-100 whitespace-nowrap">{r.handoverDate}</td>
                            <td className="px-3 py-2 text-slate-500">{r.designer}</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>

          {activeRows.some(r => !r.styleCode || !r.orderQty) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Incomplete rows detected</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {activeRows.filter(r => !r.styleCode || !r.orderQty).length} rows missing Style Code or Qty — these will be skipped.
                </p>
              </div>
            </div>
          )}
          {activeRows.some(r => {
            const total = parseInt(r.orderQty) || 0
            const split = (parseInt(r.whBhw)||0) + (parseInt(r.whDel)||0) + (parseInt(r.whBlr)||0)
            return (r.whBhw || r.whDel || r.whBlr) && total > 0 && split !== total
          }) && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Warehouse split mismatch</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {activeRows.filter(r => {
                    const t = parseInt(r.orderQty)||0
                    const s = (parseInt(r.whBhw)||0)+(parseInt(r.whDel)||0)+(parseInt(r.whBlr)||0)
                    return (r.whBhw||r.whDel||r.whBlr) && t > 0 && s !== t
                  }).length} rows: BHW + DEL + BLR does not equal Order Qty. Please correct before submitting.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setStep('grid')} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Edit Grid
            </button>
            <button onClick={() => setSubmitted(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
              <Send className="w-4 h-4" />
              Submit {activeRows.filter(r => r.styleCode && r.orderQty).length} styles
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Grid step ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Header title="Order Brief" subtitle="Create · Import · Review" />
      <div className="px-6 py-5 space-y-5">

        {/* ── Top: Grid name + actions ── */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Name field */}
          <div className="flex-1 min-w-[280px]">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={gridName}
                  onChange={e => setGridName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                  placeholder="e.g. NN AW26 Outer Wear Batch 1"
                  className="flex-1 border border-violet-400 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                />
                <button onClick={() => setEditingName(false)} className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="w-full flex items-center gap-2 group px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-violet-400 bg-white hover:bg-violet-50/40 transition-colors text-left"
              >
                <FileSpreadsheet className={cn('w-4 h-4 shrink-0', gridName ? 'text-violet-600' : 'text-slate-400')} />
                {gridName
                  ? <span className="font-semibold text-slate-900 text-sm flex-1">{gridName}</span>
                  : <span className="text-slate-400 text-sm flex-1">Click to name this Order Grid…</span>
                }
                <Pencil className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
              </button>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 bg-white">
              <Download className="w-3.5 h-3.5" /> Template
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-50 bg-violet-50/50">
              <Upload className="w-3.5 h-3.5" /> Import Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={runImport} />
            <button onClick={addRow}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>
        </div>

        {/* ── Empty state ── */}
        {rows.length === 0 && importState !== 'loading' && (
          <div className="grid grid-cols-2 gap-4">
            {/* Upload */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); runImport() }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
                dragOver ? 'border-violet-500 bg-violet-50 scale-[1.01]' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30'
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-violet-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">Import from Excel</p>
                <p className="text-xs text-slate-500 mt-1">Drag & drop your order grid or click to browse</p>
                <p className="text-xs text-slate-400 mt-0.5">Supports .xlsx · .xls · .csv</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); downloadTemplate() }}
                className="flex items-center gap-1 text-xs text-violet-600 hover:underline font-medium"
              >
                <Download className="w-3 h-3" /> Download standard template first
              </button>
            </div>

            {/* Manual */}
            <div
              onClick={addRow}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer bg-white hover:border-slate-300 hover:bg-slate-50/50 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Plus className="w-6 h-6 text-slate-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">Create Manually</p>
                <p className="text-xs text-slate-500 mt-1">Build the order grid row by row — no Excel needed</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {importState === 'loading' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-[3px] border-violet-600 border-t-transparent animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Parsing order grid…</p>
              <p className="text-xs text-slate-400 mt-1">Validating style codes · mapping fields · checking sizes</p>
            </div>
          </div>
        )}

        {/* ── Grid ── */}
        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  {rows.length} rows
                  {rows.some(r => r.disabled) && <span className="text-slate-400 font-normal"> · {rows.filter(r => r.disabled).length} disabled</span>}
                  {totalQty > 0 && <span className="text-violet-700"> · {totalQty.toLocaleString()} pcs</span>}
                </span>
                {importState === 'done' && (
                  <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                    <CheckCircle2 className="w-3 h-3" /> Imported successfully
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search styles…"
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 w-44"
                  />
                  {searchQ && <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>}
                </div>
                <button onClick={() => { setRows([]); setImportState('idle') }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '520px' }}>
              <table className="border-collapse" style={{ minWidth: '2400px', width: '100%' }}>
                <thead className="sticky top-0 z-20">
                  {/* Group header row */}
                  <tr className="bg-slate-900 text-white border-b border-slate-700">
                    <th colSpan={3} className="sticky left-0 z-30 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Style</th>
                    <th colSpan={8} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Classification</th>
                    <th colSpan={2} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Sizing</th>
                    <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-right border-r border-slate-700">Commercial</th>
                    <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-amber-400 text-center border-r border-slate-700">▸ Warehouse Split</th>
                    <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Ops</th>
                    <th className="px-3 py-1.5" />
                  </tr>
                  {/* Column header row */}
                  <tr className="bg-slate-800 text-white">
                    <th className="sticky left-0 z-30 bg-slate-800 w-9 px-2 py-2.5 text-xs font-semibold text-slate-400 text-center border-r border-slate-700">#</th>
                    <th className="sticky left-9 z-30 bg-slate-800 w-32 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Style Code</th>
                    <th className="sticky left-[164px] z-30 bg-slate-800 w-56 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Style Name</th>
                    <th className="w-20  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Gender</th>
                    <th className="w-28  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Product Grp</th>
                    <th className="w-24  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Type</th>
                    <th className="w-24  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Sub Type</th>
                    <th className="w-20  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Season</th>
                    <th className="w-24  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Drop</th>
                    <th className="w-28  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Fabric</th>
                    <th className="w-20  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Age Grp</th>
                    <th className="w-24  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Colour</th>
                    <th className="w-44  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Active Sizes</th>
                    <th className="w-28  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Size Ratio</th>
                    <th className="w-20  px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700">Order Qty</th>
                    <th className="w-20  px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700">MRP ₹</th>
                    <th className="w-24  px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700">Target ₹</th>
                    {/* Warehouse split group */}
                    <th className="w-22  px-3 py-2.5 text-xs font-semibold text-right border-r border-amber-700 bg-amber-900/30 text-amber-300">BHW</th>
                    <th className="w-22  px-3 py-2.5 text-xs font-semibold text-right border-r border-amber-700 bg-amber-900/30 text-amber-300">DEL</th>
                    <th className="w-22  px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700 bg-amber-900/30 text-amber-300">BLR</th>
                    <th className="w-28  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Inward Date</th>
                    <th className="w-28  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Designer</th>
                    <th className="w-36  px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Notes</th>
                    <th className="w-20  px-3 py-2.5 text-xs font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, idx) => {
                    const bg = row.disabled ? 'bg-slate-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                    return (
                      <tr key={row.id} className={cn('border-b border-slate-100 hover:bg-violet-50/10 transition-colors', row.disabled && 'opacity-50')}>
                        {/* # - frozen */}
                        <td className={cn('sticky left-0 z-10 w-9 px-2 py-1.5 text-xs text-slate-400 text-center border-r border-slate-100', bg)}>{idx + 1}</td>

                        {/* Style Code - frozen, read-only display */}
                        <td className={cn('sticky left-9 z-10 w-32 border-r border-slate-100', bg)}>
                          <div className={cn('px-2.5 py-1.5 text-xs font-mono font-semibold min-h-[30px] flex items-center', row.disabled ? 'text-slate-300 line-through' : 'text-violet-700 cursor-cell hover:bg-violet-50/40')}>
                            {row.styleCode || <span className="text-slate-300 font-sans font-normal">—</span>}
                          </div>
                        </td>

                        {/* Style Name - frozen */}
                        <Cell value={row.styleName}     onChange={v => updateRow(row.id,'styleName',v)}     rowDisabled={row.disabled} placeholder="Style name"  className={cn('sticky left-[164px] z-10 w-56', bg)} />

                        {/* Scrollable */}
                        <Cell value={row.gender}        onChange={v => updateRow(row.id,'gender',v)}        type="select" options={GENDER_OPTIONS}   rowDisabled={row.disabled} className="w-20" />
                        <Cell value={row.productGroup}  onChange={v => updateRow(row.id,'productGroup',v)}  type="select" options={PRODUCT_OPTIONS}  rowDisabled={row.disabled} className="w-28" />
                        <Cell value={row.type}          onChange={v => updateRow(row.id,'type',v)}          type="select" options={TYPE_OPTIONS}     rowDisabled={row.disabled} className="w-24" />
                        <Cell value={row.subType}       onChange={v => updateRow(row.id,'subType',v)}       rowDisabled={row.disabled} placeholder="Sub type"    className="w-24" />
                        <Cell value={row.season}        onChange={v => updateRow(row.id,'season',v)}        type="select" options={SEASON_OPTIONS}   rowDisabled={row.disabled} className="w-20" />
                        <Cell value={row.drop}          onChange={v => updateRow(row.id,'drop',v)}          type="select" options={DROP_OPTIONS}     rowDisabled={row.disabled} className="w-24" />
                        <Cell value={row.fabric}        onChange={v => updateRow(row.id,'fabric',v)}        type="select" options={FABRIC_OPTIONS}   rowDisabled={row.disabled} className="w-28" />
                        <Cell value={row.ageGroup}      onChange={v => updateRow(row.id,'ageGroup',v)}      type="select" options={AGE_OPTIONS}      rowDisabled={row.disabled} className="w-20" />
                        <Cell value={row.colorFamily}   onChange={v => updateRow(row.id,'colorFamily',v)}   rowDisabled={row.disabled} placeholder="Colour"       className="w-24" />
                        <Cell value={row.activeSizes}   onChange={v => updateRow(row.id,'activeSizes',v)}   rowDisabled={row.disabled} placeholder="2-3Y;3-4Y…"   className="w-44" />
                        <Cell value={row.sizeRatio}     onChange={v => updateRow(row.id,'sizeRatio',v)}     rowDisabled={row.disabled} placeholder="1:1:1:1"       className="w-28" />
                        <Cell value={row.orderQty}      onChange={v => updateRow(row.id,'orderQty',v)}      type="number" rowDisabled={row.disabled} placeholder="0" align="right" className="w-20" />
                        <Cell value={row.mrp}           onChange={v => updateRow(row.id,'mrp',v)}           type="number" rowDisabled={row.disabled} placeholder="0" align="right" className="w-20" />
                        <Cell value={row.targetPrice}   onChange={v => updateRow(row.id,'targetPrice',v)}   type="number" rowDisabled={row.disabled} placeholder="0" align="right" className="w-24" />

                        {/* Warehouse split cells — highlight red if sum ≠ orderQty */}
                        {(() => {
                          const total = parseInt(row.orderQty) || 0
                          const split = (parseInt(row.whBhw)||0) + (parseInt(row.whDel)||0) + (parseInt(row.whBlr)||0)
                          const hasValues = row.whBhw || row.whDel || row.whBlr
                          const mismatch = hasValues && total > 0 && split !== total
                          const whCls = cn('border-r text-xs', mismatch ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/20 border-amber-100')
                          return (
                            <>
                              <Cell value={row.whBhw} onChange={v => updateRow(row.id,'whBhw',v)} type="number" rowDisabled={row.disabled} placeholder="0" align="right" className={cn(whCls, 'w-22')} />
                              <Cell value={row.whDel}  onChange={v => updateRow(row.id,'whDel',v)}  type="number" rowDisabled={row.disabled} placeholder="0" align="right" className={cn(whCls, 'w-22')} />
                              <Cell value={row.whBlr}  onChange={v => updateRow(row.id,'whBlr',v)}  type="number" rowDisabled={row.disabled} placeholder="0" align="right"
                                className={cn(whCls, 'w-22',
                                  mismatch ? 'after:content-["≠"] after:text-red-500 after:text-[9px] after:ml-0.5' : ''
                                )}
                              />
                            </>
                          )
                        })()}

                        <Cell value={row.handoverDate}  onChange={v => updateRow(row.id,'handoverDate',v)}  rowDisabled={row.disabled} placeholder="DD/MM/YYYY"   className="w-28" />
                        <Cell value={row.designer}      onChange={v => updateRow(row.id,'designer',v)}      type="select" options={DESIGNER_OPTIONS} rowDisabled={row.disabled} className="w-28" />
                        <Cell value={row.notes}         onChange={v => updateRow(row.id,'notes',v)}         rowDisabled={row.disabled} placeholder="Notes…"        className="w-36" />

                        {/* Actions */}
                        <td className="w-20 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              title={row.disabled ? 'Enable row' : 'Disable row'}
                              onClick={() => toggleRow(row.id)}
                              className={cn('p-1 rounded-md transition-colors', row.disabled ? 'text-slate-400 hover:text-green-600 hover:bg-green-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50')}
                            >
                              {row.disabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              title="Delete row"
                              onClick={() => deleteRow(row.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Add row */}
            <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/50">
              <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
            </div>
          </div>
        )}

        {/* ── Submit bar ── */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3.5">
            <div className="flex items-center gap-5 text-sm">
              <span className="text-slate-600"><span className="font-bold text-slate-900">{activeRows.length}</span> active styles</span>
              <span className="text-slate-600"><span className="font-bold text-slate-900">{totalQty.toLocaleString()}</span> pcs</span>
              {rows.filter(r => r.disabled).length > 0 && (
                <span className="text-slate-400"><span className="font-medium">{rows.filter(r => r.disabled).length}</span> disabled</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!gridName && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Name your grid first
                </span>
              )}
              <button
                disabled={!readyToSend}
                onClick={() => setStep('review')}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  readyToSend ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                Review & Submit <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Recent Import History ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Order Grids</h2>
              <p className="text-xs text-slate-500 mt-0.5">Previously imported or created batches</p>
            </div>
            <button className="text-xs text-violet-600 hover:underline font-medium">View all</button>
          </div>
          <div className="divide-y divide-slate-100">
            {IMPORT_HISTORY.map(rec => (
              <div key={rec.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  rec.status === 'submitted' ? 'bg-green-100' : rec.status === 'processing' ? 'bg-violet-100' : 'bg-slate-100'
                )}>
                  {rec.status === 'submitted'  ? <CheckCircle2 className="w-4 h-4 text-green-600" />  :
                   rec.status === 'processing' ? <Clock className="w-4 h-4 text-violet-600" />          :
                   <FileSpreadsheet className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{rec.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rec.date} · <span className="text-violet-700 font-medium">{rec.rowCount} styles</span> · {rec.season}
                  </p>
                </div>
                <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full shrink-0',
                  rec.status === 'submitted'  ? 'bg-green-100 text-green-700' :
                  rec.status === 'processing' ? 'bg-violet-100 text-violet-700'  :
                  'bg-slate-100 text-slate-500'
                )}>
                  {rec.status === 'submitted' ? 'Submitted' : rec.status === 'processing' ? 'Processing' : 'Draft'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {rec.status === 'draft' && (
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
