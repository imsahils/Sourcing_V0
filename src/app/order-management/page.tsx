'use client'
import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Upload, Download, Plus, Trash2, Eye, EyeOff, CheckCircle2,
  FileSpreadsheet, ChevronRight, Clock, AlertCircle, X,
  Search, ArrowLeft, Send, RotateCcw, Pencil, Check,
  LayoutGrid, GitMerge, Users, ShoppingBag, UserCheck,
  Filter, MoreHorizontal, ChevronDown, Tag, Info,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'
import { useCurrentUser, type UserRole } from '@/lib/user-context'

// ─── Shared types ─────────────────────────────────────────────────────────────
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
  handoverDate: string
  designer: string
  notes: string
}

type OrderGridRecord = {
  id: string
  name: string
  season: string
  source: 'buying' | 'sourcing'
  createdBy: string
  onBehalfOf: string
  date: string
  styleCount: number
  assignedCount: number
  status: 'draft' | 'submitted' | 'partial' | 'assigned' | 'in-progress' | 'completed'
}

type AssignStyle = {
  id: string
  styleCode: string
  styleName: string
  qty: number
  gender: string
  assignedTo: string
  productGroup?: string
  type?: string
  subType?: string
  fabric?: string
  ageGroup?: string
  colorFamily?: string
  season?: string
  drop?: string
  mrp?: number
  targetPrice?: number
}

type AssignGrid = {
  id: string
  name: string
  source: 'buying' | 'sourcing'
  createdBy: string
  onBehalfOf: string
  date: string
  styles: AssignStyle[]
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
const MOCK_ORDER_GRIDS: OrderGridRecord[] = [
  { id:'og1', name:'NN AW26 Outer Wear Batch 1',  season:'AW 26', source:'buying',   createdBy:'Priya Sharma',    onBehalfOf:'',             date:'26 Feb 2026', styleCount:42, assignedCount:42, status:'in-progress'},
  { id:'og2', name:'NN SS26 Knits Batch 2',        season:'SS 26', source:'sourcing', createdBy:'Parthipan Kumar', onBehalfOf:'',             date:'18 Feb 2026', styleCount:28, assignedCount:28, status:'assigned'   },
  { id:'og3', name:'NN SS26 Woven Bottoms',        season:'SS 26', source:'sourcing', createdBy:'Parthipan Kumar', onBehalfOf:'Neha Gupta',   date:'10 Feb 2026', styleCount:15, assignedCount:10, status:'partial'    },
  { id:'og4', name:'NN AW26 Infants Range',        season:'AW 26', source:'buying',   createdBy:'Ananya Joshi',    onBehalfOf:'',             date:'03 Feb 2026', styleCount:33, assignedCount:0,  status:'submitted'  },
  { id:'og5', name:'NN SS26 Girls Dresses Draft',  season:'SS 26', source:'sourcing', createdBy:'Rajesh Menon',    onBehalfOf:'',             date:'28 Jan 2026', styleCount:9,  assignedCount:5,  status:'partial'    },
  { id:'og6', name:'NN AW26 Boys Basics',          season:'AW 26', source:'sourcing', createdBy:'Sahil Sharma',    onBehalfOf:'',             date:'01 May 2026', styleCount:12, assignedCount:0,  status:'draft'      },
]

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
  whBhw:'', whDel:'', whBlr:'', handoverDate:'', designer:'', notes:'',
})

const SAMPLE_IMPORT: GridRow[] = [
  { id:'r1', disabled:false, styleCode:'NNNBOW00740', styleName:'RED DISNEY CARS PRINTED PUFFER JACKET WITH HOOD',                gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'RED',    activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1299', targetPrice:'390', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', designer:'SUBASHREE', notes:'' },
  { id:'r2', disabled:false, styleCode:'NNNBOW00741', styleName:'BLUE OMBRE COLORBLOCK PUFFER JACKET WITH HOOD',                 gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'BLUE',   activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1299', targetPrice:'390', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', designer:'SUBASHREE', notes:'' },
  { id:'r3', disabled:false, styleCode:'NNNBOW00742', styleName:'BLACK AND YELLOW COLOURBLOCK PUFFER JACKET WITH HOOD',          gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'BLACK',  activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1299', targetPrice:'390', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', designer:'SUBASHREE', notes:'' },
  { id:'r4', disabled:false, styleCode:'NNNGOW00744', styleName:'YELLOW MINNIE POLKA PRINTED PUFFER JACKET WITH DETACHABLE HOOD', gender:'GIRLS', productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'2-10Y', colorFamily:'YELLOW', activeSizes:'2-3Y;3-4Y;4-5Y;5-6Y;7-8Y;9-10Y', sizeRatio:'1:1:1:1:1:1', orderQty:'400', mrp:'1499', targetPrice:'450', whBhw:'200', whDel:'120', whBlr:'80', handoverDate:'25/02/2026', designer:'SUBASHREE', notes:'' },
  { id:'r5', disabled:false, styleCode:'NNIBOW00748', styleName:'BLUE AND GREEN COLOURBLOCK PUFFER JACKET WITH HOOD',            gender:'BOYS',  productGroup:'OUTER_WEAR', type:'JACKETS', subType:'JACKET', season:'AW 26', drop:'JULY', fabric:'POLYESTER', ageGroup:'3M-2Y', colorFamily:'BLUE',   activeSizes:'3-6M;6-9M;9-12M;12-18M;18-24M',  sizeRatio:'2:2:3:3:3',     orderQty:'400', mrp:'1199', targetPrice:'360', whBhw:'180', whDel:'140', whBlr:'80', handoverDate:'25/02/2026', designer:'SUBASHREE', notes:'' },
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

// ─── Status badge helpers ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: OrderGridRecord['status'] }) {
  const map: Record<OrderGridRecord['status'], string> = {
    draft:         'bg-slate-100 text-slate-600',
    submitted:     'bg-amber-100 text-amber-700',
    partial:       'bg-violet-100 text-violet-700',
    assigned:      'bg-indigo-100 text-indigo-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    completed:     'bg-green-100 text-green-700',
  }
  const labels: Record<OrderGridRecord['status'], string> = {
    draft:         'Draft',
    submitted:     'Submitted',
    partial:       'Partially Assigned',
    assigned:      'Assigned',
    'in-progress': 'In Progress',
    completed:     'Completed',
  }
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', map[status])}>
      {labels[status]}
    </span>
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
  const assignGrid = MOCK_ASSIGN_GRIDS.find(g => g.id === grid.id)
  const pct = Math.round((grid.assignedCount / grid.styleCount) * 100)

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
  const [grids, setGrids] = useState<OrderGridRecord[]>(MOCK_ORDER_GRIDS)
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
    const assignGrid = MOCK_ASSIGN_GRIDS.find(a => a.id === g.id)
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
              {['Order Grid Name','Source','Season','Styles','Assigned','Status','Date','Actions'].map(h => (
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
                      <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${Math.round(g.assignedCount/g.styleCount*100)}%` }} />
                    </div>
                    <span className="text-slate-500">{g.assignedCount}/{g.styleCount}</span>
                  </div>
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
function NewOrderView({ onSubmitDone }: { onSubmitDone: (gridName: string) => void }) {
  const { currentUser }                 = useCurrentUser()
  const role                            = currentUser.role
  const [gridName, setGridName]         = useState('')
  const [editingName, setEditingName]   = useState(false)
  const [rows, setRows]                 = useState<GridRow[]>([])
  const [dragOver, setDragOver]         = useState(false)
  const [importState, setImportState]   = useState<'idle'|'loading'|'done'>('idle')
  const [mode, setMode]                 = useState<'idle'|'upload'|'manual'>('idle')
  const [searchQ, setSearchQ]           = useState('')
  const [showOnBehalf, setShowOnBehalf] = useState(false)
  const [onBehalf, setOnBehalf]         = useState<OnBehalfData>({ type: 'self', buyingPerson: '', notes: '' })
  const [submitted, setSubmitted]       = useState(false)
  const fileRef                         = useRef<HTMLInputElement>(null)

  const isBuying   = role === 'buying-poc'
  const isSourcing = role === 'sourcing-poc' || role === 'sourcing-mgr'

  // Row mutations
  const updateRow = useCallback((id: string, field: keyof GridRow, val: string) =>
    setRows(p => p.map(r => r.id===id ? {...r, [field]:val} : r)), [])
  const toggleRow = (id: string) => setRows(p => p.map(r => r.id===id ? {...r, disabled:!r.disabled} : r))
  const deleteRow = (id: string) => setRows(p => p.filter(r => r.id!==id))
  const addRow    = () => { setRows(p => [...p, EMPTY_ROW()]); setMode('manual') }

  // Import sim
  const runImport = () => {
    setImportState('loading')
    setMode('upload')
    setTimeout(() => {
      setRows(SAMPLE_IMPORT)
      if (!gridName) setGridName(isBuying ? 'Buying AW26 Outer Wear Batch' : 'NN AW26 Outer Wear Batch 1')
      setImportState('done')
      // Sourcing roles must do on-behalf attribution
      if (isSourcing) setTimeout(() => setShowOnBehalf(true), 300)
    }, 1400)
  }

  const downloadTemplate = () => {
    const csv = 'styleCode,styleName,gender,productGroup,type,subType,season,drop,fabric,ageGroup,colorFamily,activeSizes,sizeRatio,orderQty,mrp,targetPrice,handoverDate,designer,notes\n'
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download:'Fabricate_OrderGrid_Template.csv' })
    a.click()
  }

  const handleSubmit = () => {
    if (isBuying) { onSubmitDone(gridName); return }
    if (isSourcing && !showOnBehalf) { setShowOnBehalf(true); return }
    onSubmitDone(gridName)
  }

  const q           = searchQ.toLowerCase()
  const visible     = rows.filter(r => !q || r.styleCode.toLowerCase().includes(q) || r.styleName.toLowerCase().includes(q))
  const activeRows  = rows.filter(r => !r.disabled)
  const totalQty    = activeRows.reduce((s,r) => s+(parseInt(r.orderQty)||0), 0)
  const readyToSend = gridName.trim().length>0 && activeRows.length>0

  if (submitted) return null // handled by parent

  return (
    <div className="space-y-5">

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
                onClick={() => { setShowOnBehalf(false); onSubmitDone(gridName) }}
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
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={runImport} />
          <button onClick={addRow}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        </div>
      </div>

      {/* Empty state — only shown if not in manual mode */}
      {rows.length===0 && mode==='idle' && importState!=='loading' && (
        <div className="grid grid-cols-2 gap-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); runImport() }}
            onClick={() => fileRef.current?.click()}
            className={cn('border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
              dragOver ? 'border-violet-500 bg-violet-50 scale-[1.01]' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30'
            )}>
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-violet-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900">Import from Excel</p>
              <p className="text-xs text-slate-500 mt-1">Drag & drop or click to browse</p>
              {isSourcing && <p className="text-xs text-amber-600 mt-1 font-medium">You&apos;ll be asked to attribute this upload</p>}
            </div>
            <button onClick={e => { e.stopPropagation(); downloadTemplate() }}
              className="flex items-center gap-1 text-xs text-violet-600 hover:underline font-medium">
              <Download className="w-3 h-3" /> Download template first
            </button>
          </div>
          <div onClick={addRow}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer bg-white hover:border-slate-300 hover:bg-slate-50/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Plus className="w-6 h-6 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900">Create Manually</p>
              <p className="text-xs text-slate-500 mt-1">Build order grid row by row — no Excel needed</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {importState==='loading' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-[3px] border-violet-600 border-t-transparent animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">Parsing order grid…</p>
            <p className="text-xs text-slate-400 mt-1">Validating style codes · mapping fields · checking sizes</p>
          </div>
        </div>
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
                  <th colSpan={3} className="sticky left-0 z-30 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Style</th>
                  <th colSpan={8} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Classification</th>
                  <th colSpan={2} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left border-r border-slate-700">Sizing</th>
                  <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-right border-r border-slate-700">Commercial</th>
                  <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-amber-400 text-center border-r border-slate-700">▸ Warehouse Split</th>
                  <th colSpan={3} className="px-3 py-1.5 text-xs font-bold text-slate-400 text-left">Ops</th>
                </tr>
                <tr className="bg-slate-800 text-white">
                  <th className="sticky left-0 z-30 bg-slate-800 w-9 px-2 py-2.5 text-xs font-semibold text-slate-400 text-center border-r border-slate-700">#</th>
                  <th className="sticky left-9 z-30 bg-slate-800 w-32 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Style Code</th>
                  <th className="sticky left-[164px] z-30 bg-slate-800 w-56 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Style Name</th>
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
                  <th className="w-28 px-3 py-2.5 text-xs font-semibold text-left border-r border-slate-700">Inward Date</th>
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
                  return (
                    <tr key={row.id} className={cn('border-b border-slate-100 hover:bg-violet-50/10', row.disabled && 'opacity-50')}>
                      <td className={cn('sticky left-0 z-10 w-9 px-2 py-1.5 text-xs text-slate-400 text-center border-r border-slate-100', bg)}>{idx+1}</td>
                      {/* Style Code — combobox */}
                      <ComboCell value={row.styleCode} onChange={v => updateRow(row.id,'styleCode',v)} options={STYLE_CODES} rowDisabled={row.disabled}
                        className={cn('sticky left-9 z-10 w-32', bg)} />
                      <Cell value={row.styleName}    onChange={v => updateRow(row.id,'styleName',v)}    rowDisabled={row.disabled} placeholder="Style name"  className={cn('sticky left-[164px] z-10 w-56', bg)} />
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
                      <Cell value={row.handoverDate} onChange={v => updateRow(row.id,'handoverDate',v)} rowDisabled={row.disabled} placeholder="DD/MM/YYYY"  className="w-28" />
                      <Cell value={row.designer}     onChange={v => updateRow(row.id,'designer',v)}     type="select" options={DESIGNER_OPTIONS} rowDisabled={row.disabled} className="w-28" />
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

  // Committed state
  const [grids, setGrids]             = useState<AssignGrid[]>(MOCK_ASSIGN_GRIDS)
  const [expandedId, setExpandedId]   = useState<string|null>(highlightGrid || 'og4')
  const [filter, setFilter]           = useState<'all'|'buying'|'sourcing'>('all')

  // Draft changes: gridId → { styleId → newPoc }  (staged, not yet saved)
  const [draft, setDraft]             = useState<Record<string, Record<string, string>>>({})

  // Selection: gridId → Set of selected styleIds
  const [selected, setSelected]       = useState<Record<string, string[]>>({})

  // Per-grid "assign selected to" poc dropdown
  const [selPoc, setSelPoc]           = useState<Record<string, string>>({})

  // Per-grid "bulk all to" poc dropdown
  const [bulkPoc, setBulkPoc]         = useState<Record<string, string>>({})

  // Save toast
  const [savedToast, setSavedToast]   = useState(false)

  // Sort/filter per-grid state
  type SortDir = 'asc' | 'desc'
  const [sortState, setSortState]     = useState<Record<string, { col: keyof AssignStyle; dir: SortDir }>>({})
  const [colFilters, setColFilters]   = useState<Record<string, Record<string, string>>>({})
  const [filterOpen, setFilterOpen]   = useState<string | null>(null) // `${gridId}:${col}`

  const toggleSort = (gridId: string, col: keyof AssignStyle) => {
    setSortState(p => {
      const cur = p[gridId]
      if (!cur || cur.col !== col) return { ...p, [gridId]: { col, dir: 'asc' } }
      if (cur.dir === 'asc')        return { ...p, [gridId]: { col, dir: 'desc' } }
      const next = { ...p }; delete next[gridId]; return next
    })
  }

  const applyColFilter = (gridId: string, col: string, val: string) =>
    setColFilters(p => ({ ...p, [gridId]: { ...(p[gridId] || {}), [col]: val } }))

  const clearColFilter = (gridId: string, col: string) =>
    setColFilters(p => { const g = { ...(p[gridId] || {}) }; delete g[col]; return { ...p, [gridId]: g } })

  const getFilteredSorted = (gridId: string, styles: AssignStyle[]) => {
    const filters = colFilters[gridId] || {}
    let result = styles.filter(s =>
      Object.entries(filters).every(([col, val]) => {
        if (!val) return true
        if (col === 'assignedTo') {
          const eff = draft[gridId]?.[s.id] !== undefined ? draft[gridId][s.id] : s.assignedTo
          return val === '__unassigned__' ? !eff : eff === val
        }
        const sv = String((s as Record<string,unknown>)[col] ?? '')
        return sv === val
      })
    )
    const sort = sortState[gridId]
    if (sort) {
      result = [...result].sort((a, b) => {
        const av = (a as Record<string,unknown>)[sort.col] ?? ''
        const bv = (b as Record<string,unknown>)[sort.col] ?? ''
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const totalDraft = Object.values(draft).reduce((n, m) => n + Object.keys(m).length, 0)

  // Effective assignment (draft overrides committed)
  const effectivePoc = (gridId: string, styleId: string, committed: string) =>
    draft[gridId]?.[styleId] !== undefined ? draft[gridId][styleId] : committed

  // Is a style in draft (changed)?
  const isDrafted = (gridId: string, styleId: string) =>
    draft[gridId]?.[styleId] !== undefined

  // Stage a single change
  const stage = (gridId: string, styleId: string, poc: string) =>
    setDraft(p => ({ ...p, [gridId]: { ...(p[gridId]||{}), [styleId]: poc } }))

  // Stage all styles in a grid
  const stageAll = (gridId: string, poc: string) => {
    const grid = grids.find(g => g.id===gridId)
    if (!grid) return
    const entries: Record<string,string> = {}
    grid.styles.forEach(s => { entries[s.id] = poc })
    setDraft(p => ({ ...p, [gridId]: { ...(p[gridId]||{}), ...entries } }))
  }

  // Stage only the selected styles in a grid
  const stageSelected = (gridId: string, poc: string) => {
    const sel = selected[gridId] || []
    if (!sel.length || !poc) return
    const entries: Record<string,string> = {}
    sel.forEach(id => { entries[id] = poc })
    setDraft(p => ({ ...p, [gridId]: { ...(p[gridId]||{}), ...entries } }))
    setSelected(p => ({ ...p, [gridId]: [] }))  // clear selection after staging
    setSelPoc(p => ({ ...p, [gridId]: '' }))
  }

  // Toggle a row's checkbox
  const toggleSel = (gridId: string, styleId: string) =>
    setSelected(p => {
      const cur = p[gridId] || []
      return { ...p, [gridId]: cur.includes(styleId) ? cur.filter(id=>id!==styleId) : [...cur, styleId] }
    })

  // Select all / deselect all for a grid
  const toggleAllSel = (gridId: string) => {
    const grid = grids.find(g => g.id===gridId)
    if (!grid) return
    const cur = selected[gridId] || []
    setSelected(p => ({
      ...p,
      [gridId]: cur.length === grid.styles.length ? [] : grid.styles.map(s=>s.id)
    }))
  }

  // Save all drafts → commit
  const saveChanges = () => {
    setGrids(prev => prev.map(g => {
      const changes = draft[g.id] || {}
      if (!Object.keys(changes).length) return g
      return { ...g, styles: g.styles.map(s => ({ ...s, assignedTo: changes[s.id] ?? s.assignedTo })) }
    }))
    setDraft({})
    setSelected({})
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2500)
  }

  const discardChanges = () => { setDraft({}); setSelected({}) }

  const canSeeAll = role==='sourcing-mgr' || role==='category-head'

  const filtered = grids.filter(g => filter==='all' ? true : g.source===filter)

  return (
    <>
      {/* ── Saved toast ── */}
      {savedToast && (
        <div className="fixed top-16 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Assignments saved successfully
        </div>
      )}

      <div className="space-y-4" style={{ paddingBottom: totalDraft > 0 ? '80px' : '0' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(['all','buying','sourcing'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  filter===f ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                )}>
                {f==='all'?'All Pending':f==='buying'?'From Buying':'From Sourcing'}
              </button>
            ))}
          </div>
          {canSeeAll && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full font-medium">
              Manager view — showing all POC submissions
            </span>
          )}
        </div>

        {/* Grid cards */}
        {filtered.map(grid => {
          const sel         = selected[grid.id] || []
          const selCount    = sel.length
          const allSelected = selCount === grid.styles.length && grid.styles.length > 0
          const someSel     = selCount > 0 && !allSelected
          const isExp       = expandedId === grid.id
          const gridDrafts  = Object.keys(draft[grid.id]||{}).length

          // Compute unassigned count using effective values
          const unassigned = grid.styles.filter(s => {
            const eff = effectivePoc(grid.id, s.id, s.assignedTo)
            return !eff
          }).length

          return (
            <div key={grid.id} className={cn(
              'bg-white rounded-2xl border overflow-hidden transition-all',
              grid.id===highlightGrid ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200',
              gridDrafts > 0 && 'border-amber-300'
            )}>
              {/* Card header */}
              <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors text-left"
                onClick={() => setExpandedId(isExp ? null : grid.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">{grid.name}</p>
                    <SourceBadge source={grid.source} onBehalfOf={grid.onBehalfOf} />
                    {grid.id===highlightGrid && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Just submitted</span>
                    )}
                    {gridDrafts > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        {gridDrafts} unsaved change{gridDrafts>1?'s':''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    by {grid.createdBy} · {grid.date} · {grid.styles.length} styles ·&nbsp;
                    <span className={cn('font-medium', unassigned>0 ? 'text-amber-600' : 'text-green-600')}>
                      {unassigned>0 ? `${unassigned} unassigned` : 'All assigned'}
                    </span>
                  </p>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', isExp && 'rotate-180')} />
              </button>

              {/* Expanded content */}
              {isExp && (
                <div className="border-t border-slate-100">

                  {/* ── Toolbar: bulk-all + selection actions ── */}
                  <div className="flex items-center gap-2 px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex-wrap">

                    {/* Bulk assign ALL */}
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 shrink-0">All styles:</span>
                      <select value={bulkPoc[grid.id]||''} onChange={e => setBulkPoc(p=>({...p,[grid.id]:e.target.value}))}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white">
                        <option value="">Select POC…</option>
                        {SOURCING_POCS.map(p => <option key={p}>{p}</option>)}
                        {role==='sourcing-poc' && <option value={currentUser.name}>Myself</option>}
                      </select>
                      <button disabled={!bulkPoc[grid.id]}
                        onClick={() => { stageAll(grid.id, bulkPoc[grid.id]); setBulkPoc(p=>({...p,[grid.id]:''})) }}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0',
                          bulkPoc[grid.id] ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}>
                        Assign All
                      </button>
                      {role==='sourcing-poc' && (
                        <button onClick={() => stageAll(grid.id, currentUser.name)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shrink-0">
                          → Myself
                        </button>
                      )}
                    </div>

                    {/* Assign SELECTED (visible only when rows checked) */}
                    {selCount > 0 && (
                      <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">
                        <span className="text-xs font-bold text-violet-700 shrink-0">
                          {selCount} selected:
                        </span>
                        <select value={selPoc[grid.id]||''} onChange={e => setSelPoc(p=>({...p,[grid.id]:e.target.value}))}
                          className="border border-violet-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white">
                          <option value="">Assign to…</option>
                          {SOURCING_POCS.map(p => <option key={p}>{p}</option>)}
                          {role==='sourcing-poc' && <option value={currentUser.name}>Myself</option>}
                        </select>
                        <button
                          disabled={!selPoc[grid.id]}
                          onClick={() => stageSelected(grid.id, selPoc[grid.id])}
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0',
                            selPoc[grid.id] ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          )}>
                          Assign {selCount}
                        </button>
                        <button onClick={() => setSelected(p=>({...p,[grid.id]:[]}))}
                          className="text-xs text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Style table ── */}
                  {(() => {
                    const visibleStyles  = getFilteredSorted(grid.id, grid.styles)
                    const activeFilters  = colFilters[grid.id] || {}
                    const gridSort       = sortState[grid.id]

                    // Plain function (NOT a React component) — avoids remount closure issues
                    const ch = (
                      col: keyof AssignStyle,
                      label: string,
                      opts: { sortable?: boolean; filterable?: boolean; align?: 'left'|'right'; width?: string } = {}
                    ) => {
                      const { sortable = false, filterable = false, align = 'left', width } = opts
                      const isSorted   = gridSort?.col === col
                      const filterKey  = `${grid.id}:${col}`
                      const isOpen     = filterOpen === filterKey
                      const activeVal  = activeFilters[col as string] || ''
                      const isFiltered = !!activeVal

                      // Compute unique values directly from grid.styles
                      const uniqVals = [...new Set(
                        grid.styles
                          .map(s => {
                            if (col === 'assignedTo') return effectivePoc(grid.id, s.id, s.assignedTo)
                            const v = s[col]
                            return v != null ? String(v) : ''
                          })
                          .filter(v => v !== '')
                      )].sort()

                      return (
                        <th key={col} className={cn('px-3 py-2.5 whitespace-nowrap', width)} style={{ textAlign: align }}>
                          <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
                            {sortable ? (
                              <button
                                onClick={() => toggleSort(grid.id, col)}
                                className={cn('flex items-center gap-0.5 font-semibold text-xs transition-colors',
                                  isSorted ? 'text-violet-600' : 'text-slate-500 hover:text-slate-800'
                                )}
                              >
                                {label}
                                <span className="text-[10px] ml-0.5">
                                  {isSorted ? (gridSort!.dir === 'asc' ? '↑' : '↓') : <span className="text-slate-300">↕</span>}
                                </span>
                              </button>
                            ) : (
                              <span className="font-semibold text-xs text-slate-500">{label}</span>
                            )}
                            {filterable && (
                              <div className="relative">
                                <button
                                  onClick={() => setFilterOpen(isOpen ? null : filterKey)}
                                  className={cn('p-0.5 rounded transition-colors',
                                    isFiltered ? 'text-violet-600 bg-violet-100' : 'text-slate-300 hover:text-slate-500'
                                  )}
                                  title={isFiltered ? `Filtered: ${activeVal}` : 'Filter'}
                                >
                                  <Filter className="w-3 h-3" />
                                </button>
                                {isOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(null)} />
                                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 overflow-hidden max-h-56 overflow-y-auto">
                                      <button
                                        onClick={() => { clearColFilter(grid.id, col as string); setFilterOpen(null) }}
                                        className={cn('w-full px-3 py-1.5 text-left text-xs transition-colors',
                                          !activeVal ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'
                                        )}
                                      >All</button>
                                      {col === 'assignedTo' && (
                                        <button
                                          onClick={() => { applyColFilter(grid.id, col as string, '__unassigned__'); setFilterOpen(null) }}
                                          className={cn('w-full px-3 py-1.5 text-left text-xs transition-colors',
                                            activeVal === '__unassigned__' ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-amber-600 hover:bg-amber-50'
                                          )}
                                        >Unassigned</button>
                                      )}
                                      {uniqVals.map(v => (
                                        <button key={v}
                                          onClick={() => { applyColFilter(grid.id, col as string, v); setFilterOpen(null) }}
                                          className={cn('w-full px-3 py-1.5 text-left text-xs transition-colors truncate',
                                            activeVal === v ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                                          )}
                                        >{v}</button>
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

                    // Active filter chips
                    const activeFilterEntries = Object.entries(activeFilters).filter(([,v]) => v)

                    return (
                      <>
                        {/* Active filter chips */}
                        {activeFilterEntries.length > 0 && (
                          <div className="flex items-center gap-1.5 px-4 py-2 bg-violet-50/60 border-b border-violet-100 flex-wrap">
                            <span className="text-xs text-violet-500 font-medium">Filters:</span>
                            {activeFilterEntries.map(([col, val]) => (
                              <span key={col} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                                <span className="opacity-60 capitalize">{col}:</span> {val === '__unassigned__' ? 'Unassigned' : val}
                                <button onClick={() => clearColFilter(grid.id, col)} className="hover:text-violet-900 ml-0.5"><X className="w-2.5 h-2.5" /></button>
                              </span>
                            ))}
                            <button onClick={() => setColFilters(p => ({...p, [grid.id]: {}}))} className="text-xs text-violet-400 hover:text-violet-700 ml-1">Clear all</button>
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs" style={{ minWidth: '1100px' }}>
                            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                              <tr>
                                {/* Select-all */}
                                <th className="px-4 py-2.5 w-8">
                                  <input type="checkbox"
                                    checked={allSelected}
                                    ref={el => { if (el) el.indeterminate = someSel }}
                                    onChange={() => toggleAllSel(grid.id)}
                                    className="rounded accent-violet-600 cursor-pointer w-3.5 h-3.5"
                                  />
                                </th>
                                {ch('styleCode',    'Style Code',    { sortable: true,  filterable: true  })}
                                {ch('styleName',    'Style Name',    { sortable: true,  width: 'min-w-[200px]' })}
                                {ch('gender',       'Gender',        { sortable: true,  filterable: true  })}
                                {ch('productGroup', 'Product Grp',   { filterable: true })}
                                {ch('type',         'Type',          { filterable: true })}
                                {ch('subType',      'Sub Type',      { filterable: true })}
                                {ch('fabric',       'Fabric',        { filterable: true })}
                                {ch('ageGroup',     'Age Grp',       { filterable: true })}
                                {ch('colorFamily',  'Colour',        { filterable: true })}
                                {ch('drop',         'Drop',          { filterable: true })}
                                {ch('qty',          'Qty',           { sortable: true,  align: 'right'    })}
                                {ch('mrp',          'MRP ₹',         { sortable: true,  align: 'right'    })}
                                {ch('targetPrice',  'Target ₹',      { sortable: true,  align: 'right'    })}
                                {ch('assignedTo',   'Assignment',    { filterable: true, width: 'min-w-[180px]' })}
                                <th className="px-3 py-2.5 text-left font-semibold text-xs text-slate-500 whitespace-nowrap min-w-[160px]">Assign To</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleStyles.map((s, i) => {
                                const isChecked = sel.includes(s.id)
                                const hasDraft  = isDrafted(grid.id, s.id)
                                const effective = effectivePoc(grid.id, s.id, s.assignedTo)
                                return (
                                  <tr key={s.id} className={cn(
                                    'border-b border-slate-100 last:border-b-0 transition-colors',
                                    isChecked ? 'bg-violet-50/60' : i%2===0 ? 'bg-white' : 'bg-slate-50/20',
                                    hasDraft && 'border-l-2 border-l-amber-400'
                                  )}>
                                    <td className="px-4 py-2.5">
                                      <input type="checkbox" checked={isChecked} onChange={() => toggleSel(grid.id, s.id)}
                                        className="rounded accent-violet-600 cursor-pointer w-3.5 h-3.5" />
                                    </td>
                                    <td className="px-3 py-2.5 font-mono font-semibold text-violet-700 whitespace-nowrap">{s.styleCode}</td>
                                    <td className="px-3 py-2.5 text-slate-700 max-w-[220px]">
                                      <p className="truncate">{s.styleName}</p>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold',
                                        s.gender === 'BOYS' ? 'bg-blue-50 text-blue-700' : s.gender === 'GIRLS' ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-600'
                                      )}>{s.gender}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.productGroup ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.type ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.subType ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.fabric ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.ageGroup ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.colorFamily ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.drop ?? '—'}</td>
                                    <td className="px-3 py-2.5 font-semibold text-slate-900 text-right whitespace-nowrap">{s.qty.toLocaleString()}</td>
                                    <td className="px-3 py-2.5 text-slate-600 text-right whitespace-nowrap">{s.mrp ? `₹${s.mrp.toLocaleString()}` : '—'}</td>
                                    <td className="px-3 py-2.5 text-slate-600 text-right whitespace-nowrap">{s.targetPrice ? `₹${s.targetPrice.toLocaleString()}` : '—'}</td>
                                    {/* Assignment status */}
                                    <td className="px-3 py-2.5 min-w-[180px]">
                                      {hasDraft ? (
                                        <div className="flex items-center gap-1">
                                          {effective
                                            ? <span className="flex items-center gap-1 text-amber-700 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{effective}</span>
                                            : <span className="text-slate-400 italic">Unassigned</span>
                                          }
                                          <span className="text-[10px] text-amber-500 font-medium">(unsaved)</span>
                                        </div>
                                      ) : effective ? (
                                        <span className="flex items-center gap-1 text-green-700 font-medium"><Check className="w-3 h-3" />{effective}</span>
                                      ) : (
                                        <span className="text-slate-400">Unassigned</span>
                                      )}
                                    </td>
                                    {/* Assign dropdown */}
                                    <td className="px-3 py-2.5">
                                      <select value={effective} onChange={e => stage(grid.id, s.id, e.target.value)}
                                        className={cn('border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white min-w-[140px]',
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
                              {visibleStyles.length === 0 && (
                                <tr><td colSpan={16} className="px-4 py-8 text-center text-slate-400">No styles match the active filters.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length===0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
            <p className="text-sm font-semibold text-slate-700">All order grids are fully assigned</p>
            <p className="text-xs text-slate-400">No pending assignments for this filter</p>
          </div>
        )}
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
  const [newlySubmitted, setNewlySubmitted] = useState<string|undefined>()
  const [submitSuccess, setSubmitSuccess]   = useState(false)

  // Keep tab in sync with URL
  useEffect(() => {
    if (rawTab === 'grid' || rawTab === 'new' || rawTab === 'assignment') setTab(rawTab)
  }, [rawTab])

  const switchTab = (t: 'grid'|'new'|'assignment') => {
    setTab(t)
    router.push(`/order-management?tab=${t}`, { scroll: false })
  }

  const handleNewOrderDone = (gridName: string) => {
    setNewlySubmitted(gridName)
    setSubmitSuccess(true)
    // Buying team → auto to assignment
    if (role === 'buying-poc') {
      setTimeout(() => { setSubmitSuccess(false); switchTab('assignment') }, 1800)
    } else {
      setTimeout(() => { setSubmitSuccess(false); switchTab('grid') }, 1800)
    }
  }

  const TAB_CONFIG = [
    { key:'grid',       label:'Order Grid',       icon:LayoutGrid,  desc:'All submitted grids'        },
    { key:'new',        label:'New Order',         icon:Plus,        desc:'Create or import'           },
    { key:'assignment', label:'Order Assignment',  icon:GitMerge,    desc:'Assign to sourcing POCs'    },
  ] as const

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
        {/* Sub-nav */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 mb-6 w-fit">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => switchTab(key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                tab===key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab==='grid'       && <OrderGridView onNewOrder={() => switchTab('new')} />}
        {tab==='new'        && <NewOrderView onSubmitDone={handleNewOrderDone} />}
        {tab==='assignment' && <OrderAssignmentView highlightGrid={newlySubmitted ? 'og4' : undefined} />}
      </div>
    </>
  )
}

export default function OrderManagementPage() {
  return (
    <Suspense fallback={null}>
      <OrderManagementContent />
    </Suspense>
  )
}
