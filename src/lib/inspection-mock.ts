// ─────────────────────────────────────────────────────────────────────────────
// Inspection Module — Mock Data
//
// Mirrors the data model in docs/prd-inspection-module.md §11.
// Decoupled from the legacy FIRequest type in src/lib/types.ts so the new
// Inspector mobile flows can evolve independently. Existing /qa and
// /inspections routes continue to use the legacy types untouched.
//
// Phase 1 brand: Bewakoof. Code formats follow INS-BW-YYMM-XXXX-RN.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Inspector ────────────────────────────────────────────────────────────────

export type InspectorType = 'in_house' | 'third_party_agency'
export type FabricSpecialisation = 'woven' | 'knit' | 'both'

export interface Inspector {
  id: string
  name: string
  email: string
  phone: string
  brandIds: string[]
  inspectorType: InspectorType
  agencyName?: string                  // required if third_party_agency
  zones: string[]                      // list of cities covered
  fabricSpecialisation: FabricSpecialisation
  active: boolean
  initials: string
}

// ─── Inspection request + assignment ──────────────────────────────────────────

export type InspectionStatus =
  | 'pending_assignment'        // raised by vendor, not yet assigned
  | 'unscheduled'               // assigned to inspector, no date set
  | 'pending_confirmation'      // date set, inspector hasn't confirmed
  | 'scheduled'                 // confirmed by inspector, future date
  | 'in_progress'               // inspector started, not yet submitted
  | 'submitted'                 // report submitted, awaiting auto-routing
  | 'passed'
  | 'failed'
  | 'on_hold'
  | 'not_ready'                 // vendor wasn't ready
  | 'missed'                    // EOD passed without start
  | 'rescheduled'
  | 'cancelled'
  | 'on_site_in_progress'       // inspector raised on-site, executing now

export type InspectionResult = 'pass' | 'fail' | 'hold' | 'not_ready'

export interface ColorQty {
  colour: string
  qty: number
}

export interface InspectionRequest {
  id: string                          // internal ID e.g. ins_001
  reportNumber: string                // INS-BW-2605-0042-R1
  brandId: string
  styleCode: string
  styleName: string
  fabricateCode: string               // SubOrder unique identifier
  merchandiseCategory: string         // e.g. "(6) INFANT (REPLEN)"
  colours: string[]                   // all colors covered by this request
  poNumber: string

  // Vendor
  vendorId: string
  vendorName: string
  vendorCity: string
  vendorPremise: string

  // Quantities
  inspectionRequestedQtyTotal: number
  inspectionRequestedQtyPerColor: ColorQty[]
  packedQtyAtRequest: number
  poQty: number

  // Schedule
  readyDate: string                   // ISO date string
  scheduledDate?: string              // set by QA Manager
  confirmedAt?: string                // when inspector confirmed
  timeWindow?: string                 // e.g. "10:00 – 13:00"
  location: string                    // city — pre-filled from premise

  // Lifecycle
  status: InspectionStatus
  result?: InspectionResult
  round: number
  parentInspectionId?: string         // for re-inspections, points to R1

  // Assignment
  assignedInspectorId?: string

  // People who initiated
  createdByUserId: string
  createdByRole: 'vendor' | 'sourcing-poc' | 'inspector'
  onBehalfOfVendorId?: string         // when sourcing POC raises for vendor

  // Sourcing context
  sourcingPocName: string

  // Misc
  fabricType: FabricSpecialisation
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── Tab grouping logic (for schedule view) ───────────────────────────────────

export type ScheduleTab =
  | 'today'
  | 'upcoming'
  | 'pending_confirmation'
  | 'unscheduled'
  | 'completed'
  | 'missed'

const isoToday = (() => {
  // Project date pinned to 2026-05-22 per project context
  return '2026-05-22'
})()
const isoOffset = (days: number): string => {
  const base = new Date(isoToday + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export function classifyTab(r: InspectionRequest): ScheduleTab | 'none' {
  // Completed: any terminal result
  if (r.result === 'pass' || r.result === 'fail') return 'completed'

  // Missed: scheduled date in the past with no submission, or explicit status
  if (r.status === 'missed' || r.status === 'rescheduled' || r.status === 'not_ready') return 'missed'

  // In progress today
  if (r.status === 'in_progress' || r.status === 'on_site_in_progress') return 'today'

  // Scheduled today
  if (r.scheduledDate === isoToday && r.status === 'scheduled') return 'today'

  // Pending confirmation
  if (r.status === 'pending_confirmation') return 'pending_confirmation'

  // Unscheduled: assigned but no date
  if (r.status === 'unscheduled') return 'unscheduled'

  // Future scheduled / confirmed
  if (r.status === 'scheduled' && r.scheduledDate && r.scheduledDate > isoToday) return 'upcoming'

  // On hold (still shown in upcoming for visibility)
  if (r.status === 'on_hold') return 'upcoming'

  return 'none'
}

// ─── Demo inspector profile ───────────────────────────────────────────────────

export const DEMO_INSPECTOR: Inspector = {
  id: 'insp_arul_001',
  name: 'Arul Pandey',
  email: 'arul.pandey@tmrw.in',
  phone: '+91-98765-43210',
  brandIds: ['bewakoof'],
  inspectorType: 'in_house',
  zones: ['Faridabad', 'Noida', 'Delhi', 'Gurgaon'],
  fabricSpecialisation: 'both',
  active: true,
  initials: 'AP',
}

// Other inspectors (for assignment references / future use)
export const inspectors: Inspector[] = [
  DEMO_INSPECTOR,
  {
    id: 'insp_satish_002',
    name: 'Satish Kumar',
    email: 'satish.kumar@tmrw.in',
    phone: '+91-98712-34567',
    brandIds: ['bewakoof'],
    inspectorType: 'in_house',
    zones: ['Bengaluru', 'Tirupur', 'Chennai'],
    fabricSpecialisation: 'knit',
    active: true,
    initials: 'SK',
  },
  {
    id: 'insp_rajesh_003',
    name: 'Rajesh Menon',
    email: 'rajesh@qualityaxiom.com',
    phone: '+91-99887-66554',
    brandIds: ['bewakoof'],
    inspectorType: 'third_party_agency',
    agencyName: 'Quality Axiom',
    zones: ['Mumbai', 'Pune', 'Surat'],
    fabricSpecialisation: 'both',
    active: true,
    initials: 'RM',
  },
  {
    id: 'insp_priya_004',
    name: 'Priya Iyer',
    email: 'priya.i@inspecpro.com',
    phone: '+91-90909-12345',
    brandIds: ['bewakoof'],
    inspectorType: 'third_party_agency',
    agencyName: 'InspecPro',
    zones: ['Kolkata', 'Jaipur'],
    fabricSpecialisation: 'woven',
    active: true,
    initials: 'PI',
  },
]

// ─── Demo inspection requests (assigned to Arul) ──────────────────────────────
// 14 inspections spread across all schedule tabs.

const SOURCING_POCS = [
  'Chandni Nair',
  'Parthipan Kumar',
  'Rajesh Menon',
  'Kavitha Menon',
]
const pickPoc = (n: number) => SOURCING_POCS[n % SOURCING_POCS.length]

export const demoInspections: InspectionRequest[] = [
  // ─── TODAY ─── 3 inspections
  {
    id: 'ins_001',
    reportNumber: 'INS-BW-2605-0042-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-AS-1025',
    styleName: 'Easy-Fit Joggers — Drop 03',
    fabricateCode: 'BW-1748392001234-9690',
    merchandiseCategory: '(4) MEN BOTTOMWEAR',
    colours: ['Charcoal Black', 'Olive Stone'],
    poNumber: 'PPO-03251M',
    vendorId: 'v_aashirwad',
    vendorName: 'Aashirwad Exports',
    vendorCity: 'Noida',
    vendorPremise: 'C-119, Sector 65, Noida',
    inspectionRequestedQtyTotal: 1200,
    inspectionRequestedQtyPerColor: [
      { colour: 'Charcoal Black', qty: 720 },
      { colour: 'Olive Stone',    qty: 480 },
    ],
    packedQtyAtRequest: 1200,
    poQty: 1200,
    readyDate: isoToday,
    scheduledDate: isoToday,
    confirmedAt: isoOffset(-1) + 'T14:20:00Z',
    timeWindow: '10:00 – 13:00',
    location: 'Noida',
    status: 'scheduled',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_aashirwad',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(0),
    fabricType: 'knit',
    createdAt: isoOffset(-3) + 'T09:00:00Z',
    updatedAt: isoOffset(-1) + 'T14:20:00Z',
  },
  {
    id: 'ins_002',
    reportNumber: 'INS-BW-2605-0048-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-TSH-2240',
    styleName: 'Oversized Drop-Shoulder Tee',
    fabricateCode: 'BW-1748392001789-1024',
    merchandiseCategory: '(3) MEN TOPWEAR',
    colours: ['Off White', 'Sage Green', 'Dusty Pink'],
    poNumber: 'PPO-04102B',
    vendorId: 'v_bharti',
    vendorName: 'Bharti Apparels',
    vendorCity: 'Faridabad',
    vendorPremise: 'Plot 14, Sector 25, Faridabad',
    inspectionRequestedQtyTotal: 2400,
    inspectionRequestedQtyPerColor: [
      { colour: 'Off White',  qty: 1000 },
      { colour: 'Sage Green', qty: 800 },
      { colour: 'Dusty Pink', qty: 600 },
    ],
    packedQtyAtRequest: 2400,
    poQty: 2400,
    readyDate: isoToday,
    scheduledDate: isoToday,
    confirmedAt: isoOffset(-2) + 'T11:00:00Z',
    timeWindow: '14:00 – 17:00',
    location: 'Faridabad',
    status: 'scheduled',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_bharti',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(1),
    fabricType: 'knit',
    createdAt: isoOffset(-4) + 'T10:00:00Z',
    updatedAt: isoOffset(-2) + 'T11:00:00Z',
  },
  {
    id: 'ins_003',
    reportNumber: 'INS-BW-2605-0051-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-SHO-1180',
    styleName: 'Lounge Shorts — Solid',
    fabricateCode: 'BW-1748392002001-3344',
    merchandiseCategory: '(4) MEN BOTTOMWEAR',
    colours: ['Navy Blue'],
    poNumber: 'PPO-04108D',
    vendorId: 'v_div',
    vendorName: 'Div Creations',
    vendorCity: 'Faridabad',
    vendorPremise: 'Plot 88-B, Sector 31, Faridabad',
    inspectionRequestedQtyTotal: 800,
    inspectionRequestedQtyPerColor: [{ colour: 'Navy Blue', qty: 800 }],
    packedQtyAtRequest: 800,
    poQty: 800,
    readyDate: isoToday,
    scheduledDate: isoToday,
    confirmedAt: isoOffset(-1) + 'T09:00:00Z',
    timeWindow: 'Now in progress',
    location: 'Faridabad',
    status: 'in_progress',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'sp_chandni',
    createdByRole: 'sourcing-poc',
    onBehalfOfVendorId: 'v_div',
    sourcingPocName: pickPoc(0),
    fabricType: 'knit',
    createdAt: isoOffset(-3) + 'T15:00:00Z',
    updatedAt: isoToday + 'T09:15:00Z',
  },

  // ─── UPCOMING ─── 3 inspections
  {
    id: 'ins_004',
    reportNumber: 'INS-BW-2605-0055-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-JCK-3401',
    styleName: 'Hooded Bomber Jacket',
    fabricateCode: 'BW-1748392002567-7788',
    merchandiseCategory: '(7) MEN OUTERWEAR',
    colours: ['Black', 'Bottle Green'],
    poNumber: 'PPO-04201E',
    vendorId: 'v_arihant',
    vendorName: 'Arihant Fashions',
    vendorCity: 'Noida',
    vendorPremise: 'A-22, Phase 2, Noida',
    inspectionRequestedQtyTotal: 600,
    inspectionRequestedQtyPerColor: [
      { colour: 'Black',        qty: 360 },
      { colour: 'Bottle Green', qty: 240 },
    ],
    packedQtyAtRequest: 600,
    poQty: 600,
    readyDate: isoOffset(2),
    scheduledDate: isoOffset(2),
    confirmedAt: isoOffset(-1) + 'T17:00:00Z',
    timeWindow: '11:00 – 14:00',
    location: 'Noida',
    status: 'scheduled',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_arihant',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(2),
    fabricType: 'woven',
    createdAt: isoOffset(-2) + 'T11:00:00Z',
    updatedAt: isoOffset(-1) + 'T17:00:00Z',
  },
  {
    id: 'ins_005',
    reportNumber: 'INS-BW-2605-0058-R2',
    brandId: 'bewakoof',
    styleCode: 'BW-DEN-4502',
    styleName: 'Slim-Fit Denim — Indigo Wash',
    fabricateCode: 'BW-1748392002990-1122',
    merchandiseCategory: '(4) MEN BOTTOMWEAR',
    colours: ['Indigo'],
    poNumber: 'PPO-04299F',
    vendorId: 'v_ids',
    vendorName: 'IDS Fashion',
    vendorCity: 'Noida',
    vendorPremise: 'D-44, Sector 63, Noida',
    inspectionRequestedQtyTotal: 450,
    inspectionRequestedQtyPerColor: [{ colour: 'Indigo', qty: 450 }],
    packedQtyAtRequest: 450,
    poQty: 480,
    readyDate: isoOffset(3),
    scheduledDate: isoOffset(3),
    confirmedAt: isoOffset(-1) + 'T12:30:00Z',
    timeWindow: '10:00 – 13:00',
    location: 'Noida',
    status: 'scheduled',
    round: 2,
    parentInspectionId: 'ins_prev_004',
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_ids',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(3),
    fabricType: 'woven',
    notes: 'Re-inspection — fix stitching defects flagged on R1',
    createdAt: isoOffset(-2) + 'T09:00:00Z',
    updatedAt: isoOffset(-1) + 'T12:30:00Z',
  },
  {
    id: 'ins_006',
    reportNumber: 'INS-BW-2605-0061-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-TSH-2250',
    styleName: 'Graphic Print Tee — Anime Series',
    fabricateCode: 'BW-1748392003311-4455',
    merchandiseCategory: '(3) MEN TOPWEAR',
    colours: ['White', 'Black'],
    poNumber: 'PPO-04305G',
    vendorId: 'v_bharti',
    vendorName: 'Bharti Apparels',
    vendorCity: 'Faridabad',
    vendorPremise: 'Plot 14, Sector 25, Faridabad',
    inspectionRequestedQtyTotal: 1800,
    inspectionRequestedQtyPerColor: [
      { colour: 'White', qty: 1000 },
      { colour: 'Black', qty: 800 },
    ],
    packedQtyAtRequest: 1800,
    poQty: 1800,
    readyDate: isoOffset(4),
    scheduledDate: isoOffset(4),
    confirmedAt: isoOffset(-1) + 'T16:45:00Z',
    timeWindow: '15:00 – 18:00',
    location: 'Faridabad',
    status: 'scheduled',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_bharti',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(1),
    fabricType: 'knit',
    createdAt: isoOffset(-3) + 'T08:00:00Z',
    updatedAt: isoOffset(-1) + 'T16:45:00Z',
  },

  // ─── PENDING CONFIRMATION ─── 2 inspections
  {
    id: 'ins_007',
    reportNumber: 'INS-BW-2605-0066-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-SWE-5501',
    styleName: 'Crew Sweatshirt — Fleece',
    fabricateCode: 'BW-1748392003789-6677',
    merchandiseCategory: '(7) MEN OUTERWEAR',
    colours: ['Heather Grey', 'Maroon'],
    poNumber: 'PPO-04410H',
    vendorId: 'v_bs',
    vendorName: 'BS Fashion',
    vendorCity: 'Delhi',
    vendorPremise: 'B-401, Okhla Phase 3, Delhi',
    inspectionRequestedQtyTotal: 1500,
    inspectionRequestedQtyPerColor: [
      { colour: 'Heather Grey', qty: 900 },
      { colour: 'Maroon',       qty: 600 },
    ],
    packedQtyAtRequest: 1500,
    poQty: 1500,
    readyDate: isoOffset(3),
    scheduledDate: isoOffset(3),
    timeWindow: '11:00 – 14:00',
    location: 'Delhi',
    status: 'pending_confirmation',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_bs',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(0),
    fabricType: 'knit',
    createdAt: isoOffset(-1) + 'T10:00:00Z',
    updatedAt: isoToday + 'T08:00:00Z',
  },
  {
    id: 'ins_008',
    reportNumber: 'INS-BW-2605-0070-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-PAJ-6603',
    styleName: 'Cotton Pyjama Set',
    fabricateCode: 'BW-1748392004001-8899',
    merchandiseCategory: '(11) MEN LOUNGE',
    colours: ['Navy Stripe', 'Mustard Check'],
    poNumber: 'PPO-04515J',
    vendorId: 'v_pesos',
    vendorName: 'Pesos Vision',
    vendorCity: 'Gurgaon',
    vendorPremise: 'Tower B, Udyog Vihar, Gurgaon',
    inspectionRequestedQtyTotal: 900,
    inspectionRequestedQtyPerColor: [
      { colour: 'Navy Stripe',   qty: 500 },
      { colour: 'Mustard Check', qty: 400 },
    ],
    packedQtyAtRequest: 900,
    poQty: 900,
    readyDate: isoOffset(5),
    scheduledDate: isoOffset(5),
    timeWindow: '10:00 – 13:00',
    location: 'Gurgaon',
    status: 'pending_confirmation',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_pesos',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(2),
    fabricType: 'woven',
    createdAt: isoToday + 'T07:30:00Z',
    updatedAt: isoToday + 'T07:30:00Z',
  },

  // ─── UNSCHEDULED ─── 2 inspections
  {
    id: 'ins_009',
    reportNumber: 'INS-BW-2605-0073-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-CAR-7704',
    styleName: 'Cargo Pants — 6 Pocket',
    fabricateCode: 'BW-1748392004445-1212',
    merchandiseCategory: '(4) MEN BOTTOMWEAR',
    colours: ['Khaki', 'Olive'],
    poNumber: 'PPO-04618K',
    vendorId: 'v_caarvi',
    vendorName: 'Caarvi Textiles',
    vendorCity: 'Delhi',
    vendorPremise: 'C-12, Naraina Industrial Area, Delhi',
    inspectionRequestedQtyTotal: 1100,
    inspectionRequestedQtyPerColor: [
      { colour: 'Khaki', qty: 700 },
      { colour: 'Olive', qty: 400 },
    ],
    packedQtyAtRequest: 1100,
    poQty: 1100,
    readyDate: isoOffset(7),
    location: 'Delhi',
    status: 'unscheduled',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_caarvi',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(1),
    fabricType: 'woven',
    notes: 'QA Manager yet to set date',
    createdAt: isoToday + 'T06:00:00Z',
    updatedAt: isoToday + 'T06:00:00Z',
  },
  {
    id: 'ins_010',
    reportNumber: 'INS-BW-2605-0075-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-SHO-1185',
    styleName: 'Boxer Briefs — 3 Pack',
    fabricateCode: 'BW-1748392004678-3434',
    merchandiseCategory: '(8) MEN INNERWEAR',
    colours: ['Multi'],
    poNumber: 'PPO-04701L',
    vendorId: 'v_aashirwad',
    vendorName: 'Aashirwad Exports',
    vendorCity: 'Noida',
    vendorPremise: 'C-119, Sector 65, Noida',
    inspectionRequestedQtyTotal: 3000,
    inspectionRequestedQtyPerColor: [{ colour: 'Multi', qty: 3000 }],
    packedQtyAtRequest: 3000,
    poQty: 3000,
    readyDate: isoOffset(6),
    location: 'Noida',
    status: 'unscheduled',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_aashirwad',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(0),
    fabricType: 'knit',
    createdAt: isoToday + 'T05:30:00Z',
    updatedAt: isoToday + 'T05:30:00Z',
  },

  // ─── COMPLETED ─── 3 inspections (mix of pass, fail)
  {
    id: 'ins_011',
    reportNumber: 'INS-BW-2605-0030-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-TSH-2210',
    styleName: 'Solid Henley Tee',
    fabricateCode: 'BW-1748391998001-5566',
    merchandiseCategory: '(3) MEN TOPWEAR',
    colours: ['Charcoal', 'Cream'],
    poNumber: 'PPO-03050A',
    vendorId: 'v_bharti',
    vendorName: 'Bharti Apparels',
    vendorCity: 'Faridabad',
    vendorPremise: 'Plot 14, Sector 25, Faridabad',
    inspectionRequestedQtyTotal: 1600,
    inspectionRequestedQtyPerColor: [
      { colour: 'Charcoal', qty: 1000 },
      { colour: 'Cream',    qty: 600 },
    ],
    packedQtyAtRequest: 1600,
    poQty: 1600,
    readyDate: isoOffset(-3),
    scheduledDate: isoOffset(-3),
    confirmedAt: isoOffset(-4) + 'T10:00:00Z',
    timeWindow: '11:00 – 14:00',
    location: 'Faridabad',
    status: 'passed',
    result: 'pass',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_bharti',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(0),
    fabricType: 'knit',
    createdAt: isoOffset(-6) + 'T10:00:00Z',
    updatedAt: isoOffset(-3) + 'T15:00:00Z',
  },
  {
    id: 'ins_012',
    reportNumber: 'INS-BW-2605-0027-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-DEN-4501',
    styleName: 'Tapered Denim — Stone Wash',
    fabricateCode: 'BW-1748391997500-7788',
    merchandiseCategory: '(4) MEN BOTTOMWEAR',
    colours: ['Stone Blue'],
    poNumber: 'PPO-03012B',
    vendorId: 'v_ids',
    vendorName: 'IDS Fashion',
    vendorCity: 'Noida',
    vendorPremise: 'D-44, Sector 63, Noida',
    inspectionRequestedQtyTotal: 480,
    inspectionRequestedQtyPerColor: [{ colour: 'Stone Blue', qty: 480 }],
    packedQtyAtRequest: 480,
    poQty: 480,
    readyDate: isoOffset(-5),
    scheduledDate: isoOffset(-5),
    confirmedAt: isoOffset(-6) + 'T11:00:00Z',
    timeWindow: '10:00 – 13:00',
    location: 'Noida',
    status: 'failed',
    result: 'fail',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_ids',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(3),
    fabricType: 'woven',
    notes: 'Stitching defects > AQL limit. Vendor to rectify and re-offer.',
    createdAt: isoOffset(-8) + 'T09:00:00Z',
    updatedAt: isoOffset(-5) + 'T14:30:00Z',
  },
  {
    id: 'ins_013',
    reportNumber: 'INS-BW-2605-0019-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-SWE-5495',
    styleName: 'Pullover Sweater — Cable Knit',
    fabricateCode: 'BW-1748391996800-9900',
    merchandiseCategory: '(7) MEN OUTERWEAR',
    colours: ['Navy', 'Wine'],
    poNumber: 'PPO-02985C',
    vendorId: 'v_div',
    vendorName: 'Div Creations',
    vendorCity: 'Faridabad',
    vendorPremise: 'Plot 88-B, Sector 31, Faridabad',
    inspectionRequestedQtyTotal: 1200,
    inspectionRequestedQtyPerColor: [
      { colour: 'Navy', qty: 700 },
      { colour: 'Wine', qty: 500 },
    ],
    packedQtyAtRequest: 1200,
    poQty: 1200,
    readyDate: isoOffset(-7),
    scheduledDate: isoOffset(-7),
    confirmedAt: isoOffset(-8) + 'T10:00:00Z',
    timeWindow: '13:00 – 16:00',
    location: 'Faridabad',
    status: 'passed',
    result: 'pass',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_div',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(2),
    fabricType: 'knit',
    createdAt: isoOffset(-10) + 'T11:00:00Z',
    updatedAt: isoOffset(-7) + 'T16:45:00Z',
  },

  // ─── MISSED / RESCHEDULED ─── 1 inspection (vendor not ready)
  {
    id: 'ins_014',
    reportNumber: 'INS-BW-2605-0038-R1',
    brandId: 'bewakoof',
    styleCode: 'BW-JCK-3380',
    styleName: 'Windcheater Jacket — Light',
    fabricateCode: 'BW-1748392000500-2211',
    merchandiseCategory: '(7) MEN OUTERWEAR',
    colours: ['Royal Blue', 'Jet Black'],
    poNumber: 'PPO-03190M',
    vendorId: 'v_swara',
    vendorName: 'Swara Creation',
    vendorCity: 'Faridabad',
    vendorPremise: 'F-77, Sector 58, Faridabad',
    inspectionRequestedQtyTotal: 900,
    inspectionRequestedQtyPerColor: [
      { colour: 'Royal Blue', qty: 540 },
      { colour: 'Jet Black',  qty: 360 },
    ],
    packedQtyAtRequest: 900,
    poQty: 900,
    readyDate: isoOffset(-1),
    scheduledDate: isoOffset(-1),
    confirmedAt: isoOffset(-3) + 'T14:00:00Z',
    timeWindow: '10:00 – 13:00',
    location: 'Faridabad',
    status: 'not_ready',
    round: 1,
    assignedInspectorId: DEMO_INSPECTOR.id,
    createdByUserId: 'v_swara',
    createdByRole: 'vendor',
    sourcingPocName: pickPoc(1),
    fabricType: 'woven',
    notes: 'Vendor was not ready on arrival — finishing line incomplete. Reschedule pending.',
    createdAt: isoOffset(-5) + 'T09:00:00Z',
    updatedAt: isoOffset(-1) + 'T11:20:00Z',
  },
]

// ─── Selectors ────────────────────────────────────────────────────────────────

export function getInspectionById(id: string): InspectionRequest | undefined {
  return demoInspections.find(r => r.id === id)
}

export function getInspectionsForTab(
  tab: ScheduleTab,
  inspectorId: string = DEMO_INSPECTOR.id,
): InspectionRequest[] {
  return demoInspections
    .filter(r => r.assignedInspectorId === inspectorId)
    .filter(r => classifyTab(r) === tab)
    .sort((a, b) => {
      // For upcoming: ascending scheduled date
      // For completed/missed: descending updated date
      if (tab === 'completed' || tab === 'missed') {
        return b.updatedAt.localeCompare(a.updatedAt)
      }
      const ad = a.scheduledDate || a.readyDate
      const bd = b.scheduledDate || b.readyDate
      return ad.localeCompare(bd)
    })
}

export function getTabCounts(inspectorId: string = DEMO_INSPECTOR.id): Record<ScheduleTab, number> {
  const mine = demoInspections.filter(r => r.assignedInspectorId === inspectorId)
  return {
    today:                mine.filter(r => classifyTab(r) === 'today').length,
    upcoming:             mine.filter(r => classifyTab(r) === 'upcoming').length,
    pending_confirmation: mine.filter(r => classifyTab(r) === 'pending_confirmation').length,
    unscheduled:          mine.filter(r => classifyTab(r) === 'unscheduled').length,
    completed:            mine.filter(r => classifyTab(r) === 'completed').length,
    missed:               mine.filter(r => classifyTab(r) === 'missed').length,
  }
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const TAB_LABELS: Record<ScheduleTab, string> = {
  today:                'Today',
  upcoming:             'Upcoming',
  pending_confirmation: 'Pending Confirmation',
  unscheduled:          'Unscheduled',
  completed:            'Completed',
  missed:               'Missed / Rescheduled',
}

export function formatScheduledDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
}

export function relativeDate(iso?: string): string {
  if (!iso) return ''
  if (iso === isoToday) return 'Today'
  const today = new Date(isoToday + 'T00:00:00Z').getTime()
  const target = new Date(iso + 'T00:00:00Z').getTime()
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1) return `in ${diff} days`
  if (diff < -1) return `${Math.abs(diff)} days ago`
  return ''
}

export { isoToday }
