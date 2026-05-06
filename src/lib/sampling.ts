// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLING — shared types, config, mock data, and pure helpers
// Imported by both portfolio/page.tsx (POC tab) and sampling/page.tsx (designer/fit-tech)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageId =
  | 'lab-dip'
  | 'strike-off'
  | 'fit-sample'
  | 'fd-status'
  | 'pps'
  | 'gpt'
  | 'pp-fit'

export type StageOwner = 'designer' | 'fit-technician' | 'poc' | 'dual'

export type EntryStatus =
  | 'not-started'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'revision-required'
  | 'pass'
  | 'fail'
  | 'received'

export type ApprovalEntry = {
  round:             number
  submittedDate?:    string
  approvedDate?:     string
  approvedBy?:       string
  isOnBehalf?:       boolean
  onBehalfOf?:       string
  status:            EntryStatus
  remarks?:          string
  revisionNotes?:    string
  measurementNotes?: string
}

export type PPSEntry = {
  round:              number
  submittedDate?:     string
  status:             EntryStatus
  designerStatus:     Exclude<EntryStatus, 'pass' | 'fail' | 'received'>
  designerBy?:        string
  designerDate?:      string
  designerRemarks?:   string
  designerOnBehalf?:  boolean
  fitTechStatus:      Exclude<EntryStatus, 'pass' | 'fail' | 'received'>
  fitTechBy?:         string
  fitTechDate?:       string
  fitTechRemarks?:    string
  fitTechOnBehalf?:   boolean
  revisionNotes?:     string
}

export type TrackingEntry = {
  completedDate?: string
  notes?:         string
  certificateNo?: string
  testResult?:    'pass' | 'fail'
  status:         'not-started' | 'received' | 'pass' | 'fail'
}

export type SamplingStage =
  | { id: Exclude<StageId, 'pps' | 'fd-status' | 'gpt'>; entries: ApprovalEntry[] }
  | { id: 'pps';       entries: PPSEntry[]    }
  | { id: 'fd-status'; entry:   TrackingEntry }
  | { id: 'gpt';       entry:   TrackingEntry }

export type SamplingOrder = {
  id:             string
  styleCode:      string
  styleName:      string
  colour:         string
  category:       string
  vendor:         string
  vendorId:       string
  vendorLocation: string
  orderQty:       number
  targetPrice:    number
  inwardDate:     string
  season:         string
  tier:           'HERO' | 'TIER-1' | 'TIER-2' | 'TAIL'
  stages:         SamplingStage[]
  promisedDates?: Partial<Record<StageId, string>>
}

// ─── Stage config ──────────────────────────────────────────────────────────────

export type StageConfig = {
  id:         StageId
  label:      string
  short:      string
  owner:      StageOwner
  isTracking: boolean
  desc:       string
  bg:         string
  text:       string
  border:     string
  dot:        string
}

export const STAGE_CONFIG: StageConfig[] = [
  { id: 'lab-dip',    label: 'Lab Dip',       short: 'LD',  owner: 'designer',       isTracking: false, desc: 'Fabric colour matching — vendor submits swatches',          bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-200',   dot: 'bg-pink-500'   },
  { id: 'strike-off', label: 'Strike Off',    short: 'S/O', owner: 'designer',       isTracking: false, desc: 'Print / embroidery strike off approval',                    bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-200',   dot: 'bg-rose-500'   },
  { id: 'fit-sample', label: 'Fit Sample',    short: 'FS',  owner: 'fit-technician', isTracking: false, desc: 'Garment fit assessment with measurements',                  bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  { id: 'fd-status',  label: 'Fabric Inward', short: 'FD',  owner: 'poc',            isTracking: true,  desc: 'Fabric dispatched from mill to factory — tracked by date',  bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  { id: 'pps',        label: 'PP Sample',     short: 'PPS', owner: 'dual',           isTracking: false, desc: 'Pre-production sample — Designer + Fit Technician sign-off', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { id: 'gpt',        label: 'GPT',           short: 'GPT', owner: 'poc',            isTracking: true,  desc: 'Garment Processing Test — pass certificate required',        bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-200',   dot: 'bg-teal-500'   },
  { id: 'pp-fit',     label: 'PP Fit',        short: 'PPF', owner: 'fit-technician', isTracking: false, desc: 'Final fit check on PP Sample before production approval',    bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
]

export const STAGE_IDS: StageId[] = STAGE_CONFIG.map(s => s.id)

export function cfg(id: StageId): StageConfig {
  return STAGE_CONFIG.find(s => s.id === id)!
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getStage(order: SamplingOrder, id: StageId): SamplingStage {
  return order.stages.find(s => s.id === id)!
}

export function stageCurrentStatus(stage: SamplingStage): EntryStatus {
  if (stage.id === 'fd-status' || stage.id === 'gpt') return stage.entry.status
  if (stage.id === 'pps') {
    const last = stage.entries[stage.entries.length - 1] as PPSEntry
    if (last.designerStatus === 'approved' && last.fitTechStatus === 'approved') return 'approved'
    if (last.status === 'not-started') return 'not-started'
    return 'submitted'
  }
  const entries = stage.entries as ApprovalEntry[]
  return entries[entries.length - 1].status
}

export function getActiveStageIdx(order: SamplingOrder): number {
  for (let i = 0; i < STAGE_IDS.length; i++) {
    const s  = getStage(order, STAGE_IDS[i])
    const st = stageCurrentStatus(s)
    if (st !== 'approved' && st !== 'pass' && st !== 'received') return i
  }
  return STAGE_IDS.length
}

export function isOrderComplete(order: SamplingOrder): boolean {
  return getActiveStageIdx(order) === STAGE_IDS.length
}

export function fmtDate(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ─── Mock data helpers ────────────────────────────────────────────────────────

export function ns(): TrackingEntry  { return { status: 'not-started' } }
export function nsEntry(): ApprovalEntry { return { round: 1, status: 'not-started' } }
export function nsPPS(): PPSEntry    { return { round: 1, status: 'not-started', designerStatus: 'not-started', fitTechStatus: 'not-started' } }

// ─── Mock data ────────────────────────────────────────────────────────────────

export const SAMPLING_ORDERS: SamplingOrder[] = [
  {
    id: 'NNKNTW250030', styleCode: 'NN419-201', styleName: 'Boys Printed Polo T-Shirt',
    colour: 'WHITE', category: 'Knits', vendor: 'IDS FASHION', vendorId: 'v3', vendorLocation: 'NOIDA',
    orderQty: 750, targetPrice: 175, inwardDate: '2026-06-10', season: 'SS25', tier: 'TIER-1',
    promisedDates: { 'lab-dip': '2026-04-15', 'strike-off': '2026-05-01', 'fit-sample': '2026-05-15', 'fd-status': '2026-05-25', 'pps': '2026-06-01', 'gpt': '2026-06-05', 'pp-fit': '2026-06-08' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2026-04-05', status: 'submitted' }] },
      { id: 'strike-off', entries: [nsEntry()] },
      { id: 'fit-sample', entries: [nsEntry()] },
      { id: 'fd-status',  entry: ns() },
      { id: 'pps',        entries: [nsPPS()] },
      { id: 'gpt',        entry: ns() },
      { id: 'pp-fit',     entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250031', styleCode: 'NN416-089', styleName: 'Girls Ruffle Neck Top',
    colour: 'MINT GREEN', category: 'Knits', vendor: 'BHARTI APPARELS', vendorId: 'v1', vendorLocation: 'FARIDABAD',
    orderQty: 500, targetPrice: 220, inwardDate: '2026-06-05', season: 'SS25', tier: 'TIER-2',
    promisedDates: { 'strike-off': '2026-04-12', 'fit-sample': '2026-04-28', 'fd-status': '2026-05-10', 'pps': '2026-05-20', 'gpt': '2026-05-28', 'pp-fit': '2026-06-02' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2026-03-20', approvedDate: '2026-03-25', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'Colour within acceptable delta. Good match on swatch #3.' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2026-04-02', status: 'submitted' }] },
      { id: 'fit-sample', entries: [nsEntry()] },
      { id: 'fd-status',  entry: ns() },
      { id: 'pps',        entries: [nsPPS()] },
      { id: 'gpt',        entry: ns() },
      { id: 'pp-fit',     entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250032', styleCode: 'NN421-088', styleName: 'Girls Woven Pinafore Dress',
    colour: 'DUSTY ROSE', category: 'Wovens', vendor: 'ARIHANT FASHIONS', vendorId: 'v2', vendorLocation: 'KOLKATA',
    orderQty: 320, targetPrice: 345, inwardDate: '2026-06-18', season: 'SS25', tier: 'TIER-2',
    stages: [
      { id: 'lab-dip', entries: [
        { round: 1, submittedDate: '2026-03-15', approvedDate: '2026-03-22', approvedBy: 'Meena Krishnan', status: 'rejected', remarks: 'Dusty Rose skewing too purple. Incorrect sheen on fabric.', revisionNotes: 'Adjust dye ratio — reduce blue undertone. Confirm matte finish per BOM.' },
        { round: 2, submittedDate: '2026-04-04', status: 'submitted' },
      ] },
      { id: 'strike-off', entries: [nsEntry()] },
      { id: 'fit-sample', entries: [nsEntry()] },
      { id: 'fd-status',  entry: ns() },
      { id: 'pps',        entries: [nsPPS()] },
      { id: 'gpt',        entry: ns() },
      { id: 'pp-fit',     entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250033', styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', category: 'Knits', vendor: 'BS FASHION', vendorId: 'v4', vendorLocation: 'KOLKATA',
    orderQty: 720, targetPrice: 340, inwardDate: '2026-05-18', season: 'SS25', tier: 'TIER-1',
    promisedDates: { 'fit-sample': '2026-04-18', 'fd-status': '2026-05-02', 'pps': '2026-05-10', 'gpt': '2026-05-15', 'pp-fit': '2026-05-18' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2026-02-25', approvedDate: '2026-03-02', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'Yellow shade matches Pantone 012C.' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2026-03-10', approvedDate: '2026-03-16', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'Smocking embroidery placement and density matches design.' }] },
      { id: 'fit-sample', entries: [{ round: 1, submittedDate: '2026-04-01', status: 'submitted' }] },
      { id: 'fd-status',  entry: ns() },
      { id: 'pps',        entries: [nsPPS()] },
      { id: 'gpt',        entry: ns() },
      { id: 'pp-fit',     entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250034', styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', category: 'Wovens', vendor: 'DIV CREATIONS', vendorId: 'v5', vendorLocation: 'FARIDABAD',
    orderQty: 380, targetPrice: 295, inwardDate: '2026-06-01', season: 'SS25', tier: 'TIER-1',
    promisedDates: { 'fd-status': '2026-04-10', 'pps': '2026-04-28', 'gpt': '2026-05-08', 'pp-fit': '2026-05-18' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2026-02-10', approvedDate: '2026-02-15', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'Sky Blue matched within acceptable range.' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2026-02-20', approvedDate: '2026-02-26', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'No print on this style — marked approved.' }] },
      { id: 'fit-sample', entries: [{ round: 1, submittedDate: '2026-03-05', approvedDate: '2026-03-12', approvedBy: 'Rekha Pillai', status: 'approved', remarks: 'Fit approved across S/M/L. Collar stand height correct.', measurementNotes: 'Chest: 36cm ✓  Collar: 3.5cm ✓  Sleeve: 58cm ✓' }] },
      { id: 'fd-status',  entry: { status: 'not-started' } },
      { id: 'pps',        entries: [nsPPS()] },
      { id: 'gpt',        entry: ns() },
      { id: 'pp-fit',     entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250035', styleCode: 'NN426-310', styleName: 'Girls Embroidered Kurti',
    colour: 'YELLOW', category: 'Wovens', vendor: 'ADITEE INTERNATIONAL', vendorId: 'v7', vendorLocation: 'JAIPUR',
    orderQty: 250, targetPrice: 480, inwardDate: '2026-06-25', season: 'SS25', tier: 'HERO',
    promisedDates: { 'pps': '2026-04-22', 'gpt': '2026-05-05', 'pp-fit': '2026-05-15' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2026-02-01', approvedDate: '2026-02-07', approvedBy: 'Meena Krishnan', status: 'approved' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2026-02-12', approvedDate: '2026-02-18', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'Embroidery needle-work placement approved.' }] },
      { id: 'fit-sample', entries: [{ round: 1, submittedDate: '2026-02-25', approvedDate: '2026-03-04', approvedBy: 'Rekha Pillai', status: 'approved', measurementNotes: 'Kurta length: 65cm ✓  Hip: 42cm ✓' }] },
      { id: 'fd-status',  entry: { status: 'received', completedDate: '2026-03-18', notes: 'Fabric received at Jaipur factory from Bhilwara mill.' } },
      { id: 'pps', entries: [{ round: 1, submittedDate: '2026-04-08', status: 'submitted', designerStatus: 'submitted', fitTechStatus: 'submitted' }] },
      { id: 'gpt',    entry: ns() },
      { id: 'pp-fit', entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250036', styleCode: 'NN415-078', styleName: 'Boys French Terry Sweatshirt',
    colour: 'NAVY MELANGE', category: 'Knits', vendor: 'CAARVI TEXTILES', vendorId: 'v8', vendorLocation: 'DELHI',
    orderQty: 550, targetPrice: 380, inwardDate: '2026-05-30', season: 'SS25', tier: 'TIER-1',
    promisedDates: { 'pps': '2026-04-18', 'gpt': '2026-05-02', 'pp-fit': '2026-05-12' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2026-01-15', approvedDate: '2026-01-20', approvedBy: 'Meena Krishnan', status: 'approved' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2026-01-25', approvedDate: '2026-01-30', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'Print placement approved.' }] },
      { id: 'fit-sample', entries: [{ round: 1, submittedDate: '2026-02-08', approvedDate: '2026-02-14', approvedBy: 'Rekha Pillai', status: 'approved', measurementNotes: 'Chest: 40cm ✓  Body length: 62cm ✓  Sleeve: 60cm ✓' }] },
      { id: 'fd-status',  entry: { status: 'received', completedDate: '2026-02-28', notes: 'French terry received at Delhi factory.' } },
      { id: 'pps', entries: [{ round: 1, submittedDate: '2026-03-20', status: 'submitted', designerStatus: 'approved', designerBy: 'Meena Krishnan', designerDate: '2026-03-25', designerRemarks: 'Construction and print quality approved.', fitTechStatus: 'submitted' }] },
      { id: 'gpt',    entry: ns() },
      { id: 'pp-fit', entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250037', styleCode: 'NN408-245', styleName: 'Girls Embroidered Sharara Set',
    colour: 'MAROON', category: 'Wovens', vendor: 'ADITEE INTERNATIONAL', vendorId: 'v7', vendorLocation: 'JAIPUR',
    orderQty: 280, targetPrice: 520, inwardDate: '2026-06-10', season: 'SS25', tier: 'HERO',
    promisedDates: { 'gpt': '2026-04-25', 'pp-fit': '2026-05-10' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2026-01-10', approvedDate: '2026-01-15', approvedBy: 'Meena Krishnan', status: 'approved' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2026-01-20', approvedDate: '2026-01-26', approvedBy: 'Meena Krishnan', status: 'approved', remarks: 'Embroidery thread count matches BOM.' }] },
      { id: 'fit-sample', entries: [{ round: 1, submittedDate: '2026-02-02', approvedDate: '2026-02-10', approvedBy: 'Rekha Pillai', status: 'approved' }] },
      { id: 'fd-status',  entry: { status: 'received', completedDate: '2026-02-20', notes: 'Fabric received. Shade variation acceptable.' } },
      { id: 'pps', entries: [{ round: 1, submittedDate: '2026-03-05', status: 'approved', designerStatus: 'approved', designerBy: 'Meena Krishnan', designerDate: '2026-03-10', fitTechStatus: 'approved', fitTechBy: 'Rekha Pillai', fitTechDate: '2026-03-11' }] },
      { id: 'gpt',    entry: { status: 'not-started' } },
      { id: 'pp-fit', entries: [nsEntry()] },
    ],
  },
  {
    id: 'NNKNTW250038', styleCode: 'NN411-312', styleName: 'Boys Printed Bermuda Shorts',
    colour: 'COBALT', category: 'Wovens', vendor: 'PESOS VISION', vendorId: 'v9', vendorLocation: 'MUMBAI',
    orderQty: 650, targetPrice: 198, inwardDate: '2026-05-08', season: 'SS25', tier: 'TIER-1',
    promisedDates: { 'pp-fit': '2026-04-18' },
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2025-12-10', approvedDate: '2025-12-15', approvedBy: 'Meena Krishnan', status: 'approved' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2025-12-20', approvedDate: '2025-12-26', approvedBy: 'Meena Krishnan', status: 'approved' }] },
      { id: 'fit-sample', entries: [{ round: 1, submittedDate: '2026-01-05', approvedDate: '2026-01-12', approvedBy: 'Rekha Pillai', status: 'approved' }] },
      { id: 'fd-status',  entry: { status: 'received', completedDate: '2026-01-20' } },
      { id: 'pps', entries: [{ round: 1, submittedDate: '2026-02-10', status: 'approved', designerStatus: 'approved', designerBy: 'Meena Krishnan', designerDate: '2026-02-15', fitTechStatus: 'approved', fitTechBy: 'Rekha Pillai', fitTechDate: '2026-02-16' }] },
      { id: 'gpt',    entry: { status: 'pass', completedDate: '2026-03-01', certificateNo: 'GPT-2026-0412', testResult: 'pass' } },
      { id: 'pp-fit', entries: [{ round: 1, submittedDate: '2026-03-10', status: 'submitted' }] },
    ],
  },
  {
    id: 'NNKNTW250039', styleCode: 'NN424-156', styleName: 'Boys Cargo Shorts',
    colour: 'KHAKI', category: 'Wovens', vendor: 'ARIHANT FASHIONS', vendorId: 'v2', vendorLocation: 'KOLKATA',
    orderQty: 600, targetPrice: 210, inwardDate: '2026-05-08', season: 'SS25', tier: 'TIER-1',
    stages: [
      { id: 'lab-dip',    entries: [{ round: 1, submittedDate: '2025-11-20', approvedDate: '2025-11-25', approvedBy: 'Meena Krishnan', status: 'approved' }] },
      { id: 'strike-off', entries: [{ round: 1, submittedDate: '2025-12-01', approvedDate: '2025-12-06', approvedBy: 'Meena Krishnan', status: 'approved' }] },
      { id: 'fit-sample', entries: [{ round: 1, submittedDate: '2025-12-15', approvedDate: '2025-12-22', approvedBy: 'Rekha Pillai', status: 'approved', measurementNotes: 'Waist: 32cm ✓  Outseam: 48cm ✓  Thigh: 28cm ✓' }] },
      { id: 'fd-status',  entry: { status: 'received', completedDate: '2026-01-05' } },
      { id: 'pps', entries: [{ round: 1, submittedDate: '2026-01-20', status: 'approved', designerStatus: 'approved', designerBy: 'Meena Krishnan', designerDate: '2026-01-24', fitTechStatus: 'approved', fitTechBy: 'Rekha Pillai', fitTechDate: '2026-01-25' }] },
      { id: 'gpt',    entry: { status: 'pass', completedDate: '2026-02-05', certificateNo: 'GPT-2026-0318', testResult: 'pass' } },
      { id: 'pp-fit', entries: [{ round: 1, submittedDate: '2026-02-12', approvedDate: '2026-02-18', approvedBy: 'Rekha Pillai', status: 'approved', remarks: 'Final fit approved. Clear for production.', measurementNotes: 'All dimensions within tolerance.' }] },
    ],
  },
]
