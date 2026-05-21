'use client'
import { useState, useRef, useCallback, useEffect, Suspense, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Upload, Download, Plus, Trash2, Eye, EyeOff, CheckCircle2,
  FileSpreadsheet, ChevronRight, Clock, AlertCircle, X,
  Search, ArrowLeft, Send, RotateCcw, Pencil, Check,
  GitMerge, Users, ShoppingBag, UserCheck,
  Filter, MoreHorizontal, ChevronDown, Tag, Info,
  ExternalLink, FileText,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'
import { useCurrentUser, type UserRole } from '@/lib/user-context'
import {
  type GridStatus,
  GRID_STATUS_LABELS,
  GRID_STATUS_BADGE_CLASSES,
} from '@/lib/grid-status'
import { parseExcelFile, buildTemplateCsv, type ExcelParseResult } from '@/lib/grid-excel'
import {
  validateGridImport,
  type FieldIssue,
  type RowValidation,
  type GridImportSummary,
  type ValidatableRow,
} from '@/lib/grid-validation'
import { UploadDropzone, ValidationPreview } from '@/components/order-management/GridImportFlow'
import { NotificationCenter } from '@/components/order-management/NotificationCenter'
import {
  suggestAssignments, computeWorkload, DEFAULT_SUGGEST_RULES,
} from '@/lib/assignment-rules'
import {
  GridStoreProvider,
  useGridStore,
  type OrderGridRecord,
  type AssignStyle,
  type AssignGrid,
} from '@/lib/grid-store'
import { validateForSubmission } from '@/lib/grid-validation'

// ─── Shared types (kept local to the page) ──────────────────────────────────
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
  activeSizes: string
  sizeRatio: string
  orderQty: string
  mrp: string
  targetPrice: string
  whBhw: string
  whDel: string
  whBlr: string
  handoverDate: string             // Buying's internal sourcing deadline
  buyingExpectedInwardDate: string // OTIF target — when goods land at WH
  tier: string                     // HERO / TIER-1 / TIER-2 / TAIL (optional)
  techPack: string                 // Google Drive URL — mandatory at upload
  designer: string
  notes: string
}

type OnBehalfData = {
  type: 'self' | 'buying'
  buyingPerson: string
  notes: string
}

// ─── Options ──────────────────────────────────────────────────────────────────
const GENDER_OPTIONS    = ['BOYS','GIRLS','UNISEX','MEN','WOMEN','INFANTS','KIDS']
const PRODUCT_OPTIONS   = ['OUTER_WEAR','TOP_WEAR','BOTTOM_WEAR','CLOTHING_SET','WINTER_WEAR','INNERWEAR','ACCESSORIES']
const TYPE_OPTIONS      = ['JACKETS','T-SHIRTS','SHIRTS','SWEATSHIRTS','HOODIES','TROUSERS','JEANS','SHORTS','DRESSES','LEGGINGS','SETS']
const SUBTYPE_OPTIONS   = ['JACKET','BLAZER','DENIM JACKET','PU JACKET','SHACKET','SHRUG','WAISTCOAT','WIND CHEATERS','TRUCKER JACKET']
const SEASON_OPTIONS    = ['AW 26','SS 26','SS 27','AW 27']
const DROP_OPTIONS      = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
const FABRIC_OPTIONS    = ['POLYESTER','COTTON','COTTON BLEND','RAYON','MODAL','NYLON','POLY VISCOSE','POLYCOTTON','DENIM','FLEECE','TERRY']
const AGE_OPTIONS       = ['3M-2Y','2-8Y','2-10Y','0-2Y','4-8Y','1-5Y','NA']
const COLOR_OPTIONS     = ['RED','BLUE','BLACK','WHITE','GREEN','YELLOW','ORANGE','PINK','PURPLE','NAVY','GREY','BROWN','MULTICOLOUR','OFF WHITE','CREAM','OLIVE','MAROON','TEAL','CORAL','MINT']
const DESIGNER_OPTIONS  = ['SUBASHREE','PRIYA M','MEGHA S','RAHUL K','ANANYA B']
const TIER_OPTIONS      = ['HERO','TIER-1','TIER-2','TAIL']
const BUYING_PERSONS    = ['Priya Sharma','Neha Gupta','Ananya Joshi','Pooja Mehta']
const SOURCING_POCS     = ['Parthipan Kumar', 'Rajesh Menon', 'Kavitha Menon']

const STYLE_CODES = [
  'NNNBOW00740','NNNBOW00741','NNNBOW00742','NNNBOW00743',
  'NNNGOW00744','NNNGOW00745','NNNGOW00746','NNNGOW00747',
  'NNIBOW00748','NNIBOW00749','NNIBOW00750','NNIBOW00751',
  'NNIGOW00752','NNIGOW00753','NNKNTW250001','NNKNTW250002',
  'NNKNTW250003','NNKNTW250004','NNKNTW250005',
]

// ─── Mock data ────────────────────────────────────────────────────────────────
// Initial OrderGridRecord seed lives in `lib/grid-store.ts` so it can be shared
// across tabs. The big AssignGrid fixture below stays here only because
// inlining it into the lib would balloon that module — it's passed into the
// provider as `seedAssignGrids`.

const MOCK_ASSIGN_GRIDS: AssignGrid[] = [
  {
    id:'og1', name:'NN AW26 Outer Wear Batch 1', source:'buying', createdBy:'Priya Sharma', onBehalfOf:'', date:'26 Feb 2026',
    styles: [
      { id:'og1-s1',  styleCode:'NNNBOW00740', styleName:'RED DISNEY CARS PRINTED PUFFER JACKET WITH HOOD',                qty:400, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'RED',      season:'AW 26', drop:'JULY',   mrp:1299, targetPrice:390 },
      { id:'og1-s2',  styleCode:'NNNBOW00741', styleName:'BLUE OMBRE COLORBLOCK PUFFER JACKET WITH HOOD',                  qty:400, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'BLUE',     season:'AW 26', drop:'JULY',   mrp:1299, targetPrice:390 },
      { id:'og1-s3',  styleCode:'NNNBOW00742', styleName:'BLACK AND YELLOW COLOURBLOCK PUFFER JACKET WITH HOOD',           qty:400, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'BLACK',    season:'AW 26', drop:'JULY',   mrp:1299, targetPrice:390 },
      { id:'og1-s4',  styleCode:'NNNBOW00743', styleName:'GREEN CAMOUFLAGE PRINTED PUFFER JACKET WITH HOOD',               qty:400, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'GREEN',    season:'AW 26', drop:'JULY',   mrp:1299, targetPrice:390 },
      { id:'og1-s5',  styleCode:'NNNGOW00744', styleName:'YELLOW MINNIE POLKA PRINTED PUFFER JACKET WITH DETACHABLE HOOD', qty:400, gender:'GIRLS', assignedTo:'Rajesh Menon',    productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'YELLOW',   season:'AW 26', drop:'JULY',   mrp:1499, targetPrice:450 },
      { id:'og1-s6',  styleCode:'NNNGOW00745', styleName:'PINK FLORAL EMBROIDERED PUFFER JACKET WITH HOOD',                qty:400, gender:'GIRLS', assignedTo:'Rajesh Menon',    productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'PINK',     season:'AW 26', drop:'JULY',   mrp:1499, targetPrice:450 },
      { id:'og1-s7',  styleCode:'NNNGOW00746', styleName:'PURPLE UNICORN PRINTED PUFFER JACKET WITH DETACHABLE HOOD',      qty:400, gender:'GIRLS', assignedTo:'Rajesh Menon',    productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'PURPLE',   season:'AW 26', drop:'JULY',   mrp:1499, targetPrice:450 },
      { id:'og1-s8',  styleCode:'NNNGOW00747', styleName:'RED HEART PRINT QUILTED JACKET',                                 qty:350, gender:'GIRLS', assignedTo:'Rajesh Menon',    productGroup:'OUTER_WEAR', type:'JACKETS', subType:'SHRUG',        fabric:'POLYESTER', ageGroup:'4-8Y',  colorFamily:'RED',      season:'AW 26', drop:'AUGUST', mrp:1199, targetPrice:360 },
      { id:'og1-s9',  styleCode:'NNIBOW00748', styleName:'BLUE AND GREEN COLOURBLOCK PUFFER JACKET',                       qty:400, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'BLUE',     season:'AW 26', drop:'AUGUST', mrp:1199, targetPrice:360 },
      { id:'og1-s10', styleCode:'NNIBOW00749', styleName:'NAVY BEAR APPLIQUE PUFFER JACKET',                               qty:400, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'NAVY',     season:'AW 26', drop:'AUGUST', mrp:1199, targetPrice:360 },
      { id:'og1-s11', styleCode:'NNIGOW00752', styleName:'ORANGE PET DOG PRINTED PUFFER JACKET',                           qty:400, gender:'GIRLS', assignedTo:'Kavitha Menon',   productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET',       fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'ORANGE',   season:'AW 26', drop:'AUGUST', mrp:1199, targetPrice:360 },
      { id:'og1-s12', styleCode:'NNIGOW00753', styleName:'LAVENDER BUTTERFLY QUILTED JACKET',                              qty:350, gender:'GIRLS', assignedTo:'Kavitha Menon',   productGroup:'OUTER_WEAR', type:'JACKETS', subType:'SHRUG',        fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'LAVENDER', season:'AW 26', drop:'AUGUST', mrp:1099, targetPrice:330 },
    ],
  },
  {
    id:'og2', name:'NN SS26 Knits Batch 2', source:'sourcing', createdBy:'Parthipan Kumar', onBehalfOf:'', date:'18 Feb 2026',
    styles: [
      { id:'og2-s1',  styleCode:'NNKNTW250001', styleName:'WHITE POLO T-SHIRT WITH TIPPING',               qty:500, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'POLO',          fabric:'COTTON',      ageGroup:'2-8Y',  colorFamily:'WHITE',   season:'SS 26', drop:'FEBRUARY', mrp:599,  targetPrice:180 },
      { id:'og2-s2',  styleCode:'NNKNTW250002', styleName:'NAVY STRIPE POLO T-SHIRT',                      qty:500, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'POLO',          fabric:'COTTON',      ageGroup:'2-8Y',  colorFamily:'NAVY',    season:'SS 26', drop:'FEBRUARY', mrp:599,  targetPrice:180 },
      { id:'og2-s3',  styleCode:'NNKNTW250003', styleName:'RED GRAPHIC PRINT ROUND NECK T-SHIRT',          qty:450, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'ROUND NECK',    fabric:'COTTON',      ageGroup:'2-8Y',  colorFamily:'RED',     season:'SS 26', drop:'MARCH',    mrp:499,  targetPrice:150 },
      { id:'og2-s4',  styleCode:'NNKNTW250004', styleName:'OLIVE SOLID PIQUE POLO T-SHIRT',                qty:400, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'POLO',          fabric:'COTTON',      ageGroup:'4-8Y',  colorFamily:'OLIVE',   season:'SS 26', drop:'MARCH',    mrp:649,  targetPrice:195 },
      { id:'og2-s5',  styleCode:'NNKNTW250005', styleName:'GREY MELANGE SWEATSHIRT WITH KANGAROO POCKET',  qty:350, gender:'BOYS',  assignedTo:'Rajesh Menon',    productGroup:'TOP_WEAR',    type:'SWEATSHIRTS',  subType:'HOODED',        fabric:'COTTON BLEND',ageGroup:'4-8Y',  colorFamily:'GREY',    season:'SS 26', drop:'APRIL',    mrp:899,  targetPrice:270 },
      { id:'og2-s6',  styleCode:'NNKNTW250006', styleName:'PINK SOLID ROUND NECK T-SHIRT',                 qty:500, gender:'GIRLS', assignedTo:'Kavitha Menon',   productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'ROUND NECK',    fabric:'COTTON',      ageGroup:'2-8Y',  colorFamily:'PINK',    season:'SS 26', drop:'FEBRUARY', mrp:499,  targetPrice:150 },
      { id:'og2-s7',  styleCode:'NNKNTW250007', styleName:'YELLOW FLORAL PRINT ROUND NECK TOP',            qty:450, gender:'GIRLS', assignedTo:'Kavitha Menon',   productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'ROUND NECK',    fabric:'RAYON',       ageGroup:'2-8Y',  colorFamily:'YELLOW',  season:'SS 26', drop:'FEBRUARY', mrp:549,  targetPrice:165 },
      { id:'og2-s8',  styleCode:'NNKNTW250008', styleName:'LAVENDER PUFF SLEEVE CROP TOP',                 qty:400, gender:'GIRLS', assignedTo:'Kavitha Menon',   productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'CROP TOP',      fabric:'COTTON',      ageGroup:'4-8Y',  colorFamily:'LAVENDER',season:'SS 26', drop:'MARCH',    mrp:649,  targetPrice:195 },
      { id:'og2-s9',  styleCode:'NNKNTW250009', styleName:'WHITE BRODERIE ANGLAISE TOP',                   qty:400, gender:'GIRLS', assignedTo:'Kavitha Menon',   productGroup:'TOP_WEAR',    type:'T-SHIRTS',     subType:'ROUND NECK',    fabric:'COTTON',      ageGroup:'4-8Y',  colorFamily:'WHITE',   season:'SS 26', drop:'MARCH',    mrp:699,  targetPrice:210 },
      { id:'og2-s10', styleCode:'NNKNTW250010', styleName:'MINT GREEN SOLID SWEATSHIRT WITH HOOD',         qty:350, gender:'GIRLS', assignedTo:'Rajesh Menon',    productGroup:'TOP_WEAR',    type:'SWEATSHIRTS',  subType:'HOODED',        fabric:'COTTON BLEND',ageGroup:'4-8Y',  colorFamily:'MINT',    season:'SS 26', drop:'APRIL',    mrp:899,  targetPrice:270 },
    ],
  },
  {
    id:'og4', name:'NN AW26 Infants Range', source:'buying', createdBy:'Ananya Joshi', onBehalfOf:'', date:'03 Feb 2026',
    styles: [
      { id:'s1', styleCode:'NNIBOW00748', styleName:'BLUE AND GREEN COLOURBLOCK PUFFER JACKET', qty:400, gender:'BOYS',  assignedTo:'', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'BLUE',   season:'AW 26', drop:'JULY',   mrp:1199, targetPrice:360 },
      { id:'s2', styleCode:'NNIBOW00749', styleName:'NAVY BEAR APPLIQUE PUFFER JACKET',          qty:400, gender:'BOYS',  assignedTo:'', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'NAVY',   season:'AW 26', drop:'JULY',   mrp:1199, targetPrice:360 },
      { id:'s3', styleCode:'NNIBOW00750', styleName:'RED MICKEY MOUSE PRINTED PUFFER JACKET',    qty:400, gender:'BOYS',  assignedTo:'', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'RED',    season:'AW 26', drop:'AUGUST', mrp:1199, targetPrice:360 },
      { id:'s4', styleCode:'NNIBOW00751', styleName:'GREEN SNOWMAN PRINTED PUFFER JACKET',       qty:400, gender:'BOYS',  assignedTo:'', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'GREEN',  season:'AW 26', drop:'AUGUST', mrp:1199, targetPrice:360 },
      { id:'s5', styleCode:'NNIGOW00752', styleName:'ORANGE PET DOG PRINTED PUFFER JACKET',      qty:400, gender:'GIRLS', assignedTo:'', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'ORANGE', season:'AW 26', drop:'AUGUST', mrp:1199, targetPrice:360 },
    ],
  },
  {
    id:'og3', name:'NN SS26 Woven Bottoms', source:'sourcing', createdBy:'Parthipan Kumar', onBehalfOf:'Neha Gupta', date:'10 Feb 2026',
    styles: [
      { id:'s6',  styleCode:'NNKNTW250001', styleName:'NAVY CHINO TROUSERS',       qty:300, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'BOTTOM_WEAR', type:'TROUSERS', subType:'CHINO',   fabric:'COTTON',       ageGroup:'2-8Y',  colorFamily:'NAVY',  season:'SS 26', drop:'FEBRUARY', mrp:799, targetPrice:240 },
      { id:'s7',  styleCode:'NNKNTW250002', styleName:'KHAKI CARGO JOGGERS',       qty:250, gender:'BOYS',  assignedTo:'Parthipan Kumar', productGroup:'BOTTOM_WEAR', type:'TROUSERS', subType:'CARGO',   fabric:'COTTON BLEND', ageGroup:'2-8Y',  colorFamily:'KHAKI', season:'SS 26', drop:'FEBRUARY', mrp:849, targetPrice:255 },
      { id:'s8',  styleCode:'NNKNTW250003', styleName:'WHITE LINEN SHORTS',        qty:200, gender:'BOYS',  assignedTo:'',                productGroup:'BOTTOM_WEAR', type:'SHORTS',   subType:'REGULAR', fabric:'COTTON',       ageGroup:'4-8Y',  colorFamily:'WHITE', season:'SS 26', drop:'MARCH',    mrp:599, targetPrice:180 },
      { id:'s9',  styleCode:'NNKNTW250004', styleName:'PINK FLORAL PALAZZO PANTS', qty:300, gender:'GIRLS', assignedTo:'',                productGroup:'BOTTOM_WEAR', type:'TROUSERS', subType:'PALAZZO', fabric:'RAYON',        ageGroup:'4-8Y',  colorFamily:'PINK',  season:'SS 26', drop:'MARCH',    mrp:699, targetPrice:210 },
      { id:'s10', styleCode:'NNKNTW250005', styleName:'BLUE DENIM SKIRT',          qty:250, gender:'GIRLS', assignedTo:'',                productGroup:'BOTTOM_WEAR', type:'TROUSERS', subType:'SKIRT',   fabric:'DENIM',        ageGroup:'4-8Y',  colorFamily:'BLUE',  season:'SS 26', drop:'APRIL',    mrp:799, targetPrice:240 },
    ],
  },
  {
    id:'og5', name:'NN SS26 Girls Dresses Draft', source:'sourcing', createdBy:'Rajesh Menon', onBehalfOf:'', date:'28 Jan 2026',
    styles: [
      { id:'og5-s1', styleCode:'NNNGOW00801', styleName:'PINK FLORAL SMOCK DRESS',             qty:300, gender:'GIRLS', assignedTo:'Rajesh Menon',  productGroup:'CLOTHING_SET', type:'DRESSES', subType:'SMOCK',   fabric:'COTTON',  ageGroup:'2-8Y', colorFamily:'PINK',    season:'SS 26', drop:'FEBRUARY', mrp:999,  targetPrice:300 },
      { id:'og5-s2', styleCode:'NNNGOW00802', styleName:'WHITE BRODERIE ANGLAISE DRESS',       qty:300, gender:'GIRLS', assignedTo:'Rajesh Menon',  productGroup:'CLOTHING_SET', type:'DRESSES', subType:'REGULAR', fabric:'COTTON',  ageGroup:'2-8Y', colorFamily:'WHITE',   season:'SS 26', drop:'FEBRUARY', mrp:1099, targetPrice:330 },
      { id:'og5-s3', styleCode:'NNNGOW00803', styleName:'YELLOW PRINTED TIERED MIDI DRESS',    qty:250, gender:'GIRLS', assignedTo:'Rajesh Menon',  productGroup:'CLOTHING_SET', type:'DRESSES', subType:'MIDI',    fabric:'RAYON',   ageGroup:'4-8Y', colorFamily:'YELLOW',  season:'SS 26', drop:'MARCH',    mrp:1199, targetPrice:360 },
      { id:'og5-s4', styleCode:'NNNGOW00804', styleName:'LAVENDER TIE-DYE SHIRT DRESS',        qty:250, gender:'GIRLS', assignedTo:'Kavitha Menon', productGroup:'CLOTHING_SET', type:'DRESSES', subType:'SHIRT',   fabric:'COTTON',  ageGroup:'4-8Y', colorFamily:'LAVENDER',season:'SS 26', drop:'MARCH',    mrp:1099, targetPrice:330 },
      { id:'og5-s5', styleCode:'NNNGOW00805', styleName:'BLUE DENIM PINAFORE DRESS',           qty:300, gender:'GIRLS', assignedTo:'Kavitha Menon', productGroup:'CLOTHING_SET', type:'DRESSES', subType:'PINAFORE',fabric:'DENIM',   ageGroup:'4-8Y', colorFamily:'BLUE',    season:'SS 26', drop:'MARCH',    mrp:1299, targetPrice:390 },
      { id:'og5-s6', styleCode:'NNNGOW00806', styleName:'RED POLKA DOT WRAP DRESS',            qty:250, gender:'GIRLS', assignedTo:'',              productGroup:'CLOTHING_SET', type:'DRESSES', subType:'WRAP',    fabric:'RAYON',   ageGroup:'2-8Y', colorFamily:'RED',     season:'SS 26', drop:'APRIL',    mrp:999,  targetPrice:300 },
      { id:'og5-s7', styleCode:'NNNGOW00807', styleName:'GREEN ABSTRACT PRINT SKATER DRESS',   qty:250, gender:'GIRLS', assignedTo:'',              productGroup:'CLOTHING_SET', type:'DRESSES', subType:'SKATER',  fabric:'COTTON',  ageGroup:'2-8Y', colorFamily:'GREEN',   season:'SS 26', drop:'APRIL',    mrp:999,  targetPrice:300 },
      { id:'og5-s8', styleCode:'NNNGOW00808', styleName:'CORAL SOLID SLEEVELESS MIDI DRESS',   qty:200, gender:'GIRLS', assignedTo:'',              productGroup:'CLOTHING_SET', type:'DRESSES', subType:'MIDI',    fabric:'MODAL',   ageGroup:'4-8Y', colorFamily:'CORAL',   season:'SS 26', drop:'APRIL',    mrp:1099, targetPrice:330 },
      { id:'og5-s9', styleCode:'NNNGOW00809', styleName:'NAVY STRIPE SHIRT DRESS WITH BELT',   qty:200, gender:'GIRLS', assignedTo:'',              productGroup:'CLOTHING_SET', type:'DRESSES', subType:'SHIRT',   fabric:'COTTON',  ageGroup:'4-8Y', colorFamily:'NAVY',    season:'SS 26', drop:'MAY',      mrp:1199, targetPrice:360 },
    ],
  },
  {
    id:'og6', name:'NN AW26 Boys Basics', source:'sourcing', createdBy:'Sahil Sharma', onBehalfOf:'', date:'01 May 2026',
    styles: [
      { id:'og6-s1',  styleCode:'NNNBOW00901', styleName:'WHITE SOLID ROUND NECK T-SHIRT',         qty:600, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'T-SHIRTS',    subType:'ROUND NECK', fabric:'COTTON',       ageGroup:'2-8Y',  colorFamily:'WHITE', season:'AW 26', drop:'JULY',   mrp:449, targetPrice:135 },
      { id:'og6-s2',  styleCode:'NNNBOW00902', styleName:'BLACK SOLID ROUND NECK T-SHIRT',         qty:600, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'T-SHIRTS',    subType:'ROUND NECK', fabric:'COTTON',       ageGroup:'2-8Y',  colorFamily:'BLACK', season:'AW 26', drop:'JULY',   mrp:449, targetPrice:135 },
      { id:'og6-s3',  styleCode:'NNNBOW00903', styleName:'NAVY SOLID ROUND NECK T-SHIRT',          qty:600, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'T-SHIRTS',    subType:'ROUND NECK', fabric:'COTTON',       ageGroup:'2-8Y',  colorFamily:'NAVY',  season:'AW 26', drop:'JULY',   mrp:449, targetPrice:135 },
      { id:'og6-s4',  styleCode:'NNNBOW00904', styleName:'GREY MELANGE SOLID T-SHIRT',             qty:500, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'T-SHIRTS',    subType:'ROUND NECK', fabric:'COTTON BLEND', ageGroup:'2-8Y',  colorFamily:'GREY',  season:'AW 26', drop:'AUGUST', mrp:499, targetPrice:150 },
      { id:'og6-s5',  styleCode:'NNNBOW00905', styleName:'OLIVE GREEN SOLID POLO T-SHIRT',         qty:400, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'T-SHIRTS',    subType:'POLO',       fabric:'COTTON',       ageGroup:'4-8Y',  colorFamily:'OLIVE', season:'AW 26', drop:'AUGUST', mrp:599, targetPrice:180 },
      { id:'og6-s6',  styleCode:'NNNBOW00906', styleName:'WHITE AND NAVY STRIPE T-SHIRT',           qty:400, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'T-SHIRTS',    subType:'ROUND NECK', fabric:'COTTON',       ageGroup:'4-8Y',  colorFamily:'WHITE', season:'AW 26', drop:'AUGUST', mrp:499, targetPrice:150 },
      { id:'og6-s7',  styleCode:'NNNBOW00907', styleName:'GREY SOLID FLEECE SWEATSHIRT',           qty:350, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'SWEATSHIRTS', subType:'REGULAR',    fabric:'COTTON BLEND', ageGroup:'2-8Y',  colorFamily:'GREY',  season:'AW 26', drop:'JULY',   mrp:799, targetPrice:240 },
      { id:'og6-s8',  styleCode:'NNNBOW00908', styleName:'NAVY SOLID FLEECE SWEATSHIRT',           qty:350, gender:'BOYS', assignedTo:'', productGroup:'TOP_WEAR',    type:'SWEATSHIRTS', subType:'REGULAR',    fabric:'COTTON BLEND', ageGroup:'2-8Y',  colorFamily:'NAVY',  season:'AW 26', drop:'JULY',   mrp:799, targetPrice:240 },
      { id:'og6-s9',  styleCode:'NNNBOW00909', styleName:'BLACK SOLID FLEECE JOGGERS',             qty:400, gender:'BOYS', assignedTo:'', productGroup:'BOTTOM_WEAR', type:'TROUSERS',    subType:'JOGGERS',    fabric:'COTTON BLEND', ageGroup:'2-8Y',  colorFamily:'BLACK', season:'AW 26', drop:'JULY',   mrp:699, targetPrice:210 },
      { id:'og6-s10', styleCode:'NNNBOW00910', styleName:'GREY SOLID FLEECE JOGGERS',              qty:400, gender:'BOYS', assignedTo:'', productGroup:'BOTTOM_WEAR', type:'TROUSERS',    subType:'JOGGERS',    fabric:'COTTON BLEND', ageGroup:'2-8Y',  colorFamily:'GREY',  season:'AW 26', drop:'JULY',   mrp:699, targetPrice:210 },
      { id:'og6-s11', styleCode:'NNNBOW00911', styleName:'NAVY CARGO JOGGERS WITH DRAWSTRING',     qty:300, gender:'BOYS', assignedTo:'', productGroup:'BOTTOM_WEAR', type:'TROUSERS',    subType:'CARGO',      fabric:'COTTON BLEND', ageGroup:'4-8Y',  colorFamily:'NAVY',  season:'AW 26', drop:'AUGUST', mrp:749, targetPrice:225 },
      { id:'og6-s12', styleCode:'NNNBOW00912', styleName:'OLIVE CARGO SHORTS WITH SIDE POCKETS',   qty:300, gender:'BOYS', assignedTo:'', productGroup:'BOTTOM_WEAR', type:'SHORTS',      subType:'CARGO',      fabric:'COTTON',       ageGroup:'4-8Y',  colorFamily:'OLIVE', season:'AW 26', drop:'AUGUST', mrp:649, targetPrice:195 },
    ],
  },
]

const EMPTY_ROW = (): GridRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
  disabled: false,
  styleCode:'', styleName:'', gender:'', productGroup:'', type:'', subType:'',
  season:'AW 26', drop:'JULY', fabric:'', ageGroup:'', colorFamily:'',
  activeSizes:'', sizeRatio:'', orderQty:'', mrp:'', targetPrice:'',
  whBhw:'', whDel:'', whBlr:'',
  handoverDate:'', buyingExpectedInwardDate:'', tier:'', techPack:'',
  designer:'', notes:'',
})

const SAMPLE_IMPORT: GridRow[] = [
  { id:'r1', disabled:false, styleCode:'NNNBOW00740', styleName:'RED DISNEY CARS PRINTED PUFFER JACKET WITH HOOD',                gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'RED',    activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1299', targetPrice:'390', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', buyingExpectedInwardDate:'15/06/2026', tier:'TIER-1', techPack:'https://drive.google.com/file/d/sample-techpack/view', designer:'SUBASHREE', notes:'' },
  { id:'r2', disabled:false, styleCode:'NNNBOW00741', styleName:'BLUE OMBRE COLORBLOCK PUFFER JACKET WITH HOOD',                 gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'BLUE',   activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1299', targetPrice:'390', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', buyingExpectedInwardDate:'15/06/2026', tier:'TIER-1', techPack:'https://drive.google.com/file/d/sample-techpack/view', designer:'SUBASHREE', notes:'' },
  { id:'r3', disabled:false, styleCode:'NNNBOW00742', styleName:'BLACK AND YELLOW COLOURBLOCK PUFFER JACKET WITH HOOD',          gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'BLACK',  activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1299', targetPrice:'390', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', buyingExpectedInwardDate:'15/06/2026', tier:'TIER-1', techPack:'https://drive.google.com/file/d/sample-techpack/view', designer:'SUBASHREE', notes:'' },
  { id:'r4', disabled:false, styleCode:'NNNGOW00744', styleName:'YELLOW MINNIE POLKA PRINTED PUFFER JACKET WITH DETACHABLE HOOD', gender:'GIRLS', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'YELLOW', activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1499', targetPrice:'450', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', buyingExpectedInwardDate:'15/06/2026', tier:'TIER-1', techPack:'https://drive.google.com/file/d/sample-techpack/view', designer:'SUBASHREE', notes:'' },
  { id:'r5', disabled:false, styleCode:'NNIBOW00748', styleName:'BLUE AND GREEN COLOURBLOCK PUFFER JACKET WITH HOOD',            gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'BLUE',   activeSizes:'3-6M;6-9M;9-12M;12-18M;18-24M',  sizeRatio:'2:2:3:3:3',     orderQty:'400', mrp:'1199', targetPrice:'360', whBhw:'180', whDel:'140', whBlr:'80', handoverDate:'25/02/2026', buyingExpectedInwardDate:'15/06/2026', tier:'TIER-1', techPack:'https://drive.google.com/file/d/sample-techpack/view', designer:'SUBASHREE', notes:'' },
]

// ─── Inline editable Cell ─────────────────────────────────────────────────────
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

function Cell({ value, onChange, type='text', options, rowDisabled, placeholder, align='left', className }: CellProps) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null)
  const start = () => { if (!rowDisabled) { setEditing(true); setTimeout(() => ref.current?.focus(), 0) } }
  const done  = () => setEditing(false)
  const base  = cn('border-r border-slate-100 text-xs', rowDisabled && 'opacity-40 bg-slate-50/60', className)

  if (editing && !rowDisabled) {
    return (
      <td className={base}>
        {type === 'select' && options ? (
          <select ref={ref} value={value} autoFocus onChange={e => { onChange(e.target.value); done() }} onBlur={done}
            className="w-full px-2 py-1.5 text-xs bg-violet-50 border-b-2 border-violet-500 outline-none">
            <option value="">—</option>
            {options.map(o => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <input ref={ref} type={type === 'number' ? 'number' : 'text'} value={value} autoFocus
            onChange={e => onChange(e.target.value)} onBlur={done}
            onKeyDown={e => (e.key==='Enter'||e.key==='Tab') && done()}
            placeholder={placeholder}
            className={cn('w-full px-2.5 py-1.5 text-xs bg-violet-50 border-b-2 border-violet-500 outline-none', align==='right' && 'text-right')}
          />
        )}
      </td>
    )
  }
  return (
    <td className={cn(base, !rowDisabled && 'cursor-cell hover:bg-violet-50/40 group')} onClick={start}>
      <div className={cn('px-2.5 py-1.5 min-h-[30px] flex items-center gap-1', align==='right' && 'justify-end', rowDisabled && 'line-through')}>
        {value ? <span className="truncate">{value}</span> : <span className="text-slate-300">{placeholder||'—'}</span>}
        {value && !rowDisabled && <Pencil className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />}
      </div>
    </td>
  )
}

// Combobox cell for style code (searchable dropdown)
function ComboCell({ value, onChange, options, rowDisabled, className }: {
  value: string; onChange: (v: string) => void
  options: string[]; rowDisabled?: boolean; className?: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0,12)

  if (rowDisabled) {
    return (
      <td className={cn('border-r border-slate-100 text-xs opacity-40 bg-slate-50/60', className)}>
        <div className="px-2.5 py-1.5 min-h-[30px] flex items-center font-mono font-semibold text-violet-700 line-through text-xs">
          {value || <span className="text-slate-300 font-sans font-normal">—</span>}
        </div>
      </td>
    )
  }

  return (
    <td className={cn('border-r border-slate-100 text-xs relative', className)} onClick={() => { setOpen(true); setQuery(''); setTimeout(() => ref.current?.focus(), 0) }}>
      {open ? (
        <div className="relative">
          <input
            ref={ref}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={value || 'Search code…'}
            className="w-full px-2.5 py-1.5 text-xs bg-violet-50 border-b-2 border-violet-500 outline-none font-mono"
          />
          {filtered.length > 0 && (
            <div className="absolute top-full left-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[180px] max-h-40 overflow-y-auto">
              {filtered.map(o => (
                <button key={o} onMouseDown={() => { onChange(o); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs font-mono text-violet-700 hover:bg-violet-50">
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-2.5 py-1.5 min-h-[30px] flex items-center gap-1 cursor-cell hover:bg-violet-50/40 group">
          {value
            ? <span className="font-mono font-semibold text-violet-700 truncate">{value}</span>
            : <span className="text-slate-300 font-sans">—</span>
          }
          <ChevronDown className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-auto" />
        </div>
      )}
    </td>
  )
}

// ─── Link cell (URL input that renders as a clickable icon link) ─────────────
function LinkCell({ value, onChange, rowDisabled, placeholder, className }: {
  value: string; onChange: (v: string) => void
  rowDisabled?: boolean; placeholder?: string; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const start = () => { if (!rowDisabled) { setEditing(true); setTimeout(() => ref.current?.focus(), 0) } }
  const done  = () => setEditing(false)
  const base  = cn('border-r border-slate-100 text-xs', rowDisabled && 'opacity-40 bg-slate-50/60', className)
  const isUrl = value && /^https?:\/\//i.test(value)

  if (editing && !rowDisabled) {
    return (
      <td className={base}>
        <input ref={ref} type="url" value={value} autoFocus
          onChange={e => onChange(e.target.value)} onBlur={done}
          onKeyDown={e => (e.key==='Enter'||e.key==='Tab') && done()}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-xs bg-violet-50 border-b-2 border-violet-500 outline-none"
        />
      </td>
    )
  }
  return (
    <td className={cn(base, !rowDisabled && 'group')}>
      <div className="px-2.5 py-1.5 min-h-[30px] flex items-center gap-1.5">
        {isUrl ? (
          <>
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-violet-600 hover:text-violet-800 font-medium truncate"
              title={value}>
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">View</span>
              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
            </a>
            <button onClick={start} className="ml-auto p-0.5 rounded text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100"
              title="Edit link">
              <Pencil className="w-2.5 h-2.5" />
            </button>
          </>
        ) : (
          <button onClick={start} disabled={rowDisabled}
            className={cn('flex items-center gap-1 text-slate-300 hover:text-violet-600', rowDisabled && 'cursor-not-allowed')}>
            <Plus className="w-2.5 h-2.5" />
            <span className="text-[11px]">{placeholder || 'Add link'}</span>
          </button>
        )}
      </div>
    </td>
  )
}

// ─── Status badge helpers ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: GridStatus }) {
  const map = GRID_STATUS_BADGE_CLASSES
  const labels = GRID_STATUS_LABELS
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', map[status])}>
      {labels[status]}
    </span>
  )
}

// ─── POC avatar stack — used in the Order Grid list (Phase D) ──────────────
const POC_PALETTE = [
  { bg: 'bg-violet-100',  fg: 'text-violet-700'  },
  { bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { bg: 'bg-amber-100',   fg: 'text-amber-700'   },
  { bg: 'bg-blue-100',    fg: 'text-blue-700'    },
  { bg: 'bg-pink-100',    fg: 'text-pink-700'    },
  { bg: 'bg-orange-100',  fg: 'text-orange-700'  },
]
function pocColor(name: string) {
  // Stable per-name colour using a simple hash.
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return POC_PALETTE[Math.abs(h) % POC_PALETTE.length]
}
function pocInitials(name: string): string {
  return name.trim().split(/\s+/).map(p => p[0] || '').join('').slice(0, 2).toUpperCase()
}
function uniquePocsForGrid(gridId: string, assignGrids: AssignGrid[]): string[] {
  const grid = assignGrids.find(g => g.id === gridId)
  if (!grid) return []
  const set = new Set<string>()
  for (const s of grid.styles) if (s.assignedTo) set.add(s.assignedTo)
  return [...set]
}
function POCAvatarStack({ pocs, max = 3 }: { pocs: string[]; max?: number }) {
  if (pocs.length === 0) return <span className="text-xs text-slate-300 italic">—</span>
  const visible  = pocs.slice(0, max)
  const overflow = pocs.length - visible.length
  return (
    <div className="flex items-center" title={pocs.join(', ')}>
      {visible.map((name, i) => {
        const col = pocColor(name)
        return (
          <span key={name}
            className={cn(
              'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ring-2 ring-white',
              col.bg, col.fg,
              i > 0 && '-ml-1.5',
            )}>
            {pocInitials(name)}
          </span>
        )
      })}
      {overflow > 0 && (
        <span className="-ml-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ring-2 ring-white bg-slate-100 text-slate-600"
              title={pocs.slice(max).join(', ')}>
          +{overflow}
        </span>
      )}
    </div>
  )
}

function SourceBadge({ source, onBehalfOf }: { source: 'buying'|'sourcing'; onBehalfOf: string }) {
  if (source === 'buying') return (
    <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
      <ShoppingBag className="w-3 h-3" /> Buying
    </span>
  )
  if (onBehalfOf) return (
    <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
      <UserCheck className="w-3 h-3" /> On behalf of {onBehalfOf}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
      <Users className="w-3 h-3" /> Sourcing
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Order Grid view
// ═══════════════════════════════════════════════════════════════════════════════

/** Detail drawer shown when Eye is clicked */
function GridDetailDrawer({ grid, onClose }: { grid: OrderGridRecord; onClose: () => void }) {
  const { assignGrids } = useGridStore()
  const assignGrid = assignGrids.find(g => g.id === grid.id)
  const pct = grid.styleCount > 0 ? Math.round((grid.assignedCount / grid.styleCount) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug">{grid.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <SourceBadge source={grid.source} onBehalfOf={grid.onBehalfOf} />
              <span className="text-xs text-slate-400">{grid.season} · {grid.date}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Total Styles</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{grid.styleCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Assigned</p>
            <p className="text-2xl font-bold text-violet-600">{grid.assignedCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Unassigned</p>
            <p className="text-2xl font-bold text-slate-400">{grid.styleCount - grid.assignedCount}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Assignment progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-2 bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Styles list */}
        <div className="flex-1 overflow-y-auto">
          {assignGrid ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  {['Style Code','Style Name','Qty','Gender','Assigned To'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignGrid.styles.map((s, i) => (
                  <tr key={s.id} className={cn('border-t border-slate-100 dark:border-slate-800', i%2===0 ? '' : 'bg-slate-50/40 dark:bg-slate-800/30')}>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-400">{s.styleCode}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 max-w-[160px] truncate">{s.styleName}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{s.qty.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.gender}</td>
                    <td className="px-4 py-2.5">
                      {s.assignedTo
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">{s.assignedTo}</span>
                        : <span className="text-slate-300 dark:text-slate-600 italic">Unassigned</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
              <FileSpreadsheet className="w-8 h-8 opacity-30" />
              <p>Style-level detail not available yet</p>
              <p className="text-xs">Grid has {grid.styleCount} styles · {grid.assignedCount} assigned</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <p className="text-xs text-slate-400">Created by <span className="font-medium text-slate-600 dark:text-slate-300">{grid.createdBy}</span></p>
          <StatusBadge status={grid.status} />
        </div>
      </div>
    </div>
  )
}

function OrderGridView({ onNewOrder }: { onNewOrder: () => void }) {
  const { currentUser } = useCurrentUser()
  const [filter, setFilter] = useState<'all'|'buying'|'sourcing'|'needs-assignment'>('all')
  const [search, setSearch] = useState('')
  const [viewGrid, setViewGrid] = useState<OrderGridRecord | null>(null)
  const [menuGridId, setMenuGridId] = useState<string | null>(null)
  const { grids, setGrids, assignGrids } = useGridStore()
  const role = currentUser.role

  const filtered = grids.filter(g => {
    if (filter === 'buying')           return g.source === 'buying'
    if (filter === 'sourcing')         return g.source === 'sourcing'
    if (filter === 'needs-assignment') return g.status === 'submitted' || g.status === 'partial'
    return true
  }).filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.createdBy.toLowerCase().includes(search.toLowerCase())
  ).filter(g => {
    if (role === 'sourcing-poc') return g.createdBy === currentUser.name || g.assignedCount > 0
    return true
  })

  const downloadGrid = (g: OrderGridRecord) => {
    const assignGrid = assignGrids.find(a => a.id === g.id)
    let csv = 'Grid Name,Season,Source,Created By,Status,Style Code,Style Name,Gender,Qty,Assigned To\n'
    if (assignGrid?.styles.length) {
      assignGrid.styles.forEach(s => {
        csv += `"${g.name}","${g.season}","${g.source}","${g.createdBy}","${g.status}","${s.styleCode}","${s.styleName}","${s.gender}","${s.qty}","${s.assignedTo}"\n`
      })
    } else {
      csv += `"${g.name}","${g.season}","${g.source}","${g.createdBy}","${g.status}","","","","${g.styleCount} styles (${g.assignedCount} assigned)",""\n`
    }
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `${g.name.replace(/\s+/g, '_')}.csv`,
    })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const deleteGrid = (id: string) => {
    if (confirm('Delete this order grid? This cannot be undone.')) {
      setGrids(prev => prev.filter(g => g.id !== id))
      setMenuGridId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all','buying','sourcing','needs-assignment'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                filter===f ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}>
              {f==='all'?'All Grids':f==='buying'?'From Buying':f==='sourcing'?'From Sourcing':'Needs Assignment'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search grids…"
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 w-44 bg-white" />
          </div>
          <button onClick={onNewOrder}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">
            <Plus className="w-3.5 h-3.5" /> New Order
          </button>
        </div>
      </div>

      {/* Grid table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Order Grid Name','Source','Season','Styles','Assigned','POCs','Status','Date','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((g, i) => (
              <tr key={g.id} className={cn('border-t border-slate-100 hover:bg-slate-50/50 transition-colors', i%2===0?'bg-white':'bg-slate-50/20')}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{g.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">by {g.createdBy}</p>
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={g.source} onBehalfOf={g.onBehalfOf} />
                </td>
                <td className="px-4 py-3 text-slate-600">{g.season}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{g.styleCount}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 w-16">
                      <div className="bg-violet-500 h-1.5 rounded-full"
                        style={{ width: `${g.styleCount > 0 ? Math.round(g.assignedCount/g.styleCount*100) : 0}%` }} />
                    </div>
                    <span className="text-slate-500">{g.assignedCount}/{g.styleCount}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <POCAvatarStack pocs={uniquePocsForGrid(g.id, assignGrids)} />
                </td>
                <td className="px-4 py-3"><StatusBadge status={g.status} /></td>
                <td className="px-4 py-3 text-slate-500">{g.date}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewGrid(g)}
                      title="View details"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => downloadGrid(g)}
                      title="Download CSV"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setMenuGridId(menuGridId === g.id ? null : g.id)}
                        title="More options"
                        className={cn('p-1.5 rounded-lg transition-colors',
                          menuGridId === g.id
                            ? 'text-slate-700 bg-slate-100'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {menuGridId === g.id && (
                        <>
                          {/* invisible backdrop to close on click-outside */}
                          <div className="fixed inset-0 z-40" onClick={() => setMenuGridId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 overflow-hidden">
                            <button
                              onClick={() => { setViewGrid(g); setMenuGridId(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-700 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> View details
                            </button>
                            <button
                              onClick={() => { downloadGrid(g); setMenuGridId(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Download CSV
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                            <button
                              onClick={() => deleteGrid(g.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete grid
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No order grids match the current filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {viewGrid && <GridDetailDrawer grid={viewGrid} onClose={() => setViewGrid(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: New Order (creation form — no recent orders)
// ═══════════════════════════════════════════════════════════════════════════════
function NewOrderView({ onSubmitDone }: { onSubmitDone: (gridId: string, gridName: string) => void }) {
  const { currentUser }                 = useCurrentUser()
  const role                            = currentUser.role
  const { submitGrid }                  = useGridStore()
  const [gridName, setGridName]         = useState('')
  const [editingName, setEditingName]   = useState(false)
  const [rows, setRows]                 = useState<GridRow[]>([])

  // Phase B: import flow state machine.
  //   idle    → no file picked yet
  //   parsing → file is being read & parsed by SheetJS
  //   preview → parsed; user reviewing the validation summary
  //   done    → confirmed; rows are in the inline editor
  const [importState, setImportState]   = useState<'idle'|'parsing'|'preview'|'done'>('idle')
  const [parseResult, setParseResult]   = useState<ExcelParseResult | null>(null)
  const [parseError, setParseError]     = useState<string | null>(null)
  const [validation, setValidation]     = useState<{ perRow: RowValidation[]; summary: GridImportSummary } | null>(null)
  // Map<rowId, FieldIssue[]> — used to drive red-dot cell indicators in the editor.
  const [rowIssues, setRowIssues]       = useState<Record<string, FieldIssue[]>>({})

  const [mode, setMode]                 = useState<'idle'|'upload'|'manual'>('idle')
  const [searchQ, setSearchQ]           = useState('')
  const [showOnBehalf, setShowOnBehalf] = useState(false)
  const [onBehalf, setOnBehalf]         = useState<OnBehalfData>({ type: 'self', buyingPerson: '', notes: '' })
  const [submitted, setSubmitted]       = useState(false)
  // Phase C: blocking errors surfaced when the user clicks Submit.
  const [submitErrors, setSubmitErrors] = useState<{ rowId: string; field: string; message: string }[] | null>(null)
  // Phase E: when validation passes hard checks but rows still carry warnings,
  // pause and ask the user to confirm. `null` = no prompt.
  const [warnPrompt, setWarnPrompt]     = useState<{ warnRows: number; totalRows: number } | null>(null)
  // Phase E: auto-save indicator state. Toggles to true briefly each tick.
  const [autoSavedAt, setAutoSavedAt]   = useState<Date | null>(null)
  const fileRef                         = useRef<HTMLInputElement>(null)

  const isBuying   = role === 'buying-poc'
  const isSourcing = role === 'sourcing-poc' || role === 'sourcing-mgr'

  // Row mutations
  const updateRow = useCallback((id: string, field: keyof GridRow, val: string) =>
    setRows(p => p.map(r => r.id===id ? {...r, [field]:val} : r)), [])
  const toggleRow = (id: string) => setRows(p => p.map(r => r.id===id ? {...r, disabled:!r.disabled} : r))
  const deleteRow = (id: string) => setRows(p => p.filter(r => r.id!==id))
  const addRow    = () => { setRows(p => [...p, EMPTY_ROW()]); setMode('manual') }

  // ── Phase B import flow ──────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setImportState('parsing')
    setMode('upload')
    setParseError(null)
    try {
      const result = await parseExcelFile(file)
      // Validate every parsed row immediately so the preview can render.
      const v = validateGridImport(result.rows as Array<ValidatableRow & { id: string }>)
      setParseResult(result)
      setValidation(v)
      setImportState('preview')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.')
      setImportState('idle')
      setMode('idle')
    }
  }

  const confirmImport = () => {
    if (!parseResult || !validation) return
    // Drop skipped rows (they have severity='error' issues — only styleCode missing today).
    const skip = new Set(validation.perRow.filter(v => v.willSkip).map(v => v.rowId))
    const kept = parseResult.rows.filter(r => !skip.has(r.id)) as unknown as GridRow[]
    setRows(kept)
    // Stash field-level issues so the inline editor can paint red-dot indicators.
    const issuesById: Record<string, FieldIssue[]> = {}
    validation.perRow.forEach(v => {
      if (!skip.has(v.rowId)) issuesById[v.rowId] = v.issues
    })
    setRowIssues(issuesById)
    setImportState('done')
    if (!gridName) {
      setGridName(isBuying ? 'Buying AW26 Outer Wear Batch' : 'NN AW26 Outer Wear Batch 1')
    }
    if (isSourcing) setTimeout(() => setShowOnBehalf(true), 300)
  }

  const cancelImport = () => {
    setParseResult(null)
    setValidation(null)
    setParseError(null)
    setImportState('idle')
    setMode('idle')
  }

  // Re-run validation any time the user edits a row inline so red-dot indicators stay accurate.
  useEffect(() => {
    if (importState !== 'done' || rows.length === 0) return
    const v = validateGridImport(rows as unknown as Array<ValidatableRow & { id: string }>)
    const issuesById: Record<string, FieldIssue[]> = {}
    v.perRow.forEach(p => { issuesById[p.rowId] = p.issues })
    setRowIssues(issuesById)
  }, [rows, importState])

  // Phase E: auto-save the in-flight draft (rows + name) to localStorage every 30s.
  // Survives accidental page refreshes; cleared on submit or on user "Clear".
  const DRAFT_KEY = 'fabricate.otb.draft.v1'
  useEffect(() => {
    if (rows.length === 0) return
    const t = setInterval(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: gridName, rows, savedAt: Date.now() }))
        setAutoSavedAt(new Date())
      } catch { /* quota/private mode — silently skip */ }
    }, 30_000)
    return () => clearInterval(t)
  }, [rows, gridName])

  // Restore on mount if we have nothing yet.
  useEffect(() => {
    if (rows.length > 0) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { name?: string; rows?: GridRow[] }
      if (saved.rows && saved.rows.length > 0) {
        setRows(saved.rows)
        if (!gridName && saved.name) setGridName(saved.name)
        setMode('manual')
        setImportState('done')
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear the saved draft once the grid is actually submitted.
  useEffect(() => {
    if (submitted) {
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    }
  }, [submitted])

  const downloadTemplate = () => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([buildTemplateCsv()], { type: 'text/csv' })),
      download: 'Fabricate_OrderGrid_Template.csv',
    })
    a.click()
  }

  /**
   * Phase C: real submit flow.
   *   1. Hard-validate active rows (styleCode + Inward Date required, Inward ≥ Handover)
   *   2. If sourcing, show the On-Behalf attribution modal first (it calls finishSubmit on confirm)
   *   3. Otherwise, finishSubmit immediately
   */
  const handleSubmit = () => {
    const active = rows.filter(r => !r.disabled)
    const v = validateForSubmission(active as unknown as Array<ValidatableRow & { id: string }>)
    if (!v.ok) {
      setSubmitErrors(v.blocking.map(b => ({ rowId: b.rowId, field: b.field as string, message: b.message })))
      return
    }

    // Phase E §5.5 step 4: if any rows still have warnings, ask before submitting.
    const warnRows = Object.values(rowIssues).filter(issues =>
      issues.length > 0 && !issues.some(i => i.severity === 'error'),
    ).length
    if (warnRows > 0) {
      setWarnPrompt({ warnRows, totalRows: active.length })
      return
    }

    if (isSourcing && !showOnBehalf) { setShowOnBehalf(true); return }
    finishSubmit()
  }

  /** User clicked "Submit anyway" in the warning prompt — proceeds to next gate. */
  const acknowledgeWarningsAndContinue = () => {
    setWarnPrompt(null)
    if (isSourcing && !showOnBehalf) { setShowOnBehalf(true); return }
    finishSubmit()
  }

  /** Pushes the grid + SubOrders into the store, fires the notification, and tells the parent. */
  const finishSubmit = () => {
    const active = rows.filter(r => !r.disabled)
    if (active.length === 0) return
    // Pick the most common season across rows; fall back to AW 26.
    const seasonCount = new Map<string, number>()
    active.forEach(r => { if (r.season) seasonCount.set(r.season, (seasonCount.get(r.season) || 0) + 1) })
    let dominantSeason = 'AW 26'
    let best = 0
    seasonCount.forEach((n, s) => { if (n > best) { best = n; dominantSeason = s } })

    const result = submitGrid({
      name:       gridName.trim(),
      season:     dominantSeason,
      source:     isBuying ? 'buying' : 'sourcing',
      createdBy:  currentUser.name,
      onBehalfOf: (isSourcing && onBehalf.type === 'buying') ? onBehalf.buyingPerson : '',
      rows:       active,
    })
    setSubmitted(true)
    setShowOnBehalf(false)
    onSubmitDone(result.gridId, gridName)
  }

  const q           = searchQ.toLowerCase()
  const visible     = rows.filter(r => !q || r.styleCode.toLowerCase().includes(q) || r.styleName.toLowerCase().includes(q))
  const activeRows  = rows.filter(r => !r.disabled)
  const totalQty    = activeRows.reduce((s,r) => s+(parseInt(r.orderQty)||0), 0)
  const readyToSend = gridName.trim().length>0 && activeRows.length>0

  if (submitted) return null // handled by parent

  return (
    <div className="space-y-5">

      {/* ── Phase C: Submission-blocked modal ── */}
      {submitErrors && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4.5 h-4.5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Cannot submit yet</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {submitErrors.length} blocking issue{submitErrors.length>1?'s':''} must be fixed before this grid can be submitted.
                </p>
              </div>
            </div>

            <div className="max-h-[280px] overflow-y-auto bg-red-50/40 border border-red-100 rounded-xl p-3 mb-4 space-y-1.5">
              {submitErrors.slice(0, 30).map((e, i) => {
                const row = rows.find(r => r.id === e.rowId)
                const idx = rows.findIndex(r => r.id === e.rowId)
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <X className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-500">Row {idx + 1}</span>
                      {row?.styleCode && <> · <span className="font-mono font-semibold text-violet-700">{row.styleCode}</span></>}
                      <span className="text-slate-300"> · </span>
                      <span className="text-slate-700">{e.message}</span>
                    </div>
                  </div>
                )
              })}
              {submitErrors.length > 30 && (
                <p className="text-[11px] text-red-600 text-center pt-2">…and {submitErrors.length - 30} more</p>
              )}
            </div>

            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Style Code and Inward Date are required on every row at submission. Inward Date must
              be on or after Handover Date — this is what powers OTIF tracking.
            </p>

            <div className="flex gap-2">
              <button onClick={() => setSubmitErrors(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
                Fix in editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase E: Submit-with-warnings prompt ── */}
      {warnPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Submit with warnings?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {warnPrompt.warnRows} of {warnPrompt.totalRows} rows have flagged warnings.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Warnings won&apos;t block submission, but the affected rows will be highlighted in
              the SubOrder view so they can be cleaned up later. You can also fix them now and
              re-submit for a clean import.
            </p>

            <div className="flex gap-2">
              <button onClick={() => setWarnPrompt(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                Fix in editor
              </button>
              <button onClick={acknowledgeWarningsAndContinue}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700">
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-behalf modal (sourcing) */}
      {showOnBehalf && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Upload Attribution</h3>
                <p className="text-xs text-slate-500 mt-0.5">Who is this order grid for?</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { val:'self',   label:'My own work',            desc:'I am initiating this order grid independently' },
                { val:'buying', label:'On behalf of Buying team', desc:'Buying team sent this plan and I am uploading on their behalf' },
              ].map(opt => (
                <label key={opt.val}
                  className={cn('flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                    onBehalf.type===opt.val ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <input type="radio" name="onbehalf" value={opt.val} checked={onBehalf.type===opt.val as typeof onBehalf.type}
                    onChange={() => setOnBehalf(p => ({...p, type: opt.val as 'self'|'buying'}))}
                    className="mt-0.5 accent-violet-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {onBehalf.type === 'buying' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Buying Person *</label>
                  <select value={onBehalf.buyingPerson} onChange={e => setOnBehalf(p => ({...p, buyingPerson:e.target.value}))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">Select buying person…</option>
                    {BUYING_PERSONS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (optional)</label>
                  <input type="text" value={onBehalf.notes} onChange={e => setOnBehalf(p => ({...p, notes:e.target.value}))}
                    placeholder="e.g. Shared via email on 25 Feb"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowOnBehalf(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                Back
              </button>
              <button
                disabled={onBehalf.type==='buying' && !onBehalf.buyingPerson}
                onClick={() => finishSubmit()}
                className={cn('flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold',
                  (onBehalf.type==='self' || onBehalf.buyingPerson)
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}>
                Submit Grid →
              </button>
            </div>

            {onBehalf.type === 'buying' && (
              <p className="text-xs text-slate-400 text-center mt-3 flex items-center justify-center gap-1">
                <Info className="w-3 h-3" /> Your manager will be notified of this upload
              </p>
            )}
          </div>
        </div>
      )}

      {/* Grid name */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={gridName} onChange={e => setGridName(e.target.value)}
                onBlur={() => setEditingName(false)} onKeyDown={e => e.key==='Enter' && setEditingName(false)}
                placeholder="e.g. NN AW26 Outer Wear Batch 1"
                className="flex-1 border border-violet-400 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
              <button onClick={() => setEditingName(false)} className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)}
              className="w-full flex items-center gap-2 group px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-violet-400 bg-white hover:bg-violet-50/40 transition-colors text-left">
              <FileSpreadsheet className={cn('w-4 h-4 shrink-0', gridName ? 'text-violet-600' : 'text-slate-400')} />
              {gridName
                ? <span className="font-semibold text-slate-900 text-sm flex-1">{gridName}</span>
                : <span className="text-slate-400 text-sm flex-1">Click to name this Order Grid…</span>
              }
              <Pencil className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Phase E: auto-save indicator — shows for 4s after each tick */}
          {autoSavedAt && (Date.now() - autoSavedAt.getTime() < 4_000) && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400 px-2 py-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-500" /> Draft saved
            </span>
          )}
          {isBuying && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1.5 rounded-full font-medium">
              <ShoppingBag className="w-3 h-3" /> Buying upload
            </span>
          )}
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 bg-white">
            <Download className="w-3.5 h-3.5" /> Template
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-violet-200 text-xs font-medium text-violet-700 hover:bg-violet-50 bg-violet-50/50">
            <Upload className="w-3.5 h-3.5" /> Import Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = '' // allow re-uploading the same file
            }} />
          <button onClick={addRow}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        </div>
      </div>

      {/* Empty state — Phase B: real UploadDropzone + Manual entry side-by-side */}
      {rows.length===0 && mode==='idle' && (importState==='idle' || importState==='parsing') && (
        <div className="grid grid-cols-2 gap-4">
          <UploadDropzone
            onFile={handleFile}
            onTemplate={downloadTemplate}
            isParsing={importState==='parsing'}
            error={parseError}
          />
          <div onClick={addRow}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white hover:border-slate-300 hover:bg-slate-50/50 transition-all min-h-[260px]">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Plus className="w-7 h-7 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900">Create Manually</p>
              <p className="text-xs text-slate-500 mt-1">Build order grid row by row — no Excel needed</p>
              {isSourcing && <p className="text-xs text-amber-600 mt-2 font-medium">You&apos;ll be asked to attribute this upload</p>}
            </div>
          </div>
        </div>
      )}

      {/* Preview screen — shown after parse, before final import */}
      {importState==='preview' && parseResult && validation && (
        <ValidationPreview
          parseMeta={parseResult.meta}
          perRow={validation.perRow}
          summary={validation.summary}
          rows={parseResult.rows}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      )}

      {/* On-behalf attribution notice */}
      {importState==='done' && onBehalf.type==='buying' && onBehalf.buyingPerson && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2">
          <UserCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Uploaded on behalf of <span className="font-semibold">{onBehalf.buyingPerson}</span>
            {onBehalf.notes && <span className="text-amber-600"> · {onBehalf.notes}</span>}
          </p>
        </div>
      )}

      {/* Grid */}
      {rows.length>0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">
                {rows.length} rows
                {rows.some(r=>r.disabled) && <span className="text-slate-400 font-normal"> · {rows.filter(r=>r.disabled).length} disabled</span>}
                {totalQty>0 && <span className="text-violet-700"> · {totalQty.toLocaleString()} pcs</span>}
              </span>
              {importState==='done' && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                  <CheckCircle2 className="w-3 h-3" /> Imported
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search styles…"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 w-44" />
                {searchQ && <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-slate-400" /></button>}
              </div>
              <button onClick={() => { setRows([]); setImportState('idle'); setMode('idle') }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50">
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight:'480px' }}>
            <table className="border-collapse" style={{ minWidth:'2400px', width:'100%' }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-900 text-white">
                  <th colSpan={4} className="sticky left-0 z-30 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Style</th>
                  <th colSpan={8} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Classification</th>
                  <th colSpan={2} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Sizing</th>
                  <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-right border-r border-slate-700">Commercial</th>
                  <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-amber-400 text-center border-r border-slate-700">▸ Warehouse Split</th>
                  <th colSpan={5} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left">Ops</th>
                </tr>
                <tr className="bg-slate-800 text-white">
                  <th className="sticky left-0 z-30 bg-slate-800 w-9 px-2 py-2.5 text-xs font-semibold text-slate-400 text-center border-r border-slate-700">#</th>
                  <th className="sticky left-9 z-30 bg-slate-800 w-32 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Style Code</th>
                  <th className="sticky left-[164px] z-30 bg-slate-800 w-56 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Style Name</th>
                  <th className="w-32 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700" title="Google Drive URL — required at upload">Tech Pack</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Gender</th>
                  <th className="w-28 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Product Grp</th>
                  <th className="w-24 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Type</th>
                  <th className="w-24 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Sub Type</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Season</th>
                  <th className="w-24 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Drop</th>
                  <th className="w-28 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Fabric</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Age Grp</th>
                  <th className="w-24 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Colour</th>
                  <th className="w-44 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Active Sizes</th>
                  <th className="w-28 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Size Ratio</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700">Order Qty</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700">MRP ₹</th>
                  <th className="w-24 px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700">Target ₹</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-right border-r border-amber-700 bg-amber-900/30 text-amber-300">BHW</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-right border-r border-amber-700 bg-amber-900/30 text-amber-300">DEL</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-right border-r border-slate-700 bg-amber-900/30 text-amber-300">BLR</th>
                  <th className="w-28 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Handover</th>
                  <th className="w-28 px-3 py-2.5 text-xs font-semibold text-left border-r border-red-700 bg-red-900/20 text-red-300" title="OTIF target — when goods land at warehouse">Inward Date *</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Tier</th>
                  <th className="w-28 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Designer</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, idx) => {
                  const bg = row.disabled ? 'bg-slate-50/60' : idx%2===0 ? 'bg-white' : 'bg-slate-50/30'
                  const wh_total = parseInt(row.orderQty)||0
                  const wh_split = (parseInt(row.whBhw)||0)+(parseInt(row.whDel)||0)+(parseInt(row.whBlr)||0)
                  const wh_mis   = (row.whBhw||row.whDel||row.whBlr) && wh_total>0 && wh_split!==wh_total
                  const whCls    = cn('border-r text-xs', wh_mis ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/20 border-amber-100')
                  // Phase B: per-row issue summary — drives the warning chip on the index cell.
                  const issues   = rowIssues[row.id] || []
                  const errCount = issues.filter(i => i.severity === 'error').length
                  const warnCount = issues.filter(i => i.severity === 'warning').length
                  const issueTip = issues.length === 0 ? '' :
                    issues.slice(0, 6).map(i => `• ${i.message}`).join('\n') +
                    (issues.length > 6 ? `\n…and ${issues.length - 6} more` : '')
                  return (
                    <tr key={row.id} className={cn('border-b border-slate-100 hover:bg-violet-50/10',
                      row.disabled && 'opacity-50',
                      !row.disabled && errCount > 0 && 'bg-red-50/30',
                      !row.disabled && errCount === 0 && warnCount > 0 && 'bg-amber-50/20',
                    )}>
                      <td className={cn('sticky left-0 z-10 w-9 px-2 py-1.5 text-xs text-center border-r border-slate-100', bg)}
                          title={issueTip || undefined}>
                        {issues.length > 0 ? (
                          <span className={cn(
                            'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold cursor-help',
                            errCount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {issues.length}
                          </span>
                        ) : (
                          <span className="text-slate-400">{idx+1}</span>
                        )}
                      </td>
                      {/* Style Code — combobox */}
                      <ComboCell value={row.styleCode} onChange={v => updateRow(row.id,'styleCode',v)} options={STYLE_CODES} rowDisabled={row.disabled}
                        className={cn('sticky left-9 z-10 w-32', bg)} />
                      <Cell value={row.styleName}    onChange={v => updateRow(row.id,'styleName',v)}    rowDisabled={row.disabled} placeholder="Style name"  className={cn('sticky left-[164px] z-10 w-56', bg)} />
                      <LinkCell value={row.techPack} onChange={v => updateRow(row.id,'techPack',v)}     rowDisabled={row.disabled} placeholder="Paste GDrive link"  className="w-32" />
                      <Cell value={row.gender}       onChange={v => updateRow(row.id,'gender',v)}       type="select" options={GENDER_OPTIONS}   rowDisabled={row.disabled} className="w-20" />
                      <Cell value={row.productGroup} onChange={v => updateRow(row.id,'productGroup',v)} type="select" options={PRODUCT_OPTIONS}  rowDisabled={row.disabled} className="w-28" />
                      <Cell value={row.type}         onChange={v => updateRow(row.id,'type',v)}         type="select" options={TYPE_OPTIONS}     rowDisabled={row.disabled} className="w-24" />
                      <Cell value={row.subType}      onChange={v => updateRow(row.id,'subType',v)}      type="select" options={SUBTYPE_OPTIONS}  rowDisabled={row.disabled} className="w-24" />
                      <Cell value={row.season}       onChange={v => updateRow(row.id,'season',v)}       type="select" options={SEASON_OPTIONS}   rowDisabled={row.disabled} className="w-20" />
                      <Cell value={row.drop}         onChange={v => updateRow(row.id,'drop',v)}         type="select" options={DROP_OPTIONS}     rowDisabled={row.disabled} className="w-24" />
                      <Cell value={row.fabric}       onChange={v => updateRow(row.id,'fabric',v)}       type="select" options={FABRIC_OPTIONS}   rowDisabled={row.disabled} className="w-28" />
                      <Cell value={row.ageGroup}     onChange={v => updateRow(row.id,'ageGroup',v)}     type="select" options={AGE_OPTIONS}      rowDisabled={row.disabled} className="w-20" />
                      <Cell value={row.colorFamily}  onChange={v => updateRow(row.id,'colorFamily',v)}  type="select" options={COLOR_OPTIONS}    rowDisabled={row.disabled} className="w-24" />
                      <Cell value={row.activeSizes}  onChange={v => updateRow(row.id,'activeSizes',v)}  rowDisabled={row.disabled} placeholder="2-3Y;3-4Y…"  className="w-44" />
                      <Cell value={row.sizeRatio}    onChange={v => updateRow(row.id,'sizeRatio',v)}    rowDisabled={row.disabled} placeholder="1:1:1:1"      className="w-28" />
                      <Cell value={row.orderQty}     onChange={v => updateRow(row.id,'orderQty',v)}     type="number" rowDisabled={row.disabled} placeholder="0" align="right" className="w-20" />
                      <Cell value={row.mrp}          onChange={v => updateRow(row.id,'mrp',v)}          type="number" rowDisabled={row.disabled} placeholder="0" align="right" className="w-20" />
                      <Cell value={row.targetPrice}  onChange={v => updateRow(row.id,'targetPrice',v)}  type="number" rowDisabled={row.disabled} placeholder="0" align="right" className="w-24" />
                      <Cell value={row.whBhw}        onChange={v => updateRow(row.id,'whBhw',v)}        type="number" rowDisabled={row.disabled} placeholder="0" align="right" className={cn(whCls,'w-20')} />
                      <Cell value={row.whDel}        onChange={v => updateRow(row.id,'whDel',v)}        type="number" rowDisabled={row.disabled} placeholder="0" align="right" className={cn(whCls,'w-20')} />
                      <Cell value={row.whBlr}        onChange={v => updateRow(row.id,'whBlr',v)}        type="number" rowDisabled={row.disabled} placeholder="0" align="right" className={cn(whCls,'w-20')} />
                      <Cell value={row.handoverDate}             onChange={v => updateRow(row.id,'handoverDate',v)}             rowDisabled={row.disabled} placeholder="DD/MM/YYYY"  className="w-28" />
                      <Cell value={row.buyingExpectedInwardDate} onChange={v => updateRow(row.id,'buyingExpectedInwardDate',v)} rowDisabled={row.disabled} placeholder="DD/MM/YYYY"  className="w-28 bg-red-50/30 border-r border-red-100" />
                      <Cell value={row.tier}                     onChange={v => updateRow(row.id,'tier',v)}                     type="select" options={TIER_OPTIONS} rowDisabled={row.disabled} className="w-20" />
                      <Cell value={row.designer}                 onChange={v => updateRow(row.id,'designer',v)}                 type="select" options={DESIGNER_OPTIONS} rowDisabled={row.disabled} className="w-28" />
                      <td className="w-20 px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <button title={row.disabled?'Enable':'Disable'} onClick={() => toggleRow(row.id)}
                            className={cn('p-1 rounded-md transition-colors', row.disabled ? 'text-slate-400 hover:text-green-600 hover:bg-green-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50')}>
                            {row.disabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button title="Delete" onClick={() => deleteRow(row.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
          <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/50">
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
        </div>
      )}

      {/* Submit bar */}
      {rows.length>0 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-5 text-sm">
            <span className="text-slate-600"><span className="font-bold text-slate-900">{activeRows.length}</span> active styles</span>
            <span className="text-slate-600"><span className="font-bold text-slate-900">{totalQty.toLocaleString()}</span> pcs</span>
          </div>
          <div className="flex items-center gap-2">
            {!gridName && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Name your grid first</span>}
            {isBuying && readyToSend && (
              <span className="text-xs text-purple-600 flex items-center gap-1"><Info className="w-3 h-3" /> Will auto-route to Order Assignment</span>
            )}
            <button disabled={!readyToSend} onClick={handleSubmit}
              className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                readyToSend ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}>
              {isBuying ? <><Send className="w-4 h-4" /> Submit to Assignment</> : <><ChevronRight className="w-4 h-4" /> Review & Submit</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Order Assignment view
// ═══════════════════════════════════════════════════════════════════════════════
function OrderAssignmentView({ highlightGrid }: { highlightGrid?: string }) {
  const { currentUser } = useCurrentUser()
  const role = currentUser.role

  // ── Committed state (sourced from the cross-tab store) ──
  const { assignGrids: grids, applyAssignments } = useGridStore()

  // Draft changes: gridId → { styleId → newPoc }  (staged, not yet saved)
  const [draft, setDraft]             = useState<Record<string, Record<string, string>>>({})

  // Flat selection (composite keys: "gridId|||styleId")
  const [selected, setSelected]       = useState<string[]>([])

  // Bulk-assign POC dropdown for the selection bar
  const [bulkSelPoc, setBulkSelPoc]   = useState('')

  // Save toast
  const [savedToast, setSavedToast]   = useState(false)

  // Phase D: reassignment confirmation prompt — optional reason text.
  const [reassignPrompt, setReassignPrompt] = useState<{
    gridId: string; styleId: string; styleCode: string; oldPoc: string; newPoc: string
  } | null>(null)
  const [reassignReason, setReassignReason] = useState('')

  // Left-rail filters
  const [statusFilter, setStatusFilter] = useState<'all'|'unassigned'|'partial'|'assigned'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all'|'buying'|'sourcing'>('all')
  const [gridFilter, setGridFilter]     = useState<string>('all')   // 'all' or a gridId
  const [search, setSearch]             = useState('')

  // Left-rail card expand/collapse state
  const [railExpanded, setRailExpanded] = useState<{ status: boolean; grids: boolean; source: boolean; summary: boolean }>({
    status:  true,
    grids:   true,
    source:  false,   // collapsed by default — user requested it be lower-priority
    summary: true,
  })
  const toggleRail = (k: keyof typeof railExpanded) =>
    setRailExpanded(p => ({ ...p, [k]: !p[k] }))

  // Sort + column filters (single, not per-grid)
  type SortDir = 'asc' | 'desc'
  type SortCol = 'styleCode' | 'styleName' | 'gridName' | 'gender' | 'qty' | 'assignedTo'
  const [sort, setSort]               = useState<{ col: SortCol; dir: SortDir } | null>(null)
  const [colFilters, setColFilters]   = useState<Record<string, string>>({})
  const [filterOpen, setFilterOpen]   = useState<string | null>(null)

  const toggleSort = (col: SortCol) =>
    setSort(prev => {
      if (!prev || prev.col !== col) return { col, dir: 'asc' }
      if (prev.dir === 'asc')         return { col, dir: 'desc' }
      return null
    })

  // ── Helpers ──
  const totalDraft = Object.values(draft).reduce((n, m) => n + Object.keys(m).length, 0)

  const effectivePoc = (gridId: string, styleId: string, committed: string) =>
    draft[gridId]?.[styleId] !== undefined ? draft[gridId][styleId] : committed

  const isDrafted = (gridId: string, styleId: string) =>
    draft[gridId]?.[styleId] !== undefined

  const stage = (gridId: string, styleId: string, poc: string) =>
    setDraft(p => ({ ...p, [gridId]: { ...(p[gridId]||{}), [styleId]: poc } }))

  const stageSelectedFlat = (poc: string) => {
    if (!selected.length || !poc) return
    const byGrid: Record<string, Record<string, string>> = {}
    selected.forEach(key => {
      const [gridId, styleId] = key.split('|||')
      byGrid[gridId] = { ...(byGrid[gridId]||{}), [styleId]: poc }
    })
    setDraft(p => {
      const next = { ...p }
      Object.entries(byGrid).forEach(([gid, entries]) => {
        next[gid] = { ...(next[gid]||{}), ...entries }
      })
      return next
    })
    setSelected([])
    setBulkSelPoc('')
  }

  const toggleSelKey = (key: string) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  /**
   * Phase F: route saves through the store's `applyAssignments`. That function:
   *   - mutates assignGrids + the matching SubOrders
   *   - recomputes grid status (submitted → partial → assigned)
   *   - writes activity-log entries on each affected SubOrder
   *   - fires the right notifications (reassignment + grid-fully-assigned)
   */
  const saveChanges = () => {
    // Build a flat AssignmentChange[] from the per-grid draft, including the OLD POC
    // so the store can distinguish first-assignment from reassignment.
    const changes: { gridId: string; styleId: string; oldPoc: string; newPoc: string }[] = []
    for (const [gridId, perStyle] of Object.entries(draft)) {
      const grid = grids.find(g => g.id === gridId)
      if (!grid) continue
      for (const [styleId, newPoc] of Object.entries(perStyle)) {
        const old = grid.styles.find(s => s.id === styleId)?.assignedTo ?? ''
        if (old === newPoc) continue   // no-op
        changes.push({ gridId, styleId, oldPoc: old, newPoc })
      }
    }

    if (changes.length > 0) {
      applyAssignments(changes, currentUser.name)
    }
    setDraft({})
    setSelected([])
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2500)
  }

  const discardChanges = () => { setDraft({}); setSelected([]) }

  /**
   * Phase D: when the user picks a different POC on a row that ALREADY has
   * one, open the confirmation prompt instead of staging immediately.
   * First-time assignments (old empty → new) bypass the prompt — no friction.
   */
  const onPocPicked = (
    gridId: string, styleId: string, styleCode: string, oldPoc: string, newPoc: string,
  ) => {
    if (oldPoc && newPoc && oldPoc !== newPoc) {
      setReassignPrompt({ gridId, styleId, styleCode, oldPoc, newPoc })
      setReassignReason('')
      return
    }
    stage(gridId, styleId, newPoc)
  }

  const confirmReassign = () => {
    if (!reassignPrompt) return
    stage(reassignPrompt.gridId, reassignPrompt.styleId, reassignPrompt.newPoc)
    // Reason is captured for now; Phase F can attach it to the activity log entry.
    setReassignPrompt(null)
    setReassignReason('')
  }

  /**
   * Phase D: Auto-suggest. Looks at every CURRENTLY-VISIBLE unassigned row
   * (after filters/search), runs the rules engine, and stages the suggested
   * POCs into the draft. The user still has to click Save to commit.
   */
  const runAutoSuggest = () => {
    // Build the list of unassigned visible rows.
    const candidates = visible
      .filter(r => !effectivePoc(r.gridId, r.id, r.assignedTo))
      .map(r => ({ id: r.rowKey, productGroup: r.productGroup, assignedTo: '' }))
    if (candidates.length === 0) return

    // Workload across ALL grids (using effective POC values, including drafts).
    const allEffective = grids.flatMap(g =>
      g.styles.map(s => ({ assignedTo: effectivePoc(g.id, s.id, s.assignedTo) || '' })),
    )
    const workload = computeWorkload(allEffective)

    const suggestions = suggestAssignments(candidates, DEFAULT_SUGGEST_RULES, workload)
    if (suggestions.length === 0) return

    // Stage into the draft (rowKey is `${gridId}|||${styleId}`).
    setDraft(prev => {
      const next = { ...prev }
      for (const s of suggestions) {
        const [gridId, styleId] = s.styleId.split('|||')
        next[gridId] = { ...(next[gridId] || {}), [styleId]: s.pocName }
      }
      return next
    })
  }

  // ── Flat list of styles (one row per style across all grids) ──
  type FlatRow = AssignStyle & {
    gridId: string
    gridName: string
    gridSource: 'buying' | 'sourcing'
    gridOnBehalfOf: string
    gridDate: string
    gridCreatedBy: string
    rowKey: string
  }
  const flat: FlatRow[] = grids.flatMap(g =>
    g.styles.map(s => ({
      ...s,
      gridId: g.id,
      gridName: g.name,
      gridSource: g.source,
      gridOnBehalfOf: g.onBehalfOf,
      gridDate: g.date,
      gridCreatedBy: g.createdBy,
      rowKey: `${g.id}|||${s.id}`,
    }))
  )

  // Counts for left-rail buckets (grid-level)
  const statusCounts = (() => {
    let unassigned = 0, partial = 0, assigned = 0
    grids.forEach(g => {
      const total = g.styles.length
      const n = g.styles.filter(s => effectivePoc(g.id, s.id, s.assignedTo)).length
      if (n === 0) unassigned++
      else if (n < total) partial++
      else assigned++
    })
    return { all: grids.length, unassigned, partial, assigned }
  })()

  const sourceCounts = {
    all: grids.length,
    buying:   grids.filter(g => g.source === 'buying').length,
    sourcing: grids.filter(g => g.source === 'sourcing').length,
  }

  // Per-grid summary for the left-rail "Grids" section.
  const gridSummaries = grids.map(g => {
    const total       = g.styles.length
    const assignedN   = g.styles.filter(s => effectivePoc(g.id, s.id, s.assignedTo)).length
    const unassignedN = total - assignedN
    return { id: g.id, name: g.name, source: g.source, total, unassignedN, assignedN }
  })

  // ── Apply filters ──
  const filtered = flat.filter(r => {
    if (gridFilter !== 'all'   && r.gridId     !== gridFilter)   return false
    if (sourceFilter !== 'all' && r.gridSource !== sourceFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const ok = r.styleCode.toLowerCase().includes(q)
        || r.styleName.toLowerCase().includes(q)
        || r.gridName.toLowerCase().includes(q)
        || (r.gridCreatedBy || '').toLowerCase().includes(q)
      if (!ok) return false
    }
    if (statusFilter === 'unassigned' || statusFilter === 'assigned') {
      const eff = effectivePoc(r.gridId, r.id, r.assignedTo)
      if (statusFilter === 'unassigned' && eff) return false
      if (statusFilter === 'assigned' && !eff) return false
    } else if (statusFilter === 'partial') {
      const grid = grids.find(g => g.id === r.gridId)
      if (!grid) return false
      const total = grid.styles.length
      const n = grid.styles.filter(s => effectivePoc(grid.id, s.id, s.assignedTo)).length
      if (n === 0 || n === total) return false
    }
    for (const [col, val] of Object.entries(colFilters)) {
      if (!val) continue
      if (col === 'assignedTo') {
        const eff = effectivePoc(r.gridId, r.id, r.assignedTo)
        if (val === '__unassigned__') { if (eff) return false }
        else if (eff !== val) return false
      } else {
        const sv = String((r as Record<string, unknown>)[col] ?? '')
        if (sv !== val) return false
      }
    }
    return true
  })

  // ── Apply sort ──
  const visible = sort
    ? [...filtered].sort((a, b) => {
        let av: unknown = (a as Record<string, unknown>)[sort.col]
        let bv: unknown = (b as Record<string, unknown>)[sort.col]
        if (sort.col === 'assignedTo') {
          av = effectivePoc(a.gridId, a.id, a.assignedTo) || ''
          bv = effectivePoc(b.gridId, b.id, b.assignedTo) || ''
        }
        const aval = av ?? ''
        const bval = bv ?? ''
        const cmp = typeof aval === 'number' && typeof bval === 'number'
          ? aval - bval
          : String(aval).localeCompare(String(bval))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    : filtered

  // Selection helpers
  const allVisibleSelected  = visible.length > 0 && visible.every(r => selected.includes(r.rowKey))
  const someVisibleSelected = visible.some(r => selected.includes(r.rowKey)) && !allVisibleSelected
  const toggleAllVisible = () => {
    if (allVisibleSelected) setSelected(prev => prev.filter(k => !visible.some(r => r.rowKey === k)))
    else                    setSelected(prev => [...new Set([...prev, ...visible.map(r => r.rowKey)])])
  }

  const exportCsv = () => {
    let csv = 'Grid,Source,Created By,Style Code,Style Name,Gender,Product Grp,Type,Qty,Current Assignment\n'
    visible.forEach(r => {
      const eff = effectivePoc(r.gridId, r.id, r.assignedTo)
      csv += `"${r.gridName}","${r.gridSource}","${r.gridCreatedBy}","${r.styleCode}","${r.styleName}","${r.gender}","${r.productGroup||''}","${r.type||''}",${r.qty},"${eff}"\n`
    })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `order-assignment-${Date.now()}.csv`,
    })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const activeChips = Object.entries(colFilters).filter(([, v]) => v)

  // Left-rail row helper
  const RailRow = ({ active, label, count, onClick, dot }: {
    active: boolean; label: string; count: number; onClick: () => void; dot?: string
  }) => (
    <button onClick={onClick}
      className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        active ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
      )}>
      <span className="flex items-center gap-2">
        {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />}
        {label}
      </span>
      <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
      )}>{count}</span>
    </button>
  )

  // Collapsible left-rail card
  const CollapsibleCard = ({ title, expanded, onToggle, badge, children, bodyClass }: {
    title: string; expanded: boolean; onToggle: () => void; badge?: number;
    children: ReactNode; bodyClass?: string
  }) => (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50/60 transition-colors">
        <span className="flex items-center gap-2">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</h3>
          {badge !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{badge}</span>
          )}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform', !expanded && '-rotate-90')} />
      </button>
      {expanded && (
        <div className={cn('px-3 pb-3', bodyClass)}>{children}</div>
      )}
    </div>
  )

  // Header-cell helper (sort + filter; supports sticky-left/right pinning)
  const ch = (col: SortCol | string, label: string,
              opts: { sortable?: boolean; filterable?: boolean; align?: 'left'|'right'; width?: string; sticky?: 'left'|'right'; stickyOffset?: string } = {}) => {
    const { sortable, filterable, align='left', width, sticky, stickyOffset } = opts
    const isSorted   = sort?.col === col
    const isOpen     = filterOpen === col
    const activeVal  = colFilters[col] || ''
    const isFiltered = !!activeVal

    const uniqVals = [...new Set(
      flat.map(r => {
        if (col === 'assignedTo') return effectivePoc(r.gridId, r.id, r.assignedTo)
        return String((r as Record<string, unknown>)[col] ?? '')
      }).filter(v => v !== '')
    )].sort()

    const stickyClass = sticky === 'left'
      ? cn('sticky z-20 bg-slate-50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]', stickyOffset || 'left-8')
      : sticky === 'right'
      ? cn('sticky z-20 bg-slate-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]', stickyOffset || 'right-0')
      : ''

    return (
      <th key={col} className={cn('px-3 py-2.5 whitespace-nowrap', width, stickyClass)} style={{ textAlign: align }}>
        <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>

          {sortable ? (
            <button onClick={() => toggleSort(col as SortCol)}
              className={cn('flex items-center gap-0.5 font-semibold text-xs transition-colors',
                isSorted ? 'text-violet-600' : 'text-slate-500 hover:text-slate-800'
              )}>
              {label}
              <span className="text-[10px] ml-0.5">
                {isSorted ? (sort!.dir === 'asc' ? '↑' : '↓') : <span className="text-slate-300">↕</span>}
              </span>
            </button>
          ) : (
            <span className="font-semibold text-xs text-slate-500">{label}</span>
          )}
          {filterable && (
            <div className="relative">
              <button onClick={() => setFilterOpen(isOpen ? null : col)}
                className={cn('p-0.5 rounded transition-colors',
                  isFiltered ? 'text-violet-600 bg-violet-100' : 'text-slate-300 hover:text-slate-500'
                )}>
                <Filter className="w-3 h-3" />
              </button>
              {isOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(null)} />
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-slate-200 rounded-xl shadow-xl py-1 max-h-56 overflow-y-auto">
                    <button onClick={() => { setColFilters(p => { const n = {...p}; delete n[col]; return n }); setFilterOpen(null) }}
                      className={cn('w-full px-3 py-1.5 text-left text-xs',
                        !activeVal ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'
                      )}>
                      All
                    </button>
                    {col === 'assignedTo' && (
                      <button onClick={() => { setColFilters(p => ({...p, [col]: '__unassigned__'})); setFilterOpen(null) }}
                        className={cn('w-full px-3 py-1.5 text-left text-xs',
                          activeVal === '__unassigned__' ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-amber-600 hover:bg-amber-50'
                        )}>
                        Unassigned
                      </button>
                    )}
                    {uniqVals.map(v => (
                      <button key={v} onClick={() => { setColFilters(p => ({...p, [col]: v as string})); setFilterOpen(null) }}
                        className={cn('w-full px-3 py-1.5 text-left text-xs truncate',
                          activeVal === v ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        )}>
                        {v}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </th>
    )
  }

  const unassignedRowCount = flat.filter(r => !effectivePoc(r.gridId, r.id, r.assignedTo)).length

  return (
    <>
      {/* ── Saved toast ── */}
      {savedToast && (
        <div className="fixed top-16 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Assignments saved successfully
        </div>
      )}

      {/* Phase D: Reassignment confirmation prompt */}
      {reassignPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Reassign sub-order</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Both POCs will be notified when this is saved.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 mb-4 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">SubOrder</span>
                <span className="font-mono font-semibold text-violet-700">{reassignPrompt.styleCode}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">From</span>
                <span className="text-slate-700">{reassignPrompt.oldPoc}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">To</span>
                <span className="text-slate-900 font-semibold">{reassignPrompt.newPoc}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Reason <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input type="text" value={reassignReason}
                onChange={e => setReassignReason(e.target.value)}
                placeholder="e.g. Parthipan over capacity for AW26"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setReassignPrompt(null); setReassignReason('') }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={confirmReassign}
                className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4" style={{ paddingBottom: totalDraft > 0 ? '80px' : '0' }}>
        {/* ═══ LEFT RAIL ═══════════════════════════════════════════════════════════ */}
        <aside className="w-60 shrink-0 space-y-3">
          {/* 1. Assignment status */}
          <CollapsibleCard
            title="Assignment Status"
            expanded={railExpanded.status}
            onToggle={() => toggleRail('status')}
          >
            <div className="space-y-0.5">
              <RailRow active={statusFilter==='all'}        label="All"        count={statusCounts.all}        onClick={() => setStatusFilter('all')} />
              <RailRow active={statusFilter==='unassigned'} label="Unassigned" count={statusCounts.unassigned} onClick={() => setStatusFilter('unassigned')} dot="bg-amber-400" />
              <RailRow active={statusFilter==='partial'}    label="Partial"    count={statusCounts.partial}    onClick={() => setStatusFilter('partial')}    dot="bg-violet-400" />
              <RailRow active={statusFilter==='assigned'}   label="Assigned"   count={statusCounts.assigned}   onClick={() => setStatusFilter('assigned')}   dot="bg-green-500" />
            </div>
          </CollapsibleCard>

          {/* 2. Order Grids */}
          <CollapsibleCard
            title="Order Grids"
            badge={gridSummaries.length}
            expanded={railExpanded.grids}
            onToggle={() => toggleRail('grids')}
          >
            <div className="space-y-0.5 max-h-72 overflow-y-auto pr-0.5">
              <button onClick={() => setGridFilter('all')}
                className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  gridFilter==='all' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                )}>
                <span>All grids</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
                  gridFilter==='all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}>{gridSummaries.length}</span>
              </button>
              {gridSummaries.map(g => {
                const isActive = gridFilter === g.id
                return (
                  <button key={g.id} onClick={() => setGridFilter(g.id)}
                    className={cn('w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                      isActive ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    )}>
                    <span className={cn('mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                      g.unassignedN > 0
                        ? (isActive ? 'bg-white/70' : 'bg-amber-400')
                        : (isActive ? 'bg-white/70' : 'bg-green-500')
                    )} />
                    <span className="flex-1 min-w-0">
                      <span className={cn('block text-xs font-semibold leading-tight truncate',
                        isActive ? 'text-white' : 'text-slate-900'
                      )} title={g.name}>{g.name}</span>
                      <span className={cn('block text-[10px] mt-0.5',
                        isActive ? 'text-white/70'
                        : g.unassignedN > 0 ? 'text-amber-600' : 'text-green-600'
                      )}>
                        {g.unassignedN > 0 ? `${g.unassignedN} unassigned` : 'All assigned'}
                        <span className={isActive ? 'text-white/50' : 'text-slate-400'}> · {g.total}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </CollapsibleCard>

          {/* 3. Source — moved below Order Grids per request */}
          <CollapsibleCard
            title="Source"
            expanded={railExpanded.source}
            onToggle={() => toggleRail('source')}
          >
            <div className="space-y-0.5">
              <RailRow active={sourceFilter==='all'}      label="All"           count={sourceCounts.all}      onClick={() => setSourceFilter('all')} />
              <RailRow active={sourceFilter==='buying'}   label="From Buying"   count={sourceCounts.buying}   onClick={() => setSourceFilter('buying')} />
              <RailRow active={sourceFilter==='sourcing'} label="From Sourcing" count={sourceCounts.sourcing} onClick={() => setSourceFilter('sourcing')} />
            </div>
          </CollapsibleCard>

          {/* 4. Summary */}
          <CollapsibleCard
            title="Summary"
            expanded={railExpanded.summary}
            onToggle={() => toggleRail('summary')}
          >
            <div className="space-y-3 pt-1">
              <div>
                <p className="text-[11px] text-slate-400">Total styles</p>
                <p className="text-2xl font-bold text-slate-900">{flat.length.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Unassigned</p>
                <p className={cn('text-2xl font-bold', unassignedRowCount > 0 ? 'text-amber-600' : 'text-green-600')}>
                  {unassignedRowCount.toLocaleString()}
                </p>
              </div>
              {totalDraft > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-wider">Pending changes</p>
                  <p className="text-2xl font-bold text-amber-600">{totalDraft}</p>
                </div>
              )}
            </div>
          </CollapsibleCard>
        </aside>

        {/* ═══ MAIN ════════════════════════════════════════════════════════════════ */}
        <main className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Top toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search style, grid, creator…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white"
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              <span className="font-semibold text-slate-900">{visible.length}</span> records
            </span>
            <button onClick={runAutoSuggest}
              disabled={visible.filter(r => !effectivePoc(r.gridId, r.id, r.assignedTo)).length === 0}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors',
                visible.filter(r => !effectivePoc(r.gridId, r.id, r.assignedTo)).length > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200',
              )}
              title="Auto-suggest a Sourcing POC for every unassigned visible row">
              <GitMerge className="w-3.5 h-3.5" /> Auto-Suggest
            </button>
            <button onClick={exportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>

          {/* Active column-filter chips */}
          {activeChips.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-violet-50/60 border-b border-violet-100 flex-wrap">
              <span className="text-xs text-violet-500 font-medium">Filters:</span>
              {activeChips.map(([col, val]) => (
                <span key={col} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                  <span className="opacity-60 capitalize">{col}:</span> {val === '__unassigned__' ? 'Unassigned' : val}
                  <button onClick={() => setColFilters(p => { const n = {...p}; delete n[col]; return n })}
                    className="hover:text-violet-900 ml-0.5"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
              <button onClick={() => setColFilters({})} className="text-xs text-violet-400 hover:text-violet-700 ml-1">Clear all</button>
            </div>
          )}

          {/* Selection bar */}
          {selected.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 border-b border-violet-100">
              <span className="text-xs font-bold text-violet-700 shrink-0">{selected.length} selected:</span>
              <select value={bulkSelPoc} onChange={e => setBulkSelPoc(e.target.value)}
                className="border border-violet-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white">
                <option value="">Assign to…</option>
                {SOURCING_POCS.map(p => <option key={p}>{p}</option>)}
                {role==='sourcing-poc' && <option value={currentUser.name}>Myself</option>}
              </select>
              <button disabled={!bulkSelPoc} onClick={() => stageSelectedFlat(bulkSelPoc)}
                className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                  bulkSelPoc ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}>
                Apply
              </button>
              {role==='sourcing-poc' && (
                <button onClick={() => stageSelectedFlat(currentUser.name)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  → Myself
                </button>
              )}
              <button onClick={() => setSelected([])}
                className="ml-auto text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}

          {/* Flat table */}
          <div className="overflow-x-auto">
            <table className="text-xs table-fixed w-full" style={{ minWidth: '1280px' }}>
              <colgroup>
                <col style={{ width: 36 }} />              {/* checkbox */}
                <col style={{ width: 140 }} />             {/* Style Code (sticky-left) */}
                <col />                                    {/* Style Name — flexes to fill remaining width */}
                {gridFilter === 'all' && <col style={{ width: 180 }} />} {/* Grid (conditional) */}
                <col style={{ width: 100 }} />             {/* Source */}
                <col style={{ width: 80 }} />              {/* Gender */}
                <col style={{ width: 130 }} />             {/* Product Grp */}
                <col style={{ width: 100 }} />             {/* Type */}
                <col style={{ width: 80 }} />              {/* Qty */}
                <col style={{ width: 180 }} />             {/* Assignment (sticky-right) */}
                <col style={{ width: 160 }} />             {/* Assign To (sticky-right) */}
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-50 px-4 py-2.5 w-8">
                    <input type="checkbox"
                      checked={allVisibleSelected}
                      ref={el => { if (el) el.indeterminate = someVisibleSelected }}
                      onChange={toggleAllVisible}
                      className="rounded accent-violet-600 cursor-pointer w-3.5 h-3.5"
                    />
                  </th>
                  {ch('styleCode',    'Style Code',  { sortable: true,  filterable: true, sticky: 'left' })}
                  {ch('styleName',    'Style Name',  { sortable: true,  width: 'min-w-[200px]' })}
                  {gridFilter === 'all' && ch('gridName', 'Grid', { sortable: true, filterable: true, width: 'min-w-[180px]' })}
                  {ch('gridSource',   'Source',      { filterable: true })}
                  {ch('gender',       'Gender',      { sortable: true,  filterable: true })}
                  {ch('productGroup', 'Product Grp', { filterable: true })}
                  {ch('type',         'Type',        { filterable: true })}
                  {ch('qty',          'Qty',         { sortable: true,  align: 'right' })}
                  {ch('assignedTo',   'Assignment',  { sortable: true,  filterable: true, width: 'min-w-[180px] w-[180px]', sticky: 'right', stickyOffset: 'right-[160px]' })}
                  <th className="sticky right-0 z-20 bg-slate-50 px-3 py-2.5 text-left font-semibold text-xs text-slate-500 whitespace-nowrap w-[160px] shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]">Assign To</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const isChecked = selected.includes(r.rowKey)
                  const hasDraft  = isDrafted(r.gridId, r.id)
                  const eff       = effectivePoc(r.gridId, r.id, r.assignedTo)
                  const isHl      = r.gridId === highlightGrid
                  // Background that sticky cells must match (so they occlude scrolling content correctly).
                  const rowBg = isChecked
                    ? 'bg-violet-100'
                    : isHl
                    ? 'bg-violet-50'
                    : i % 2 === 0
                    ? 'bg-white'
                    : 'bg-slate-50'
                  const stickyL = cn('sticky z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]', rowBg)
                  const stickyR = cn('sticky z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]', rowBg)
                  return (
                    <tr key={r.rowKey} className={cn(
                      'border-b border-slate-100 last:border-b-0 transition-colors',
                      rowBg,
                      hasDraft && 'border-l-2 border-l-amber-400'
                    )}>
                      <td className={cn('px-4 py-2.5 left-0', stickyL)}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleSelKey(r.rowKey)}
                          className="rounded accent-violet-600 cursor-pointer w-3.5 h-3.5" />
                      </td>
                      <td className={cn('px-3 py-2.5 font-mono font-semibold text-violet-700 whitespace-nowrap left-8', stickyL)}>
                        {r.styleCode}
                        {r.colorFamily && (
                          <span className="block text-[10px] text-slate-400 font-sans font-normal mt-0.5">{r.colorFamily}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-[220px]">
                        <p className="truncate" title={r.styleName}>{r.styleName}</p>
                      </td>
                      {gridFilter === 'all' && (
                        <td className="px-3 py-2.5 text-slate-500 max-w-[200px]">
                          <p className="truncate" title={r.gridName}>{r.gridName}</p>
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <SourceBadge source={r.gridSource} onBehalfOf={r.gridOnBehalfOf} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold',
                          r.gender === 'BOYS'  ? 'bg-blue-50 text-blue-700' :
                          r.gender === 'GIRLS' ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-600'
                        )}>{r.gender}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.productGroup ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.type ?? '—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 text-right whitespace-nowrap">{r.qty.toLocaleString()}</td>
                      <td className={cn('px-3 py-2.5 w-[180px] right-[160px]', stickyR)}>
                        {hasDraft ? (
                          <div className="flex items-center gap-1">
                            {eff ? (
                              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                {eff}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                            <span className="text-[10px] text-amber-500 font-medium">(unsaved)</span>
                          </div>
                        ) : eff ? (
                          <span className="flex items-center gap-1 text-green-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                            {eff}
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className={cn('px-3 py-2.5 w-[160px] right-0', stickyR)}>
                        <select value={eff}
                          onChange={e => onPocPicked(r.gridId, r.id, r.styleCode, eff, e.target.value)}
                          className={cn('border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white w-full',
                            hasDraft ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
                          )}>
                          <option value="">Assign to…</option>
                          {SOURCING_POCS.map(p => <option key={p}>{p}</option>)}
                          {role==='sourcing-poc' && <option value={currentUser.name}>Myself</option>}
                        </select>
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={gridFilter === 'all' ? 11 : 10} className="px-4 py-12 text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-medium">No styles match the current filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>


      {/* ── Sticky save bar ── */}
      {totalDraft > 0 && (
        <div className="fixed bottom-0 left-60 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-6 py-4">
          <div className="flex items-center justify-between max-w-5xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {totalDraft} assignment{totalDraft>1?'s':''} pending
                </p>
                <p className="text-xs text-slate-500">Changes are staged but not yet saved</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={discardChanges}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Discard Changes
              </button>
              <button onClick={saveChanges}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                <Check className="w-4 h-4" />
                Save {totalDraft} Assignment{totalDraft>1?'s':''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Root page (with Suspense for useSearchParams)
// ═══════════════════════════════════════════════════════════════════════════════
function OrderManagementContent() {
  const searchParams           = useSearchParams()
  const router                 = useRouter()
  const { currentUser }        = useCurrentUser()
  const role                   = currentUser.role
  const rawTab                 = searchParams.get('tab') ?? 'grid'
  const [tab, setTab]          = useState<'grid'|'new'|'assignment'>(rawTab as 'grid'|'new'|'assignment')
  // Phase C: track BOTH the just-submitted grid id (for highlighting in the
  // assignment view) and its name (for the success toast).
  const [newlySubmitted,   setNewlySubmitted]   = useState<string|undefined>()
  const [newlySubmittedId, setNewlySubmittedId] = useState<string|undefined>()
  const [submitSuccess,    setSubmitSuccess]    = useState(false)

  // Keep tab in sync with URL
  useEffect(() => {
    if (rawTab === 'grid' || rawTab === 'new' || rawTab === 'assignment') setTab(rawTab)
  }, [rawTab])

  const switchTab = (t: 'grid'|'new'|'assignment') => {
    setTab(t)
    router.push(`/order-management?tab=${t}`, { scroll: false })
  }

  const handleNewOrderDone = (gridId: string, gridName: string) => {
    setNewlySubmitted(gridName)
    setNewlySubmittedId(gridId)
    setSubmitSuccess(true)
    // Buying team → auto to assignment so the Sourcing Manager can pick it up
    if (role === 'buying-poc') {
      setTimeout(() => { setSubmitSuccess(false); switchTab('assignment') }, 1800)
    } else {
      setTimeout(() => { setSubmitSuccess(false); switchTab('grid') }, 1800)
    }
  }

  // Subtitle based on role
  const roleSubtitle: Record<UserRole, string> = {
    'buying-poc':       'Upload & track your order grids',
    'sourcing-poc':     'Manage assigned styles',
    'sourcing-mgr':     'Full team visibility',
    'sourcing-mis':     'View order status',
    'qa-inspector':     'View order status',
    'qa-mgr':           'View order status',
    'warehouse-ops':    'View inward plans',
    'category-head':    'Category-level order view',
    'vendor':           'View order status',
    'designer':         'View order status',
    'fit-technician':   'View order status',
    'super-admin':      'Full system access',
  }

  return (
    <>
      <Header title="OTB Management" subtitle={roleSubtitle[role]} />

      {/* Success toast */}
      {submitSuccess && (
        <div className="fixed top-16 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-in">
          <CheckCircle2 className="w-4 h-4" />
          {role === 'buying-poc'
            ? `"${newlySubmitted}" submitted → routing to Assignment`
            : `"${newlySubmitted}" submitted successfully`
          }
        </div>
      )}

      <div className="px-6 py-5">
        {/* Tab navigation lives in the global sidebar, so we only float the
            NotificationCenter here, top-right, where the tab bar used to sit. */}
        <div className="flex items-center justify-end mb-4">
          <NotificationCenter />
        </div>

        {/* Tab content (deep-linked from the sidebar via `?tab=...`) */}
        {tab==='grid'       && <OrderGridView onNewOrder={() => switchTab('new')} />}
        {tab==='new'        && <NewOrderView onSubmitDone={handleNewOrderDone} />}
        {tab==='assignment' && <OrderAssignmentView highlightGrid={newlySubmittedId} />}
      </div>
    </>
  )
}

export default function OrderManagementPage() {
  return (
    <Suspense fallback={null}>
      <GridStoreProvider seedAssignGrids={MOCK_ASSIGN_GRIDS}>
        <OrderManagementContent />
      </GridStoreProvider>
    </Suspense>
  )
}
