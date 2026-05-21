// ─── Order-Grid Row Validation (Phase B) ────────────────────────────────────
//
// Pure functions — no React, no DOM. The Excel-import flow uses these to:
//   1. Decide which rows to **skip** (only when styleCode is missing)
//   2. Flag rows that need **attention** (warnings) but are still imported
//   3. Surface field-level issues in the inline editor (red-dot indicators)
//
// All field rules track the PRD §5.2.1 column-mapping table.

// Phase A introduced the GridRow type inside order-management/page.tsx.
// To avoid coupling this lib file to a Next page, we re-declare a structural
// subset that is enough for validation. Any extra fields on the runtime
// object are ignored.
export type ValidatableRow = {
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
  activeSizes: string
  sizeRatio: string
  orderQty: string
  mrp: string
  targetPrice: string
  whBhw: string
  whDel: string
  whBlr: string
  handoverDate: string
  buyingExpectedInwardDate: string
  tier: string
  techPack: string
  designer: string
}

export type IssueSeverity = 'error' | 'warning'

/**
 * One issue tied to a specific cell. `severity = 'error'` means the row will
 * be skipped entirely on import; `'warning'` means the row is imported but
 * flagged for inline correction.
 */
export type FieldIssue = {
  field: keyof ValidatableRow
  severity: IssueSeverity
  message: string
}

export type RowValidation = {
  rowId: string
  issues: FieldIssue[]
  willSkip: boolean        // true when any issue is severity 'error'
  hasWarnings: boolean     // true when any non-error issue exists
}

export type GridImportSummary = {
  total: number
  ready: number
  warnings: number
  skipped: number
  duplicates: number       // duplicate styleCode within the import (replenishment hint)
}

// ─── Allowed-value catalogues ───────────────────────────────────────────────
// Kept in sync with the constants in order-management/page.tsx.
export const VALIDATION_OPTIONS = {
  gender:       ['BOYS','GIRLS','UNISEX','MEN','WOMEN','INFANTS','KIDS'],
  productGroup: ['OUTER_WEAR','TOP_WEAR','BOTTOM_WEAR','CLOTHING_SET','WINTER_WEAR','INNERWEAR','ACCESSORIES'],
  type:         ['JACKETS','T-SHIRTS','SHIRTS','SWEATSHIRTS','HOODIES','TROUSERS','JEANS','SHORTS','DRESSES','LEGGINGS','SETS'],
  subType:      ['JACKET','BLAZER','DENIM JACKET','PU JACKET','SHACKET','SHRUG','WAISTCOAT','WIND CHEATERS','TRUCKER JACKET'],
  season:       ['AW 26','SS 26','SS 27','AW 27'],
  drop:         ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'],
  fabric:       ['POLYESTER','COTTON','COTTON BLEND','RAYON','MODAL','NYLON','POLY VISCOSE','POLYCOTTON','DENIM','FLEECE','TERRY'],
  ageGroup:     ['3M-2Y','2-8Y','2-10Y','0-2Y','4-8Y','1-5Y','NA'],
  tier:         ['HERO','TIER-1','TIER-2','TAIL'],
} as const

// Mandatory fields per PRD §5.2.1 (warning if missing; styleCode is the only
// hard-block at upload time).
const MANDATORY_FIELDS: (keyof ValidatableRow)[] = [
  'styleName', 'gender', 'productGroup', 'type', 'subType',
  'season', 'drop', 'fabric', 'ageGroup',
  'activeSizes', 'sizeRatio', 'orderQty',
  'handoverDate', 'buyingExpectedInwardDate',
  'techPack', 'designer',
]

// ─── Helpers ────────────────────────────────────────────────────────────────
const isBlank = (v: string | undefined | null) => !v || !String(v).trim()

const URL_RE   = /^https?:\/\/.+/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE  = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/   // DD/MM/YYYY

const parseDate = (s: string): Date | null => {
  if (!s) return null
  const m = DATE_RE.exec(s.trim())
  if (m) {
    const [, d, mo, y] = m
    return new Date(Number(y), Number(mo) - 1, Number(d))
  }
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t) : null
}

// ─── validateRow: collect every issue on a single row ──────────────────────
export function validateRow(row: ValidatableRow, rowId: string): RowValidation {
  const issues: FieldIssue[] = []
  const push = (field: FieldIssue['field'], severity: IssueSeverity, message: string) =>
    issues.push({ field, severity, message })

  // ── styleCode: HARD BLOCK ──
  if (isBlank(row.styleCode)) {
    push('styleCode', 'error', 'Style Code is required — row will be skipped.')
  }

  // ── Other mandatory fields: warning if missing ──
  for (const f of MANDATORY_FIELDS) {
    if (isBlank(row[f])) {
      push(f, 'warning', `${labelOf(f)} is required.`)
    }
  }

  // ── Dropdown enum checks ──
  for (const [field, allowed] of Object.entries(VALIDATION_OPTIONS) as [keyof typeof VALIDATION_OPTIONS, readonly string[]][]) {
    const v = row[field]
    if (v && !allowed.includes(v.trim())) {
      push(field, 'warning', `Invalid value "${v}". Expected one of: ${allowed.slice(0, 4).join(', ')}${allowed.length > 4 ? '…' : ''}`)
    }
  }

  // ── Tech Pack URL format ──
  if (row.techPack && !URL_RE.test(row.techPack.trim())) {
    push('techPack', 'warning', 'Tech Pack should be a Google Drive URL (https://…).')
  }

  // ── Designer email format ──
  if (row.designer && row.designer.includes('@') && !EMAIL_RE.test(row.designer.trim())) {
    push('designer', 'warning', 'Designer email looks malformed.')
  }

  // ── Numeric: orderQty / mrp / targetPrice ──
  if (row.orderQty && !/^\d+$/.test(row.orderQty.trim())) {
    push('orderQty', 'warning', 'Order Qty must be a whole number.')
  } else if (row.orderQty && Number(row.orderQty) < 1) {
    push('orderQty', 'warning', 'Order Qty must be ≥ 1.')
  }
  for (const f of ['mrp', 'targetPrice'] as const) {
    if (row[f] && !/^\d+(\.\d+)?$/.test(row[f].trim())) {
      push(f, 'warning', `${labelOf(f)} must be numeric.`)
    }
  }

  // ── Size ratio count must match active sizes count ──
  if (row.activeSizes && row.sizeRatio) {
    const sizes  = row.activeSizes.split(';').map(s => s.trim()).filter(Boolean)
    const ratios = row.sizeRatio.split(':').map(s => s.trim()).filter(Boolean)
    if (sizes.length !== ratios.length) {
      push('sizeRatio', 'warning',
        `Size Ratio has ${ratios.length} parts but Active Sizes has ${sizes.length}.`)
    }
  }

  // ── Warehouse split: when ANY value is filled, sum should equal orderQty ──
  const hasWh = !isBlank(row.whBhw) || !isBlank(row.whDel) || !isBlank(row.whBlr)
  if (hasWh) {
    const sum  = (Number(row.whBhw)||0) + (Number(row.whDel)||0) + (Number(row.whBlr)||0)
    const ordr = Number(row.orderQty) || 0
    if (ordr > 0 && sum !== ordr) {
      const msg = `Warehouse split (${sum}) doesn't match Order Qty (${ordr}).`
      push('whBhw', 'warning', msg)
      push('whDel', 'warning', msg)
      push('whBlr', 'warning', msg)
    }
  }

  // ── Date ordering: Inward Date must be ≥ Handover Date when both present ──
  const hd = parseDate(row.handoverDate)
  const id = parseDate(row.buyingExpectedInwardDate)
  if (hd && id && id < hd) {
    push('buyingExpectedInwardDate', 'warning',
      'Inward Date must be on or after Handover Date.')
  }

  const willSkip     = issues.some(i => i.severity === 'error')
  const hasWarnings  = issues.some(i => i.severity === 'warning')

  return { rowId, issues, willSkip, hasWarnings }
}

// ─── validateGridImport: aggregate stats across rows ───────────────────────
export function validateGridImport(
  rows: { id: string } & ValidatableRow extends infer _ ? Array<ValidatableRow & { id: string }> : never
): { perRow: RowValidation[]; summary: GridImportSummary } {
  // The funky generic above just enforces that we get rows with an id; in
  // practice the caller passes GridRow[] directly.
  const perRow: RowValidation[] = (rows as unknown as Array<ValidatableRow & { id: string }>)
    .map(r => validateRow(r, r.id))

  // Duplicate styleCodes within this import (informational only — replenishment is allowed).
  const seen = new Map<string, number>()
  ;(rows as unknown as Array<ValidatableRow & { id: string }>).forEach(r => {
    const k = (r.styleCode || '').trim().toUpperCase()
    if (!k) return
    seen.set(k, (seen.get(k) || 0) + 1)
  })
  let duplicates = 0
  seen.forEach(n => { if (n > 1) duplicates += n })

  const skipped  = perRow.filter(v => v.willSkip).length
  const warnings = perRow.filter(v => !v.willSkip && v.hasWarnings).length
  const ready    = perRow.filter(v => !v.willSkip && !v.hasWarnings).length

  return {
    perRow,
    summary: {
      total: perRow.length,
      ready,
      warnings,
      skipped,
      duplicates,
    },
  }
}

// ─── Submission-time validation (PRD §5.5) ─────────────────────────────────
// At submission, styleCode AND buyingExpectedInwardDate are HARD-required, and
// inward date must be ≥ handover date. Phase C will call this when the user
// hits "Submit" in the inline editor.
export function validateForSubmission(rows: Array<ValidatableRow & { id: string }>):
  { ok: boolean; blocking: { rowId: string; field: keyof ValidatableRow; message: string }[] } {
  const blocking: { rowId: string; field: keyof ValidatableRow; message: string }[] = []
  rows.forEach(r => {
    if (isBlank(r.styleCode)) {
      blocking.push({ rowId: r.id, field: 'styleCode', message: 'Style Code is required.' })
    }
    if (isBlank(r.buyingExpectedInwardDate)) {
      blocking.push({ rowId: r.id, field: 'buyingExpectedInwardDate',
        message: 'Inward Date is required — OTIF cannot be tracked without it.' })
    }
    const hd = parseDate(r.handoverDate)
    const id = parseDate(r.buyingExpectedInwardDate)
    if (hd && id && id < hd) {
      blocking.push({ rowId: r.id, field: 'buyingExpectedInwardDate',
        message: 'Inward Date must be on or after Handover Date.' })
    }
  })
  return { ok: blocking.length === 0, blocking }
}

// ─── Field labels for messages (matches grid header text) ──────────────────
function labelOf(f: keyof ValidatableRow): string {
  const map: Partial<Record<keyof ValidatableRow, string>> = {
    styleCode:                'Style Code',
    styleName:                'Style Name',
    gender:                   'Gender',
    productGroup:             'Product Group',
    type:                     'Type',
    subType:                  'Sub Type',
    season:                   'Season',
    drop:                     'Drop',
    fabric:                   'Fabric',
    ageGroup:                 'Age Group',
    colorFamily:              'Colour Family',
    activeSizes:              'Active Sizes',
    sizeRatio:                'Size Ratio',
    orderQty:                 'Order Qty',
    mrp:                      'MRP',
    targetPrice:              'Target Price',
    whBhw:                    'Warehouse BHW',
    whDel:                    'Warehouse DEL',
    whBlr:                    'Warehouse BLR',
    handoverDate:             'Handover Date',
    buyingExpectedInwardDate: 'Inward Date',
    tier:                     'Tier',
    techPack:                 'Tech Pack',
    designer:                 'Designer',
  }
  return map[f] ?? String(f)
}
