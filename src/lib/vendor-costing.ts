// ─── Shared vendor costing types & static data ───────────────────────────────
// Used by both reports/page.tsx (DPR view) and vendor-portal/page.tsx

export type CostStatus = 'pending' | 'submitted' | 'approved' | 'escalated'

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
  breakdown?: {
    fabric: number; cmt: number; trims: number
    print: number; packaging: number; other: number
  }
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
      breakdown: { fabric: 178, cmt: 96, trims: 52, print: 38, packaging: 18, other: 16 },
      notes: 'Fabric cost elevated due to yarn dyed woven; CMT competitive.',
      pocName: 'Parthipan Kumar',
    },
    {
      id: 'NNKNTW250035', styleCode: 'NN435-310', styleName: 'Girls Tiered Skirt',
      colour: 'PEACH', category: 'Wovens', orderQty: 480, targetPrice: 295,
      costStatus: 'escalated', inwardDate: '2026-07-05', costingDueDate: '2026-04-25',
      submittedCost: 342,
      breakdown: { fabric: 155, cmt: 88, trims: 42, print: 20, packaging: 22, other: 15 },
      notes: 'Fabric sourced from premium mill.',
      pocName: 'Parthipan Kumar',
      escalationNote: 'Quote is significantly above acceptable range. Please review fabric and CMT components and resubmit.',
    },
    {
      id: 'NNKNTW250036', styleCode: 'NN436-088', styleName: 'Boys Oxford Shirt',
      colour: 'WHITE', category: 'Wovens', orderQty: 720, targetPrice: 260,
      costStatus: 'approved', inwardDate: '2026-05-30', costingDueDate: '2026-04-05',
      submittedCost: 248,
      breakdown: { fabric: 108, cmt: 72, trims: 34, print: 0, packaging: 18, other: 16 },
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
      breakdown: { fabric: 118, cmt: 74, trims: 36, print: 0, packaging: 14, other: 33 },
      pocName: 'Parthipan Kumar',
    },
  ],
}

/** Resolve short mock key from real DB vendorId (UUID) or fallback by vendor name */
export function resolveVendorKey(vendorId: string, companyName: string): string {
  return VENDOR_NAME_TO_KEY[companyName.toLowerCase()] ?? vendorId
}
