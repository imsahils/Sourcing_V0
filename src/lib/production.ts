// ─── Types ────────────────────────────────────────────────────────────────────

export type DPREntry = {
  id:              string
  orderId:         string
  date:            string          // YYYY-MM-DD
  cutQty:          number          // cumulative to date
  stitchingQty:    number          // cumulative
  finishingQty:    number          // cumulative
  packingQty:      number          // cumulative
  remarks?:        string
  submittedBy:     string
  submittedByRole: 'vendor' | 'sourcing-poc'
  submittedAt:     string          // ISO timestamp
  isFlagged?:      boolean
  pocNote?:        string
}

export type ProductionOrder = {
  id:                  string
  styleCode:           string
  styleName:           string
  colour:              string
  vendor:              string
  vendorId:            string
  vendorLocation:      string
  orderQty:            number
  inwardDate:          string
  productionStartDate: string
  category:            string
  status:              'on-track' | 'at-risk' | 'delayed' | 'completed'
  tier:                'HERO' | 'TIER-1' | 'TIER-2' | 'TAIL'
  dprLog:              DPREntry[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function sortedLog(order: ProductionOrder): DPREntry[] {
  return [...order.dprLog].sort((a, b) => b.date.localeCompare(a.date))
}

export function latestEntry(order: ProductionOrder): DPREntry | null {
  const sorted = sortedLog(order)
  return sorted[0] ?? null
}

export function todayEntry(order: ProductionOrder): DPREntry | null {
  const t = todayStr()
  return order.dprLog.find(e => e.date === t) ?? null
}

export function prevEntry(order: ProductionOrder): DPREntry | null {
  const t = todayStr()
  const sorted = sortedLog(order).filter(e => e.date < t)
  return sorted[0] ?? null
}

export function submittedToday(order: ProductionOrder): boolean {
  return todayEntry(order) !== null
}

export function pct(num: number, denom: number): number {
  if (denom <= 0) return 0
  return Math.min(100, Math.round((num / denom) * 100))
}

export function daysLeft(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  // Compare date only (strip time)
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const nowDate    = new Date(now.getFullYear(),    now.getMonth(),    now.getDate())
  return Math.round((targetDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))
}

export function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function fmtDateTime(iso: string): string {
  const dt = new Date(iso)
  const date = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const time = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  return `${date}, ${time}`
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

function ts(date: string, time: string): string {
  return `2026-${date.split('-').slice(1).join('-')}T${time}:00.000Z`
}

function makeTs(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00.000Z`
}

export const INITIAL_PRODUCTION_ORDERS: ProductionOrder[] = [
  // ── PROD-001 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-001',
    styleCode:           'NN405-180',
    styleName:           'Boys Striped Polo',
    colour:              'RED/WHITE',
    vendor:              'BHARTI APPARELS',
    vendorId:            'v1',
    vendorLocation:      'FARIDABAD',
    orderQty:            600,
    inwardDate:          '2026-05-05',
    productionStartDate: '2026-04-08',
    category:            'Knits',
    status:              'on-track',
    tier:                'TIER-1',
    dprLog: [
      { id: 'dpr-001-1', orderId: 'PROD-001', date: '2026-04-10', cutQty: 450, stitchingQty: 380, finishingQty: 320, packingQty: 280, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-10', '09:10') },
      { id: 'dpr-001-2', orderId: 'PROD-001', date: '2026-04-11', cutQty: 500, stitchingQty: 420, finishingQty: 360, packingQty: 320, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-11', '09:05') },
      { id: 'dpr-001-3', orderId: 'PROD-001', date: '2026-04-12', cutQty: 540, stitchingQty: 460, finishingQty: 400, packingQty: 360, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '09:20') },
      { id: 'dpr-001-4', orderId: 'PROD-001', date: '2026-04-14', cutQty: 570, stitchingQty: 510, finishingQty: 450, packingQty: 410, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '09:15') },
      { id: 'dpr-001-5', orderId: 'PROD-001', date: '2026-04-15', cutQty: 590, stitchingQty: 550, finishingQty: 490, packingQty: 455, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '09:08') },
    ],
  },

  // ── PROD-008 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-008',
    styleCode:           'NN436-088',
    styleName:           'Boys Oxford Shirt',
    colour:              'WHITE',
    vendor:              'BHARTI APPARELS',
    vendorId:            'v1',
    vendorLocation:      'FARIDABAD',
    orderQty:            720,
    inwardDate:          '2026-05-30',
    productionStartDate: '2026-04-10',
    category:            'Wovens',
    status:              'on-track',
    tier:                'HERO',
    dprLog: [
      { id: 'dpr-008-1', orderId: 'PROD-008', date: '2026-04-12', cutQty: 300, stitchingQty: 180, finishingQty: 120, packingQty: 0,   submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '09:30') },
      { id: 'dpr-008-2', orderId: 'PROD-008', date: '2026-04-14', cutQty: 480, stitchingQty: 320, finishingQty: 240, packingQty: 80,  submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '09:15') },
      { id: 'dpr-008-3', orderId: 'PROD-008', date: '2026-04-15', cutQty: 600, stitchingQty: 440, finishingQty: 340, packingQty: 180, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '09:10') },
      { id: 'dpr-008-4', orderId: 'PROD-008', date: '2026-04-16', cutQty: 680, stitchingQty: 540, finishingQty: 430, packingQty: 280, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-16', '09:05') },
      { id: 'dpr-008-5', orderId: 'PROD-008', date: '2026-04-28', cutQty: 720, stitchingQty: 620, finishingQty: 540, packingQty: 380, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-28', '09:12') },
      { id: 'dpr-008-6', orderId: 'PROD-008', date: '2026-04-29', cutQty: 720, stitchingQty: 660, finishingQty: 590, packingQty: 460, remarks: 'Stitching team doubled up this week.', submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-29', '09:08') },
    ],
  },

  // ── PROD-009 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-009',
    styleCode:           'NN432-205',
    styleName:           'Girls Palazzo Set',
    colour:              'LAVENDER',
    vendor:              'BHARTI APPARELS',
    vendorId:            'v1',
    vendorLocation:      'FARIDABAD',
    orderQty:            350,
    inwardDate:          '2026-05-10',
    productionStartDate: '2026-04-05',
    category:            'Wovens',
    status:              'at-risk',
    tier:                'TIER-1',
    dprLog: [
      { id: 'dpr-009-1', orderId: 'PROD-009', date: '2026-04-08', cutQty: 200, stitchingQty: 120, finishingQty: 80,  packingQty: 0,  submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-08', '09:22') },
      { id: 'dpr-009-2', orderId: 'PROD-009', date: '2026-04-10', cutQty: 280, stitchingQty: 190, finishingQty: 140, packingQty: 40, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-10', '09:18') },
      { id: 'dpr-009-3', orderId: 'PROD-009', date: '2026-04-14', cutQty: 320, stitchingQty: 240, finishingQty: 190, packingQty: 90, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '09:30') },
      { id: 'dpr-009-4', orderId: 'PROD-009', date: '2026-04-16', cutQty: 340, stitchingQty: 270, finishingQty: 210, packingQty: 120, isFlagged: true, pocNote: 'Packing at 120/350 with 3 weeks to inward — pace is too slow. Vendor to confirm recovery plan.', submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-16', '09:25') },
      { id: 'dpr-009-5', orderId: 'PROD-009', date: '2026-04-28', cutQty: 350, stitchingQty: 310, finishingQty: 265, packingQty: 185, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-28', '09:20') },
      { id: 'dpr-009-6', orderId: 'PROD-009', date: '2026-04-29', cutQty: 350, stitchingQty: 335, finishingQty: 290, packingQty: 230, remarks: 'Added one extra stitching line from yesterday.', submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-29', '09:14') },
    ],
  },

  // ── PROD-010 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-010',
    styleCode:           'NN435-310',
    styleName:           'Girls Tiered Skirt',
    colour:              'PEACH',
    vendor:              'BHARTI APPARELS',
    vendorId:            'v1',
    vendorLocation:      'FARIDABAD',
    orderQty:            480,
    inwardDate:          '2026-04-18',
    productionStartDate: '2026-03-25',
    category:            'Wovens',
    status:              'delayed',
    tier:                'TIER-2',
    dprLog: [
      { id: 'dpr-010-1', orderId: 'PROD-010', date: '2026-04-05', cutQty: 480, stitchingQty: 360, finishingQty: 280, packingQty: 140, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-05', '09:40') },
      { id: 'dpr-010-2', orderId: 'PROD-010', date: '2026-04-08', cutQty: 480, stitchingQty: 400, finishingQty: 330, packingQty: 200, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-08', '09:35') },
      { id: 'dpr-010-3', orderId: 'PROD-010', date: '2026-04-10', cutQty: 480, stitchingQty: 430, finishingQty: 370, packingQty: 250, isFlagged: true, pocNote: 'Inward is Apr 18 — only 250 packed with 8 days left. Escalated to manager.', submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-10', '09:50') },
      { id: 'dpr-010-4', orderId: 'PROD-010', date: '2026-04-14', cutQty: 480, stitchingQty: 460, finishingQty: 420, packingQty: 320, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '09:45') },
      { id: 'dpr-010-5', orderId: 'PROD-010', date: '2026-04-16', cutQty: 480, stitchingQty: 475, finishingQty: 455, packingQty: 380, remarks: 'Fabric delay on trims caused stitching hold on 20 pcs — cleared now.', submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-16', '09:40') },
      { id: 'dpr-010-6', orderId: 'PROD-010', date: '2026-04-28', cutQty: 480, stitchingQty: 480, finishingQty: 470, packingQty: 440, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-28', '09:32') },
      { id: 'dpr-010-7', orderId: 'PROD-010', date: '2026-04-29', cutQty: 480, stitchingQty: 480, finishingQty: 478, packingQty: 462, remarks: 'Final finishing underway — dispatch planned tomorrow.', submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-29', '09:28') },
    ],
  },

  // ── PROD-011 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-011',
    styleCode:           'NN431-088',
    styleName:           'Boys Poplin Shirt',
    colour:              'WHITE CHECK',
    vendor:              'BHARTI APPARELS',
    vendorId:            'v1',
    vendorLocation:      'FARIDABAD',
    orderQty:            450,
    inwardDate:          '2026-04-10',
    productionStartDate: '2026-03-18',
    category:            'Wovens',
    status:              'completed',
    tier:                'TIER-1',
    dprLog: [
      { id: 'dpr-011-1', orderId: 'PROD-011', date: '2026-03-28', cutQty: 450, stitchingQty: 380, finishingQty: 310, packingQty: 200, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-03-28', '09:10') },
      { id: 'dpr-011-2', orderId: 'PROD-011', date: '2026-04-01', cutQty: 450, stitchingQty: 420, finishingQty: 370, packingQty: 280, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-01', '09:05') },
      { id: 'dpr-011-3', orderId: 'PROD-011', date: '2026-04-04', cutQty: 450, stitchingQty: 445, finishingQty: 420, packingQty: 360, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-04', '09:12') },
      { id: 'dpr-011-4', orderId: 'PROD-011', date: '2026-04-07', cutQty: 450, stitchingQty: 450, finishingQty: 445, packingQty: 420, submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-07', '09:08') },
      { id: 'dpr-011-5', orderId: 'PROD-011', date: '2026-04-09', cutQty: 450, stitchingQty: 450, finishingQty: 450, packingQty: 450, remarks: 'All 450 pcs packed and dispatched to warehouse.', submittedBy: 'Sunil Garg', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-09', '09:00') },
    ],
  },

  // ── PROD-002 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-002',
    styleCode:           'NN412-220',
    styleName:           'Girls Flared Skirt',
    colour:              'NAVY',
    vendor:              'IDS FASHION',
    vendorId:            'v3',
    vendorLocation:      'NOIDA',
    orderQty:            450,
    inwardDate:          '2026-04-25',
    productionStartDate: '2026-04-05',
    category:            'Wovens',
    status:              'completed',
    tier:                'HERO',
    dprLog: [
      { id: 'dpr-002-1', orderId: 'PROD-002', date: '2026-04-10', cutQty: 450, stitchingQty: 400, finishingQty: 380, packingQty: 320, submittedBy: 'Ravi Kumar', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-10', '09:30') },
      { id: 'dpr-002-2', orderId: 'PROD-002', date: '2026-04-11', cutQty: 450, stitchingQty: 430, finishingQty: 410, packingQty: 370, submittedBy: 'Ravi Kumar', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-11', '09:12') },
      { id: 'dpr-002-3', orderId: 'PROD-002', date: '2026-04-12', cutQty: 450, stitchingQty: 445, finishingQty: 430, packingQty: 410, submittedBy: 'Ravi Kumar', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '09:18') },
      { id: 'dpr-002-4', orderId: 'PROD-002', date: '2026-04-14', cutQty: 450, stitchingQty: 450, finishingQty: 445, packingQty: 440, submittedBy: 'Ravi Kumar', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '09:25') },
      { id: 'dpr-002-5', orderId: 'PROD-002', date: '2026-04-15', cutQty: 450, stitchingQty: 450, finishingQty: 450, packingQty: 448, submittedBy: 'Ravi Kumar', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '09:05') },
      { id: 'dpr-002-6', orderId: 'PROD-002', date: '2026-04-16', cutQty: 450, stitchingQty: 450, finishingQty: 450, packingQty: 450, remarks: 'All packed and ready for dispatch.', submittedBy: 'Ravi Kumar', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-16', '09:02') },
    ],
  },

  // ── PROD-003 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-003',
    styleCode:           'NN418-090',
    styleName:           'Boys Linen Shorts',
    colour:              'OLIVE',
    vendor:              'ARIHANT FASHIONS',
    vendorId:            'v2',
    vendorLocation:      'KOLKATA',
    orderQty:            380,
    inwardDate:          '2026-05-20',
    productionStartDate: '2026-04-08',
    category:            'Wovens',
    status:              'on-track',
    tier:                'TIER-2',
    dprLog: [
      { id: 'dpr-003-1', orderId: 'PROD-003', date: '2026-04-10', cutQty: 200, stitchingQty: 120, finishingQty: 80, packingQty: 40, remarks: 'Logged on behalf of vendor', submittedBy: 'Parthipan Kumar', submittedByRole: 'sourcing-poc', submittedAt: makeTs('2026-04-10', '11:30') },
      { id: 'dpr-003-2', orderId: 'PROD-003', date: '2026-04-11', cutQty: 260, stitchingQty: 180, finishingQty: 120, packingQty: 80, submittedBy: 'Arihant Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-11', '09:40') },
      { id: 'dpr-003-3', orderId: 'PROD-003', date: '2026-04-12', cutQty: 320, stitchingQty: 230, finishingQty: 170, packingQty: 110, submittedBy: 'Arihant Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '09:35') },
      { id: 'dpr-003-4', orderId: 'PROD-003', date: '2026-04-14', cutQty: 350, stitchingQty: 270, finishingQty: 210, packingQty: 150, submittedBy: 'Arihant Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '09:28') },
      { id: 'dpr-003-5', orderId: 'PROD-003', date: '2026-04-15', cutQty: 370, stitchingQty: 300, finishingQty: 240, packingQty: 180, submittedBy: 'Arihant Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '09:22') },
    ],
  },

  // ── PROD-004 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-004',
    styleCode:           'NN407-315',
    styleName:           'Girls Printed Dress',
    colour:              'MULTICOLOUR',
    vendor:              'BS FASHION',
    vendorId:            'v4',
    vendorLocation:      'KOLKATA',
    orderQty:            520,
    inwardDate:          '2026-04-20',
    productionStartDate: '2026-04-05',
    category:            'Wovens',
    status:              'delayed',
    tier:                'TIER-1',
    dprLog: [
      { id: 'dpr-004-1', orderId: 'PROD-004', date: '2026-04-10', cutQty: 520, stitchingQty: 350, finishingQty: 280, packingQty: 150, submittedBy: 'BS Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-10', '09:45') },
      { id: 'dpr-004-2', orderId: 'PROD-004', date: '2026-04-11', cutQty: 520, stitchingQty: 390, finishingQty: 320, packingQty: 200, submittedBy: 'BS Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-11', '09:50') },
      { id: 'dpr-004-3', orderId: 'PROD-004', date: '2026-04-12', cutQty: 520, stitchingQty: 420, finishingQty: 360, packingQty: 250, isFlagged: true, pocNote: 'Packing rate is low — 250/520. Must accelerate to meet Apr 20 inward date.', submittedBy: 'BS Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '09:55') },
      { id: 'dpr-004-4', orderId: 'PROD-004', date: '2026-04-14', cutQty: 520, stitchingQty: 450, finishingQty: 390, packingQty: 290, submittedBy: 'BS Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '09:48') },
      { id: 'dpr-004-5', orderId: 'PROD-004', date: '2026-04-15', cutQty: 520, stitchingQty: 470, finishingQty: 415, packingQty: 320, submittedBy: 'BS Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '09:42') },
      { id: 'dpr-004-6', orderId: 'PROD-004', date: '2026-04-16', cutQty: 520, stitchingQty: 490, finishingQty: 435, packingQty: 360, remarks: 'Working overtime to clear remaining packing.', submittedBy: 'BS Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-16', '08:55') },
    ],
  },

  // ── PROD-005 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-005',
    styleCode:           'NN422-175',
    styleName:           'Boys Cargo Pants',
    colour:              'KHAKI',
    vendor:              'DIV CREATIONS',
    vendorId:            'v5',
    vendorLocation:      'FARIDABAD',
    orderQty:            300,
    inwardDate:          '2026-05-25',
    productionStartDate: '2026-04-10',
    category:            'Wovens',
    status:              'on-track',
    tier:                'TIER-2',
    dprLog: [
      { id: 'dpr-005-1', orderId: 'PROD-005', date: '2026-04-12', cutQty: 80,  stitchingQty: 0,   finishingQty: 0,  packingQty: 0, submittedBy: 'Div Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '10:05') },
      { id: 'dpr-005-2', orderId: 'PROD-005', date: '2026-04-14', cutQty: 180, stitchingQty: 60,  finishingQty: 0,  packingQty: 0, submittedBy: 'Div Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '10:10') },
      { id: 'dpr-005-3', orderId: 'PROD-005', date: '2026-04-15', cutQty: 260, stitchingQty: 120, finishingQty: 40, packingQty: 0, submittedBy: 'Div Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '10:02') },
    ],
  },

  // ── PROD-006 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-006',
    styleCode:           'NN413-285',
    styleName:           'Girls Embroidered Top',
    colour:              'IVORY',
    vendor:              'ADITEE INTERNATIONAL',
    vendorId:            'v7',
    vendorLocation:      'JAIPUR',
    orderQty:            250,
    inwardDate:          '2026-05-01',
    productionStartDate: '2026-04-08',
    category:            'Knits',
    status:              'at-risk',
    tier:                'HERO',
    dprLog: [
      { id: 'dpr-006-1', orderId: 'PROD-006', date: '2026-04-10', cutQty: 250, stitchingQty: 200, finishingQty: 170, packingQty: 100, submittedBy: 'Aditee Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-10', '09:55') },
      { id: 'dpr-006-2', orderId: 'PROD-006', date: '2026-04-11', cutQty: 250, stitchingQty: 220, finishingQty: 190, packingQty: 130, submittedBy: 'Aditee Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-11', '09:48') },
      { id: 'dpr-006-3', orderId: 'PROD-006', date: '2026-04-12', cutQty: 250, stitchingQty: 235, finishingQty: 210, packingQty: 160, submittedBy: 'Aditee Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '09:52') },
      { id: 'dpr-006-4', orderId: 'PROD-006', date: '2026-04-15', cutQty: 250, stitchingQty: 245, finishingQty: 225, packingQty: 180, isFlagged: true, pocNote: 'Missed Apr 14. At current packing pace (~20/day) will miss May 1 inward. Vendor must add shifts.', submittedBy: 'Aditee Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '09:38') },
      { id: 'dpr-006-5', orderId: 'PROD-006', date: '2026-04-16', cutQty: 250, stitchingQty: 250, finishingQty: 240, packingQty: 205, remarks: 'Added extra packing staff from today.', submittedBy: 'Aditee Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-16', '09:15') },
    ],
  },

  // ── PROD-007 ──────────────────────────────────────────────────────────────
  {
    id:                  'PROD-007',
    styleCode:           'NN401-110',
    styleName:           'Boys Cotton Round Neck Tee',
    colour:              'WHITE',
    vendor:              'CAARVI TEXTILES',
    vendorId:            'v8',
    vendorLocation:      'DELHI',
    orderQty:            800,
    inwardDate:          '2026-05-08',
    productionStartDate: '2026-04-08',
    category:            'Knits',
    status:              'on-track',
    tier:                'TIER-1',
    dprLog: [
      { id: 'dpr-007-1', orderId: 'PROD-007', date: '2026-04-10', cutQty: 650, stitchingQty: 580, finishingQty: 500, packingQty: 380, submittedBy: 'Caarvi Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-10', '09:00') },
      { id: 'dpr-007-2', orderId: 'PROD-007', date: '2026-04-11', cutQty: 720, stitchingQty: 630, finishingQty: 550, packingQty: 430, submittedBy: 'Caarvi Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-11', '08:58') },
      { id: 'dpr-007-3', orderId: 'PROD-007', date: '2026-04-12', cutQty: 780, stitchingQty: 680, finishingQty: 600, packingQty: 480, submittedBy: 'Caarvi Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-12', '09:02') },
      { id: 'dpr-007-4', orderId: 'PROD-007', date: '2026-04-14', cutQty: 800, stitchingQty: 720, finishingQty: 640, packingQty: 530, submittedBy: 'Caarvi Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-14', '08:55') },
      { id: 'dpr-007-5', orderId: 'PROD-007', date: '2026-04-15', cutQty: 800, stitchingQty: 760, finishingQty: 690, packingQty: 590, submittedBy: 'Caarvi Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-15', '09:00') },
      { id: 'dpr-007-6', orderId: 'PROD-007', date: '2026-04-16', cutQty: 800, stitchingQty: 790, finishingQty: 730, packingQty: 650, submittedBy: 'Caarvi Floor Team', submittedByRole: 'vendor', submittedAt: makeTs('2026-04-16', '08:50') },
    ],
  },
]

// Suppress unused import warning for the ts helper
void ts
