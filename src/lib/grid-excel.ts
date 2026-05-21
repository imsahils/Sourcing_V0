// ─── Excel Import (Phase B) ────────────────────────────────────────────────
//
// Parses the OTB Order Grid Excel template (.xlsx / .xls / .csv) into the
// `GridRow` shape used by the inline grid editor. Built on SheetJS.
//
// Column-mapping strategy:
//   - The shipped Bewakoof / Nautinati template has ~77 columns. We only need
//     ~24 of them for Phase 1 (the commercial fields). Everything else is
//     ignored gracefully (PRD §7 edge case: extra columns must not error).
//   - Header lookup is case- and whitespace-insensitive, and supports a few
//     common alias spellings the team has been using.

import * as XLSX from 'xlsx'

// Public type — kept structural so this module doesn't import from a Next page.
export type ParsedGridRow = {
  id: string
  disabled: false
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
  notes: string
}

export type ExcelParseResult = {
  rows: ParsedGridRow[]
  meta: {
    fileName: string
    sheetName: string
    sheetCount: number
    headerCount: number     // total columns the sheet had
    mappedCount: number     // how many of those mapped to a GridRow field
    unmappedHeaders: string[]
  }
}

// ─── Column aliases ────────────────────────────────────────────────────────
// Each GridRow field can be sourced from any of the listed Excel headers
// (case- and whitespace-insensitive, first match wins).
const COLUMN_ALIASES: Record<keyof Omit<ParsedGridRow, 'id' | 'disabled' | 'notes'>, string[]> = {
  styleCode:                ['stylecode', 'style code', 'style_code'],
  styleName:                ['stylename', 'style name', 'style_name'],
  gender:                   ['gender'],
  productGroup:             ['productgroup', 'product group', 'product_group', 'product grp'],
  type:                     ['type'],
  subType:                  ['subtype', 'sub type', 'sub_type'],
  season:                   ['season'],
  drop:                     ['drop'],
  fabric:                   ['fabric'],
  ageGroup:                 ['agegroup', 'age group', 'age_group', 'age grp'],
  colorFamily:              ['colorfamily', 'color family', 'colour family', 'colour'],
  activeSizes:              ['active sizes', 'activesizes', 'active_sizes', 'sizes'],
  sizeRatio:                ['size ratio', 'sizeratio', 'size_ratio', 'ratio'],
  orderQty:                 ['order quantity', 'orderqty', 'order qty', 'order_qty', 'qty', 'quantity'],
  mrp:                      ['mrp'],
  targetPrice:              ['targetprice', 'target price', 'target_price', 'target ₹', 'target'],
  whBhw:                    ['whbhw', 'wh bhw', 'wh_bhw', 'bhw'],
  whDel:                    ['whdel', 'wh del', 'wh_del', 'del'],
  whBlr:                    ['whblr', 'wh blr', 'wh_blr', 'blr'],
  handoverDate:             ['handover date', 'handoverdate', 'handover_date'],
  buyingExpectedInwardDate: ['inward date', 'inwarddate', 'inward_date', 'expectedinwarddate', 'expected inward date', 'buying expected inward date'],
  tier:                     ['merchandisingpyramid', 'merchandising pyramid', 'tier', 'merch tier'],
  techPack:                 ['techpack', 'tech pack', 'tech_pack'],
  designer:                 ['designer', 'designer email'],
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// ─── parseExcelFile: the main entry point ──────────────────────────────────
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const buf = await file.arrayBuffer()
  const wb  = XLSX.read(buf, { type: 'array', cellDates: true })

  // Prefer a sheet named "Styles" (matches the shipped template), fall back
  // to the first sheet.
  const preferredSheet = wb.SheetNames.find(n => /^styles?$/i.test(n)) ?? wb.SheetNames[0]
  const sheet          = wb.Sheets[preferredSheet]
  if (!sheet) throw new Error('Workbook contains no readable sheets.')

  // `defval: ''` ensures missing cells become empty string (not undefined).
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw:    false,   // values come back as formatted strings
    defval: '',
    blankrows: false,
  })

  const headerSet = new Set<string>()
  records.forEach(rec => Object.keys(rec).forEach(h => headerSet.add(h)))

  // For each GridRow field, find the matching Excel header name (or null).
  const headerMap: Record<string, string | null> = {}
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const found = [...headerSet].find(h => aliases.includes(normalize(h)))
    headerMap[field] = found ?? null
  }

  // Also surface which Excel headers we IGNORED — useful for the preview.
  const mappedNormalised = new Set(Object.values(headerMap).filter(Boolean).map(h => normalize(h!)))
  const unmapped = [...headerSet].filter(h => !mappedNormalised.has(normalize(h)))

  // Build rows.
  const pull = (rec: Record<string, unknown>, field: string): string => {
    const h = headerMap[field]
    if (!h) return ''
    const v = rec[h]
    if (v === undefined || v === null) return ''
    if (v instanceof Date) return formatDate(v)
    return String(v).trim()
  }

  const rows: ParsedGridRow[] = records.map((rec, idx) => ({
    id:                       `row-${Date.now()}-${idx}`,
    disabled:                 false,
    styleCode:                pull(rec, 'styleCode').toUpperCase(),
    styleName:                pull(rec, 'styleName'),
    gender:                   pull(rec, 'gender').toUpperCase(),
    productGroup:             pull(rec, 'productGroup').toUpperCase().replace(/\s+/g, '_'),
    type:                     pull(rec, 'type').toUpperCase(),
    subType:                  pull(rec, 'subType').toUpperCase(),
    season:                   pull(rec, 'season').toUpperCase(),
    drop:                     pull(rec, 'drop').toUpperCase(),
    fabric:                   pull(rec, 'fabric').toUpperCase(),
    ageGroup:                 pull(rec, 'ageGroup').toUpperCase(),
    colorFamily:              pull(rec, 'colorFamily').toUpperCase(),
    activeSizes:              pull(rec, 'activeSizes'),
    sizeRatio:                pull(rec, 'sizeRatio'),
    orderQty:                 pull(rec, 'orderQty'),
    mrp:                      pull(rec, 'mrp'),
    targetPrice:              pull(rec, 'targetPrice'),
    whBhw:                    pull(rec, 'whBhw'),
    whDel:                    pull(rec, 'whDel'),
    whBlr:                    pull(rec, 'whBlr'),
    handoverDate:             pull(rec, 'handoverDate'),
    buyingExpectedInwardDate: pull(rec, 'buyingExpectedInwardDate'),
    tier:                     pull(rec, 'tier').toUpperCase(),
    techPack:                 pull(rec, 'techPack'),
    designer:                 pull(rec, 'designer'),
    notes:                    '',
  }))

  return {
    rows,
    meta: {
      fileName:        file.name,
      sheetName:       preferredSheet,
      sheetCount:      wb.SheetNames.length,
      headerCount:     headerSet.size,
      mappedCount:     Object.values(headerMap).filter(Boolean).length,
      unmappedHeaders: unmapped,
    },
  }
}

// Format a JS Date as DD/MM/YYYY (matches the format the inline editor uses).
function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  return `${dd}/${mm}/${yy}`
}

// ─── Template download (shipped to user from the upload screen) ────────────
// Returns a Blob with a CSV that has the headers we accept, in the order
// they appear in the inline editor. Buying can use this as a starter.
export function buildTemplateCsv(): string {
  const headers = [
    'styleCode', 'styleName', 'styleImage',
    'gender', 'productGroup', 'type', 'subType',
    'season', 'drop', 'fabric', 'ageGroup', 'colorFamily',
    'activeSizes', 'sizeRatio', 'orderQty',
    'mrp', 'targetPrice',
    'whBhw', 'whDel', 'whBlr',
    'handoverDate', 'Inward Date',
    'tier', 'techPack', 'designer',
  ]
  return headers.join(',') + '\n'
}
