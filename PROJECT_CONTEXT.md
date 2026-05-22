# Fabricate OMS — Project Context

> Hand this file to a new Claude session before any PRD or build discussion.
> It covers the business process, data model, user roles, and existing module state.

---

## 1. What This App Is

**Fabricate** is a Sourcing Order Management System (OMS) for **Nautinati** (a children's fashion brand under TMRW House of Brands). It manages the full lifecycle of a garment order — from OTB buying plan → vendor sourcing → production → warehouse inward.

**Tech stack:** Next.js 15 App Router, TypeScript, static export (`output: 'export'`), Tailwind + Manju Design System (terra-cotta `#CC785C`, warm stone neutrals). No backend for now — mock data fallback.

**Repo:** `https://github.com/imsahils/Sourcing_V0.git`
**Deployed:** `ubiquitous-cat-1c6553.netlify.app`

---

## 2. User Roles

| Role | What they do |
|---|---|
| `buying-poc` | Raises the OTB demand — creates style briefs with qty, target price, handover date |
| `category-head` | Oversees the buying plan, reviews OTIF, approves escalations |
| `sourcing-mgr` | Assigns order grids to Sourcing POCs, reviews portfolio health, manages escalations |
| `sourcing-poc` | Owns execution — assigns vendor, closes costing, tracks pre-prod & production |
| `sourcing-mis` | Manages purchase orders in D365 |
| `vendor` | Views their assigned orders, updates production, submits costing |
| `qa-mgr` / `qa-inspector` | Manages final inspections (FI) |
| `warehouse-ops` | Receives goods, does GRN |
| `designer` / `fit-technician` | Approves samples in pre-production |

---

## 3. The Order Lifecycle (The Spine)

Every sub-order moves through these stages in order:

```
order-brief → assigned → vendor → costing → pre-prod → production → fi → asn → grn
```

| Stage | Who acts | What happens |
|---|---|---|
| `order-brief` | Buying POC | Style brief created — style code, qty, target price, handover date, category, gender, fabric |
| `assigned` | Sourcing Mgr | Order assigned to a Sourcing POC |
| `vendor` | Sourcing POC | Vendor selected and confirmed |
| `costing` | Sourcing POC + Vendor | Target price negotiated, cost sheet submitted, approved/escalated |
| `pre-prod` | Sourcing POC + Designer + Fit Tech | Lab dip, strike off, fit sample, fabric inward, PP sample, GPT, PP fit — each needs approval |
| `production` | Sourcing POC (on behalf of Vendor) | Daily production updates: cut qty, sewing qty, packed qty |
| `fi` | QA Inspector / QA Mgr | Final inspection scheduled, conducted, result: pass/fail/hold |
| `asn` | Vendor / Sourcing MIS | Advance Shipment Notice raised, goods dispatched |
| `grn` | Warehouse Ops | Goods Received Note — inward qty confirmed per warehouse |

---

## 4. Core Data Types (from `src/lib/types.ts`)

### SubOrder — the atomic execution unit
```typescript
interface SubOrder {
  id: string                  // Fabricate Code e.g. NNKNTW250001
  styleCode: string           // e.g. NN401-238
  styleName: string
  colour: string
  category: string            // Knits / Wovens / etc.
  product: string             // Dress / T-shirt / Jacket
  season: string              // AW 26 / SS 26
  orderType: 'NEW' | 'REPLEN'
  tier: 'HERO' | 'TIER-1' | 'TIER-2' | 'TAIL'
  gender: string
  ageGroup: string
  fabricQuality: string
  vendor: Vendor
  poc: User                   // Sourcing POC assigned
  status: SubOrderStatus      // on-track | needs-attention | overdue | completed | not-started
  currentStage: SpineStage    // where it sits on the spine right now
  atRisk: boolean

  // Key dates
  handoverDate: string             // buying's internal deadline
  orderToVendorDate: string        // when order was placed with vendor
  buyingExpectedInwardDate: string // when buying expects goods at WH
  vendorPromisedDate: string       // what vendor committed
  costingApprovedDate?: string

  // Costing
  targetPrice: number
  closedCost?: number
  costStatus: 'pending' | 'submitted' | 'approved' | 'escalated'

  // Quantities (live production progress)
  orderQty: number
  cutQty: number
  sewingQty: number
  packedQty: number
  fiQty: number
  dispatchedQty: number
  grnQty: number

  // Linked data
  poNumbers: { warehouse: string; poNumber: string; qty: number }[]
  preProdStages: PreProdStage[]
  productionHistory: ProductionEntry[]
  fiRequests: FIRequest[]
  samples?: SampleRecord[]
  history: ActivityLog[]
}
```

### Other key types
```typescript
interface Vendor {
  id, name, location, contactName, contactPhone, contactEmail
  tier, otifScore, fiPassRate
}

interface User {
  id, name, initials, role: Role, brand, email
}

interface QueueItem {
  subOrderId, styleCode, colour, vendorName
  actionType: 'production-update-overdue' | 'pre-prod-overdue' | 'fi-needed' |
              'costing-due' | 'sample-approval-pending' | 'asn-pending' | 'grn-pending'
  urgency: 'overdue' | 'due-today'
  ctaLabel, ctaRoute   // ctaRoute = '/portfolio/ID?tab=production'
}
```

---

## 5. Existing Modules (Routes)

| Route | Module | Status | Key tabs |
|---|---|---|---|
| `/queue` | My Queue | ✅ Built | — (single view, opens right drawer) |
| `/portfolio` | My Portfolio | ✅ Built | dashboard, vendor-assign, costing, pre-production, production, inspection, asn |
| `/portfolio/[id]` | Sub-order Detail | ✅ Built | overview, costing, pre-prod, production, samples, inspection, asn-grn, history |
| `/order-management` | OTB Management | 🔨 Partial | grid, new, assignment |
| `/vendors` | Vendor Master | 🔨 Partial | — |
| `/reports` | Reports / DPR | ✅ Built | overall OTIF, POC-level, vendor-level |
| `/purchase-orders` | Purchase Orders | 🔨 Partial | — |
| `/sampling` | Sampling | 🔨 Partial | — |
| `/manager` | Manager Queue | 🔨 Stub | — |
| `/category-head` | Category Head | 🔨 Stub | — |
| `/qa` | QA Dashboard | 🔨 Stub | — |
| `/warehouse` | Warehouse / GRN | 🔨 Stub | — |
| `/vendor-portal` | Vendor Portal | 🔨 Stub | — |

---

## 6. OTB Management — Current State

**Route:** `/order-management` with `?tab=grid | new | assignment`

### What's already built (partially)

**Order Grid tab** shows a list of "Order Grid Records" — each record is a batch of styles raised for a season:

```typescript
type OrderGridRecord = {
  id: string
  name: string               // e.g. "NN AW26 Outer Wear Batch 1"
  season: string             // AW 26 / SS 26
  source: 'buying' | 'sourcing'   // who created it
  createdBy: string          // person name
  onBehalfOf: string         // if Sourcing POC raised on behalf of Buying
  date: string               // creation date
  styleCount: number         // total styles in batch
  assignedCount: number      // how many have been assigned to a POC
  status: 'draft' | 'submitted' | 'partial' | 'assigned' | 'in-progress' | 'completed'
}
```

**Each grid record contains styles** (GridRow):
```typescript
type GridRow = {
  styleCode, styleName, gender, productGroup, type, subType,
  season, drop, fabric, ageGroup, colorFamily,
  activeSizes, sizeRatio, orderQty, mrp, targetPrice,
  whBhw, whDel, whBlr,       // warehouse-wise qty split
  handoverDate, designer, notes
}
```

**New Order tab** — form to create a new grid record (upload or manual entry)

**Order Assignment tab** — assign styles from a submitted grid to Sourcing POCs

### What's NOT built / needs PRD
- Clear state machine for order grid status transitions
- Role-based view differences (Buying POC sees different columns/actions than Sourcing Mgr)
- Inline editing of grid rows
- Bulk actions (assign all, download, filter by status)
- How a grid record "becomes" individual SubOrders in the portfolio
- Approval flow (Buying submits → Sourcing Mgr reviews → assigns POCs → SubOrders created)

---

## 7. Key Business Rules

1. **One style = one colour = one SubOrder** (Fabricate Code). If a style comes in 3 colours, that's 3 sub-orders.

2. **OTB → SubOrder**: When a grid record goes from `assigned` → `in-progress`, the system should create SubOrders (one per style-colour) in the portfolio. Until that point they're just "order lines" in the grid.

3. **On Behalf Of**: A Sourcing POC can raise an order grid on behalf of a Buying POC. This needs to be tracked throughout (for attribution).

4. **Warehouse split**: Qty is split across warehouses (BHW, Delhi, Bangalore) at the order line level. This feeds into PO generation later.

5. **Tier classification** (HERO / TIER-1 / TIER-2 / TAIL): Assigned by Category Head. Drives priority visibility on the OTIF dashboard.

6. **Drop = delivery month**: Each style has a target drop month. This sets the expected inward date at the warehouse.

---

## 8. Existing Mock Data Samples

### Vendors (10 records)
BHARTI APPARELS (Faridabad, OTIF 74%), ARIHANT FASHIONS (Kolkata, 61%), IDS FASHION (Noida, 55%), BS FASHION (Kolkata, 80%), DIV CREATIONS (Faridabad, 68%), AND DESIGN (Jaipur, 72%), ADITEE INTERNATIONAL (Jaipur, 63%), CAARVI TEXTILES (Delhi, 77%), PESOS VISION (Mumbai, 70%), SWARA CREATION (Surat, 65%)

### SubOrders (23 records)
IDs: NNKNTW250001 through NNKNTW250031 (with gaps). All Nautinati brand, seasons AW26/SS26.
Categories: Knits, Wovens, Denim, Outerwear. Stages spread across the full spine.

### Order Grid Records (6 mock batches)
- NN AW26 Outer Wear Batch 1 (42 styles, in-progress)
- NN SS26 Knits Batch 2 (28 styles, assigned)
- NN SS26 Woven Bottoms (15 styles, partial — 10/15 assigned)
- NN AW26 Infants Range (33 styles, submitted — unassigned)
- NN SS26 Girls Dresses Draft (9 styles, partial)
- NN AW26 Boys Basics (12 styles, draft)

---

## 9. Field Options Reference

```
GENDER:       BOYS, GIRLS, UNISEX, MEN, WOMEN, INFANTS, KIDS
PRODUCT:      OUTER_WEAR, TOP_WEAR, BOTTOM_WEAR, CLOTHING_SET, WINTER_WEAR, INNERWEAR, ACCESSORIES
TYPE:         JACKETS, T-SHIRTS, SHIRTS, SWEATSHIRTS, HOODIES, TROUSERS, JEANS, SHORTS, DRESSES, LEGGINGS, SETS
SUB-TYPE:     JACKET, BLAZER, DENIM JACKET, PU JACKET, SHACKET, SHRUG, WAISTCOAT, WIND CHEATERS, TRUCKER JACKET
SEASON:       AW 26, SS 26, SS 27, AW 27
DROP:         JANUARY … DECEMBER
FABRIC:       POLYESTER, COTTON, COTTON BLEND, RAYON, MODAL, NYLON, POLY VISCOSE, POLYCOTTON, DENIM, FLEECE, TERRY
AGE GROUP:    3M-2Y, 2-8Y, 2-10Y, 0-2Y, 4-8Y, 1-5Y, NA
COLOR FAMILY: RED, BLUE, BLACK, WHITE, GREEN, YELLOW, ORANGE, PINK, PURPLE, NAVY, GREY, BROWN, etc.
SOURCING POCS: Parthipan Kumar, Rajesh Menon, Kavitha Menon
BUYING PERSONS: Priya Sharma, Neha Gupta, Ananya Joshi, Pooja Mehta
DESIGNERS:    Subashree, Priya M, Megha S, Rahul K, Ananya B
```

---

## 10. Design System (Manju)

All new UI uses **inline styles + CSS custom properties** (no new Tailwind classes).

```
--ds-primary:      #CC785C   terra-cotta
--ds-primary-dark: #B5633E   hover
--ds-primary-light:#FDF0EB   active/tinted bg
--ds-bg:           #FAF9F6   page background
--ds-surface:      #FFFFFF   cards
--ds-text:         #1C1917   primary text
--ds-text-secondary:#78716C  labels
--ds-text-tertiary: #A8A29E  hints, placeholders
--ds-border:       #E7E5E0
--ds-bg-subtle:    #F5F4EF   table headers, hover rows
--ds-success:      #2E7D52
--ds-warning:      #92400E
--ds-danger:       #B91C1C
--ds-info:         #1D4ED8
--ds-sidebar-width:240px
```

CSS utility classes available globally: `ds-card`, `ds-card-flat`, `ds-badge ds-badge-green/yellow/red/blue/orange/gray`, `ds-btn ds-btn-primary/secondary/ghost/danger`, `ds-stat-card`, `ds-tabs ds-tab-btn`, `ds-filter-pill`, `ds-table`, `ds-alert ds-alert-error/success/warning/info`, `ds-modal ds-modal-overlay`, `ds-fade-in`, `ds-spinner ds-spinner-dark`

---

## 11. File Structure (key files)

```
src/
  app/
    layout.tsx                    # Root layout — sidebar + main
    globals.css                   # Manju design tokens + Tailwind
    login/page.tsx                # Login + demo user picker
    queue/page.tsx                # My Queue (with right-drawer SubOrderPanel)
    portfolio/page.tsx            # Portfolio dashboard (2000+ lines)
    portfolio/[id]/
      page.tsx                    # Static route wrapper
      SubOrderDetailClient.tsx    # SubOrderPanel + all tabs
    order-management/page.tsx     # OTB Management (1700 lines, partial)
    reports/page.tsx              # OTIF reports (2400 lines)
  components/
    layout/
      Sidebar.tsx                 # Manju-styled sidebar (inline styles)
      Header.tsx                  # Fixed top header
      Providers.tsx               # UserContext + ThemeContext + SidebarContext
  lib/
    types.ts                      # All TypeScript interfaces
    data.ts                       # Mock data (vendors, subOrders, queueItems)
    user-context.tsx              # UserRole type, UserProfile, ROLE_LABELS
    hooks/
      useSubOrders.ts             # Fetches + mock fallback
      useVendors.ts               # Fetches + mock fallback
      useUsers.ts                 # Fetches + mock fallback
    api/
      orders.ts                   # fetchSubOrders, fetchSubOrder
      vendors.ts                  # fetchVendors
      users.ts                    # fetchUsers
      auth.ts                     # login, logout, getToken
      adapters.ts                 # ApiSubOrder → SubOrder conversion
    sampling.ts                   # Sampling order types + mock data
    purchase-orders.ts            # PO types + mock data
```
