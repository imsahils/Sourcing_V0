# Vendor Assignment / RFQ Flow — PRD v1

> **Module:** `/portfolio?tab=vendor-assign` (Sourcing) · `/vendor-portal?view=rfq` (Vendor)
> **Status:** Build complete — live in `nifty-zhukovsky` worktree
> **Owner:** Sahil Sharma
> **Last updated:** 21 May 2026

---

## 1. Overview

The Vendor Assignment module is the **bridge** between an OTB-approved sub-order and a committed manufacturing partner. It replaces direct-assignment with a structured **RFQ (Request For Quote) flow** so a Sourcing POC can solicit responses from multiple vendors in parallel, compare on price + capacity + delivery date, and lock the right vendor before the order enters Costing.

Every sub-order that exits the `assigned` lifecycle stage must pass through this module before it can move to `costing`. No sub-order skips the RFQ step.

This PRD covers the **full Vendor Assignment module**, addressing six concerns identified during build:
1. Multi-vendor RFQ send (replacing single-vendor direct assignment)
2. Structured vendor response capture (price + date + capacity, or decline)
3. POC-side RFQ tracker with comparison view
4. Vendor-side portal for inbox, response, and confirmed-orders visibility
5. Listing-page RFQ status visibility for portfolio-wide pipeline health
6. Order-cancellation with dual approval (Category Head + Sourcing Director)

---

## 2. Goals & Non-Goals

### Goals
- Let a Sourcing POC send the **same RFQ to many vendors** simultaneously with the full style brief + tech pack
- Capture **structured vendor responses** (quoted price, promised date, capacity qty) — or a decline with reason
- Provide a **side-by-side comparison view** so the POC can decide on objective data
- On confirmation, **auto-reject** all other open RFQs and advance the sub-order to `costing`
- Give Sourcing Managers and Directors **read-only visibility** of every RFQ across all POCs
- Allow **cancellation** of any sub-order at any stage with **parallel dual sign-off** (Category Head + Sourcing Director)
- Expose **vendor workload context** (active orders, pieces in pipeline, same-category fit) at decision time

### Non-Goals (Phase 1)
- Vendor self-onboarding workflow — vendors are added internally; see §8
- Negotiation chat / counter-offer back-and-forth — Phase 1 is single response per RFQ
- Order splitting across vendors during the RFQ stage — deferred to Costing PRD
- Vendor-facing RFQ analytics (win/loss reports for vendors)
- API integration with vendor ERP systems
- Bulk-confirm across many sub-orders in one click (bulk-send is supported; bulk-confirm is not)

---

## 3. Personas & Permissions

### Personas

| Role | Their job in Vendor Assignment |
|---|---|
| **Sourcing POC** | Shortlists vendors, sends RFQs, evaluates responses, confirms a vendor |
| **Sourcing Manager** | Read-only visibility across all POCs in their portfolio; can revoke an RFQ on a POC's behalf |
| **Sourcing Director** *(new role)* | Read-only visibility across all managers; co-approves cancellations |
| **Category Head** | Co-approves cancellations; does not see RFQ pipeline |
| **Vendor** | Receives RFQs in inbox, submits quote or declines, sees confirmed orders |
| **QA Manager** | Read-only — no actions in this module |
| **Sourcing MIS** | Read-only — no actions in this module |

### Permissions Matrix

| Action | Sourcing POC | Sourcing Mgr | Sourcing Director | Category Head | Vendor |
|---|:---:|:---:|:---:|:---:|:---:|
| Send RFQ to vendors | ✅ | ✅ (on POC's behalf) | — | — | — |
| Revoke an open RFQ | ✅ (own) | ✅ (any in portfolio) | — | — | — |
| Confirm a vendor (accept quote) | ✅ | ✅ (on behalf) | — | — | — |
| Re-open vendor search after `closed-no-vendor` | ✅ | ✅ | — | — | — |
| View RFQ status (portfolio-wide) | ✅ (own) | ✅ (all) | ✅ (all) | — | — |
| Submit vendor response (quote / decline) | — | — | — | — | ✅ (own RFQs) |
| Initiate order cancellation | ✅ | ✅ | — | — | — |
| Approve cancellation | — | — | ✅ | ✅ | — |
| Reject cancellation | — | — | ✅ | ✅ | — |
| Reassign vendor after cancellation | ✅ | ✅ | — | — | — |
| View Vendor Master | ✅ | ✅ | ✅ | ✅ | — |
| Edit Vendor Master | — | — | — | — | — |

> **Note on dual approval:** Cancellation always requires **both** Category Head **and** Sourcing Director sign-off — parallel, not sequential. Either can act first; the sub-order is cancelled only when both approve. Either rejection sends the request back to the initiator for revision.

---

## 4. Module Structure

**Sourcing-side route:** `/portfolio?tab=vendor-assign` (listing) → `/portfolio/<id>` drawer with `vendor-assign` tab (detail)
**Vendor-side route:** `/vendor-portal?view={rfq|pre-prod|my-orders}`

### Sourcing-side sub-views

| Sub-view | URL | Purpose |
|---|---|---|
| **Vendor Assignment listing** | `/portfolio?tab=vendor-assign` | All sub-orders in `assigned` / `vendor` stage with RFQ status |
| **RFQ Tracker (drawer)** | listing → "View RFQs →" CTA | Per-sub-order vendor responses comparison |
| **Vendor Discovery modal** | RFQ Tracker → "Send to More Vendors" | Vendor picker with OTIF / FI Pass / workload |
| **RFQ Preview modal** | Discovery modal → "Preview RFQ (N)" | Read-only style brief, tech pack check, expiry |
| **Cancellation modal** | sub-order detail → "Cancel order" | Reason + sends to dual-approval queue |

### Vendor-side sub-views

| Sub-view | URL | Purpose |
|---|---|---|
| **RFQ Inbox** | `/vendor-portal?view=rfq` | All RFQs sent to this vendor, by status |
| **RFQ Detail / Response form** | inbox → RFQ card | Submit price / date / capacity, or decline |
| **My Orders** | `/vendor-portal?view=my-orders` | All sub-orders where this vendor is confirmed |
| **Pre-Production** | `/vendor-portal?view=pre-prod` | Existing pre-prod stages (out of RFQ scope) |

### Sidebar entries

| Label | Role visibility | Icon | Href |
|---|---|---|---|
| Vendors | Sourcing POC, Mgr | Building2 | `/vendors` |
| Vendor Portal | Sourcing POC, Mgr, Warehouse Ops | UserCog | `/vendor-portal` |
| RFQ | Vendor | Inbox | `/vendor-portal?view=rfq` |
| Pre-Production | Vendor | FlaskConical | `/vendor-portal?view=pre-prod` |
| My Orders | Vendor | Package | `/vendor-portal?view=my-orders` |

---

## 5. Feature Specifications

### 5.1 Vendor Assignment Listing (`/portfolio?tab=vendor-assign`)

#### Description
Master list of every sub-order that needs vendor assignment. Replaces the old "Unassigned" listing with an RFQ-aware status column and KPI cards that double as filters.

#### KPI Cards

| Card | Counts | Filter |
|---|---|---|
| **Pending RFQ** | Sub-orders with no RFQ sent yet (`rfqStatus == 'not-started'` and no draft) | amber |
| **RFQs Sent** | `rfqStatus == 'sent'` — awaiting at least one response | violet |
| **Quotes Received** | `rfqStatus == 'responded'` — at least one vendor has replied | orange |
| **Confirmed** | At least one vendor has been accepted | green |
| **Total Styles** | All sub-orders in listing scope | slate |

Click any card to toggle a filter; click again to clear.

#### Columns

| Column | Source | Notes |
|---|---|---|
| Checkbox | UI | Multi-select for bulk RFQ send |
| Style | sub-order | `styleCode` + `styleName` + `subOrderId` |
| Colour | sub-order | |
| Cat / Sub-type / Gender / Fabric | sub-order | |
| Qty | sub-order | `orderQty` |
| Target ₹ | sub-order | `targetPrice` |
| Del. Days | sub-order | Days from RFQ send to inward |
| Inward | sub-order | `buyingExpectedInwardDate` + "Nd left" countdown |
| Tier | sub-order | HERO / TIER-1 / TIER-2 / TAIL |
| **Vendor Status** | computed | RFQ status pill + `N sent · N responded · N declined` + best quote |
| Action | UI | "View RFQs →" (drawer) when RFQs exist · "Send RFQ" (legacy sheet) otherwise |

#### Vendor Status pill rendering

| Status | Pill colour | Sub-text |
|---|---|---|
| `RFQs Sent` | violet | `N sent` |
| `Quotes Received` | amber | `N sent · N responded · N declined` + Best: ₹X · Vendor |
| `Vendor Confirmed` | green | Vendor name + accepted price |
| `Closed — No Vendor` | slate | "All vendors declined / expired" + "Re-open" CTA |
| `Not Started` (legacy direct-assignment fallback) | slate | "Unassigned" |

#### Mobile cards
Same content stacked vertically. The RFQ status pill, counts strip, and "View RFQ Tracker" CTA replace the desktop columns.

---

### 5.2 RFQ Tracker — Drawer (`/portfolio?tab=vendor-assign` → "View RFQs →")

#### Description
Right-side drawer (780 px desktop / full-width mobile) opened by clicking "View RFQs →" on any row that has RFQs. Reuses the `SubOrderPanel` component with `initialTab='vendor-assign'`. Backdrop click or `Escape` closes; listing state, scroll, and filters persist underneath.

**Why drawer not route:** Sourcing POC compares many sub-orders in one filter pass. Routing away breaks that flow.

#### Summary pills (top of tab)
- `N Quote Received` (amber)
- `N Awaiting Response` (blue)
- `N Declined / Revoked` (slate)
- `Expires in Nd` (red if any open RFQ < 3 days from expiry)

#### RFQ Tracker table

| Field | Notes |
|---|---|
| Vendor name + location | Click → vendor profile modal |
| Status chip | `Awaiting Response` / `Quote Received` / `Declined` / `Revoked` / `Expired` |
| Sent date · Expires date | Both shown in same cell |
| Quoted price | Only when `responded` — shows `₹X/pc` and `±₹Y vs target` |
| Promised date | Only when `responded` |
| Capacity qty | Only when `responded` |
| Action | `Revoke` (POC) when status = `sent` · `Accept` (POC) when `responded` · decline reason text when `declined` |

#### Actions
- **Accept** → confirms vendor, auto-rejects all other open RFQs, advances sub-order stage to `costing`, vendor notified
- **Revoke** → marks RFQ `revoked` (optional reason), keeps other RFQs untouched
- **Send to More Vendors** → opens Vendor Discovery modal pre-filtered to exclude already-sent vendors
- **Re-open** (only when status = `closed-no-vendor`) → returns sub-order to `assigned` stage and offers the Discovery modal

---

### 5.3 Vendor Discovery Modal

#### Description
Vendor picker. Surfaces the right vendor info at decision time — not just performance scores but also current workload so the POC doesn't overload a vendor with strong OTIF.

#### Filters
- Search (vendor name or location)
- Tier toggle: `All Tiers` / `Tier 1` / `Tier 2` / `Tier 3`
- Already-sent vendors are excluded (cannot send a duplicate RFQ)

#### Vendor card

| Field | Source | Display |
|---|---|---|
| Vendor name + Tier badge | vendor master | Plain |
| Location | vendor master | `MapPin` icon prefix |
| **Active orders** | live: `subOrders` where `vendor.id == v.id` AND `currentStage != 'grn'` | Pill: green ≤3, amber 4-7, red ≥8 |
| **Pipeline qty** | sum of `orderQty` for active orders | `1,840 pcs in pipeline` |
| **Same-category count** | active orders where `category == currentOrder.category` | Violet text — `· 3 Knits` (only shown for single-order send) |
| OTIF % | vendor master | Coloured chip: green ≥75 / amber ≥60 / red <60 |
| FI Pass % | vendor master | Coloured chip: green ≥85 / amber ≥70 / red <70 |
| Load (numeric) | same as Active orders, separate column | Coloured number |

#### Bottom action bar
- "Select vendors to send RFQ" hint when none selected
- "Preview RFQ (N)" primary CTA → opens RFQ Preview modal

---

### 5.4 RFQ Preview Modal

#### Description
Last-mile review before sending. The POC sees exactly what each shortlisted vendor will receive.

#### Style brief snapshot (read-only)
| Block | Fields |
|---|---|
| Style | `styleCode`, `styleName`, `colour`, `category`, `subType`, `gender`, `ageGroup`, `fabricQuality` |
| Quantities | `orderQty`, `sizeRatio`, warehouse split |
| Commercials | `targetPrice` (informational only — vendor will quote independently) |
| Dates | `handoverDate`, `buyingExpectedInwardDate` (used by vendor to gauge feasibility) |
| Tech Pack | Drive link — **mandatory**. Send blocked with clear error if `techPackUrl` missing on the sub-order |

#### Inputs
- **Notes for vendor** (optional textarea — additional spec / sourcing remarks)
- **Expiry** (radio: 3d / 5d / 7d / 10d / 14d — default 7d)

#### Confirm action
- Validates `techPackUrl` is present
- Creates one `VendorRFQ` record per selected vendor (each independent, with its own status)
- Sub-order `rfqStatus` transitions to `sent`
- Each vendor receives email + in-app notification

---

### 5.5 Vendor Portal — RFQ Inbox (`/vendor-portal?view=rfq`)

#### Description
Vendor's home screen. Lists every RFQ sent to this vendor across all sourcing POCs.

#### Summary pills
- `N Awaiting Response` — RFQs the vendor still needs to act on
- `N Quotes Submitted` — responses sent, awaiting POC decision
- `N Closed` — accepted / rejected / expired

#### RFQ card

| Field | Notes |
|---|---|
| Style name + status chip | `Awaiting Response` / `Quote Submitted` / `Accepted` / `Rejected` / `Declined` / `Expired` |
| Style code · colour · category | |
| Qty · Target ₹ · Handover date | Read-only style brief snapshot |
| Tech Pack link | Drive download |
| Expiry countdown | "Expires N days" — red if < 3 days |
| Action button | `Respond` (open response form) when `Awaiting Response` · "Submitted" badge with quote summary otherwise |

#### Quote summary (after submission)
When status is `Quote Submitted`, the card expands to show what the vendor quoted: `Your Quote ₹X/pc · Promised Date DD MMM · Capacity N pcs`.

---

### 5.6 Vendor Response Form

#### Description
The form vendors fill to respond to one RFQ. Two paths — submit or decline.

#### Submit path (required fields)
- **Quoted price** (₹/piece, numeric, > 0) — required
- **Promised delivery date** (date picker, must be after `handoverDate`) — required
- **Capacity qty** (numeric, must be ≥ 1) — required
- **Lead time** (days, numeric) — optional
- **Notes** (textarea) — optional

On submit: `VendorRFQ.status = 'responded'`, sub-order's `rfqStatus` becomes `responded` if any vendor has responded, POC is notified.

#### Decline path
- **Reason** (textarea) — optional but encouraged
- One click confirms decline

On decline: `VendorRFQ.status = 'declined'`, POC is notified. If all RFQs decline/expire → sub-order `rfqStatus = 'closed-no-vendor'`.

---

### 5.7 Vendor Portal — My Orders (`/vendor-portal?view=my-orders`)

#### Description
Read-only list of every sub-order where this vendor has been confirmed. Vendor sees only their own orders.

#### Columns
- Sub-order ID + style code
- Stage chip (`Vendor` / `Costing` / `Pre-Prod` / `Production` / `FI` / `ASN` / `GRN`)
- Qty (Order / Cut / Sewing / Packed / Dispatched)
- Promised date
- Action — opens read-only sub-order detail

---

### 5.8 Vendor Master (Internal, Read-Only)

#### Description
Browse all vendors. List view shows high-level metrics; drill-in modal shows deep metrics + order history.

#### List view (already implemented at `/vendors`)
| Column | Notes |
|---|---|
| Avatar + name | Tier-coloured |
| Location | |
| Tier | HERO / Tier 1 / Tier 2 / Tier 3 |
| OTIF % | Coloured chip |
| FI Pass % | Coloured chip |
| Active orders | Same calculation as Discovery modal |

#### Profile modal (drill-in)
- Contact section: phone (`tel:`), email (`mailto:`)
- 6-metric grid: OTIF · FI Pass · Active · Completed · Overdue · Total
- Order history table — all sub-orders ever associated with this vendor, with stage + status badges

> **Note on editing:** No internal user can edit vendor master in Phase 1. New vendor onboarding is the Vendor Onboarding workflow (see §8 — deferred).

---

### 5.9 Order Cancellation Flow

#### Description
Any sub-order — at any stage — can be cancelled. Cancellation is **terminal** (cannot be reinstated) and requires **parallel dual approval** from Category Head and Sourcing Director.

#### Initiator
- Sourcing POC
- Sourcing Manager (on POC's behalf)

#### Required fields at initiation
- **Reason code** (dropdown, mandatory):
  - `DEMAND_DROP`
  - `DESIGN_CHANGE`
  - `BUDGET_CUT`
  - `STYLE_MERGED`
  - `VENDOR_FAILURE`
  - `QUALITY_MISMATCH`
  - `OTHER`
- **Reason note** (textarea, optional unless `OTHER` — then required)

#### Approval mechanics
- **Parallel** — both approvers can act in any order
- **Either rejection** returns the request to the initiator with the rejection reason
- Initiator can **revise** the reason / note and resubmit; both approvers are re-notified
- **Reminder** every 3 days to any pending approver
- All actions logged to sub-order history

#### Effect on confirmation
- Sub-order stage moves to `cancelled` (terminal)
- All in-flight RFQs on the sub-order are auto-revoked
- Confirmed vendor (if any) is notified
- Sub-order disappears from the vendor's "My Orders" list

> **Note on partial cancellation:** Not supported in Phase 1. To "partially cancel", the user must cancel fully and raise a new OTB line item with the reduced quantity.

---

### 5.10 Reassignment (post-cancellation)

#### Description
If a sub-order is cancelled mid-stream (e.g. vendor failure during production), the team can raise a new sub-order with the same style brief but assign a different vendor.

#### Mechanics
- New sub-order is created with the same style brief
- New sub-order links back to the cancelled one via `parentSubOrderId`
- Vendor can be **direct-assigned** (no fresh RFQ required — this is the agreed shortcut for reassignment)
- Reason for reassignment is mandatory and logged to history

> **Note on direct assignment:** This is the only path where direct-assignment is permitted post-RFQ-rollout. Standard new sub-orders always go through the RFQ flow.

---

## 6. UI Components Reference

| Component | Location in code | Used by |
|---|---|---|
| `VendorAssignTab` | `src/app/portfolio/[id]/SubOrderDetailClient.tsx` | RFQ Tracker drawer content |
| `VendorDiscoveryModal` | `src/app/portfolio/[id]/SubOrderDetailClient.tsx` | RFQ Tracker → Send More |
| `RFQPreviewModal` | `src/app/portfolio/[id]/SubOrderDetailClient.tsx` | Discovery → Preview RFQ |
| `VendorAssignView` | `src/app/portfolio/page.tsx` | Listing tab + KPI cards |
| `VendorProfileModal` | `src/app/vendors/page.tsx` | Vendors page drill-in |
| `RFQInbox` / `RFQResponseModal` | `src/app/vendor-portal/page.tsx` | Vendor RFQ pages |
| `MyConfirmedOrders` | `src/app/vendor-portal/page.tsx` | Vendor My Orders page |

#### Design tokens
- Primary accent: `#CC785C` (terra-cotta)
- Status colours match `STATUS_PILL_STYLES` constant — green / amber / red / violet / blue / slate
- All modals use `bg-black/30` backdrop + `rounded-2xl` panel
- Right drawer is `w-full md:w-[780px] md:max-w-[90vw]`, slides via `translate-x` transition (300ms ease-out)

---

## 7. Edge Cases & Open Questions

### Edge Cases — handled

| Case | Behaviour |
|---|---|
| RFQ sent to vendor who is later deactivated | RFQ stays open; vendor can still respond. POC sees no special treatment. |
| Vendor responds after RFQ expiry | Response is rejected with "RFQ expired" message. POC sees the vendor still as `expired`. |
| All vendors decline an RFQ | Sub-order `rfqStatus` becomes `closed-no-vendor`. "Re-open" CTA appears on the listing. |
| POC tries to send RFQ without tech pack | Send is blocked with error: "Tech pack required. Upload to sub-order before sending RFQ." |
| POC tries to confirm a vendor whose RFQ has expired | Confirm is blocked. POC must re-open via Send to More. |
| Two POCs send RFQs for the same sub-order | Not possible — RFQ send is scoped to the sub-order's assigned POC. |
| Cancellation initiated while RFQ is open | All open RFQs are auto-revoked at the moment of cancellation. |
| Cancellation rejected by one approver | Request returns to initiator. Other approver's earlier approval is **invalidated** — they must re-approve after revision. |
| Vendor logged in tries to view another vendor's RFQs | Backend filters by `vendorId` — only own RFQs returned. |

### Open Questions
- Should there be a **bulk-confirm** across many sub-orders for the same vendor? (Currently no — confirm is per-RFQ.)
- Should RFQ expiry trigger an **auto-reminder** to non-responding vendors at the halfway point? (Currently yes — 3-day reminders. Confirm timing.)
- Should `Sourcing Director` be allowed to **override** a stuck cancellation if Category Head has not responded in 5+ days? (Currently no override — Category Head must act.)
- How are **new RFQs** delivered to vendors who don't yet have portal accounts? (Currently: portal-only. Email-only vendors are out of Phase 1 scope.)

---

## 8. Phase 2 — Vendor Onboarding

The current vendor master is **read-only inside Fabricate**. Phase 2 adds:

- A **vendor onboarding workflow** (PRD pending) — manual entry by Sourcing Manager → review by Sourcing Director → activation creates the vendor's portal login
- **Vendor self-service profile updates** — vendors can edit contact info, capacity, machine count via their portal
- **Tier promotion / demotion rules** — automated based on rolling OTIF / FI Pass scores
- **Multi-contact per vendor** — current model assumes one contact; Phase 2 supports multiple roles (sales / production / QA)

Until Phase 2 ships, vendors are added by the Fabricate team directly to `lib/data.ts` and portal logins are issued manually.

---

## 9. User Stories

### RFQ Send & Comparison (Sourcing POC)

| ID | Story | Acceptance Criteria |
|---|---|---|
| **US-01** | As a Sourcing POC, I want to browse vendors with performance + workload context so I can shortlist the right ones | Vendor list shows OTIF, FI Pass, active orders, pipeline qty, same-category count, tier. Filter by tier and search. |
| **US-02** | As a Sourcing POC, I want to send an RFQ to multiple vendors with the full style brief + tech pack | Send blocked if `techPackUrl` missing. Expiry auto-calculated. One `VendorRFQ` record per selected vendor. |
| **US-03** | As a Sourcing POC, I want to see all RFQ responses in one comparison view | RFQ Tracker shows vendor, status, price, promised date, capacity side-by-side. Best quote highlighted. |
| **US-04** | As a Sourcing POC, I want to confirm one vendor so the order advances to costing | On accept, all other open RFQs auto-rejected. Sub-order → `costing`. Vendor notified. |
| **US-05** | As a Sourcing POC, I want to revoke an RFQ | Revoke available while status = `sent`. Optional reason. |
| **US-06** | As a Sourcing POC, I want to send RFQs for multiple sub-orders to the same vendors at once | Bulk-select on listing → Discovery modal opens once → independent RFQ records created per sub-order. |
| **US-07** | As a Sourcing POC, I want to re-open vendor search if all decline | Sub-order shows `closed-no-vendor` with "Send to More" CTA on the listing. |

### Vendor (Portal)

| ID | Story | Acceptance Criteria |
|---|---|---|
| **US-08** | As a Vendor, I want a notification when an RFQ is sent so I can respond in time | Email + in-app on send. Expiry shown clearly. |
| **US-09** | As a Vendor, I want to see the style brief + download the tech pack | RFQ detail shows all style fields + Drive link. Read-only. |
| **US-10** | As a Vendor, I want to submit price + date + capacity in one form | Required fields validated. Lead time optional. |
| **US-11** | As a Vendor, I want to decline with an optional reason | Decline available while status = `Awaiting Response`. POC notified. |
| **US-12** | As a Vendor, I want to see my confirmed orders | My Orders page lists sub-orders where I'm confirmed. Read-only. |

### Visibility (Sourcing Mgr & above)

| ID | Story | Acceptance Criteria |
|---|---|---|
| **US-13** | As a Sourcing Manager, I want to see RFQ status across all my POCs | Portfolio listing has RFQ Status column. Filterable. Drill-in via drawer. |
| **US-14** | As a Sourcing Director, I want portfolio-wide RFQ pipeline health | KPI cards summarise the pipeline. Filter by status to investigate. |
| **US-15** | As a Sourcing Manager, I want to revoke a stuck RFQ on my POC's behalf | Revoke button available on any RFQ in my portfolio scope. Action logged. |

### Cancellation (POC, Mgr, Cat Head, Director)

| ID | Story | Acceptance Criteria |
|---|---|---|
| **US-16** | As a Sourcing POC, I want to cancel an order with a reason code | Reason code dropdown mandatory. Note required if `OTHER`. Sends to dual-approval queue. |
| **US-17** | As a Category Head, I want to approve / reject a cancellation with optional note | Action logged. Other approver re-notified on rejection. |
| **US-18** | As a Sourcing Director, I want to approve / reject in parallel with Category Head | Approvals are independent. Cancellation succeeds only when both approve. |
| **US-19** | As an Initiator, I want to revise a rejected cancellation and resubmit | Revision triggers fresh approval from both approvers. Earlier approvals invalidated. |
| **US-20** | As any actor, I want a 3-day reminder on pending approvals | Email + in-app to whoever has not acted. |

---

## 10. Test Cases

### TC-01: Send RFQ to multiple vendors — happy path
- **Given** sub-order NN416-089 (Girls Ruffle Neck Top) is in `assigned` stage with `techPackUrl` set
- **When** Sourcing POC selects 3 vendors in the Discovery modal and clicks "Preview RFQ (3)"
- **And** confirms send with default 7-day expiry
- **Then** three `VendorRFQ` records are created (one per vendor) with `status = 'sent'`, `expiresAt = now + 7d`
- **And** sub-order `rfqStatus = 'sent'`
- **And** each vendor receives email + in-app notification

### TC-02: Send RFQ blocked — missing tech pack
- **Given** sub-order has `techPackUrl = null`
- **When** Sourcing POC tries to confirm RFQ send from the Preview modal
- **Then** "Send" button is disabled
- **And** an inline error reads "Tech pack required. Upload to sub-order before sending RFQ."

### TC-03: Vendor response captures all required fields
- **Given** Vendor ADITEE has an open RFQ for NN419-201
- **When** they submit `quotedPrice=168`, `vendorPromisedDate=12 Aug`, `capacityQty=750`
- **Then** `VendorRFQ.status = 'responded'`, sub-order `rfqStatus = 'responded'`
- **And** POC receives notification with the quote summary

### TC-04: Vendor decline with reason
- **Given** Vendor AND DESIGN has an open RFQ
- **When** they click Decline and enter "Capacity full — committed to other orders for May handover"
- **Then** `VendorRFQ.status = 'declined'` and `declineReason` is stored
- **And** POC sees the decline reason in the RFQ Tracker

### TC-05: All vendors decline — sub-order moves to closed-no-vendor
- **Given** Sub-order has 3 RFQs, all `declined` or `expired`
- **When** the last RFQ's status flips to `declined`
- **Then** sub-order `rfqStatus = 'closed-no-vendor'`
- **And** listing shows the order with a "Re-open" CTA

### TC-06: Confirm vendor — auto-reject others
- **Given** Sub-order has 3 RFQs: 1 `responded`, 2 still `sent`
- **When** POC clicks "Accept" on the responded RFQ
- **Then** that RFQ becomes `accepted`, the other 2 become `rejected`
- **And** sub-order stage advances to `costing`
- **And** all 3 vendors receive a notification

### TC-07: Revoke RFQ — keep others open
- **Given** Sub-order has 3 RFQs all in `sent` status
- **When** POC revokes one RFQ with reason "Vendor relationship paused"
- **Then** that RFQ becomes `revoked`
- **And** other 2 RFQs remain `sent`
- **And** sub-order `rfqStatus` stays `sent` (still has open RFQs)

### TC-08: RFQ expired — vendor cannot respond
- **Given** RFQ's `expiresAt` is in the past
- **When** vendor opens the response form
- **Then** the form is disabled with a banner "This RFQ has expired"
- **And** status auto-updates to `expired` on the next read

### TC-09: Vendor workload visible in Discovery modal
- **Given** Vendor BHARTI APPARELS has 4 active orders totaling 1,840 pcs, with 3 in `Knits` category
- **When** POC opens Discovery modal for a Knits sub-order
- **Then** BHARTI's card shows `4 active`, `1,840 pcs in pipeline`, `· 3 Knits`
- **And** the Load chip is amber (4-7 range)

### TC-10: Bulk send RFQ to same vendors across sub-orders
- **Given** POC selects 5 sub-orders on the listing
- **When** they open Discovery modal and select 2 vendors
- **Then** 10 `VendorRFQ` records are created (5 sub-orders × 2 vendors)
- **And** each is independent

### TC-11: Cancellation requires dual approval — happy path
- **Given** POC initiates cancellation with reason `DEMAND_DROP`
- **When** Category Head approves AND Sourcing Director approves (any order)
- **Then** sub-order stage = `cancelled`, terminal
- **And** all open RFQs auto-revoked
- **And** confirmed vendor (if any) notified

### TC-12: Cancellation rejected — returns to initiator
- **Given** POC initiates cancellation
- **And** Category Head approves
- **When** Sourcing Director rejects with reason "Order has committed PO — discuss with Buying first"
- **Then** request status = `rejected`
- **And** initiator gets a notification with the rejection reason
- **And** Category Head's approval is invalidated for any future revision

### TC-13: Cancellation reminder at 3 days
- **Given** A cancellation request has been pending for 3 days with both approvers still un-acted
- **When** the daily reminder job runs
- **Then** both approvers receive a reminder email + in-app notification
- **And** `lastReminderSentAt` is updated

### TC-14: RFQ Tracker drawer — preserves listing state
- **Given** POC has filtered the listing to "Quotes Received" and scrolled to row 12
- **When** they click "View RFQs →" on a row, view the drawer, and close it (Esc)
- **Then** listing is still filtered to "Quotes Received"
- **And** scroll position is preserved at row 12

### TC-15: Vendor sees only own RFQs
- **Given** Vendor SG (`vendorId = v1`) opens `/vendor-portal?view=rfq`
- **When** the RFQ inbox renders
- **Then** only RFQs sent to `v1` are visible
- **And** RFQs sent to other vendors are not in the response payload

### TC-16: Sidebar navigation drives content
- **Given** Vendor is logged in
- **When** they click "Pre-Production" in the sidebar
- **Then** URL becomes `/vendor-portal?view=pre-prod`
- **And** the Pre-Production section renders (no in-page tab bar)

### TC-17: Re-open after closed-no-vendor
- **Given** Sub-order is in `closed-no-vendor` status
- **When** POC clicks "Re-open" and selects 2 new vendors
- **Then** sub-order `rfqStatus` becomes `sent`
- **And** 2 new `VendorRFQ` records are created
- **And** previously declined / expired RFQs remain in the history

### TC-18: Reassignment via direct-assign — post-cancellation
- **Given** Sub-order NN322-088 was cancelled at the `production` stage
- **When** Sourcing Manager creates a reassignment with direct-assign to Vendor v3
- **Then** a new sub-order is created with the same style brief
- **And** `parentSubOrderId` points to the cancelled one
- **And** the new sub-order starts at `costing` stage (skipping `assigned` and `vendor`)
- **And** reassignment reason is logged to history

### TC-19: Mobile — Vendor Portal layout
- **Given** Vendor opens `/vendor-portal?view=rfq` on a 375 px viewport
- **When** the page renders
- **Then** content uses full width (no off-screen sidebar margin)
- **And** RFQ cards stack vertically with full readable content
- **And** the in-page tab bar from earlier builds is absent

### TC-20: Vendor Master read-only — no edit affordance
- **Given** Any internal user opens the Vendors page
- **When** they click into a vendor's profile
- **Then** all fields are read-only
- **And** no "Edit" CTA is visible
- **And** the profile shows OTIF, FI Pass, Active, Completed, Overdue, Total + order history

---

## 11. Glossary

| Term | Definition |
|---|---|
| **RFQ** | Request For Quote. The structured ask sent from a Sourcing POC to one or more vendors with the full style brief, target price, and tech pack. |
| **VendorRFQ** | A single RFQ record — one per (sub-order, vendor) pair. Carries its own status, expiry, and vendor response. |
| **Tech Pack** | A Drive-hosted document with the full technical specification for the style — fabric, construction, measurements, trims. Mandatory for RFQ send. |
| **OTIF** | On-Time-In-Full. The vendor's score for delivering the right qty on the agreed date, rolling 12-month window. |
| **FI Pass Rate** | The percentage of final inspections the vendor has passed without rework, rolling 12-month window. |
| **Active orders** | Sub-orders assigned to a vendor that have not yet reached `grn`. Used as a workload signal. |
| **Pipeline qty** | Sum of `orderQty` across a vendor's active orders. |
| **Same-category fit** | The count of a vendor's active orders that share `category` with the current sub-order — proxy for relevant capability. |
| **Quote** | A vendor's response with `quotedPrice`, `vendorPromisedDate`, `capacityQty`. |
| **Decline** | A vendor's "no thanks" response to an RFQ, with optional reason. |
| **Revoke** | A Sourcing POC's withdrawal of an open RFQ before vendor responds. |
| **Closed — No Vendor** | The terminal RFQ state when every RFQ on a sub-order has been declined / expired / revoked. Requires re-open to proceed. |
| **Dual Approval** | Cancellation requires parallel sign-off from both Category Head and Sourcing Director. |
| **Sourcing Director** | New role — sits above Sourcing Manager. Co-approver for cancellations. |
| **Sub-order** | The atomic execution unit — one style + one colour. Owns its own RFQ lifecycle. |
| **Spine** | The fixed lifecycle: `order-brief → assigned → vendor → costing → pre-prod → production → fi → asn → grn`. RFQ flow lives in the `vendor` stage. |

---

## Appendix A — Data Model

```typescript
// New / changed types — see src/lib/types.ts

export type RFQStatus =
  | 'not-started'   // No RFQ sent yet
  | 'draft'         // Drafted but not sent
  | 'sent'          // At least one RFQ sent, awaiting responses
  | 'responded'     // At least one vendor has responded
  | 'confirmed'     // Vendor accepted, sub-order moved to costing
  | 'closed-no-vendor' // All RFQs declined/expired — needs re-open

export type VendorRFQStatus =
  | 'sent' | 'responded' | 'declined' | 'accepted'
  | 'rejected' | 'expired' | 'revoked'

export interface VendorRFQ {
  id: string
  subOrderId: string
  vendor: Vendor
  // Style brief snapshot at time of sending
  styleCode: string
  styleName: string
  colour: string
  orderQty: number
  targetPrice: number
  handoverDate: string
  fabricQuality: string
  category: string
  sizeRatio: string
  warehouseSplit: { warehouse: string; qty: number }[]
  techPackUrl: string
  notes?: string
  // Lifecycle
  status: VendorRFQStatus
  sentAt: string
  expiresAt: string
  respondedAt?: string
  closedAt?: string
  // Vendor response
  quotedPrice?: number
  vendorPromisedDate?: string
  leadTimeDays?: number
  capacityQty?: number
  declineReason?: string
  // POC action
  revokedReason?: string
}

export interface CancellationRequest {
  id: string
  subOrderId: string
  status: 'pending-approval' | 'approved' | 'rejected' | 'revised'
  initiatedBy: { id: string; name: string; role: Role }
  initiatedAt: string
  reasonCode: CancelReason
  reasonNote?: string
  categoryHeadApproval: ApprovalEntry
  sourcingDirectorApproval: ApprovalEntry
  rejectedBy?: { id: string; name: string; role: Role }
  rejectionReason?: string
  revisions: { revisedAt: string; reasonCode: CancelReason; reasonNote?: string }[]
  lastReminderSentAt?: string
}

// SubOrder additions:
//   techPackUrl?: string
//   rfqStatus?: RFQStatus
//   vendorRFQs?: VendorRFQ[]
//   parentSubOrderId?: string
//   cancellationRequest?: CancellationRequest
```

---

## Appendix B — Complete Decision Log

| # | Area | Decision |
|---|---|---|
| 1 | Flow type | RFQ — not direct assignment |
| 2 | Shortlist size | Open-ended, no limit |
| 3 | Vendor response | Quoted price + promised date + capacity qty (informational), or decline |
| 4 | Tech Pack | Required in RFQ — send blocked if `techPackUrl` missing |
| 5 | Order split | Deferred to Costing PRD — not triggered during RFQ |
| 6 | RFQ expiry | Configurable (`rfq.expiryDays`); reminder every 3 days to non-responding vendors |
| 7 | On confirmation | All other open RFQs auto-rejected; vendor notified |
| 8 | POC autonomy | No Mgr approval needed to send or confirm RFQ |
| 9 | Mgr visibility | Read-only RFQ status across all POCs in portfolio view |
| 10 | Reassignment | POC + Sourcing Director; only after costing stage; direct assignment; reason mandatory; logged |
| 11 | Cancellation initiator | POC or Sourcing Mgr |
| 12 | Cancellation approval | Parallel dual sign-off — Category Head + Sourcing Director |
| 13 | Cancellation rejection | Returns to initiator with reason; can revise; both approvers re-notified |
| 14 | Cancellation reminder | Every 3 days to pending approvers |
| 15 | Partial cancellation | Not allowed — cancel + raise new line item in OTB |
| 16 | Cancellation terminal | Cannot be reinstated |
| 17 | Vendor Master | Read-only; all internal roles; list + drill-in profile |
| 18 | Vendor Onboarding | Deferred to Phase 2 |
| 19 | Vendor Portal scope | RFQ only for Phase 1 |
| 20 | Vendor login | Separate credentials; one login per vendor entity |
| 21 | New role | `sourcing-director` — Sourcing Mgr reports to them |
| 22 | Vendor workload in pickers | Active orders, pipeline qty, same-category count — alongside OTIF / FI Pass |
| 23 | Listing-page RFQ status | RFQ-aware KPI cards + status pills; legacy assign sheet preserved for backward compatibility |
| 24 | Detail entry from listing | RFQ Tracker opens as right-side drawer (780 px) — not a separate route |
| 25 | Vendor sidebar layout | RFQ / Pre-Production / My Orders as top-level sidebar items (no in-page tabs) |
