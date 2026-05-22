# Inspection Management Module — PRD v1

> **Module:** `/qa` (QA Manager) · `/portfolio/[id]?tab=inspection` (Sourcing POC) · `/inspector` (Inspector mobile web) · `/vendor-portal?view=inspections` (Vendor)
> **Status:** Draft — supersedes Spec v0.6 (Maheshwar PV)
> **Owner:** Sahil Sharma
> **Last updated:** 21 May 2026
> **Phase 1 brand:** Bewakoof

---

## 0. Context — What This PRD Consolidates

This PRD replaces **Inspection Module Spec v0.6** (Maheshwar PV, 21 May 2026). It is built from three inputs:

1. **Spec v0.6** — Maheshwar's draft, used as the structural backbone
2. **Quality team discovery sessions** — May 20 and May 21 with S. Kathiresan (QA Head) and Arul Pandey (Field QS). Documented in `MOM - Quality Discovery Sessions.docx`
3. **Reference report PDF** — `Passed Inspection Report Format.pdf` showing the actual report output

### Framing Decisions (Resolved)

| Decision | Resolution |
|---|---|
| OMS name and unique code | Drishti is deprecated → replaced by **Fabricate**. Sub-order identifier is **Fabricate Code** |
| Third-party inspector model | Third-party inspectors are full system users — same `Inspector` role as in-house, distinguished by `inspector_type` flag (`in_house` / `third_party_agency`). No separate coordinator role in the system |
| Phase 1 baseline brand | **Bewakoof** — report template, AQL defaults, branding all baseline to Bewakoof. Other brands (Nautinati, Urbano, etc.) onboarded as separate templates in Phase 2 |
| Tracker sheet automation | **Out of Phase 1 scope** — to be addressed in the Reports module. Data is captured in a structured way that supports those reports being built later |

### Changes vs. Spec v0.6

| # | Change | Section(s) |
|---|---|---|
| 1 | New flow: third-party inspector handling within unified Inspector role | §2, §5.3, §11, §14 |
| 2 | New flow: multi-color AQL — single inspection per PO covers all colors with combined AQL calculation | §5.1, §5.6A, §7 |
| 3 | New flow: Sourcing POC can raise inspection request on behalf of vendor (transition support) | §5.2 |
| 4 | New flow: GPT waiver / exception flow for failed lab tests | §5.8, §5.9 |
| 5 | New flow: real-time consultation request from Inspector to QA Manager on borderline AQL | §5.6D |
| 6 | New field: Cut Qty added to data model and report | §5.6A, §7, §11 |
| 7 | New mandatory captures: Carton Stacking photo (Section A first step), PP Sample photo (Section B first step), Packing List photo per destination | §5.6A, §5.6B |
| 8 | New screen: Weekly Inspection Planning Calendar for QA Manager | §15.1 |
| 9 | Report header additions: Fabricate Code, Merchandise category, Submission Type, Sourcing POC name, Size Ratio | §7 |
| 10 | New KPI: Vendor Not Ready Rate added to vendor scorecard | §8 |
| 11 | Brand baseline corrected: Bewakoof confirmed as Phase 1 (not Nautinati) | §7 |
| 12 | Tracker automation explicitly deferred to Reports module | §0, §6 |

---

## 1. Overview

A standalone inspection management module integrated within Fabricate OMS that manages the quality inspection lifecycle from vendor-packed batch to dispatch clearance. Replaces the current AppSheet + 5 Google Sheet tracker stack used by Bewakoof's QA team.

### Primary Goals

- Digitise and standardise the inspection **request → schedule → execution → report → re-inspection** flow
- Give QA Managers real-time visibility into inspector activity and accountability
- Create an auditable trail for every inspection decision (pass, fail, hold, override, partial split, waiver)
- Auto-generate brand-templated inspection reports distributed to all stakeholders
- Gate dispatch on **QA Cleared Qty** within the existing Fabricate production spine
- Eliminate the manual MIS re-entry burden across the 5 existing trackers (via Reports module — out of this PRD's scope)

### Phasing

| Capability | Phase |
|---|---|
| Full inspection request → report flow (manual scheduling) | 1 |
| In-house + third-party inspectors (unified role) | 1 |
| Multi-color AQL on single PO inspection | 1 |
| Inspector mobile web app with offline draft / auto-save | 1 |
| Real-time Inspector ↔ QA Manager consultation on borderline AQL | 1 |
| GPT waiver / exception flow | 1 |
| Re-inspection workflow with linked report chain | 1 |
| QA Cleared Qty in Fabricate production spine | 1 |
| Weekly Inspection Planning Calendar | 1 |
| Auto-scheduling by zone + specialisation | 2 |
| Style master / spec sheet integration (auto-load measurement points) | 2 |
| Tessera ASN integration (clearance flag) | 2 |
| Pre-production inspection detailed workflow | 2 |
| Inline inspection detailed workflow | 2 |
| Tracker reports (FAT, GPT, Weekly QA, FI, NFP) in Reports module | 2 |
| Returns tie-back to batch inspection data | 3 |
| Inspector bandwidth & calendar management | 3 |

---

## 2. Users & Roles

| Role | Primary Device | Access |
|---|---|---|
| **Vendor** | Mobile / Desktop | Raise inspection requests, track status, receive report, submit corrective action, raise re-inspection |
| **Inspector** | Mobile web (on-site) | View personal schedule, confirm/flag dates, execute inspection checklist, upload photos, submit report. Single role for both in-house and third-party agency inspectors |
| **QA Manager** | Desktop | Assign inspectors, manage weekly schedule, review reports, override decisions, grant waivers, monitor accountability metrics. Reports to Sourcing Manager |
| **Sourcing POC** | Desktop | Raise inspection on behalf of vendor (transition support), receive reports, approve partial lot splits, track vendor-wise quality history |
| **Sourcing Manager** | Desktop | Oversight of QA team performance and vendor quality. QA Manager reports into this role. Uses vendor scorecards (including QA KPIs) for vendor selection and performance management |
| **Brand / Category Manager** | Desktop | Aggregate QA performance, vendor scorecards, inspector accountability metrics |

### Inspector Sub-Type

Inspector is a single role, but each Inspector profile carries an `inspector_type`:

| inspector_type | Notes |
|---|---|
| `in_house` | Employed by Bewakoof/TMRW. Examples: Arul, Satish |
| `third_party_agency` | Contracted external inspector. Profile includes `agency_name` field |

This distinction is informational and reporting-only. It does **not** change any system flow — assignment, schedule, execution, submission are identical for both. The split exists for: vendor scorecard contextualisation, accountability metrics segmentation, and future cost tracking (Phase 3).

The third-party agency *coordinator* (the human Kanti calls today to book a third-party inspector) does **not** have a system role. They are external to the system. The QA Manager assigns a specific third-party inspector profile directly. Coordinator-side booking happens out of band — same as how the QA Manager hires the inspector in the first place.

---

## 3. User-Level Pain Points

### Vendor

- No structured channel to request inspection — relies on WhatsApp/calls to QA team
- No visibility into when inspector will arrive after request is made
- No clear corrective action workflow after a fail — told informally what to fix but no record of what was agreed
- Cannot track re-inspection request status and historical trail
- Blocked from ASN until QA team manually sends clearance — no real-time status

### Inspector (in-house and third-party)

- No single view of all upcoming inspections
- Currently filling reports in AppSheet with hard 8-defect cap and limited image attachments
- Network drops at vendor sites cause complete data loss (no auto-save in current system)
- Completed inspections stay in the active list — confusion about pending vs. done
- Accidental Pass/Fail/Not Ready click is permanent — no correction flow
- Borderline AQL cases require phone call to QA Manager (Kanti) — no in-app consultation flow; the conversation isn't logged

### QA Manager (Kanti)

- Cannot confirm if inspector actually visited the vendor on the scheduled date
- Cannot see inspector workload across cities without calling them individually
- Report quality varies between inspectors (especially third-party agencies)
- No metric to identify which inspector has high re-inspection rates or suspiciously high pass rates
- Re-inspection requests managed ad-hoc — no visibility into open corrective actions
- GPT failure waivers are happening on WhatsApp with no audit trail
- Currently maintains the Weekly Inward NFP Tracker manually each evening to plan next-day inspections
- The MIS person on his team re-enters every AppSheet result into 5 separate trackers daily

### Sourcing POC

- Finds out about inspection results only when inspector emails the report — no in-tool visibility
- Partial lot decisions happen over calls with no audit trail
- Cannot track how many units are QA-cleared vs. pending inspection vs. failed across all active styles
- No clean handoff from inspection clearance to dispatch — ASN is manually triggered

### Sourcing Manager

- No consolidated view of QA team performance across all inspectors and brands — has to ask QA Manager verbally
- Vendor scorecard exists but QA pass rate, re-inspection rate, and first-time pass rate are not in it — decisions on vendor continuation/delisting are made without this data
- Cannot tell if low QA pass rate at a vendor is a vendor quality problem or an inspector rigor problem — no way to separate the two
- No SLA visibility on inspection turnaround — cannot hold QA Manager accountable for delays
- When holds are unresolved or re-inspections accumulate, finds out through escalation rather than proactively

### Brand / Category Manager

- No vendor quality scorecard — cannot identify consistently failing vendors until it becomes a crisis
- No visibility into QA team throughput or inspection skip rate
- Cannot tie customer return defect types back to inspection findings (Phase 3)

---

## 4. Inspection Types

### 4.1 Final Inspection (FI) — Fully Specified (Phase 1)

End-of-production quality gate before dispatch. Full AQL-based checklist, measurement verification, packing check, and report generation. Triggered when vendor has packed a batch against a specific PO.

### 4.2 Pre-Production Inspection — Placeholder (Phase 2)

Covers fabric approval (FIR), trim approval, PP sample, size set. Triggered by Sourcing POC before production begins. See §13.1.

### 4.3 Inline Inspection — Placeholder (Phase 2)

In-process quality check at configurable production milestones. Triggered by vendor declaring a production milestone. See §13.2.

---

## 5. End-to-End Flow — Final Inspection

### 5.1 Packed Qty — Relationship to Production Module

The Fabricate production module tracks cumulative production quantities against a style/colour:

```
Order Qty → Cut Qty → Sewing Qty → Packed Qty → QA Cleared Qty → Dispatched Qty
```

**How packed qty feeds into inspection requests**

- `Packed Qty` is the total cumulative quantity packed by the vendor for the style/colour, updated via production update entries
- A style may have multiple PO numbers (one PO per warehouse destination). Each ASN maps to one PO
- **Inspection requests are raised per PO** — not per style overall, not per color
- A single inspection request can (and usually does) cover **multiple colors within the same PO**. The AQL is calculated on the combined total packed qty across all colors in that PO — not split per color
- `Inspection Requested Qty` for a PO must satisfy: `≤ (PO Qty − already QA Cleared for that PO)`
- Vendor can request inspection for a partial packed quantity against a PO — the rest can be inspected in a separate round later
- System validates on request submission: `Inspection Requested Qty ≤ Packed Qty (from production module) for that PO`

**Multi-color AQL — critical correction vs. current AppSheet behaviour**

Today, the sourcing team sends one inspection request per color per PO. This fragments AQL — e.g., 8,000-piece PO across 3 colors triggers 3 separate AQL calculations totalling 405 pieces inspected instead of the correct 200. The team manually manipulates per-report numbers to compensate, corrupting the data.

The new system enforces:

- **One PO + one inspection request = one AQL calculation, regardless of color count**
- Section A of the execution form has a colour-wise quantity breakdown that rolls up to a single PO total
- The system computes sample size from the combined PO packed qty using ANSI/ASQ Z1.4 single sampling tables
- Sample pieces are pulled proportionally from each color and each warehouse destination

**QA Cleared Qty in Fabricate**

A new quantity stage is added to the Fabricate production spine:

- `QA Cleared Qty` is tracked per PO — sum of passed quantities across all completed inspections for that PO
- At SubOrder level, QA Cleared Qty is displayed as an aggregate across all POs for summary visibility
- Updated automatically when an inspection result is `Passed` or when a partial lot approval is granted by Sourcing POC
- Visible on the SubOrder detail page alongside other production quantities
- Dispatch / ASN can only proceed against QA Cleared Qty (Phase 2 enforcement via Tessera; Phase 1: surfaced as a field, enforcement manual)

**Edge cases**

| Scenario | Handling |
|---|---|
| Vendor inflates packed qty and requests inspection for more than actually packed | Inspector confirms actual qty in Section A. Inspector input overrides declaration if discrepancy; report records both figures |
| Packed qty in production module is zero but vendor raises inspection request | System prompts: "No packed quantity recorded. Update packed quantity now?" If vendor confirms with a qty, packed qty is updated and request proceeds. If declined, request is blocked |
| Inspection requested qty > current packed qty | System prompts to update packed qty to the requested figure. If confirmed, packed qty updated and request proceeds. If declined, vendor must reduce requested qty |
| Multiple POs for same style/colour | Vendor must select which PO the inspection is for; system shows list of active POs with packed qty and already-inspected qty per PO |
| Multiple active inspections for the same PO | Allowed. Both tracked independently against the same PO. QA Cleared Qty accumulates as each passes |
| One PO spans multiple colors but vendor only wants to inspect one color now | Allowed — vendor enters inspection requested qty for the color(s) being offered. Remaining colors get their own future inspection request against the same PO |

**Vendor premises**

- Each vendor can have multiple premises (factory locations within the same city or different cities)
- Vendor profile stores all registered premises with address and city
- When raising an inspection request, location field is pre-populated from the PO's associated vendor premise
- Vendor can override the pre-populated premise if the batch is at a different location — override is logged
- Phase 2: premise is auto-populated from Tessera PO/ASN data

---

### 5.2 Inspection Request Initiation

**Trigger:** Vendor (or Sourcing POC on behalf of vendor) has packed a batch against a specific PO and wants to request inspection.

**Who can initiate**

| Initiator | When |
|---|---|
| **Vendor** | Standard path. Vendor uses vendor portal to raise the request. Available as vendors are onboarded to the portal |
| **Sourcing POC on behalf of vendor** | Transition support — for vendors not yet onboarded to the portal, Sourcing POC can raise the request from the SubOrder detail page. Recorded with `on_behalf_of_vendor_id` field. Notifications flow to the vendor on completion as if the vendor raised it |
| **Inspector — on-site** | When already at a vendor site for a scheduled inspection, can initiate same-day inspection for an additional packed batch. See §5.2 — On-site discovery |

**PO Gating — hard prerequisites before inspection request can be created**

| Condition | If not met |
|---|---|
| PO must exist in Fabricate (valid PO number) | Request blocked — "No PO found. Contact sourcing POC." |
| PO status must not be `Cancelled` | Request blocked — "PO is cancelled. Inspection cannot be raised." |
| PO status must not be `Fully Dispatched` | Request blocked — "PO fully dispatched. No remaining qty for inspection." |
| PO status must not be `On Hold` | Request blocked with reason — "PO is on hold. Contact sourcing POC before raising inspection." |
| Packed qty must be > 0 | System prompts to update packed qty (see §5.1); if declined, request blocked |

Gating checks run on PO selection before the request form is shown.

**Steps (vendor path)**

1. Vendor logs in, sees active sub-orders → styles/POs with packed qty and inspection status per PO
2. Selects PO — system runs PO gating checks above
3. If gating passes, inspection request form opens
4. Vendor enters:
   - **Inspection requested qty per color** (validated against packed qty in production module). Multi-color rows shown if PO has multiple colors
   - **Ready-for-inspection date** (must be ≥ today + 2 days)
   - **Location** (pre-filled from vendor profile, editable per inspection)
   - **Notes for QA team** (optional)
5. Submits → status: `Pending Assignment`
6. QA Manager and Sourcing POC notified

**Steps (Sourcing POC on behalf of vendor)**

1. Sourcing POC opens SubOrder detail page → Inspections tab
2. Clicks "Raise Inspection on behalf of vendor"
3. Same form as vendor path. PO list pre-filtered to that SubOrder
4. Submits — `created_by` = Sourcing POC user ID, `on_behalf_of_vendor_id` = vendor ID
5. Vendor receives in-app + email notification: "Inspection request raised on your behalf"

**On-site discovery — Inspector finds additional batch at vendor premises**

When an inspector is already at a vendor site for a scheduled inspection and the vendor has an additional packed batch ready for a different PO (or additional qty for the same PO):

1. Inspector taps "New On-Site Request" from within the active inspection or from their schedule
2. Selects PO (vendor pre-filled from current visit, location pre-filled from current premises)
3. System runs PO gating checks (same as standard request)
4. If gating passes: inspector enters inspection requested qty per color, confirms location
5. System creates request with status `On-Site — In Progress` and ready date = today. **No QA Manager approval gate**
6. Notifications sent immediately to: QA Manager (informational — "Inspector [name] has added an on-site inspection for PO [X] at [vendor]"), Vendor (in-app), Sourcing POC (in-app)
7. Inspector proceeds directly to inspection execution (geo already verified from primary inspection)
8. Each inspection generates a separate report with its own report number
9. The 2-day minimum lead time rule is waived for on-site requests

**Cancellation flow**

| Who cancels | When | How |
|---|---|---|
| Vendor | Status is `Pending Assignment` | Vendor can withdraw directly. No approval needed. QA Manager notified |
| Vendor | Status is `Scheduled` or `Confirmed` | Vendor can request cancellation with mandatory reason. QA Manager must approve. Inspector notified if approved |
| QA Manager | Any status before `In Progress` | Manager cancels directly with reason. Vendor and inspector notified |
| QA Manager | Status is `In Progress` | Cannot cancel while in progress. Inspector's draft data is preserved. After report submission, QA Manager can void the report with mandatory reason. Voided report retained in audit trail |

Cancelled inspections are retained in audit trail with cancellation reason and actor. Cancelled status does not count as missed inspection in accountability metrics.

**Phase 1 vs Phase 2**

- **Phase 1**: Vendor (or Sourcing POC on behalf) manually enters packed qty and location. Ready date minimum 2 days (waived for on-site). No Tessera sync
- **Phase 2**: PO details (qty, warehouse destination, premises) auto-populated from Tessera PO data. Inspection request auto-triggered when vendor initiates ASN in Tessera. Inspection clearance flag returned to Tessera on pass

---

### 5.3 Inspector Assignment (QA Manager) — Phase 1: Manual

**Phase 1 — Manual assignment by QA Manager**

QA Manager reviews incoming requests and assigns inspector manually. Per request, the system shows:

- Vendor name, city, fabric type (woven / knit)
- PO qty, inspection requested qty, ready date
- Eligible inspectors with current active inspection count
- Conflict indicator: inspectors already assigned on the requested date are flagged inline
- Inspector type indicator: `in_house` / `third_party_agency (agency name)` — surfaced as a chip on each inspector

**Inspector eligibility criteria shown to QA Manager**

- Zone covers vendor city
- Specialisation matches vendor fabric type (Woven / Knit / Both)
- Conflict check: system flags inspectors with an existing confirmed assignment on the requested date — "Conflict on [date]" per inspector. Not a hard block; manager can assign with awareness

**Inspector pool — Phase 1**

- Each inspector profile stores: name, `inspector_type` (`in_house` / `third_party_agency`), `agency_name` (if third-party), zones covered (list of cities), fabric specialisation (Woven / Knit / Both), active flag
- Each vendor profile stores: fabric type (Woven / Knit / Mixed), registered premises
- Specialisation mismatch shows a warning but does not block assignment
- Preferred inspector list per vendor: Phase 3

**Third-party inspector handling**

- Third-party inspectors are full system users — they have a login, see their schedule, fill the report in the mobile web form, and submit it the same way in-house inspectors do
- No coordinator role in the system. The QA Manager assigns a specific third-party inspector profile directly
- The fact that they're third-party is visible in the assignment panel and in reports/metrics, but the workflow is identical

**QA Manager actions**

1. Selects inspector from list (conflict and specialisation status visible per inspector)
2. Sets inspection date (can adjust from vendor's requested ready date)
3. Adds travel/logistics notes for inspector (optional)
4. Confirms assignment → status: `Scheduled`
5. Inspector and vendor notified

**Phase 2 — Auto-scheduling**

System auto-suggests best available inspector based on zone + specialisation + active load + travel proximity. QA Manager reviews and confirms or overrides. Date auto-proposed based on inspector calendar and vendor ready date. Escalates automatically if no eligible inspector is found.

**Edge cases**

| Scenario | Handling |
|---|---|
| No inspector in vendor's city on requested date | QA Manager sees alert. Can assign from adjacent zone with override flag, or adjust date |
| Inspector assigned but becomes unavailable before confirming | QA Manager can re-assign. Vendor and original inspector notified |
| QA Manager assigns inspector with specialisation mismatch | Warning shown, not blocked. Mismatch reason logged |
| QA Manager assigns inspector with date conflict | Warning shown, not blocked. Manager proceeds with awareness |
| Multiple requests for same city on same date | Manager can batch-assign to same inspector if within active load threshold |
| Third-party inspector inactive in their agency | QA Manager marks `inactive` on inspector profile — inspector hidden from assignment list. Existing assignments require re-assignment |

---

### 5.4 Inspector Schedule View (Mobile — Inspector)

Inspector sees a personal schedule of all inspections assigned to them.

**Views**

- **Today** — inspections scheduled for today, sorted by time window. Active CTAs shown
- **Upcoming** — future confirmed inspections sorted by earliest scheduled date first
- **Pending Confirmation** — date has been set by QA Manager but inspector has not yet confirmed or flagged. Requires action. Badge count shown on tab
- **Unscheduled** — assigned to inspector but no date set yet by QA Manager. No action available; informational only
- **Completed** — submitted reports only. Pass/fail badge visible. Report PDF accessible
- **Missed / Rescheduled** — missed inspections and vendor-not-ready rescheduled cases. Separate from Completed. Inspector can propose new date from here

**Reminders for pending schedule confirmation**

- Inspector has not confirmed/flagged within 24hr of assignment → push notification + in-app badge
- Inspector still unconfirmed after 48hr → QA Manager alerted

**Card states and CTAs**

| Status | What inspector sees | CTA |
|---|---|---|
| `Scheduled` — future date | Vendor, location, style, PO, date, time window | Confirm Date / Flag Conflict |
| `Confirmed` — upcoming | All details + confirmed badge | No action until date |
| `Confirmed` — today | Active card with geo check | Start Inspection |
| `Unscheduled` | Pending date badge | No CTA — wait for manager |
| `In Progress` | Started but not submitted | Continue Inspection |
| `Missed` | Missed flag, date passed without start | Propose New Date |
| `Rescheduled — Vendor Not Ready` | Rescheduled badge with original date | View details |
| `Rescheduled — Inspector Conflict` | Rescheduled badge | View details |
| `Completed` | Result badge (Pass/Fail/Hold) | View Report |
| `Re-inspection Assigned` | Re-inspection badge with round number + link to previous round report | Start Re-inspection |

**Critical UX fix from discovery:** Once an inspection moves to `Completed`, it must automatically disappear from the active list (Today / Upcoming). Inspector should never see completed items mixed with pending ones. The Completed tab is the only place they appear.

**Edge cases in schedule**

| Scenario | Handling |
|---|---|
| Inspector has two inspections scheduled on the same date in different cities | Both show on Today view. Inspector must flag conflict — QA Manager prompted to re-assign one |
| Inspector assigned but date is not set yet | Shows in Unscheduled tab. Inspector cannot start. Inspector can message QA Manager via notes |
| Inspector reassigned mid-flow to a different inspector | Removed from original inspector's schedule, added to new inspector's schedule. Both notified |
| Vendor rejects inspection date (vendor was not ready) | Status → `Rescheduled — Vendor Not Ready`. Inspector sees this in Past tab with reason. Inspector can propose a new date |
| Inspector starts inspection on wrong date (day early) | Warning: "Scheduled date is [X]. You are starting on [Y]. Confirm to proceed." Deviation logged |
| Re-inspection round assigned — inspector needs previous report context | Re-inspection card links to previous round report. Inspector can review failed items before starting |
| Inspection is `Missed` (no start by EOD) | Inspector can tap "Propose New Date" — enters suggested date + mandatory reason. Submitted to QA Manager for approval |

**Inspector date confirmation flow**

1. Inspector receives assignment notification
2. Opens assignment in schedule view
3. Reviews details — if date works, taps "Confirm Date"
4. If conflict: taps "Flag Conflict" → mandatory reason field → submitted to QA Manager
5. On confirm: vendor receives email + in-app notification with inspector name, confirmed date, time window
6. Status → `Confirmed`

---

### 5.5 Day of Inspection — Visit Tracking

| Event | System action |
|---|---|
| Inspector taps "Start Inspection" | Browser location permission prompt shown. Inspector must grant permission to proceed |
| Inspector denies location permission | Hard block — "Location access required. Enable in browser/device settings and retry." No bypass |
| Permission granted, coordinate resolved, within 500m of vendor address | `geo_verified: true`. Inspection proceeds normally |
| Permission granted, coordinate resolved, outside 500m | Geo mismatch flag raised to QA Manager. Inspector proceeds — not a blocker |
| Permission granted but GPS fails to resolve coordinate (poor connectivity at factory) | Inspector sees: "GPS unavailable. Inspection will be marked location-unverified." Inspector confirms to proceed. `geo_verified: false`. Flag to QA Manager |
| Inspector does not start by EOD of scheduled date | Auto-alert to QA Manager; status → `Missed` |
| Report submitted in < 30 min from start | Suspicious flag raised to QA Manager for review |
| Inspection started but not submitted within 6 hours | Reminder to inspector. After 12 hours: flag to QA Manager |

**Location permission is mandatory. GPS signal failure is not a blocker.**

- Denying location permission (a deliberate choice) → hard block
- GPS failing to resolve a coordinate (infrastructure constraint, common at vendor premises with poor connectivity) → allowed with `geo_verified: false` flag

---

### 5.6 Inspection Execution — Mobile Form (Inspector)

Sections are completed sequentially on mobile. **Progress auto-saves every 30 seconds** to local storage (Phase 1) with cloud sync on reconnect (Phase 2). All sections mandatory unless marked optional. Inspector can navigate back to earlier sections before final submit.

#### Section A — Order & Packing Verification

**A.1 Mandatory pre-quantity captures (in this order)**

These three captures happen *before* any quantity data is entered. Carton stacking photo specifically must be taken before any cartons are moved or opened — it's evidence the goods were in original packed state.

| Capture | Why mandatory | Multiplicity |
|---|---|---|
| **Carton Stacking Photo** | Evidence of original packed state. Must be first action — before any cartons are moved or opened | At least 1, no upper limit |
| **Packing List Photo** | Per destination warehouse | At least 1, one per destination minimum |
| **Packed Goods Photo (cartons opened)** | Documentation of goods condition after cartons opened | At least 1 |

**A.2 Fields (auto-filled or inspector input)**

| Field | Source | Notes |
|---|---|---|
| Style code | Auto-filled from request | Phase 2: from style master |
| Colour(s) | Auto-filled from request | Multi-color shown as rows |
| PO number | Auto-filled from request | One PO per inspection |
| Fabricate Code | Auto-filled from SubOrder | The unique sub-order identifier |
| Total PO qty | Auto-filled from Fabricate | Phase 2: from Tessera PO data |
| Vendor declared packed qty (per color) | Auto-filled from inspection request | |
| Order Qty (per size) | Auto-filled from Fabricate | From the PO breakdown |
| Cut Qty (per size) | Auto-filled from Fabricate production module | Factory-reported cut quantity. Inspector verifies / can flag discrepancy |
| Inspector confirmed packed qty (per size, per color, per destination) | Inspector input | If different from declared → discrepancy flagged in report |
| Total cartons present | Inspector input | Phase 2: expected count from Tessera packing list |
| Cartons expected | Phase 1: inspector derives from PO packing list. Phase 2: auto-populated from Tessera | |
| Cartons selected for AQL | Inspector input — carton numbers picked for sampling | |
| Packing status % | Calculated | Confirmed packed qty / PO qty |

**A.3 Size + Colour + Destination breakdown**

Inspector verifies qty per size per color per destination. This is the table that the AQL sample size is computed from:

| Destination | Colour | XS | S | M | L | XL | XXL | 3XL | 4XL | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| (Inspector input per row) | | | | | | | | | | Auto |

The system compares against the PO breakdown and flags size variances > ±5%.

**A.4 Edge cases**

| Scenario | Handling |
|---|---|
| Inspector confirmed qty < vendor declared qty | Discrepancy field auto-populated. Report notes both. QA Manager and Sourcing POC alerted |
| Vendor has packed qty across multiple POs but only one PO is selected | Inspector notes which PO qty is physically segregated and verifiable. Other POs not included in this report |
| Cartons mixed across destinations and cannot be separated | Inspector notes in remarks. Packing table filled with best estimates + flag |
| Size ratio grossly wrong (e.g., all M, no XL) | Flagged as packing non-conformity. Counted as a major defect in AQL |
| One color in PO is fully packed, another color is still in production | Inspector enters confirmed qty only for colors physically offered. Other colors get separate future inspection |
| Cut Qty < PL Qty (more packed than cut) | Hard validation error — flagged as data integrity issue. Inspector cannot proceed without resolving (likely vendor under-declared cut qty) |

---

#### Section B — Workmanship

**B.1 PP Sample Photo (mandatory first capture in this section)**

Before defect entry begins, inspector takes a photo of the **PP Sample** (Pre-Production approved reference sample). This is the baseline garment that all workmanship defects are judged against. It appears embedded in the workmanship section of the final report.

| Capture | Why mandatory | Multiplicity |
|---|---|---|
| **PP Sample Photo** | Reference garment against which defects are evaluated | 1 mandatory, additional allowed |

**B.2 Defect entries**

Inspector adds defect entries one by one. **No cap on the number of defects** (current AppSheet caps at 8 — this is removed).

| Field | Type | Notes |
|---|---|---|
| Defect description | Text | Freeform |
| Severity | Select | Major / Minor |
| Photo | Upload | **Mandatory for each Major defect.** Optional but recommended for Minor. **No cap on number of photos per defect** |
| Count | Number | Instances found across inspected sample |

System auto-tallies: Total Major count, Total Minor count.

**B.3 Edge cases**

| Scenario | Handling |
|---|---|
| Inspector marks Major but does not upload photo | Blocked — photo mandatory for Major severity. Cannot proceed to next section |
| Inspector finds zero defects | Explicitly requires inspector to confirm "No defects found" — cannot leave blank |
| Same defect type found at high frequency | Inspector can enter one defect entry with count > 1 rather than individual entries |
| Inspector wants to attach 15+ photos for a single defect | Allowed — no upper limit |

---

#### Section C — Measurement Verification

Per measurement point:

| Field | Notes |
|---|---|
| Measurement point | e.g., Full Length at Side Seam |
| Spec value | Phase 1: inspector inputs from physical spec sheet. Phase 2: auto-loaded from style master |
| Tolerance (±) | Phase 1: inspector inputs. Phase 2: auto-loaded |
| Actual measured value | Inspector input |
| Finding | Auto: OK / Deviation. Inspector can override with note |

Representative measurement points (customisable per category by QA Manager):

- Full length at side seam
- 1/2 waist relaxed / stretched
- 1/2 hip 8" below waist band
- 1/2 thigh 1" at crotch
- 1/2 knee 14" below crotch
- 1/2 bottom relaxed (elastic)
- Front / back rise incl. waist band
- Bottom elastic fold height
- Fly width / length
- Waist band height
- String length
- Distance between two eyelets
- Front pocket bag width / length
- Side cross pocket opening at side seam
- Cargo pocket dimensions (if applicable)

**Phase 1**: Inspector fills measurement table manually OR uploads a photo of the physical measurement sheet. Photo upload is the fallback; structured data entry is preferred. Measurement point list pre-configured per category by QA Manager in tool settings.

**Phase 2**: Spec sheet auto-loaded from style master integration. Inspector only enters actual measured values; spec and tolerance pre-filled.

**Edge cases**

| Scenario | Handling |
|---|---|
| Measurement point not applicable for this style | Inspector marks N/A per row — excluded from pass/fail calculation |
| Inspector measures within tolerance on spec but visual quality is poor | Inspector notes discrepancy in remarks. Cannot auto-pass on measurements alone if workmanship defects are present |
| Measurement sheet not available at vendor site | Inspector uploads photo of physical copy. Flag raised on report: "Measurement data entered from physical copy — digital verification pending" |

---

#### Section D — AQL Evaluation

| Field | Type | Notes |
|---|---|---|
| AQL level — Major | Pre-set | Phase 1: configured per brand by QA Manager. Bewakoof default: 2.5 |
| AQL level — Minor | Pre-set | Phase 1: configured per brand. Bewakoof default: 4.0 |
| Sample size | Auto-calculated | From confirmed packed qty per AQL sampling table (ANSI/ASQ Z1.4 single sampling) |
| Max allowed — Major | Auto-calculated | |
| Max allowed — Minor | Auto-calculated | |
| Actual defects — Major | Pulled from Section B | |
| Actual defects — Minor | Pulled from Section B | |
| System AQL result | Auto-calculated | Pass / Hold / Fail |
| Inspector override | Optional | Inspector can override result with mandatory written reason — override permanently logged |

**D.1 Real-time consultation with QA Manager (NEW — solves the WhatsApp problem)**

For borderline AQL results, the inspector currently calls Kanti (QA Manager) on the phone to discuss the result before submitting. This conversation isn't logged anywhere. The new system supports this as a structured flow:

1. On the AQL Evaluation screen, inspector sees a **"Request Manager Input"** CTA alongside the result
2. Tap → opens consultation dialog with: AQL numbers (sample size, max allowed, actual), defect summary, optional note from inspector
3. Submit → in-app notification + push notification to QA Manager
4. QA Manager sees the consultation request in their dashboard with full context
5. QA Manager responds with: **Recommend Pass** / **Recommend Hold** / **Recommend Fail** + mandatory note (e.g., "Approve as Pass — minor defects acceptable for this customer segment")
6. Inspector receives the recommendation in-app. Inspector selects the result (typically aligned with manager recommendation but not forced)
7. Both the consultation request and the manager's recommendation are logged in the report's audit trail
8. If inspector selects a result *different* from the manager's recommendation, that's also logged as a deviation

This replaces the WhatsApp/phone consultation with an in-system trail. SLA: QA Manager response expected within 30 minutes. If no response in 30 min, inspector can proceed with their own judgement (still logged).

**D.2 Edge cases**

| Scenario | Handling |
|---|---|
| Inspector overrides system Pass to Fail | Override logged with reason. QA Manager and Sourcing POC notified |
| Inspector overrides system Fail to Pass | Override logged with reason. Immediate alert to QA Manager and Sourcing POC — high-risk action requiring review |
| AQL is on the boundary (exactly at max allowed) | System marks as Pass. Inspector shown warning that this is borderline. Consultation suggested |
| Packed qty too small for standard AQL sampling | System falls back to 100% inspection or shows minimum sample size. QA Manager to confirm approach |
| Inspector requests consultation but QA Manager doesn't respond in 30 min | Inspector can proceed with own judgement; the unanswered consultation is logged |

---

#### Section E — Test Results

| Check | Result | Notes |
|---|---|---|
| Accessories | Pass / Fail | Buttons, zippers, snaps, labels — present, correctly placed, functional |
| Snap / button resistance | Pass / Fail | |
| GPT test report | Pass / Fail / Pending / Waived / N/A | See E.1 below |
| Labelling & packing | Pass / Fail | Brand label, care label, country of origin, size label, barcode scannable and correct SKU |
| Safety check | Pass / Fail | Needle detection, no sharp objects, no prohibited substances |
| Quantity | Pass / Fail | Confirmed packed qty matches declaration |

**E.1 GPT (Garment Performance Test) — extended states**

GPT is a lab test typically conducted by external labs (Intertek, Bureau Veritas, etc.). Results are often delayed. The four meaningful states:

| GPT State | Meaning | Inspection Outcome |
|---|---|---|
| `Pass` | Lab report received, all parameters within spec | Section E check: Pass |
| `Fail` | Lab report received, one or more parameters failed | Section E check: Fail → triggers GPT Waiver Flow (§5.9) |
| `Pending` | Sample sent to lab, results not yet received | Inspection result → **Hold** (cannot proceed to Pass without GPT) |
| `Waived` | GPT failure has been formally waived by QA Manager (see §5.9) | Section E check: Pass (with waiver reference visible in report) |
| `N/A` | Style does not require GPT for this category | Section E check: not applicable |

Inspector enters the GPT test report reference number or uploads a photo of the report front page.

---

#### Section F — Remarks & Sign-off

| Field | Type | Notes |
|---|---|---|
| Inspector remarks | Text | Observations, corrective actions required, re-inspection conditions |
| Overall result | Select | Pass / Hold / Fail / Not Ready — pre-filled from AQL result, editable with mandatory reason if overriding |
| Inspector sign-off | Name confirmation + timestamp | Inspector confirms identity digitally |
| Factory representative name | Text | Person present at vendor during inspection |
| Factory representative signature | Photo upload | Photo of physical signed copy acceptable in Phase 1 |
| Additional images | Multi-upload | Optional — general inspection photos (label/tag closeups, packaging detail, etc.) |

**F.1 Lockability rules (preserves current AppSheet behaviour with one improvement)**

| Final result | Lockability |
|---|---|
| Pass | Locked on submission — no edit |
| Fail | Locked on submission — no edit |
| Not Ready | Locked on submission — no edit |
| Hold | Editable post-submission by QA Manager only (resolves to Pass once blocking item — typically GPT — is cleared) |

**F.2 Correction flow for accidental locks (NEW)**

If an inspector accidentally clicks Pass/Fail/Not Ready and submits, QA Manager can **void** the report (§5.7 edge cases). Voided report retained in audit trail; inspector creates new report against the same inspection request. This replaces the current AppSheet behaviour of permanent unrecoverable lock.

---

### 5.7 Submission & Report Generation

On inspector submit:

1. System validates: all mandatory fields complete, Major defects have photos, mandatory captures present (carton stacking, PP sample, packing list, factory rep signature)
2. Report assigned a unique Inspection Report Number (see §5.11)
3. PDF inspection report generated using Phase 1 brand template (Bewakoof)
4. Status → `Submitted`
5. QA cleared qty updated in Fabricate production module:
   - If result is Pass → QA Cleared Qty for this PO incremented by inspection passed qty
   - If result is Fail / Hold / Not Ready → no change to QA Cleared Qty until resolved
6. Email triggered to: Vendor (PDF attached), Sourcing POC (PDF attached), QA Manager (PDF attached)
7. In-app notification to QA Manager and Sourcing POC

**Edge cases**

| Scenario | Handling |
|---|---|
| Inspector loses connectivity mid-inspection / browser crashes | Form auto-saves locally every 30 seconds. All data entered up to that point preserved in draft state. Status remains `In Progress`. On reconnect or reopen, inspector resumes from last saved state. No data loss |
| Inspector submits but PDF generation fails | Report data is saved. Email retried up to 3 times. QA Manager alerted: "Report submitted but PDF not generated — manual follow-up required" |
| Inspector submits report for wrong PO (human error) | Report locked post-submission. QA Manager can void the report with reason. Inspector re-submits. Voided reports retained in audit trail |
| Inspector accidentally clicks Pass instead of Hold | QA Manager voids → inspector creates new report |

---

### 5.8 Outcome Flows

#### Pass

- Status → `Passed`
- QA Cleared Qty for PO updated in Fabricate
- Vendor notified to proceed with dispatch / ASN initiation
- Sourcing POC and QA Manager receive report
- Phase 2: inspection clearance flag sent to Tessera

#### Fail

- Status → `Failed`
- Vendor receives email: PDF report with failed items listed, instruction to log corrective action
- Vendor sees corrective action submission form in tool (see §5.10)
- QA Cleared Qty not updated

#### Hold

- Status → `On Hold`
- Sourcing POC notified — decision required within 48 hours
- If no decision in 48 hours → escalation alert to Sourcing Manager
- Sourcing POC options:

| Decision | Action | Notes |
|---|---|---|
| Full re-inspection | Marks as Fail → re-inspection flow | |
| Partial lot approval | Enters pass qty + fail qty split | Pass qty → QA Cleared Qty updated; fail qty → corrective action flow |
| Override to Pass | Mandatory written reason | Permanently logged in audit trail |
| Override to Fail | Mandatory written reason | Permanently logged in audit trail |

**Vendor cannot initiate a partial split.** Vendor view shows Sourcing POC decision as read-only.

#### Not Ready

- Status → `Rescheduled — Vendor Not Ready`
- Counts toward Vendor Not Ready Rate KPI on vendor scorecard
- Inspector visit is logged as a wasted trip — flagged for accountability tracking
- New ready date proposed via standard reschedule flow

**Edge cases**

| Scenario | Handling |
|---|---|
| Sourcing POC approves partial split but qty doesn't add up to inspected qty | Validation error — pass qty + fail qty must equal inspection requested qty |
| Hold escalated to Sourcing Manager but Sourcing Manager is inactive | Escalation goes to QA Manager as fallback. Alert: "Sourcing Manager unresponsive — QA Manager notified as escalation fallback" |
| Override to Pass on a report with safety failures | Hard warning: "This report has safety check failures. Overriding to Pass carries compliance risk." Reason field mandatory, flags for audit, notifies Sourcing POC and Sourcing Manager immediately |
| Vendor Not Ready 3rd time in a season for same vendor | Flag on vendor scorecard. Sourcing Manager notified |

---

### 5.9 GPT Waiver / Exception Flow (NEW)

When a GPT lab test fails (e.g., dimensional stability fails for an interlock fabric), the current workflow handles this via WhatsApp: the merchandiser sends the failed report to Sandeep / QA leadership, and approval to waive is given in chat. There is no system audit trail.

This flow makes the waiver explicit in the system.

**Trigger**

GPT Fail can be flagged at two points:
1. **During inspection execution** — inspector enters GPT as `Fail` in Section E
2. **Post-submission** — a Hold report (originally GPT Pending) gets the lab result back and the result is Fail

**Waiver request flow**

1. **Initiator**: Sourcing POC (typically), QA Manager, or vendor can request a waiver
2. Initiator opens the inspection report → clicks "Request GPT Waiver"
3. Form fields:
   - GPT failure parameter (e.g., dimensional stability, colour fastness)
   - Lab report attachment (PDF, mandatory)
   - Fabric / yarn batch details
   - Business justification (text, mandatory)
   - Scope: **this PO only** / **multiple POs of same fabric batch** (multi-select list of POs shown)
4. Submit → status: `GPT Waiver Pending`

**Approver**

- For Bewakoof Phase 1: **QA Manager** is the sole approver (Kanti's equivalent)
- Future expansion: brand-configurable approval matrix (e.g., requires QA Manager + Category Manager dual approval for waivers above a qty threshold)

**Approver actions**

- **Approve** → for each PO in scope: GPT state on the report changes to `Waived`. Inspection result re-evaluated:
  - If only GPT was holding it as Hold → status moves to `Passed` (or back to whatever AQL result was)
  - QA Cleared Qty updated
- **Approve with conditions** → waiver granted but vendor must implement corrective action on future batches. Logged
- **Reject** → waiver denied. Report stays at Fail/Hold. Vendor must proceed via re-inspection flow

**Audit trail**

- Every waiver creates an immutable record: requester, approver, justification, lab report PDF, POs covered, decision, decision reason, timestamp
- Visible on the inspection report and on the vendor profile (waiver history)
- Counted in vendor accountability — repeated waivers for same vendor / fabric flag the vendor

**Edge cases**

| Scenario | Handling |
|---|---|
| Same fabric lot fails GPT across 5 POs at once | Multi-PO waiver allowed in single request. One decision applies to all listed POs |
| Waiver approved but goods already dispatched | Allowed — waiver retroactively clears the QA record. Logged with `retroactive: true` flag |
| Vendor requests waiver themselves | Allowed but requires QA Manager approval (vendors cannot self-approve their own waivers) |
| Waiver rejected — vendor wants to escalate | Vendor can escalate to Sourcing Manager. Sourcing Manager can override the QA Manager rejection. Override logged |

---

### 5.10 Corrective Action & Re-inspection Flow

This flow applies to three cases: (1) full Fail result, (2) Hold where Sourcing POC decides full re-inspection, (3) Hold with partial lot approval — fail qty portion. In all cases the trigger and vendor experience are identical; only the qty under corrective action differs.

**How vendor knows to take corrective action**

1. Vendor receives email on Fail / Hold (or partial fail decision) with PDF report attached — failed items listed clearly
2. In-app: vendor dashboard shows the inspection result with status `Failed — Corrective Action Required`
3. Vendor sees a "Submit Corrective Action" CTA against the failed inspection

**How vendor submits corrective action**

1. Vendor opens the failed inspection record
2. Sees list of defects found (from inspector's workmanship section)
3. Per defect or overall:
   - Describes corrective action taken (freeform text)
   - Uploads photo evidence of correction (optional but strongly recommended — flagged if missing)
4. Confirms corrective action complete → submits
5. Status → `Corrective Action Submitted`
6. QA Manager notified to review

**QA Manager reviews corrective action**

- Sees vendor's description and photos
- Accepts or rejects:
  - **Accept** → vendor notified they can now raise a re-inspection request. Status → `Ready for Re-inspection`
  - **Reject** → vendor notified with reason. Status remains `Corrective Action Required`. Vendor must re-submit

**How vendor raises re-inspection**

1. After corrective action accepted, vendor dashboard shows "Raise Re-inspection" CTA against the style/PO
2. CTA is blocked until corrective action is accepted — vendor cannot initiate re-inspection directly after a fail
3. Vendor enters:
   - Corrected / re-packed qty (may differ from original inspected qty)
   - Ready-for-re-inspection date
   - Notes (optional)
4. Submits → new inspection request created, linked to parent, round number incremented
5. Re-inspection follows same flow from §5.3 onwards

**Edge cases**

| Scenario | Handling |
|---|---|
| Vendor submits corrective action without photos | Allowed but flagged. QA Manager sees "No photo evidence provided" warning when reviewing |
| Vendor re-raises inspection without corrective action (tries to bypass) | Blocked. "Raise Re-inspection" CTA disabled until corrective action status is `Accepted` |
| Second re-inspection also fails | Same fail flow. Round number increments. After 3 failed rounds for the same PO: escalation flag to Sourcing POC and Sourcing Manager |
| Corrective action accepted but vendor's re-packed qty < originally failed qty | Allowed. Remaining qty not re-packed treated as unresolved. Sourcing POC notified of the gap |

---

### 5.11 Inspection Report Numbering & Re-inspection Linking

**Report number format**

```
INS-{BRAND}-{YYMM}-{SEQUENCE}-R{ROUND}
```

Examples:
- `INS-BW-2601-0042-R1` — First inspection, Bewakoof, Jan 2026, sequence 42
- `INS-BW-2601-0042-R2` — Re-inspection (Round 2) of the same batch
- `INS-BW-2601-0042-R3` — Third round

**Linking logic**

- The original inspection (R1) is the parent record
- Every re-inspection references `parent_inspection_id` → always the R1 report ID
- Report chain visible as a timeline: R1 → R2 → R3 with result at each round
- Each report PDF shows: Report #, Round #, Previous Report # (with link in digital version)
- QA Manager and Sourcing POC can see full inspection chain for any PO on the style detail page

**Tracking re-inspection chain to closure**

- A PO is only considered inspection-closed when the final round in its chain has a `Passed` result or a Sourcing POC partial/override decision or a granted GPT waiver
- Open inspection chains (last round is Fail or Hold without a decision) surfaced in QA Manager's open items dashboard
- SLA tracked from the first failed round

---

## 6. Fabricate OMS Integration — Changes to Production Flow

### 6.1 New Quantity Stage: QA Cleared Qty

Production spine updated:

```
Order Qty → Cut Qty → Sewing Qty → Packed Qty → QA Cleared Qty → Dispatched Qty
```

- `QA Cleared Qty` shown on SubOrder detail page and production history
- Updated automatically by inspection module on `Passed` result or Sourcing POC partial approval or granted GPT waiver
- Per PO — since each ASN maps to one PO, QA Cleared Qty tracked per PO line
- Dispatch (ASN) should only proceed against QA Cleared Qty (Phase 1: informational; Phase 2: enforced via Tessera)

### 6.2 Inspection Status on SubOrder

SubOrder detail page shows one row per active inspection request, grouped by PO.

| PO # | Inspection ID | Round | Inspected Qty | QA Cleared Qty | Status |
|---|---|---|---|---|---|
| BBPL-1234 | INS-BW-2601-0042-R1 | 1 | 500 | 500 | Passed |
| BBPL-1234 | INS-BW-2601-0043-R1 | 1 | 133 | 0 | In Progress |
| MUM-5678 | INS-BW-2601-0044-R1 | 1 | 290 | 0 | Failed — Corrective Action Pending |

PO-level QA Cleared Qty subtotal shown at PO group header. SubOrder-level aggregate at top of section.

### 6.3 FI Stage in Spine

The existing `fi` stage in the Fabricate production spine maps to the inspection module. Stage statuses:

| Inspection status | OMS stage display |
|---|---|
| No inspection request raised | FI: Not Requested |
| Pending Assignment | FI: Requested |
| Scheduled / Confirmed | FI: Scheduled |
| In Progress | FI: In Progress |
| Passed | FI: Cleared |
| Failed / Hold (open) | FI: Action Required |
| GPT Waiver Pending | FI: Waiver Pending |

### 6.4 Queue / Action Items

QA-related action items appear in the Fabricate action queue:

| Action Type | Trigger | Urgency | CTA |
|---|---|---|---|
| FI Not Requested | Packed qty updated, no inspection request for PO > X days | Due-today / Overdue | Raise FI |
| FI Result Pending | Inspection in progress, no submission in > 12hr | Overdue | View |
| Hold — Decision Required | Sourcing POC has an unresolved hold | Due-today (< 48hr) / Overdue (> 48hr) | Decide |
| Corrective Action Pending Review | Vendor submitted CA, QA Manager hasn't reviewed | Due-today | Review |
| Re-inspection Not Assigned | Re-inspection request raised, not yet assigned | Due-today | Assign |
| GPT Waiver Approval Pending | Waiver request raised, QA Manager hasn't decided | Due-today | Decide |
| Consultation Pending | Inspector requested manager input on borderline AQL | High urgency (30 min SLA) | Respond |

### 6.5 Tracker Sheet Automation — Deferred

The existing 5 Google Sheet trackers (FAT Tracker, GPT Tracker, FI Tracker, Weekly QA Performance Tracker, Weekly Inward NFP Tracker) are **out of scope for this PRD**. The new system captures the underlying data in a structured form; the equivalent reports will be built in the Reports module separately. Until then, the MIS team continues manual re-entry.

---

## 7. Inspection Report Format (PDF — Auto-generated)

Phase 1 brand is **Bewakoof**. The Bewakoof report template is the Phase 1 baseline. Other brand templates (Nautinati, Urbano, etc.) added as those brands onboard in Phase 2.

The content schema below is brand-agnostic. Brand-specific variations are in: logo, header layout, colour, font, field labels, and disclaimer text.

### Report Header

| Field | Source |
|---|---|
| Brand logo | Brand profile |
| Report title | "INSPECTION REPORT" |
| Report # | Auto-generated (INS-BW-YYMM-XXXX-RN) |
| **Fabricate Code** | SubOrder unique identifier |
| **Merchandise category** | Category code (e.g., "(6) INFANT (REPLEN)") |
| Round # | From inspection chain |
| Previous Report # | Parent report ID (for re-inspections) |
| **Submission Type** | "1st Inspection" / "2nd Inspection" / "3rd Inspection" |
| Inspection type | IN-LINE / MID-LINE / FINAL (pre-filled) |
| Date | Inspection execution date |
| Inspector name | Inspector profile |
| Inspector type | In-house / Third-party (agency name) |
| **Sourcing POC name** | From SubOrder |
| Style name | From style master |
| Style code | From style master |
| Colour(s) | From request |
| Gender | From style master |
| **Size Ratio** | From style master (e.g., 4:3:3:4:4:3:2) |
| C/O | Country of origin (from style master) |
| Vendor name | Vendor profile |
| Vendor address | Vendor profile |
| Vendor email | Vendor profile |
| Total PO Qty | From PO |
| AQL Sample Size | AQL calculated |
| Sizes | From style master |
| Buyer | Brand name |

### Section 1 — Order Details (Quantity Breakdown)

Per-size quantity table:

| | Size 1 | Size 2 | ... | Total |
|---|---|---|---|---|
| Order Qty | | | | |
| **Cut Qty** | | | | |
| PL Qty (Packed) | | | | |

Per-warehouse table:

| Warehouse | PO # | PO Qty | PL Qty | % | No. of Cartons | Cartons Selected |
|---|---|---|---|---|---|---|

### Section 2 — Workmanship Findings

- **PP Sample photo** embedded top-right
- Numbered list of defects (no cap on number of entries)
- Columns: # | Defect Description | Severity (Major / Minor) | Count
- Total Major count, Total Minor count
- Defect photos embedded as thumbnail grid with captions (page 2 of report)

### Section 3 — Packing Verification

Size + colour + destination breakdown table (from execution Section A.3).

### Section 4 — AQL Summary

| Field | Value |
|---|---|
| AQL Level — Major | 2.5 |
| AQL Level — Minor | 4.0 |
| Sample Size | Calculated |
| Max Allowed — Major | Calculated |
| Max Allowed — Minor | Calculated |
| Findings — Major | Actual count |
| Findings — Minor | Actual count |
| Total Defects | Sum |
| System AQL Result | Pass / Hold / Fail |
| Inspector Override | Yes/No — if Yes, reason shown |
| Consultation | Yes/No — if Yes, QA Manager note shown |

### Section 5 — Test Results (Acceptance Checklist)

| Check | Accepted | Refused | Comments |
|---|---|---|---|
| Accessories | ✓/✗ | | |
| Quality | ✓/✗ | | |
| Measurements | ✓/✗ | | |
| Conformity | ✓/✗ | | |
| Safety | ✓/✗ | | |
| GPT | ✓/✗ / Pending / Waived | | Test report reference, or waiver reference if waived |
| Labelling / Packing | ✓/✗ | | |
| Quantity | ✓/✗ | | |

### Section 6 — Overall Result & Sign-off

| Field | Value |
|---|---|
| Inspection date | |
| Inspection Result | **PASS / FAIL / HOLD / NOT READY** |
| If override: Override reason | |
| If consultation: Consultation note | |
| If GPT waiver: Waiver reference + decision date | |
| Inspector name + signature | Digital timestamp |
| Factory Manager / Representative name | |
| Factory representative signature | Photo of signed copy |
| QA Name & Email | From inspector profile |

**Standard disclaimer (Bewakoof variant):**

> *"Quality inspection carried out by Bewakoof is on the AQL requirements and is done to the best of their ability and knowledge. The result of these inspections by no means absolves the vendor / factory / manufacturer from 100% quality inspection of the complete merchandise and all materials and trims used."*

### Section 7 — Images

- Carton stacking photos (from Section A captures)
- Packing list photos per destination
- Packed goods photos
- PP sample photo
- Defect photos with captions
- GPT/FPT lab report photos
- Measurement sheet (photo or digital table)
- Factory representative signature photo
- General inspection photos

### Report Storage

- Each report stored against PO #
- One style can have multiple POs — each PO has its own inspection chain
- Reports accessible in:
  - Inspection module (by report number, by PO, by vendor, by inspector)
  - Fabricate SubOrder detail page (per PO)
  - Vendor portal (their own reports only)

### Report Distribution (Email)

| Recipient | Trigger | Attachment |
|---|---|---|
| Vendor | On submission | PDF |
| Sourcing POC | On submission | PDF |
| QA Manager | On submission | PDF |
| All above | On re-inspection submit | New round PDF + link to parent |
| All above | On GPT waiver decision | Updated PDF with waiver note |

---

## 8. QA Team Accountability — Manager Dashboard

### Inspector Metrics (Per Inspector, Rolling 30d / Season)

Metrics segmentable by `inspector_type` to enable in-house vs. third-party comparison.

| Metric | Description | Flag Condition |
|---|---|---|
| Scheduled vs. Completed | Assigned inspections vs. reports submitted | Completion rate < 90% |
| Missed inspections | No start by EOD of scheduled date | Any missed → immediate alert |
| Avg. turnaround | Request raised → report submitted (days) | > brand SLA threshold |
| Visit adherence | % inspections started within ±1hr of scheduled time | < 80% |
| Geo-check compliance | % inspections started within 500m radius | < 95% — review required |
| Avg. report submission time | Time between start and submit | < 30 min → suspicious flag |
| Defect detection rate | Avg. major + minor defects per inspection | Outlier low → flag |
| Re-inspection rate | % of their inspections requiring re-inspection | > team avg + 1 std dev |
| Pass rate | % of their inspections resulting in Pass | > 2 std dev above team avg → rubber-stamp flag |
| Override rate | % of results where inspector overrode AQL suggestion | High rate → judgment review |
| Consultation rate | % of inspections where inspector requested manager input | Informational — no flag |
| Vendor not ready rate | % of visits where vendor was not ready | Persistent → coordinator issue |

### Team-Level Metrics (QA Manager view)

- Total inspections scheduled / completed / missed by period
- Pass / Fail / Hold / Re-inspection / Not Ready breakdown
- Avg. re-inspection rounds per PO before clearance
- Vendor-wise fail rate (surfaces consistently failing vendors)
- City / zone coverage gaps (inspections with no eligible inspector)
- GPT waiver rate by vendor and by fabric type
- In-house vs. third-party split: completion rate, pass rate, override rate
- Consultation response time (QA Manager's own SLA)

### Sourcing Manager View — Vendor Scorecard & QA KPIs

Sourcing Manager has a read-only dashboard across all brands / vendors they oversee. QA performance is a formal KPI component of the vendor scorecard alongside OTIF, costing compliance, and sampling adherence.

**QA KPIs in vendor scorecard**

| KPI | Description | Benchmark (indicative) |
|---|---|---|
| First-Time Pass Rate | % of FI inspections that pass on Round 1 | ≥ 85% |
| Re-inspection Rate | % of POs requiring more than one inspection round | ≤ 15% |
| Avg. Rounds to Clearance | Average inspection rounds before QA cleared | ≤ 1.2 |
| Hold Rate | % of inspections resulting in Hold | ≤ 5% |
| **Vendor Not Ready Rate** | % of scheduled visits where vendor was not ready | ≤ 5% |
| **GPT Waiver Rate** | % of POs requiring a GPT waiver to clear | ≤ 10% (high indicates quality risk) |
| Inspection Turnaround | Avg. days from request raised to report submitted | ≤ 3 days |
| Corrective Action Response Time | Avg. days for vendor to submit corrective action after fail | ≤ 2 days |

**Sourcing Manager can view**

- Vendor scorecard with QA KPIs (above) alongside other sourcing metrics
- QA team performance summary: overall pass rate, inspector-level outlier flags surfaced
- Open inspection chains with 3+ rounds or unresolved holds > 48hr
- Season-over-season trend: is a vendor's QA pass rate improving or deteriorating?
- Vendor ranking by first-time pass rate
- In-house vs. third-party inspector pass rate gap (signal of inspector rigor differences)

**Sourcing Manager cannot action**: inspector assignments, report overrides, partial lot decisions — these remain with QA Manager and Sourcing POC respectively.

### Future Phase 3

- Customer return defect type vs. inspection defect type match rate per inspector
- Inspector accuracy score based on returns tied to their cleared batches

---

## 9. Vendor View — Feature Summary

| Feature | Description |
|---|---|
| Raise inspection request | Select PO, enter qty per color (validated against packed qty), ready date |
| Track request status | Full status timeline: Pending → Scheduled → Confirmed → In Progress → Submitted → Result |
| Inspector details | Shown once confirmed: name, date, time window (does not show in-house vs. third-party — irrelevant to vendor) |
| Receive report | PDF via email on completion; accessible in vendor portal |
| Acknowledge fail | Log corrective action per defect with description + photos |
| Raise re-inspection | CTA enabled only after corrective action accepted by QA Manager |
| Request GPT waiver | Form to request waiver with lab report + justification. Approved/rejected by QA Manager |
| View inspection chain | All rounds for a PO, each with result and report link |
| Receive on-behalf-of notifications | When Sourcing POC raises a request on vendor's behalf, vendor is notified and sees it as if they raised it |

**Vendor cannot**: assign inspectors, initiate partial lot splits, override results, view QA team metrics, raise re-inspection before corrective action is accepted, self-approve GPT waivers.

---

## 10. Notifications Summary

| Event | Recipients | Channel |
|---|---|---|
| New inspection request raised | QA Manager, Sourcing POC | In-app + email |
| Request raised by Sourcing POC on behalf of vendor | Vendor (informational) | In-app + email |
| Inspector assigned | Vendor, Inspector | In-app + email |
| Inspector confirms date | Vendor, Sourcing POC, QA Manager | In-app + email |
| Inspector flags conflict | QA Manager | In-app alert |
| Vendor not ready — rescheduled | QA Manager, Sourcing POC | In-app + email |
| Inspection started | QA Manager (geo flag if triggered) | In-app |
| Consultation requested by inspector | QA Manager | Push + in-app (30 min SLA) |
| Consultation response by QA Manager | Inspector | Push + in-app |
| Report submitted | Vendor, Sourcing POC, QA Manager | In-app + email (PDF) |
| Result: Pass | Vendor, Sourcing POC | In-app + email |
| Result: Fail | Vendor, Sourcing POC, QA Manager | In-app + email |
| Result: Hold | Sourcing POC (decision required), QA Manager | In-app + email |
| Result: Not Ready | QA Manager, Sourcing POC | In-app + email |
| Hold unresolved > 48hr | Sourcing POC, Brand Manager, Sourcing Manager | In-app + email escalation |
| Missed inspection (EOD) | QA Manager | In-app + email |
| Geo mismatch on start | QA Manager | In-app flag |
| Suspicious submission (< 30 min) | QA Manager | In-app flag |
| Corrective action submitted by vendor | QA Manager | In-app + email |
| Corrective action accepted | Vendor | In-app + email |
| Corrective action rejected | Vendor | In-app + email with reason |
| Re-inspection request raised | QA Manager | In-app + email |
| GPT waiver requested | QA Manager | In-app + email |
| GPT waiver decision | Requester (Sourcing POC / vendor), Sourcing POC, QA Manager | In-app + email |
| 3rd consecutive fail on same PO | Sourcing POC, Sourcing Manager | In-app + email escalation |
| PDF generation failure | QA Manager | In-app alert |

---

## 11. Key Data Entities

### InspectionRequest

```
id, report_number, brand_id, style_code, fabricate_code,
colours[], po_number, vendor_id,
inspection_requested_qty_total,
inspection_requested_qty_per_color {color_id: qty},
packed_qty_at_request, ready_date, location,
status, round, parent_inspection_id,
created_by_user_id, created_by_role,
on_behalf_of_vendor_id (nullable — set when Sourcing POC raises for vendor),
created_at, updated_at
```

### InspectionAssignment

```
id, inspection_request_id, assigned_inspector_id, assigned_by_user_id,
scheduled_date, confirmed_at, specialisation_match (bool),
zone_match (bool), notes, status
```

### InspectionReport

```
id, inspection_request_id, inspector_id, inspector_type_snapshot,
started_at, started_geo_lat, started_geo_lng, geo_verified (bool),
submitted_at, pdf_url, factory_rep_name,
overall_result (pass/fail/hold/not_ready),
override (bool), override_reason,
consultation_requested (bool), consultation_response_id,
section_a {captures{}, quantities{}, packing_breakdown[]},
section_b {pp_sample_photo, defects[]},
section_c {measurements[]},
section_d {aql_calculation, override},
section_e {test_results, gpt_state, gpt_waiver_id},
section_f {remarks, sign_off}
```

### Defect

```
id, report_id, description, severity (major/minor), count, photo_urls[]
```

### MeasurementEntry

```
id, report_id, measurement_point, spec_value, tolerance,
actual_value, finding (ok/deviation/na), inspector_note
```

### CorrectiveAction

```
id, inspection_report_id, vendor_id, description, photo_urls[],
submitted_at, reviewed_by_user_id, review_status (pending/accepted/rejected),
review_note, reviewed_at
```

### InspectionDecision (Hold outcomes)

```
id, report_id, decision_type (re-inspection/partial/override-pass/override-fail),
decided_by_user_id, pass_qty, fail_qty, reason, decided_at
```

### GPTWaiver (NEW)

```
id, requested_by_user_id, requested_by_role,
failed_gpt_parameter, lab_report_pdf_url,
fabric_batch_details, business_justification,
scope_po_numbers[] (one or many),
status (pending/approved/approved_with_conditions/rejected),
approved_by_user_id, decision_reason, decision_conditions (nullable),
decided_at, retroactive (bool)
```

### ConsultationRequest (NEW)

```
id, report_id, requested_by_inspector_id,
aql_snapshot {sample_size, max_major, max_minor, actual_major, actual_minor, system_result},
defect_summary, inspector_note,
requested_at,
responded_by_qa_manager_id, recommendation (pass/hold/fail), response_note, responded_at,
inspector_final_decision, deviation_from_recommendation (bool)
```

### Inspector

```
id, name, brand_ids[], email, phone,
inspector_type (in_house | third_party_agency),
agency_name (nullable — required if third_party_agency),
zones (cities[]), fabric_specialisation (woven/knit/both),
active (bool), preferred_vendor_ids[]
```

### Vendor (updates)

```
... existing fields ...
fabric_type (woven/knit/mixed),
premises[] {name, address, city},
preferred_inspector_ids[] (Phase 3)
```

---

## 12. User Stories

### Vendor

- As a vendor, I want to raise an inspection request against a packed PO so I can get QA clearance to proceed with dispatch
- As a vendor, I want to see when my inspection is scheduled and who the inspector is so I can ensure the factory is ready
- As a vendor with multiple colors in one PO, I want to request inspection for all colors in a single request so the AQL is calculated correctly on the combined qty
- As a vendor, I want to receive the inspection report on email immediately after submission so I know the result without following up
- As a vendor, I want to see clearly what failed and why so I know exactly what corrective action to take
- As a vendor, I want to submit corrective action evidence in the tool so QA Manager can review and approve a re-inspection
- As a vendor, I want to request a GPT waiver when a fabric test fails so I can get a formal decision instead of WhatsApp approvals
- As a vendor, I want to track the status of my re-inspection request so I am not calling the QA team for updates

### Inspector (in-house and third-party)

- As an inspector, I want to see all my upcoming inspections sorted by date so I can plan my travel schedule
- As an inspector, I want to confirm or flag a conflict on an assigned inspection date so the QA manager knows my availability
- As an inspector, I want to fill the inspection checklist on my phone at the vendor site so I do not have to carry paper forms
- As an inspector, I want to attach unlimited defect photos directly to each defect entry so the report is self-evidencing
- As an inspector, I want the AQL result calculated automatically on the combined PO qty (across all colors) so I am not doing manual maths during the inspection
- As an inspector, I want the form to auto-save every 30 seconds so I do not lose data if I lose connectivity at a vendor site
- As an inspector, I want to request real-time input from my QA Manager on a borderline AQL result so the consultation is logged and I am not making the call alone
- As an inspector, I want completed inspections to disappear from my active list so I am not confused about what is pending
- As an inspector, I want to see the previous round's report before starting a re-inspection so I know which defects to focus on

### QA Manager

- As a QA manager, I want a weekly inspection planning calendar so I can see all upcoming inspections at once and plan inspector coverage
- As a QA manager, I want to assign an inspector — in-house or third-party — to an inspection request with their zone and fabric specialisation visible so I assign the right person
- As a QA manager, I want to see each inspector's workload before assigning so I distribute fairly
- As a QA manager, I want to receive consultation requests from inspectors with the full AQL context so I can give a quick recommendation without a phone call
- As a QA manager, I want to be alerted if an inspector does not start an inspection by EOD so I can follow up immediately
- As a QA manager, I want to see a flag if an inspector submits a report in under 30 minutes so I can review if the inspection was thorough
- As a QA manager, I want to review and approve / reject GPT waivers in the system so we have an audit trail instead of WhatsApp approvals
- As a QA manager, I want to review corrective actions submitted by vendors so I can approve re-inspection requests
- As a QA manager, I want to see inspector-level metrics segmented by in-house vs. third-party so I can compare rigor across the team
- As a QA manager, I want to void a report submitted in error so the inspector can re-submit without permanent damage

### Sourcing Manager

- As a sourcing manager, I want to see each vendor's first-time pass rate, re-inspection rate, GPT waiver rate, and not-ready rate on their scorecard so I can use QA performance as an objective input in vendor decisions
- As a sourcing manager, I want to see QA team performance at a summary level so I can hold the QA Manager accountable without micromanaging
- As a sourcing manager, I want to be alerted on POs with 3+ consecutive failed inspection rounds or unresolved holds > 48 hours
- As a sourcing manager, I want to compare vendor QA KPIs season-over-season
- As a sourcing manager, I want to see if there's a pass rate gap between in-house and third-party inspectors at the same vendor (signal of inspector rigor differences)

### Sourcing POC

- As a sourcing POC, I want to raise an inspection request on behalf of a vendor not yet onboarded to the portal so the QA flow can still proceed
- As a sourcing POC, I want to receive the inspection report instantly on submission so I do not wait for the inspector to email me
- As a sourcing POC, I want to approve a partial lot split on a held inspection so pass qty can be dispatched while fail qty is corrected
- As a sourcing POC, I want to see QA cleared qty vs. packed qty per PO so I know how much of the order is ready for dispatch
- As a sourcing POC, I want to request a GPT waiver when a vendor has a recurring fabric issue so I can keep production moving
- As a sourcing POC, I want to be escalated on unresolved holds after 48 hours so decisions do not silently delay dispatch

### Brand / Category Manager

- As a brand manager, I want to see vendor-wise fail rates by season so I can make informed vendor selection decisions
- As a brand manager, I want to see inspector accountability metrics so QA manager has data to act on performance issues
- As a brand manager, I want to be escalated on holds unresolved after 48 hours and on POs with 3 consecutive failed inspections

---

## 13. Placeholder Specs

### 13.1 Pre-Production Inspection (Phase 2)

Pre-production approvals cover multiple sequential checkpoints before production begins.

**Approval types and owners**

| Checkpoint | Sent by | Reviewed by | Decision by |
|---|---|---|---|
| FIR (Fabric Inspection Report) | Vendor | Sourcing POC + Designer | Sourcing POC |
| Trim approval | Vendor | Sourcing POC + Designer | Sourcing POC |
| PP Sample (Pre-production sample) | Vendor | Designer | Sourcing POC |
| Size set approval | Vendor | Fit Technician | Sourcing POC |

**Summary flow (per checkpoint)**

1. Vendor declares send date
2. Vendor confirms dispatch (with courier details or photo)
3. Sourcing POC logs receipt; system calculates transit time
4. Review assigned to checkpoint owner
5. Reviewer fills structured feedback form (format TBD in Phase 2 detailed spec); photos attached
6. Sourcing POC records decision — Pass / Conditionally Approved / Rejected
7. Reminders to vendor / reviewer / Sourcing POC per SLA
8. All checkpoints tracked on style page with status, dates, round number

**Key constraints**

- Production should not begin until all mandatory checkpoints cleared (system flag; enforcement manual in Phase 1, enforced in Phase 2)
- Each checkpoint is independent
- Re-sampling round number tracked per checkpoint independently

### 13.2 Inline Inspection (Phase 2)

**Trigger**: Vendor declares production milestone (configurable: every 20% of order cut/stitched or specific dates)

**Types**: Cutting inspection, Stitching / assembly, Mid-line quality check

**Report inputs (TBD)**: Defect type per operation, defect rate per 100 units, line rejection rate, corrective actions on the line

**Outcomes**: Continue Production / Issue Corrective Action / Escalate to QA Manager

---

## 14. Role-Based Access Control (RBAC)

Access is controlled at two levels: screen access (can the user see the screen) and action access (what can they do within it). All access is brand-scoped — a user can only see data for brands they are assigned to.

### Screen Access

| Screen | Vendor | Inspector | QA Manager | Sourcing POC | Sourcing Manager | Brand Mgr |
|---|---|---|---|---|---|---|
| Vendor portal — inspection tab | Own orders / POs only | No | No | No | No | No |
| Inspection list / tracker | Own requests only | Own assigned only | All | All | All (read-only) | All (read-only) |
| Inspection request form | Yes | On-site only (via CTA) | No | Yes (on behalf of vendor) | No | No |
| Inspector assignment panel | No | No | Yes | No | No | No |
| Weekly planning calendar (NEW) | No | No | Yes | No | Read-only | Read-only |
| Inspection execution form | No | Own assigned | View + Edit | No | No | No |
| Report view (PDF + structured) | Own only | Own submitted | All | All | All (read-only) | All (read-only) |
| Corrective action form | Own fails only | No | No | No | No | No |
| GPT waiver request form | Own (for own PO) | No | No | Yes | No | No |
| GPT waiver approval | No | No | Yes | No | Override-only (escalation) | No |
| Consultation response | No | No | Yes | No | No | No |
| QA Manager dashboard (accountability) | No | No | Yes | No | Summary only | Read-only |
| Sourcing Manager dashboard (scorecards) | No | No | No | No | Yes | Yes |
| Inspector management (settings) | No | No | Yes | No | No | No |
| AQL / checklist config (settings) | No | No | Yes | No | No | No |

### Action Access

| Action | Vendor | Inspector | QA Manager | Sourcing POC | Sourcing Manager | Brand Mgr |
|---|---|---|---|---|---|---|
| Raise inspection request | Yes (own POs) | On-site CTA only | No | On behalf of vendor | No | No |
| Cancel inspection request | Yes (Pending only) | No | Yes (any status pre-In Progress) | No | No | No |
| Assign / reassign inspector | No | No | Yes | No | Yes (fallback if QA Manager unavailable) | No |
| Confirm inspection date | No | Yes (own) | No | No | No | No |
| Flag date conflict | No | Yes (own) | No | No | No | No |
| Propose reschedule date (after miss) | No | Yes (own) | Yes | No | No | No |
| Approve reschedule proposal | No | No | Yes | No | No | No |
| Start inspection | No | Yes (own, scheduled date ±1 day) | No | No | No | No |
| Submit inspection report | No | Yes (own) | No | No | No | No |
| Request consultation on borderline AQL | No | Yes (own) | No | No | No | No |
| Respond to consultation | No | No | Yes | No | No | No |
| Override AQL result | No | Yes (own, with reason) | Yes (with reason) | No | No | No |
| Void submitted report | No | No | Yes (with reason) | No | No | No |
| Submit corrective action | Yes (own fails) | No | No | No | No | No |
| Accept / reject corrective action | No | No | Yes | No | No | No |
| Approve partial lot split | No | No | No | Yes | Fallback if SLA breached | No |
| Override Hold to Pass / Fail | No | No | Yes (with reason) | Yes (with reason) | No | No |
| Request GPT waiver | Yes (own) | No | Yes | Yes | No | No |
| Approve / reject GPT waiver | No | No | Yes | No | Override-only | No |
| Raise re-inspection request | Yes (after CA accepted) | No | Yes | No | No | No |
| View QA team metrics (full) | No | No | Yes | No | Summary | Read-only |
| View vendor scorecard | No | No | No | Own vendors | All | All |

### Notes

- **Brand scoping**: Every role is filtered to their assigned brand(s)
- **Super-admin** role (not listed) has full access across all brands — used for system configuration and support only
- **On-site inspection request**: Inspector can raise an on-site request (§5.2) using a dedicated CTA, not the standard vendor form
- **Inspector self-override**: Inspector can override AQL result at time of submission only. Post-submission overrides require QA Manager
- **Sourcing Manager fallback access**: Inspector assignment and partial lot split fallbacks only — primary ownership stays with QA Manager and Sourcing POC respectively
- **QA Manager execution form access**: View + edit. QA Manager can correct or supplement inspector entries post-submission if needed. All QA Manager edits logged separately from inspector inputs in audit trail
- **Third-party inspector access**: Identical to in-house inspector. Same screens, same actions, same data visibility (own assigned inspections only)

---

## 15. UI Screens

### 15.1 New Screens

#### Inspection Dashboard (Role-specific home)

Shown on login for all internal roles. Vendor sees their portal.

**QA Manager view**

- Summary tiles: Pending Assignment | Scheduled Today | In Progress | Awaiting Corrective Action Review | Open Holds | GPT Waivers Pending | Consultation Requests — count of inspections and quantity to be inspected
- Inspector workload mini-table: each inspector with active count + today's assignments, segmented by in-house / third-party
- Alerts panel: missed inspections, geo flags, suspicious submission times, unconfirmed schedules > 48hr, consultation SLA breaches
- Quick-action: assign inspector to top pending request

**Sourcing POC view**

- Summary tiles: QA Cleared Qty (season total) | Pending Inspection | Open Holds (require decision) | GPT Waivers Pending (own)
- Holds awaiting decision sorted by age (oldest first)
- Recent reports (last 10 submitted)

**Sourcing Manager view**

- Vendor scorecard summary (first-time pass rate, re-inspection rate, GPT waiver rate, not ready rate) for current season
- QA team performance bar (completion rate, avg turnaround, in-house vs. third-party split)
- Escalation flags: open holds > 48hr, POs with 3+ failed rounds, recurring vendor GPT failures

**Brand / Category Manager view**

- Vendor quality ranking by first-time pass rate
- Season trend chart: pass rate by month
- Inspector accountability flags (read-only)

#### Weekly Inspection Planning Calendar (NEW — QA Manager)

A week-grid view showing all scheduled inspections across the team for the current week.

- **Rows**: each inspector (in-house first, then third-party grouped by agency)
- **Columns**: 7 days of the week
- **Cells**: inspection cards showing vendor, city, PO #, status badge. Multiple inspections per cell stack vertically
- **Filters**: city, brand, inspector type, status
- **Actions on a cell**: open assignment, reassign, view details
- **Empty cells**: visible gaps in coverage by city / day
- **Header summary**: total inspections this week, % coverage by city, # unassigned

This view replaces the current Weekly Inward NFP Tracker spreadsheet that Kanti maintains manually each evening.

#### Inspection List / Tracker

Central table of all inspections. Accessible to roles (RBAC-filtered).

**Columns**
Brand | Style Code | Fabricate Code | SubOrder# | Colour(s) | PO# | Vendor | Location | Inspection ID | Round | Status | Assigned Inspector | Inspector Type | Scheduled Date | Submitted Date | Result | QA Cleared Qty

**Filters**

- Brand (multi-select)
- Status (multi-select)
- Result: Pass / Fail / Hold / Not Ready / Pending
- Vendor (search)
- Inspector (multi-select)
- Inspector type: in-house / third-party
- Scheduled date range
- Submitted date range
- Inspection type: Final / Pre-production / Inline
- Round: R1 only / R2+
- Geo verified: Yes / No / Unverified
- GPT state: Pass / Fail / Pending / Waived

**Bulk actions (QA Manager only)**

- Assign same inspector to multiple selected pending requests
- Bulk reschedule

#### Inspection Request Form (Vendor + Sourcing POC on-behalf + On-site)

Three entry points: vendor portal, Sourcing POC SubOrder page (on behalf of vendor), inspector on-site CTA. Fields identical; on-behalf pre-fills `on_behalf_of_vendor_id`; on-site pre-fills vendor from current location.

**Fields**

- Brand (auto-filled from session)
- Style (dropdown, filtered to vendor's active styles)
- PO number (dropdown, PO gating runs on selection)
- Vendor premise / location (pre-filled from PO, editable)
- **Inspection requested qty per color** (multi-color rows shown if PO has multiple colors)
- Ready-for-inspection date
- Notes (optional)

#### Inspector Assignment Panel (QA Manager — modal or side panel)

Opens when QA Manager clicks a pending request.

**Left: Request details**

- Style, colour(s), PO#, vendor, location, fabric type, requested qty per color, ready date

**Right: Inspector selector**

- List of all eligible inspectors filtered to zone + specialisation match
- Per inspector shown: name, **type chip (in-house / third-party + agency)**, zone, fabric spec, active inspection count, conflict indicator (yellow badge if conflict)
- Unfiltered view toggle (shows all inspectors with mismatch warnings)

**Actions**

- Select inspector → set date → add notes → Assign
- Multi-select requests and assign to one inspector with individual dates per request

#### Inspection Execution Form (Inspector — mobile web)

Sequential sections (A → F). Progress bar at top. Auto-save indicator (last saved timestamp visible).

Section navigation: tab bar or stepper. Cannot submit until all mandatory sections complete.

On "Start Inspection" tap:
1. Location permission prompt (mandatory)
2. Geo resolves → proceed / GPS fails → unverified warning → proceed
3. Form opens at Section A with mandatory captures (carton stacking → packing list → packed goods) before quantity entry

Each section has a completion indicator (✓ / incomplete). Inspector can navigate back to earlier sections before final submit.

**Section D specifics**

- AQL evaluation card shows: sample size, max allowed (major/minor), actual (major/minor), system result
- Below the card: **"Request Manager Input"** CTA + Override result CTA + Continue
- Consultation dialog flows in-line; QA Manager response shown in same screen when received

#### Corrective Action Form (Vendor — in vendor portal)

Shown after a Fail/Hold result.

**Fields**

- Failed items list (read-only, from inspector report)
- Per defect or overall: corrective action description (text)
- Photo upload (optional per defect, flagged if missing)
- Overall corrective action summary

**States**

- Draft (vendor saving in progress)
- Submitted (sent to QA Manager for review)
- Accepted (vendor sees "Re-inspection request" CTA)
- Rejected (vendor sees rejection reason, can revise and resubmit)

#### GPT Waiver Request Form (Sourcing POC / Vendor / QA Manager)

**Fields**

- Inspection report (auto-filled from context, link to report)
- Failed GPT parameter (dropdown: dimensional stability, colour fastness, shrinkage, other + text)
- Lab report attachment (mandatory PDF upload)
- Fabric / yarn batch details (text)
- Business justification (mandatory text)
- Scope — radio: This PO only / Multiple POs same fabric batch (if multi: searchable PO multi-select)
- Submit → status `GPT Waiver Pending`

#### GPT Waiver Approval Screen (QA Manager)

- Waiver request details, lab report viewer, scope POs listed
- Actions: Approve / Approve with Conditions (conditions text required) / Reject (reason required)
- Approval audit trail shown for waivers on the same vendor/fabric in past 90 days

### 15.2 Updates to Existing Fabricate OMS Screens

#### SubOrder Detail Page

**Production quantities section** — new row added:

```
Order Qty | Cut Qty | Sewing Qty | Packed Qty | QA Cleared Qty | Dispatched Qty
```

QA Cleared Qty shown per PO (expandable breakdown if multiple POs).

**Updated tab: Inspections** (replaces the existing inspection placeholder)

- Table of all inspection requests for this SubOrder, grouped by PO
- Columns: PO# | Inspection ID | Round | Status | Inspector (type chip) | Scheduled | Submitted | Result | Cleared Qty
- Clicking an inspection ID → opens report view
- "Raise Inspection on behalf of vendor" CTA visible to Sourcing POC if packed qty > QA cleared qty and no active inspection for that PO
- "Request GPT Waiver" CTA visible if any inspection has GPT Fail or Hold-pending-GPT status

#### Fabricate Action Queue / Queue Screen

New action types added:

| Action Type | Trigger | Urgency | CTA |
|---|---|---|---|
| FI Not Requested | Packed qty updated, no inspection request for that PO > X days | Due-today / Overdue | Raise FI |
| FI Result Pending | Inspection in progress, no submission in > 12hr | Overdue | View |
| Hold — Decision Required | Sourcing POC has an unresolved hold | Due-today (< 48hr) / Overdue (> 48hr) | Decide |
| Corrective Action Pending Review | Vendor submitted CA, QA Manager hasn't reviewed | Due-today | Review |
| Re-inspection Not Assigned | Re-inspection request raised, not yet assigned | Due-today | Assign |
| GPT Waiver Decision Pending | Waiver request raised, QA Manager hasn't decided | Due-today | Decide |
| Consultation Pending | Inspector requested manager input | 30-min SLA | Respond |

#### Vendor Profile Screen

New fields added:

- Fabric type (Woven / Knit / Mixed)
- Registered premises (list: premise name, address, city — add / edit by QA Manager or admin)
- Preferred inspector (Phase 3)
- QA scorecard tab: first-time pass rate, re-inspection rate, hold rate, vendor not ready rate, GPT waiver rate by season (read-only, auto-calculated)
- GPT waiver history list

#### Reports Screen

Existing reports screen gets new **QA Summary** report type:

- Inspector performance report (downloadable, QA Manager + Sourcing Manager)
- Vendor QA scorecard export (downloadable, Sourcing Manager)
- Inspection history by PO / style (downloadable, all internal roles)

(Tracker-style sheet equivalents — FAT, GPT, FI, Weekly QA, NFP — are scoped to the Reports module Phase 2 work, not this PRD.)

---

## 16. SLA Reference Table

All SLAs are configurable at brand level by a super-admin. Default values are indicative starting points. SLA breaches trigger the notification and escalation actions specified.

| SLA | Default | Configurable? | Breach action |
|---|---|---|---|
| Inspection request min. lead time | 2 days from ready date | Yes | Warning to vendor; QA Manager can override |
| QA Manager assignment SLA | 1 business day from request | Yes | Alert to QA Manager; escalation to Sourcing Manager after 2 days |
| Inspector confirmation SLA | 24 hours from assignment | Yes | Reminder at 24hr; QA Manager alerted at 48hr |
| Inspector visit — start by EOD | Scheduled date end of day | No | Status → `Missed`; immediate alert to QA Manager |
| Report submission after start | 6 hours | Yes | Reminder to inspector; QA Manager flagged at 12hr |
| Suspicious submission (too fast) | < 30 minutes from start | Yes | Flag to QA Manager for review |
| Consultation response — QA Manager | 30 minutes | Yes | Inspector can proceed at SLA breach (logged); QA Manager metric tracked |
| Hold decision — Sourcing POC | 48 hours from report submission | Yes | Escalation to Sourcing Manager at breach |
| Hold decision — Sourcing Manager (fallback) | 24 hours from escalation | Yes | Alert to Sourcing Manager; QA Manager notified as secondary |
| GPT waiver decision — QA Manager | 1 business day from request | Yes | Escalation to Sourcing Manager at breach |
| Corrective action submission — vendor | 3 business days from fail result | Yes | Reminder at 2 days; alert at breach |
| Corrective action review — QA Manager | 1 business day from vendor submission | Yes | Reminder; Sourcing Manager alerted at breach |
| Re-inspection request after CA accepted | 2 business days from acceptance | Yes | Reminder at 1 day; alert at breach |
| Re-inspection assignment after request | 1 business day from request | Yes | Alert to QA Manager; Sourcing Manager alerted after 2 days |
| Vendor not ready — reschedule confirmation | 2 business days | Yes | Alert to QA Manager and Sourcing POC if not rescheduled |

**Notes**

- "Business day" definition is brand-configurable (default: Mon–Sat, excluding national holidays)
- Reminders are in-app + email; escalations are in-app + email to the escalation recipient
- SLA clock pauses on weekends and holidays if the brand uses business-day SLAs
- QA Manager can view all open SLA breaches in a consolidated alerts panel on the dashboard

---

## 17. Open Questions

These remain open after this PRD draft and need resolution before build.

1. **Spec sheet source (Phase 2)**: Which system holds the tech pack / measurement spec sheet — Fabricate style master, a PLM system, or manual? This determines Phase 2 integration scope for auto-loading measurement points.

2. **AQL level configuration**: Fixed per brand (2.5/4.0) or variable by category or tier (e.g., stricter AQL for Hero styles)? Bewakoof defaults assumed. Configured by QA Manager.

3. **Tessera integration scope (Phase 2)**: Internal API (preferred) or batch sync. ASN event webhook from Tessera → inspection check, or inspection module pushes clearance flag to Tessera on pass. Both viable — to be scoped with Tessera team.

4. **Measurement sheet Phase 1 UX**: Structured form vs. photo upload as primary input. Recommendation: photo upload as fallback, structured entry as default with pre-populated measurement point list per category.

5. **Vendor not ready cost accountability**: If vendor sends inspector back, who pays for the wasted visit (especially for third-party inspectors who charge per visit)? Not Ready Rate KPI flags vendors; commercial penalty mechanism TBD.

6. **GPT waiver approval matrix**: Single QA Manager approver in Phase 1. Future expansion: dual approval (QA Manager + Category Manager) for waivers above a qty/value threshold?

7. **Brand template rollout**: Bewakoof is Phase 1 baseline. Each subsequent brand template (Nautinati, Urbano, Modern, Wrogn, TGC, Bewakoof, Naut, etc.) needs its own template build. Who owns template specification per brand — QA Manager per brand or central Product team?

8. **Third-party inspector cost tracking**: Should the system track per-visit cost for third-party inspectors (for finance reporting)? Out of Phase 1 scope, but data model should not preclude it.

9. **Consultation SLA enforcement**: Is 30 min the right SLA? Does the inspector wait or proceed if QA Manager doesn't respond? Current spec: inspector can proceed after 30 min with own judgement, logged.

10. **Tracker sheet migration path**: The 5 existing trackers (FAT, GPT, FI, Weekly QA, NFP) are deferred to Reports module. During the transition (Phase 1 build → Reports module build), the MIS team continues manual re-entry. What's the timeline gap and is there a temporary export from the new system to populate the existing sheets?

---

*End of PRD v1*
