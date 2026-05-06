// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS — shared types, OTB data, WH master, mock records, helpers
// ═══════════════════════════════════════════════════════════════════════════════

export type POStatus =
  | 'requested'   // POC raised request, waiting for MIS
  | 'pushing'     // MIS is pushing to D365 (transient)
  | 'po-raised'   // D365 confirmed PO number, PDF not yet attached
  | 'failed'      // D365 push failed, manual entry needed
  | 'complete'    // PO number + PDF both present

export type POLine = {
  sku:       string   // e.g. "NN419-201-WHITE-4Y"
  styleCode: string
  colour:    string
  size:      string
  whCode:    string
  qty:       number
  unitPrice: number
  lineTotal: number
}

export type Warehouse = {
  code:    string
  name:    string
  address: string
  city:    string
  state:   string
  pincode: string
  gstNo:   string
}

export type OTBEntry = {
  styleCode: string
  colour:    string
  size:      string
  whCode:    string
  qty:       number
}

export type PORecord = {
  id:            string
  subOrderId:    string   // links to CostingOrder.id
  whCode:        string   // one PO per warehouse
  styleCode:     string
  styleName:     string
  colour:        string
  season:        string
  vendorId:      string
  vendorCode:    string   // D365 vendor account code
  vendor:        string
  lines:         POLine[]
  totalQty:      number
  totalValue:    number
  deliveryDate:  string
  status:        POStatus
  requestedBy:   string
  requestedDate: string
  // D365 fields
  poNumber?:       string
  poCreatedDate?:  string
  d365PushedBy?:   string
  d365PushDate?:   string
  failureReason?:  string
  manualPoEntry?:  boolean
  pushAttempts?:   number
  // PDF
  pdfUrl?:          string
  pdfUploadedBy?:   string
  pdfUploadedDate?: string
}

// ─── Warehouse Master (synced from Unicommerce) ────────────────────────────────

export const WAREHOUSES: Warehouse[] = [
  {
    code:    'NTW-DEL-01',
    name:    'Nautinati Delhi DC',
    address: 'Plot 14, Sector 65, IMT Manesar',
    city:    'Gurugram',
    state:   'Haryana',
    pincode: '122018',
    gstNo:   '06AADCN1234A1Z5',
  },
  {
    code:    'NTW-MUM-01',
    name:    'Nautinati Mumbai DC',
    address: 'Survey 88, MIDC, Bhiwandi',
    city:    'Bhiwandi',
    state:   'Maharashtra',
    pincode: '421302',
    gstNo:   '27AADCN1234A1Z3',
  },
]

// ─── Vendor D365 Account Codes ─────────────────────────────────────────────────

export const VENDOR_D365_CODES: Record<string, string> = {
  v1: 'VEN-00112',
  v2: 'VEN-00089',
  v3: 'VEN-00134',
  v4: 'VEN-00078',
  v5: 'VEN-00201',
  v6: 'VEN-00156',
  v7: 'VEN-00243',
  v8: 'VEN-00167',
  v9: 'VEN-00188',
}

// ─── OTB Master (size × WH split per style+colour, sourced from OTB system) ────

export const OTB_DATA: OTBEntry[] = [
  // NN401-190  CORAL  900 pcs  — Girls Printed Balloon Dress
  { styleCode: 'NN401-190', colour: 'CORAL', size: '2Y',  whCode: 'NTW-DEL-01', qty: 80  },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '2Y',  whCode: 'NTW-MUM-01', qty: 40  },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '3Y',  whCode: 'NTW-DEL-01', qty: 110 },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '3Y',  whCode: 'NTW-MUM-01', qty: 55  },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '4Y',  whCode: 'NTW-DEL-01', qty: 130 },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '4Y',  whCode: 'NTW-MUM-01', qty: 65  },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '6Y',  whCode: 'NTW-DEL-01', qty: 120 },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '6Y',  whCode: 'NTW-MUM-01', qty: 60  },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '8Y',  whCode: 'NTW-DEL-01', qty: 100 },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '8Y',  whCode: 'NTW-MUM-01', qty: 40  },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '10Y', whCode: 'NTW-DEL-01', qty: 60  },
  { styleCode: 'NN401-190', colour: 'CORAL', size: '10Y', whCode: 'NTW-MUM-01', qty: 40  },

  // NN411-312  COBALT  650 pcs  — Boys Printed Bermuda Shorts
  { styleCode: 'NN411-312', colour: 'COBALT', size: '3Y',  whCode: 'NTW-DEL-01', qty: 70  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '3Y',  whCode: 'NTW-MUM-01', qty: 35  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '4Y',  whCode: 'NTW-DEL-01', qty: 90  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '4Y',  whCode: 'NTW-MUM-01', qty: 45  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '6Y',  whCode: 'NTW-DEL-01', qty: 100 },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '6Y',  whCode: 'NTW-MUM-01', qty: 50  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '8Y',  whCode: 'NTW-DEL-01', qty: 85  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '8Y',  whCode: 'NTW-MUM-01', qty: 40  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '10Y', whCode: 'NTW-DEL-01', qty: 95  },
  { styleCode: 'NN411-312', colour: 'COBALT', size: '10Y', whCode: 'NTW-MUM-01', qty: 40  },

  // NN409-155  YELLOW  720 pcs  — Girls Smocked Kurta Set
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '2Y',  whCode: 'NTW-DEL-01', qty: 70  },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '2Y',  whCode: 'NTW-MUM-01', qty: 30  },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '3Y',  whCode: 'NTW-DEL-01', qty: 95  },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '3Y',  whCode: 'NTW-MUM-01', qty: 50  },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '4Y',  whCode: 'NTW-DEL-01', qty: 110 },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '4Y',  whCode: 'NTW-MUM-01', qty: 55  },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '6Y',  whCode: 'NTW-DEL-01', qty: 115 },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '6Y',  whCode: 'NTW-MUM-01', qty: 55  },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '8Y',  whCode: 'NTW-DEL-01', qty: 95  },
  { styleCode: 'NN409-155', colour: 'YELLOW', size: '8Y',  whCode: 'NTW-MUM-01', qty: 45  },

  // NN403-302  SKY BLUE  380 pcs  — Boys Linen Blend Shirt
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '3Y',  whCode: 'NTW-DEL-01', qty: 45  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '3Y',  whCode: 'NTW-MUM-01', qty: 25  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '4Y',  whCode: 'NTW-DEL-01', qty: 58  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '4Y',  whCode: 'NTW-MUM-01', qty: 27  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '6Y',  whCode: 'NTW-DEL-01', qty: 65  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '6Y',  whCode: 'NTW-MUM-01', qty: 30  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '8Y',  whCode: 'NTW-DEL-01', qty: 58  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '8Y',  whCode: 'NTW-MUM-01', qty: 27  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '10Y', whCode: 'NTW-DEL-01', qty: 28  },
  { styleCode: 'NN403-302', colour: 'SKY BLUE', size: '10Y', whCode: 'NTW-MUM-01', qty: 17  },

  // NN408-245  MAROON  280 pcs  — Girls Embroidered Sharara Set  (HERO)
  { styleCode: 'NN408-245', colour: 'MAROON', size: '2Y',  whCode: 'NTW-DEL-01', qty: 30  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '2Y',  whCode: 'NTW-MUM-01', qty: 15  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '3Y',  whCode: 'NTW-DEL-01', qty: 35  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '3Y',  whCode: 'NTW-MUM-01', qty: 18  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '4Y',  whCode: 'NTW-DEL-01', qty: 40  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '4Y',  whCode: 'NTW-MUM-01', qty: 20  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '6Y',  whCode: 'NTW-DEL-01', qty: 38  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '6Y',  whCode: 'NTW-MUM-01', qty: 18  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '8Y',  whCode: 'NTW-DEL-01', qty: 32  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '8Y',  whCode: 'NTW-MUM-01', qty: 16  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '10Y', whCode: 'NTW-DEL-01', qty: 12  },
  { styleCode: 'NN408-245', colour: 'MAROON', size: '10Y', whCode: 'NTW-MUM-01', qty: 6   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getOTBLines(styleCode: string, colour: string, unitPrice: number): POLine[] {
  return OTB_DATA
    .filter(e => e.styleCode === styleCode && e.colour === colour)
    .map(e => ({
      sku:       `${e.styleCode}-${e.colour.replace(/\s+/g, '_')}-${e.size}`,
      styleCode: e.styleCode,
      colour:    e.colour,
      size:      e.size,
      whCode:    e.whCode,
      qty:       e.qty,
      unitPrice,
      lineTotal: e.qty * unitPrice,
    }))
}

// Lines scoped to a single warehouse — used when generating per-WH PO records
export function getOTBLinesForWH(styleCode: string, colour: string, unitPrice: number, whCode: string): POLine[] {
  return OTB_DATA
    .filter(e => e.styleCode === styleCode && e.colour === colour && e.whCode === whCode)
    .map(e => ({
      sku:       `${e.styleCode}-${e.colour.replace(/\s+/g, '_')}-${e.size}`,
      styleCode: e.styleCode,
      colour:    e.colour,
      size:      e.size,
      whCode:    e.whCode,
      qty:       e.qty,
      unitPrice,
      lineTotal: e.qty * unitPrice,
    }))
}

export function getWH(code: string): Warehouse | undefined {
  return WAREHOUSES.find(w => w.code === code)
}

export function poTotalQty(lines: POLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0)
}

export function poTotalValue(lines: POLine[]): number {
  return lines.reduce((s, l) => s + l.lineTotal, 0)
}

// Unique sizes in order of the OTB (preserve insertion order)
export function sizesFromLines(lines: POLine[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of lines) { if (!seen.has(l.size)) { seen.add(l.size); out.push(l.size) } }
  return out
}

// ─── Mock initial PO records (one per subOrderId × whCode) ────────────────────

function wh(styleCode: string, colour: string, price: number, whCode: string): POLine[] {
  return getOTBLinesForWH(styleCode, colour, price, whCode)
}

// CORAL — NNKNTW250014 (Girls Printed Balloon Dress)
const coralDEL  = wh('NN401-190', 'CORAL',    238, 'NTW-DEL-01')
const coralMUM  = wh('NN401-190', 'CORAL',    238, 'NTW-MUM-01')
// COBALT — NNKNTW250017 (Boys Printed Bermuda Shorts)
const cobaltDEL = wh('NN411-312', 'COBALT',   192, 'NTW-DEL-01')
const cobaltMUM = wh('NN411-312', 'COBALT',   192, 'NTW-MUM-01')
// YELLOW — NNKNTW250012 (Girls Smocked Kurta Set)
const yellowDEL = wh('NN409-155', 'YELLOW',   328, 'NTW-DEL-01')
const yellowMUM = wh('NN409-155', 'YELLOW',   328, 'NTW-MUM-01')
// SKY BLUE — NNKNTW250013 (Boys Linen Blend Shirt)
const skyDEL    = wh('NN403-302', 'SKY BLUE', 318, 'NTW-DEL-01')
const skyMUM    = wh('NN403-302', 'SKY BLUE', 318, 'NTW-MUM-01')

export const INITIAL_PO_RECORDS: PORecord[] = [

  // ── CORAL (NNKNTW250014) — both warehouses complete ──────────────────────────
  {
    id: 'POR-2026-001', subOrderId: 'NNKNTW250014', whCode: 'NTW-DEL-01',
    styleCode: 'NN401-190', styleName: 'Girls Printed Balloon Dress',
    colour: 'CORAL', season: 'SS25',
    vendorId: 'v6', vendorCode: VENDOR_D365_CODES['v6'], vendor: 'AND DESIGN',
    lines: coralDEL,
    totalQty: poTotalQty(coralDEL), totalValue: poTotalValue(coralDEL),
    deliveryDate: '2026-05-12', status: 'complete',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-08',
    poNumber: 'PO-D365-26-10412', poCreatedDate: '2026-04-09',
    d365PushedBy: 'Kavitha Menon', d365PushDate: '2026-04-09',
    pdfUrl: 'PO-D365-26-10412.pdf', pdfUploadedBy: 'Kavitha Menon', pdfUploadedDate: '2026-04-09',
  },
  {
    id: 'POR-2026-002', subOrderId: 'NNKNTW250014', whCode: 'NTW-MUM-01',
    styleCode: 'NN401-190', styleName: 'Girls Printed Balloon Dress',
    colour: 'CORAL', season: 'SS25',
    vendorId: 'v6', vendorCode: VENDOR_D365_CODES['v6'], vendor: 'AND DESIGN',
    lines: coralMUM,
    totalQty: poTotalQty(coralMUM), totalValue: poTotalValue(coralMUM),
    deliveryDate: '2026-05-12', status: 'complete',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-08',
    poNumber: 'PO-D365-26-10413', poCreatedDate: '2026-04-09',
    d365PushedBy: 'Kavitha Menon', d365PushDate: '2026-04-09',
    pdfUrl: 'PO-D365-26-10413.pdf', pdfUploadedBy: 'Kavitha Menon', pdfUploadedDate: '2026-04-10',
  },

  // ── COBALT (NNKNTW250017) — Delhi PO raised, Mumbai still requested ──────────
  {
    id: 'POR-2026-003', subOrderId: 'NNKNTW250017', whCode: 'NTW-DEL-01',
    styleCode: 'NN411-312', styleName: 'Boys Printed Bermuda Shorts',
    colour: 'COBALT', season: 'SS25',
    vendorId: 'v9', vendorCode: VENDOR_D365_CODES['v9'], vendor: 'PESOS VISION',
    lines: cobaltDEL,
    totalQty: poTotalQty(cobaltDEL), totalValue: poTotalValue(cobaltDEL),
    deliveryDate: '2026-05-08', status: 'po-raised',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-09',
    poNumber: 'PO-D365-26-10418', poCreatedDate: '2026-04-10',
    d365PushedBy: 'Kavitha Menon', d365PushDate: '2026-04-10',
  },
  {
    id: 'POR-2026-004', subOrderId: 'NNKNTW250017', whCode: 'NTW-MUM-01',
    styleCode: 'NN411-312', styleName: 'Boys Printed Bermuda Shorts',
    colour: 'COBALT', season: 'SS25',
    vendorId: 'v9', vendorCode: VENDOR_D365_CODES['v9'], vendor: 'PESOS VISION',
    lines: cobaltMUM,
    totalQty: poTotalQty(cobaltMUM), totalValue: poTotalValue(cobaltMUM),
    deliveryDate: '2026-05-08', status: 'requested',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-09',
  },

  // ── YELLOW (NNKNTW250012) — both requested, awaiting MIS ─────────────────────
  {
    id: 'POR-2026-005', subOrderId: 'NNKNTW250012', whCode: 'NTW-DEL-01',
    styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', season: 'SS25',
    vendorId: 'v4', vendorCode: VENDOR_D365_CODES['v4'], vendor: 'BS FASHION',
    lines: yellowDEL,
    totalQty: poTotalQty(yellowDEL), totalValue: poTotalValue(yellowDEL),
    deliveryDate: '2026-05-18', status: 'requested',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-14',
  },
  {
    id: 'POR-2026-006', subOrderId: 'NNKNTW250012', whCode: 'NTW-MUM-01',
    styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', season: 'SS25',
    vendorId: 'v4', vendorCode: VENDOR_D365_CODES['v4'], vendor: 'BS FASHION',
    lines: yellowMUM,
    totalQty: poTotalQty(yellowMUM), totalValue: poTotalValue(yellowMUM),
    deliveryDate: '2026-05-18', status: 'requested',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-14',
  },

  // ── SKY BLUE (NNKNTW250013) — Delhi push failed, Mumbai still requested ──────
  {
    id: 'POR-2026-007', subOrderId: 'NNKNTW250013', whCode: 'NTW-DEL-01',
    styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', season: 'SS25',
    vendorId: 'v5', vendorCode: VENDOR_D365_CODES['v5'], vendor: 'DIV CREATIONS',
    lines: skyDEL,
    totalQty: poTotalQty(skyDEL), totalValue: poTotalValue(skyDEL),
    deliveryDate: '2026-06-01', status: 'failed',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-12',
    d365PushedBy: 'Kavitha Menon', d365PushDate: '2026-04-12',
    failureReason: 'D365 API Error 500: Vendor account VEN-00201 could not be resolved in legal entity NNKNTW. Verify vendor configuration.',
    pushAttempts: 1,
  },
  {
    id: 'POR-2026-008', subOrderId: 'NNKNTW250013', whCode: 'NTW-MUM-01',
    styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', season: 'SS25',
    vendorId: 'v5', vendorCode: VENDOR_D365_CODES['v5'], vendor: 'DIV CREATIONS',
    lines: skyMUM,
    totalQty: poTotalQty(skyMUM), totalValue: poTotalValue(skyMUM),
    deliveryDate: '2026-06-01', status: 'requested',
    requestedBy: 'Parthipan Kumar', requestedDate: '2026-04-12',
  },
]
