// ─── Shared vendor costing types & static data ───────────────────────────────
// Used by both reports/page.tsx (DPR view) and vendor-portal/page.tsx

export type CostStatus = 'pending' | 'submitted' | 'approved' | 'escalated'

// Open costing breakdown — matches the sourcing cost sheet columns DN–EC
export type OpenCostingBreakdown = {
  mainFabricPrice: number        // DN  ₹/metre
  mainFabricConsumption: number  // DO  metres
  trimFabricPrice: number        // DQ  ₹/metre
  trimFabricConsumption: number  // DR  metres
  trimCostThread: number         // DU  trims + thread ₹
  cmp: number                    // DV  cut, make, pack ₹
  valueAddition: number          // DW  embroidery, print, etc. ₹
  testing: number                // DY  lab testing ₹
  logistic: number               // DZ  freight ₹
  rejectionPct: number           // EA  % applied on TTL product cost
  marginPct: number              // EB  % applied on TTL product cost
}

// Compute all intermediate totals from stored breakdown (mirrors the spreadsheet columns DP–EC)
export function deriveOpenCostingTotals(b: OpenCostingBreakdown) {
  const mainFabricCost   = b.mainFabricPrice * b.mainFabricConsumption
  const trimFabricCost   = b.trimFabricPrice * b.trimFabricConsumption
  const ttlFabricCost    = mainFabricCost + trimFabricCost
  const ttlProductCost   = ttlFabricCost + b.trimCostThread + b.cmp + b.valueAddition
  const rejectionAmt     = ttlProductCost * (b.rejectionPct / 100)
  const marginAmt        = ttlProductCost * (b.marginPct / 100)
  const openCostingTotal = ttlProductCost + b.testing + b.logistic + rejectionAmt + marginAmt
  return {
    mainFabricCost:   Math.round(mainFabricCost * 100) / 100,
    trimFabricCost:   Math.round(trimFabricCost * 100) / 100,
    ttlFabricCost:    Math.round(ttlFabricCost * 100) / 100,
    ttlProductCost:   Math.round(ttlProductCost * 100) / 100,
    rejectionAmt:     Math.round(rejectionAmt * 100) / 100,
    marginAmt:        Math.round(marginAmt * 100) / 100,
    openCostingTotal: Math.round(openCostingTotal * 100) / 100,
  }
}

export type VendorCostOrder = {
  id: string
  styleCode: string
  styleName: string
  colour: string
  category: string
  orderQty: number
  targetPrice: number
  costStatus: CostStatus
  inwardDate: string
  costingDueDate: string
  submittedCost?: number
  breakdown?: OpenCostingBreakdown
  notes?: string
  pocName: string
  escalationNote?: string        // set when costStatus === 'escalated'
  promisedInwardDate?: string    // vendor's committed delivery date
}

/** Maps vendor name (lowercase) → short mock key ('v1', 'v2', …) */
export const VENDOR_NAME_TO_KEY: Record<string, string> = {
  'bharti apparels':      'v1',
  'arihant fashions':     'v2',
  'ids fashion':          'v3',
  'bs fashion':           'v4',
  'div creations':        'v5',
  'and design':           'v6',
  'aditee international': 'v7',
  'caarvi textiles':      'v8',
  'pesos vision':         'v9',
  'swara creation':       'v10',
}

/** Costing orders keyed by short vendor key */
export const VENDOR_COSTING_ORDERS: Record<string, VendorCostOrder[]> = {
  v1: [
    {
      id: 'NNKNTW250030', styleCode: 'NN430-112', styleName: 'Girls Dungaree Set',
      colour: 'DENIM BLUE', category: 'Wovens', orderQty: 600, targetPrice: 380,
      costStatus: 'pending', inwardDate: '2026-06-20', costingDueDate: '2026-04-20',
      pocName: 'Parthipan Kumar',
    },
    {
      id: 'NNKNTW250031', styleCode: 'NN431-088', styleName: 'Boys Poplin Shirt',
      colour: 'WHITE CHECK', category: 'Wovens', orderQty: 450, targetPrice: 245,
      costStatus: 'pending', inwardDate: '2026-06-15', costingDueDate: '2026-04-18',
      pocName: 'Parthipan Kumar',
    },
    {
      id: 'NNKNTW250032', styleCode: 'NN432-205', styleName: 'Girls Palazzo Set',
      colour: 'LAVENDER', category: 'Wovens', orderQty: 350, targetPrice: 420,
      costStatus: 'submitted', inwardDate: '2026-06-28', costingDueDate: '2026-04-15',
      submittedCost: 398,
      breakdown: {
        mainFabricPrice: 115, mainFabricConsumption: 1.5,   // 172.5
        trimFabricPrice: 22,  trimFabricConsumption: 0.4,   //   8.8
        trimCostThread: 52, cmp: 96, valueAddition: 38,     // ttlProduct ≈ 367
        testing: 12, logistic: 8, rejectionPct: 2, marginPct: 2.5,
      },
      notes: 'Fabric cost elevated due to yarn dyed woven; CMT competitive.',
      pocName: 'Parthipan Kumar',
    },
    {
      id: 'NNKNTW250035', styleCode: 'NN435-310', styleName: 'Girls Tiered Skirt',
      colour: 'PEACH', category: 'Wovens', orderQty: 480, targetPrice: 295,
      costStatus: 'escalated', inwardDate: '2026-07-05', costingDueDate: '2026-04-25',
      submittedCost: 342,
      breakdown: {
        mainFabricPrice: 98,  mainFabricConsumption: 1.4,   // 137.2
        trimFabricPrice: 18,  trimFabricConsumption: 0.5,   //   9.0
        trimCostThread: 42, cmp: 88, valueAddition: 20,     // ttlProduct ≈ 296
        testing: 12, logistic: 14, rejectionPct: 3, marginPct: 5,
      },
      notes: 'Fabric sourced from premium mill.',
      pocName: 'Parthipan Kumar',
      escalationNote: 'Quote is significantly above acceptable range. Please review fabric and CMT components and resubmit.',
    },
    {
      id: 'NNKNTW250036', styleCode: 'NN436-088', styleName: 'Boys Oxford Shirt',
      colour: 'WHITE', category: 'Wovens', orderQty: 720, targetPrice: 260,
      costStatus: 'approved', inwardDate: '2026-05-30', costingDueDate: '2026-04-05',
      submittedCost: 248,
      breakdown: {
        mainFabricPrice: 88,  mainFabricConsumption: 1.3,   // 114.4
        trimFabricPrice: 14,  trimFabricConsumption: 0.35,  //   4.9
        trimCostThread: 34, cmp: 72, valueAddition: 0,      // ttlProduct ≈ 225
        testing: 8, logistic: 6, rejectionPct: 2, marginPct: 2,
      },
      pocName: 'Parthipan Kumar',
    },
  ],
  v3: [
    {
      id: 'NNKNTW250033', styleCode: 'NN433-201', styleName: 'Boys Cargo Pants',
      colour: 'DARK GREY', category: 'Wovens', orderQty: 520, targetPrice: 310,
      costStatus: 'pending', inwardDate: '2026-06-25', costingDueDate: '2026-04-22',
      pocName: 'Parthipan Kumar',
    },
    {
      id: 'NNKNTW250034', styleCode: 'NN434-099', styleName: 'Boys Linen Casual Shirt',
      colour: 'BEIGE', category: 'Wovens', orderQty: 380, targetPrice: 290,
      costStatus: 'approved', inwardDate: '2026-06-10', costingDueDate: '2026-04-10',
      submittedCost: 275,
      breakdown: {
        mainFabricPrice: 92,  mainFabricConsumption: 1.25,  // 115
        trimFabricPrice: 18,  trimFabricConsumption: 0.3,   //   5.4
        trimCostThread: 36, cmp: 74, valueAddition: 0,      // ttlProduct ≈ 230
        testing: 10, logistic: 8, rejectionPct: 2, marginPct: 8,
      },
      pocName: 'Parthipan Kumar',
    },
  ],
}

/** Resolve short mock key from real DB vendorId (UUID) or fallback by vendor name */
export function resolveVendorKey(vendorId: string, companyName: string): string {
  return VENDOR_NAME_TO_KEY[companyName.toLowerCase()] ?? vendorId
}
