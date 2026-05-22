# Fabricate OMS — Product Roadmap
> **Last updated:** 21 May 2026 · **Brand baseline:** Bewakoof (Phase 1) → Nautinati (Phase 2)
> **Repo:** https://github.com/imsahils/Sourcing_V0 · **Live:** https://ubiquitous-cat-1c6553.netlify.app

---

## Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Built & live |
| 🔶 | Partially built — UI exists, logic incomplete |
| 🔲 | Planned — PRD written or scoped |
| 💡 | Idea / backlog — not yet scoped |

---

## Phase 0 — Foundation ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| Next.js 15 App Router setup (static export) | ✅ | `output: 'export'`, deployed to Netlify |
| Manju Design System | ✅ | Terra-cotta `#CC785C`, `--ds-*` CSS variables, warm stone neutrals |
| Auth / role context (`user-context.tsx`) | ✅ | 12 roles: buying-poc, sourcing-poc, sourcing-mgr, vendor, qa-inspector, qa-mgr, warehouse, mis, designer, fit-tech, category-head, super-admin |
| Sidebar navigation with role-aware links | ✅ | Collapsible, active state, notification bell |
| App header with breadcrumbs | ✅ | Sticky, role badge, search stub |
| Mock data layer with API fallback | ✅ | `src/lib/data.ts` — 26+ mock SubOrders across styles |
| SubOrder + Vendor + User type system | ✅ | Full spine stages, pre-prod stages, FI requests, sampling, POs |
| GridStore shared state (React context) | ✅ | submitGrid, applyAssignments, notification centre |
| Netlify deploy pipeline | ✅ | Auto-build on push, `netlify.toml` configured |

---

## Phase 1 — Core Execution Modules  🟡 IN PROGRESS

### 1A. Order Brief / Grid Submission ✅
| Feature | Status | Notes |
|---------|--------|-------|
| New Order Brief grid (CSV-like input) | ✅ | Row-by-row entry with validation, 20+ columns |
| Validation rules engine | ✅ | `grid-validation.ts` — required fields, qty checks, date logic |
| Excel-paste import | ✅ | Clipboard detection + column mapping |
| Draft → Submit flow | ✅ | Creates SubOrders + AssignGrid on submit |
| Grid template CSV export | ✅ | Downloadable prefilled template |
| On-behalf-of attribution | ✅ | Buying POC creates on behalf of designer / planner |
| Grid list view (`/order-management`) | ✅ | Status badges (draft / submitted / partial / assigned / in-progress), grid health |
| Notification on grid full-assignment | ✅ | Bell icon in header, real-time state |

### 1B. Sourcing POC Assignment ✅
| Feature | Status | Notes |
|---------|--------|-------|
| Assignment grid view | ✅ | Filter sidebar (Assignment Status, Order Grids, Source, Summary) |
| Bulk-assign POC to styles | ✅ | Row-by-row or multi-select assign |
| Auto-suggest assignments | ✅ | Based on assignment-rules (`src/lib/assignment-rules.ts`) |
| Re-assignment with notification | ✅ | Old POC and new POC both notified |
| Grid → partial / assigned status recompute | ✅ | Real-time as assignments change |

### 1C. Sourcing Portfolio (Sourcing POC) ✅
| Feature | Status | Notes |
|---------|--------|-------|
| Portfolio grid view | ✅ | 8,200-line component — 150+ columns, column picker, sticky cols, export |
| Status badges (OTIF, at-risk, stage) | ✅ | Colour-coded per spine stage |
| Column filters (per-column inline search/select) | ✅ | 20+ filterable columns |
| Export DPR (daily progress report) | ✅ | CSV export |
| Sub-order detail page (`/portfolio/[id]`) | ✅ | Full spine timeline, pre-prod stages, FI tab, production updates, costing |
| **Tracker View** | ✅ | Excel-like data grid with Edit/Save mode, Tab/Arrow key nav |
| Tracker View — filter sidebar | ✅ | Assignment Status, Category, Stage, GRN Delivery Month (hierarchical week view) |
| Tracker View — inline editing | ✅ | Closed Cost, Sourcing Note, Prod Status, GRN Plan Date, Lab Dip, Strike Off |
| PO amendment / cancellation initiation | 🔶 | UI stub in detail page — dual-approval backend logic pending |
| On-behalf-of upload attribution | 🔶 | Flag exists in types, not surfaced in all upload flows |

### 1D. Vendor Portal ✅
| Feature | Status | Notes |
|---------|--------|-------|
| Vendor dashboard (confirmed orders) | ✅ | Order list, production update form |
| Costing submission (vendor side) | ✅ | Price + breakdown sheet upload, cost sheet UI |
| Production update form | ✅ | Cut/Sewing/Packing qty, comments |
| RFQ inbox (view open RFQs) | ✅ | Quote or decline flow |
| Sample tracking / dispatch log | ✅ | Sample dispatch with courier + tracking |
| Pre-prod status view | ✅ | Lab dip, strike off approval status |

### 1E. Vendor RFQ / Assignment Flow 🔶
> **PRD:** `docs/prd-vendor-assignment.md` — Status: Build complete in worktree, needs merge

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-vendor RFQ send (bulk) | 🔶 | Single-vendor assign built; multi-vendor RFQ needs merge |
| Structured vendor response (price + date + capacity) | 🔶 | Response form in vendor portal, comparison view pending |
| Side-by-side RFQ comparison view | 🔲 | POC sees all responses in a table, selects best |
| Auto-reject other open RFQs on confirm | 🔲 | Backend state machine logic |
| Vendor workload context at decision time | 🔲 | Show active orders + capacity at shortlist stage |
| Order cancellation — dual approval flow | 🔲 | Category Head + Sourcing Director parallel sign-off |
| RFQ portfolio-wide visibility (Sourcing Mgr) | 🔲 | Read-only cross-POC RFQ status dashboard |

### 1F. Purchase Orders (MIS) 🔶
| Feature | Status | Notes |
|---------|--------|-------|
| PO list view (`/purchase-orders`) | ✅ | Filter by vendor, status, date |
| PO creation (D365 stub) | 🔶 | Form UI exists, no D365 integration yet |
| PO amendment flow | 🔲 | Qty/date change with sourcing approval |
| PO cancellation with PO# revocation | 🔲 | Linked to dual-approval cancellation flow |
| Warehouse-to-PO reconciliation | 🔲 | GRN qty match against PO qty |

### 1G. Inspection Module 🔶
> **PRD:** `docs/prd-inspection-module.md` — Phase 1 baseline brand: Bewakoof

| Feature | Status | Notes |
|---------|--------|-------|
| QA Manager inspection dashboard (`/qa`) | ✅ | Inspection pipeline, at-risk list, inspector workload |
| Inspector queue / portal (`/inspector`) | ✅ | Assigned inspection list, status cards, today's schedule |
| Inspection form — Sections A & B (AQL, measurements, photos) | 🔶 | Sections A & B built; C, D, E, F are stubs |
| AQL sampling size calculation | ✅ | `src/lib/aql.ts` — per-PO AQL with multi-color support |
| Pass / Fail / Hold result capture | 🔶 | Result capture built, gate-to-dispatch not wired |
| Real-time Inspector ↔ QA Manager consultation | 🔲 | Borderline AQL escalation chat / override |
| GPT waiver / exception flow | 🔲 | Lab test fail override with QA Head approval |
| Re-inspection workflow (linked report chain) | 🔲 | Round 2+ FI with prior report reference |
| Auto-generate brand-templated PDF report | 🔲 | Bewakoof report format from `Passed Inspection Report Format.pdf` |
| QA Cleared Qty gating dispatch (ASN stage) | 🔲 | SpineStage: `fi` → `asn` only after QA clearance |
| Weekly Inspection Planning Calendar | 🔲 | QA Manager calendar view for scheduling |
| Third-party inspector handling (unified role) | 🔲 | `inspector_type: in_house / third_party_agency` flag |
| Inspections listing page (`/inspections`) | ✅ | All inspections with status, result, vendor, style |

### 1H. Sample Tracking 🔶
| Feature | Status | Notes |
|---------|--------|-------|
| Sample dispatch log (`/sampling`) | ✅ | Sample records with courier + tracking number |
| Pre-prod stage approval chain | ✅ | Lab dip → Strike off → Fit → FPT → PP Sample per sub-order |
| Designer / Fit-tech approval flow | 🔶 | UI shows approval status; action buttons wired to mock only |
| Sample receipt confirmation (vendor side) | 🔲 | Vendor confirms sample received in portal |

---

## Phase 2 — Quality & Vendor Intelligence  🔲 PLANNED

### 2A. Vendor Scorecard & Performance
| Feature | Status |
|---------|--------|
| Vendor OTIF score (on-time in-full %) | 🔲 |
| Vendor Not Ready Rate (QA refusal %) | 🔲 |
| Costing accuracy (closed cost vs target) | 🔲 |
| Vendor tier auto-classification (HERO → TAIL) | 🔲 |
| Penalty calculation and documentation | 🔲 |
| Vendor comparison dashboard | 🔲 |

### 2B. Inspection Module — Phase 2
| Feature | Status |
|---------|--------|
| Auto-scheduling by inspector zone + specialisation | 🔲 |
| Style master / spec sheet integration (auto-load measurement points) | 🔲 |
| Tessera ASN integration (clearance flag) | 🔲 |
| Pre-production inspection detailed workflow | 🔲 |
| Inline (during production) inspection flow | 🔲 |
| Multi-brand report templates (Nautinati, Urbano, etc.) | 🔲 |

### 2C. Reports Module
| Feature | Status |
|---------|--------|
| FAT (Factory Acceptance Test) tracker | 🔲 |
| GPT (Goods Performance Test) tracker | 🔲 |
| Weekly QA summary report | 🔲 |
| Final Inspection summary report | 🔲 |
| NFP (Not For Production) tracker | 🔲 |
| OTIF dashboard (category / vendor / POC view) | 🔲 |
| GRN delay + penalty report | 🔲 |
| Sourcing POC performance dashboard | 🔲 |

### 2D. Warehouse Module
| Feature | Status |
|---------|--------|
| GRN entry form (`/warehouse`) | 🔶 |
| Warehouse-wise inward split | 🔲 |
| Shortage / excess qty handling | 🔲 |
| GRN vs ASN reconciliation | 🔲 |
| Damaged goods flag with photo upload | 🔲 |

### 2E. Category Head / Manager Dashboards
| Feature | Status |
|---------|--------|
| Category-level OTIF view (`/category-head`) | 🔶 |
| Sourcing Manager portfolio health (`/manager`) | 🔶 |
| Escalation approval hub (`/approvals`) | 🔶 |
| Budget vs actual costing view | 🔲 |
| Season health summary (AW26 / SS26 at a glance) | 🔲 |

---

## Phase 3 — Integrations & Automation  💡 FUTURE

| Item | Notes |
|------|-------|
| D365 PO sync | PO numbers, amendments, cancellations pushed to D365 in real-time |
| Tessera WMS integration | ASN clearance flag, GRN confirmation pull |
| WhatsApp / email notifications | Vendor notifications on RFQ, inspection schedule, report share |
| Inspector mobile app (PWA offline) | Draft capture, auto-save when connection restored |
| Vendor self-onboarding | Vendor registers, uploads compliance docs, gets activated |
| Returns tie-back | Returns linked back to batch inspection data and vendor scorecard |
| Inspector bandwidth & calendar management | Inspector availability calendar, leave management |
| AI-assisted defect classification | Photo → defect type auto-tagging |
| Bulk confirm (RFQ → multi-sub-order) | Confirm same vendor for N sub-orders in one click |

---

## Immediate Next Actions  (Sprint Focus)

| # | Item | Owner | Priority |
|---|------|-------|---------|
| 1 | Vendor RFQ multi-send + comparison view | Sahil / Claude | 🔴 High |
| 2 | Inspection form — complete Sections C–F (workmanship, packing, labelling, measurement) | Sahil / Claude | 🔴 High |
| 3 | Inspection PDF report auto-generation (Bewakoof template) | Sahil / Claude | 🔴 High |
| 4 | QA Cleared Qty gate — wire `fi → asn` transition | Sahil / Claude | 🔴 High |
| 5 | PO amendment / cancellation dual-approval backend logic | Sahil / Claude | 🟡 Medium |
| 6 | Tracker View — wire Save to persist edits (API / localStorage) | Sahil / Claude | 🟡 Medium |
| 7 | SLA configuration template (for Kannan) | Sahil | 🟡 Medium |
| 8 | Sample tracking — designer / fit-tech approval action buttons | Sahil / Claude | 🟡 Medium |
| 9 | Separate MOM session — Sandeep (was not in second call) | Sahil | 🟡 Medium |
| 10 | Portfolio: Fabricate Code column, ASN+GRN qty in row, label fixes | Sahil / Claude | 🟢 Low |
| 11 | Vendor master: name + code display, category/subtype/gender columns | Sahil / Claude | 🟢 Low |
| 12 | Sourcing POC column in order grid + gender/fabric fields | Sahil / Claude | 🟢 Low |

---

## Key Business Context

| Fact | Detail |
|------|--------|
| **Phase 1 brand** | Bewakoof — all report templates, AQL defaults, branding |
| **Phase 2 brand** | Nautinati, Urbano, etc. as separate brand templates |
| **OMS name** | Fabricate (Drishti is deprecated) |
| **Sub-order ID** | Fabricate Code (format: `NNKNTW250001`) |
| **Inspection scope** | Final Inspection (FI) in Phase 1; pre-prod + inline in Phase 2 |
| **Third-party inspectors** | Unified `inspector_type` flag — no separate coordinator role |
| **PO integration** | D365 (Microsoft Dynamics) — API integration in Phase 3 |
| **WMS** | Tessera — integration in Phase 2 for ASN clearance |
| **Cancellation approval** | Category Head + Sourcing Director — parallel, both required |

---

*Generated from codebase state + PRD docs · https://github.com/imsahils/Sourcing_V0*
