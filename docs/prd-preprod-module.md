# Pre-Production Module — Product Requirements Document

> **Module:** Pre-Production  
> **Date:** 2026-06-08 (built & deployed 2026-06-09)  
> **Status:** Built — live at https://ubiquitous-cat-1c6553.netlify.app  
> **Author:** Sahil Sharma  
> **Related docs:** `prd-costing-po.md`, `prd-preprod-unlock.md`, `prd-vendor-assignment.md`

> **Build note (2026-06-09):** During build, two capabilities were added to the `/pre-prod` reviewer queue beyond the original spec — (1) reviewers can **start** a not-started stage (not just review), gated on pre-prod being unlocked; (2) the queue gained **action + stage-type filters** and **reviewer photo upload**. The sidebar gained **role-specific stage sub-items**. These are reflected in §3, §9.2, §10.8, §12 below.

---

## 1. Problem Statement

Pre-production tracking at Nautinati currently runs on WhatsApp threads, Excel, and AppSheet. Designers and fit technicians have not adopted AppSheet — approvals happen over calls and chat, with no structured record of what was approved, by whom, or in which iteration.

Key pain points:

- **No audit trail** — "we approved the lab dip" is a WhatsApp message, not a system record. Disputes at final inspection have no reference point.
- **Rejection iterations are invisible** — when a lab dip goes through three rounds, only the current state is known. Past rejections and their reasons are lost in chat history.
- **Designers and fit techs have no personal record** — they can't recall what shade they approved for a style last season, or what fit issue they flagged in round 1. Their institutional knowledge is locked in scrollable chat.
- **Production starts informally** — without a system gate, vendors begin cutting after a verbal go-ahead. The connection between pre-prod completion and production start is not enforced.
- **POC has no portfolio view** — no way to see which stages are overdue across all orders simultaneously.

---

## 2. Goals

1. Give the Sourcing POC a structured tracker for all 7 pre-prod stages with iteration history
2. Give designers and fit technicians a personal review queue and approval timeline — their hook for adoption
3. Enforce the production gate (pre-prod completion → production start) with a manual override for exceptions
4. Capture photo evidence per submission so approvals are credible and traceable
5. Notify vendors when stages are approved or rejected
6. Give managers portfolio-wide visibility into pre-prod health

---

## 3. Roles & Permissions

| Role | Can do |
|------|--------|
| **Sourcing POC** | Set planned dates · Mark stage as submitted · Upload photos · Record approval/rejection on behalf of reviewer · Unlock production gate with reason · Confirm REPLEN skip |
| **Designer** | Review Lab Dip, Strike Off, PP Sample — approve or reject with notes + tags · **Start** a not-started stage (upload photo to log a sample on receipt) when pre-prod is unlocked · Upload own photo of the sample during review · View personal approval timeline |
| **Fit Technician** | Review Fit Sample, PP Fit, PP Sample — approve or reject with notes + tags · **Start** a not-started stage when pre-prod is unlocked · Upload own photo during review · View personal approval timeline |
| **Sourcing Manager** | All POC actions (on behalf of their team) · Portfolio health view across all POCs |
| **Sourcing Director** | Read-only portfolio view |
| **Vendor** | Receive in-app notifications on stage approval/rejection · View stage status (read-only) in vendor portal |

> **Phase 1 constraint:** Designers and fit technicians act through the `/pre-prod` route — they can both **review** POC-submitted samples and **start** (initiate) a stage themselves by uploading a photo, but only when the order's pre-prod is unlocked. **Vendor**-initiated submissions remain deferred to the Sampling module.
>
> **Note on stage ownership:** the queue surfaces stages by a role→stage-key map, not the single `reviewerRole` field — Designer = `lab-dip` / `strike-off` / `pp-sample`; Fit Technician = `fit-sample` / `pp-fit` / `pp-sample`. PP Sample therefore appears for **both** roles (consistent with its AND-approval model, §8.2a).

---

## 4. Pre-Production Lifecycle

```
Costing Approved (or early unlock active)
        ↓
Pre-prod stage accessible on sub-order
        ↓
POC sets planned dates for all 7 stages
        ↓
For each stage (in sequence):
  POC marks "Submitted" + uploads 1–3 photos
        ↓
  [Hard gate stages]            [Soft gate stages]
  Must be approved before       Rejection logged but next
  next stage can be submitted   stage can still proceed
        ↓
  Reviewer (Designer / Fit Tech / POC) approves or rejects
        ↓
  [Approved]                    [Rejected]
  Stage closed                  Rejection notes + tags captured
  Advance to next               New iteration opens
        ↓
All 7 stages approved
        ↓
Production gate cleared → order advances to Production
        ↓
[Exception A: POC manual override]   [Exception B: REPLEN order + same vendor]
Production unlocked with reason       System suggests skip · POC confirms
```

---

## 5. The 7 Pre-Production Stages

| # | Stage | Abbreviation | Gate Type | Reviewer | Description |
|---|-------|-------------|-----------|----------|-------------|
| 1 | Lab Dip | LD | **Hard** | Designer | Fabric colour/shade approval against buyer's colour reference |
| 2 | Strike Off | SO | Soft | Designer | Print placement, colour repeat, and artwork approval |
| 3 | Fit Sample | FS | **Hard** | Fit Technician | Garment construction, silhouette, and measurement approval |
| 4 | Fabric Inward (FD Status) | FD | **Hard** | POC (tracking) | Confirmation that approved fabric has arrived at vendor factory |
| 5 | PP Sample (4B / Commercial) | PP | Soft | Designer **AND** Fit Tech | Near-production sample combining approved colour + approved fit. Both reviewers must approve independently. Stage is not `approved` until both have acted. POC may record approvals on behalf of either. |
| 6 | GPT (Garment Processing Test) | GPT | Soft | POC (tracking) | Wash / shrinkage / colorfastness test result |
| 7 | PP Fit | PPF | Soft | Fit Technician | Final fit check on the commercial fabric |

**Gate type definitions:**
- **Hard gate** — next stage cannot be submitted until this stage is `approved`. If rejected, the iteration loop must be resolved first.
- **Soft gate** — rejection is logged and visible, but the POC may proceed to the next stage without blocking. Used for stages where parallel progress is operationally necessary.

**Stage sequence:** Stages proceed 1→7 in order. The POC may not mark stage N+1 as submitted if stage N is a hard gate and is not yet `approved`.

---

## 6. Iteration Model

Each stage has a `submissions` array. Every time the POC marks a stage as submitted, a new iteration record is created. Rejected iterations are archived and never deleted.

```
Stage: Lab Dip
├── submissions[0]  (current)
│   ├── iterationNumber: 2
│   ├── submittedAt: 2026-06-04
│   ├── photos: [url1, url2]
│   ├── status: pending
│   └── reviewedBy: —
└── pastIterations[0]
    ├── iterationNumber: 1
    ├── submittedAt: 2026-05-28
    ├── photos: [url3]
    ├── status: rejected
    ├── reviewedBy: Subashree (Designer)
    ├── rejectionNotes: "Shade is visibly darker than the reference swatch"
    └── rejectionTags: ["shade-too-dark"]
```

A stage's displayed `status` is always derived from its current (latest) submission:
- No submissions → `not-started`
- Current submission `status: pending` → `pending`
- Current submission `status: approved` → `approved`
- Current submission `status: rejected` → `rejected`
- Planned date passed + not `approved` → `overdue`

**Iteration count pill** — when `pastIterations.length > 0`, the stage card shows "Round 2", "Round 3", etc. This makes repeat rejections visible at a glance.

---

## 7. Rejection Tags Vocabulary

Stage-specific tags the reviewer can optionally select alongside their free-text rejection note. Free text is always mandatory on rejection; tags are optional but encouraged.

| Stage(s) | Tags |
|----------|------|
| Lab Dip, Strike Off | `shade-too-dark` · `shade-too-light` · `contrast-off` · `print-misaligned` · `hand-feel` · `pattern-repeat-wrong` |
| Fit Sample, PP Fit | `chest-too-tight` · `chest-too-loose` · `waist-off` · `hip-off` · `length-too-short` · `length-too-long` · `sleeve-off` · `silhouette-wrong` · `construction-issue` · `measurement-out-of-spec` |
| PP Sample | `colour-off` · `print-placement-wrong` · `distortion` · `finishing-poor` · `seam-issue` · `fabric-hand-wrong` |
| GPT, Fabric Inward | `colorfastness-fail` · `shrinkage-out-of-spec` · `pilling` · `delayed` · `quantity-short` |

---

## 8. Data Model Changes

### 8.1 New types in `src/lib/types.ts`

```typescript
// ─── Pre-Production (revised) ─────────────────────────────────────────────────

export type PreProdStageKey =
  | 'lab-dip' | 'strike-off' | 'fit-sample'
  | 'fabric-inward' | 'pp-sample' | 'gpt' | 'pp-fit'

export type PreProdStageStatus =
  | 'not-started' | 'pending' | 'approved' | 'rejected' | 'overdue'

export interface PreProdIteration {
  id: string
  iterationNumber: number        // 1, 2, 3 …
  submittedAt: string            // ISO date string
  submittedBy: string            // POC user id
  submitterName: string
  photos: string[]               // 1–3 URLs; empty array until uploaded
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string            // user id of designer / fit-tech / POC
  reviewerName?: string
  reviewerRole?: string
  reviewedAt?: string
  approvalNotes?: string         // optional on approve
  rejectionNotes?: string        // mandatory on reject
  rejectionTags?: string[]       // optional vocabulary, see §7
}

export interface PreProdStage {
  id: string
  stageKey: PreProdStageKey
  name: string                   // display name
  status: PreProdStageStatus     // derived — always current iteration's status
  gate: 'hard' | 'soft'
  reviewerRole: 'designer' | 'fit-technician' | 'sourcing-poc'
  plannedDate: string            // ISO date — set by POC
  currentIteration?: PreProdIteration
  pastIterations: PreProdIteration[]
}
```

### 8.2 Additions to `SubOrder` in `src/lib/types.ts`

```typescript
// Production gate (mirrors pre-prod unlock pattern)
productionUnlocked?: boolean
productionUnlockReason?: string
productionUnlockedBy?: string            // user display name
productionUnlockedAt?: string            // ISO date string

// REPLEN skip flag
preprodSkippedForReplen?: boolean
preprodSkipConfirmedBy?: string
preprodSkipConfirmedAt?: string
```

### 8.2a PP Sample dual-approval sub-type

For the `pp-sample` stage only, `PreProdIteration` carries two independent sub-approvals:

```typescript
export interface PPSampleApproval {
  reviewerId: string         // user id from user list
  reviewerName: string
  reviewerRole: 'designer' | 'fit-technician'
  status: 'pending' | 'approved' | 'rejected'
  actedAt?: string
  approvalNotes?: string
  rejectionNotes?: string    // mandatory on reject
  rejectionTags?: string[]
  recordedByPoc?: string     // POC user id if recorded on behalf
}

// Added to PreProdIteration for pp-sample stages only
designerApproval?: PPSampleApproval
fitTechApproval?: PPSampleApproval
```

The iteration's top-level `status` is computed:
- `approved` — both sub-approvals are `approved`
- `rejected` — either sub-approval is `rejected`
- `pending` — at least one sub-approval is still `pending` (and none rejected)

Both Designer and Fit Technician see the PP Sample card in their respective queues simultaneously. Each sees only their own action buttons; they can see the other reviewer's status as read-only context.

### 8.3 Notes on existing fields

- `SubOrder.preProdStages: PreProdStage[]` — already in types, shape changes (see §8.1)
- `SubOrder.preProdUnlocked` — already exists, no change
- The old flat `PreProdStage` (id, name, status, plannedDate, actualDate, approvedBy, approverRole, remarks, photoUrl) is **replaced** by the new shape above. Existing mock data must be migrated.

---

## 9. Screens & Components

### 9.1 Pre-Prod Tab — Sub-Order Detail (`/portfolio/[id]?tab=pre-prod`)

This is the POC's primary workspace. Already partially built; needs full rebuild to support the iteration model.

**Layout (top to bottom):**

1. **Pre-prod early unlock banner** (existing — keep as-is)
2. **Production gate banner** (new — see §9.1a)
3. **Progress header** — "N of 7 stages approved · N%", progress bar, 7 stage dots (abbreviated)
4. **Stage cards** — one per stage, expandable (see §9.1b)

#### 9.1a Production Gate Banner

Mirrors the `PreProdUnlockBanner` pattern. States:

| Condition | Banner |
|-----------|--------|
| All 7 stages approved | Green — "All pre-prod stages cleared. Production can begin." |
| Stages incomplete, gate locked | Amber lock — "N of 7 stages approved. Production is locked until all stages clear." + "Unlock Production" button (POC/Manager only) |
| Gate manually unlocked | Amber — "Production unlocked early by [Name] on [Date]. Reason: [reason]." + Re-lock button |
| REPLEN + same vendor (not yet skipped) | Blue info pill — "Replenishment of [styleCode] with same vendor. Production gate is skippable. Confirm skip?" + [Confirm Skip] [Keep Gate] buttons |
| REPLEN gate skipped | Grey — "Production gate skipped — replenishment order with previously approved pre-prod (confirmed by [Name])." |

**Unlock Production modal:**
- Mandatory reason text field
- Roles that can unlock: `sourcing-poc`, `sourcing-manager`, `sourcing-director`

#### 9.1b Stage Cards

Each card (collapsed):
```
[Status dot / number]  Stage Name                         [Iteration pill: "Round 2"]
                       Reviewer: Designer  ·  Plan: 15-Jun  ·  [Overdue chip if applicable]
                       [Status badge]                     [↓ expand]
```

Expanded card — two panels:

**Left: Current submission**
- Photos (thumbnail grid, up to 3; click to enlarge)
- Submitted by · Submitted on
- Status: pending / approved / rejected
- Approval/rejection notes + tags (if reviewed)
- Actions (role-gated):
  - POC: [Mark Submitted] (if not-started/rejected) · [Edit Planned Date]
  - Reviewer: [Approve] · [Reject] (shown only if `status === 'pending'` and `currentUser.role === stage.reviewerRole`)

**Right: Iteration history** (shown only if `pastIterations.length > 0`)
- Collapsible list: "Round 1 — Rejected on 28-May by Subashree · shade-too-dark"
- Expandable to show full notes and photos from each past round

**Mark Submitted modal (POC):**
- Photo upload: drag-drop or file picker, 1–3 images, max 5MB each
- Optional submission notes
- Confirm button

**Approve modal (Reviewer):**
- Optional approval notes
- Confirm Approval button

**Reject modal (Reviewer):**
- Rejection tags: multi-select chip grid (stage-specific vocabulary, see §7)
- Rejection notes: text area, mandatory, min 10 characters
- Confirm Rejection button

---

### 9.2 `/pre-prod` Route — Reviewer Queue (New Route)

This is the dedicated home for Designers and Fit Technicians. Also accessible by POC and Manager for monitoring.

**Sidebar entry:** Added for roles `designer` and `fit-technician` — "Pre-Production" with stage sub-items (§12). The in-page **My Queue** toggle carries the count badge (review + start); a live count on the sidebar nav item itself is not yet wired (see §11.3).

**Two views within `/pre-prod`:**

#### 9.2a My Queue (`?view=queue`)

Default view. Surfaces two kinds of work for the reviewer's stages (per the role→stage-key map above):

- **Review cards** — stages whose current iteration is `pending`. Amber flask icon, "Review →".
- **Start cards** — not-started stages the reviewer can initiate. Blue `+` icon, "Ready to start" + "Pre-prod unlocked" chips, "Start →". Only shown when the order's pre-prod is unlocked (`costStatus === 'approved' || preProdUnlocked`) and the stage is the earliest ready one for that order (prior stage approved). See §10.8.

Layout:
- Header: "Your pre-production queue" + subline "Designer · N to review · N to start"
- **Action filter pills**: All · To Review · To Start (each with a live count)
- **Stage-type filter pills**: All stages + one per role-relevant stage that has items (with counts). Driven by `?tab=<stageKey>` when entered from the sidebar sub-items (§12).
- Both filter rows scroll horizontally on mobile; the page is fully responsive (sidebar collapses to a hamburger, content goes full-width).

Review card:
```
🧪  NN413-185 · BLUE WHITE   [Lab Dip] [Round 2] [⚠ Overdue]       Review →
    Girls Woven Co-ord Set · Vendor: ARIHANT FASHIONS · POC: Parthipan Kumar
    Planned: 2 Apr 2026 · Submitted: 8 Apr 2026 · 🖼 1 photo
```

Start card:
```
+  NN411-715 · PINK   [Strike Off] [Ready to start]                Start →
   Girls Party Dress · Vendor: BS FASHION · POC: Parthipan Kumar
   Planned: 18 Apr 2026 · ✓ Pre-prod unlocked
```

Clicking a **review** card opens the right drawer (§9.2c); clicking a **start** card opens the Start-Stage modal (§9.2d). Neither navigates away from the queue.

#### 9.2b My History (`?view=history`)

Timeline of all past approvals and rejections by the current reviewer.

- Search bar: filter by style code
- Sort: most recent first
- Timeline cards:

```
[✓ Approved]  Lab Dip — NN401-238 CORAL PINK       12-May-2026
              Submitted by Parthipan · BS Fashion
              Round 1 · No notes

[✗ Rejected]  Fit Sample — NNG201-102 NAVY SET      08-May-2026
              Submitted by Kavitha · Arihant Fashions
              Round 1 · chest-too-tight, length-too-short
              "Chest width is 3cm short across the board..."
```

This timeline is the personal record that replaces their WhatsApp scroll. Filterable by stage type, date range, and style code.

#### 9.2c Stage Review Drawer

Right-side drawer (720px wide; full-screen on mobile) that opens when the reviewer clicks "Review →" on a queue card.

Content:
- Sub-order summary strip: style, category, POC, planned, submitted
- Stage name + round number (orange "Round N" pill when iterating)
- Photo viewer: full-width image + thumbnail strip; the reviewer's own uploads are appended to the submission's photos
- **"Add your photo of the sample"** — functional upload zone (reads files to data URLs, up to 3) so the reviewer can attach their own photo of the physical sample
- Submission note (if any)
- Past iterations section — full rejection history (tags + notes) for context
- Action bar (sticky bottom): [Close] [Reject] [Approve]
  - **Approve** → inline form: optional notes → "Confirm Approval" (carries any added photos)
  - **Reject** → inline form: stage-specific tags (multi-select) + mandatory notes (≥10 chars) → "Confirm Rejection"

After acting: drawer slides out, queue card disappears, a flash toast confirms ("Approved — recorded in your history." / "Rejected — vendor & POC notified.").

#### 9.2d Start-Stage Modal

Opens when the reviewer clicks "Start →" on a start card. Lets them log a sample on receipt and kick off the approval record.

Content:
- Title "Start [stage name]" + sub-order context line
- Info callout explaining the sample will be logged and then move to review
- **Sample photo** upload zone (required — min 1 photo; functional file picker)
- Notes (optional)
- "Start & Submit" (disabled until ≥1 photo)

On submit: a new `pending` iteration is created for that stage; a flash toast confirms ("Stage started — submitted for review."), and the card leaves the Start list.

---

### 9.3 Portfolio Pre-Production View (`/portfolio?tab=pre-production`)

Manager and POC visibility across all orders.

**KPI cards (clickable filters):**
- **On Track** — all stages ahead of planned dates
- **Pending Review** — at least 1 stage in `pending` state
- **Overdue** — at least 1 stage past planned date and not `approved`
- **Production Blocked** — all stages approved but production gate not yet cleared (shouldn't happen in practice but surfaced for ops clarity)

**Table columns:**
```
Sub-Order ID | Style | Vendor | POC | Stage Progress | Current Stage | Planned Completion | Status
```

- **Stage Progress**: 7-dot strip (same as detail tab) — at a glance which stages are green/amber/red
- **Current Stage**: name of the first non-approved stage + round number if >1
- **Planned Completion**: planned date of the last incomplete stage
- Row click → opens sub-order detail drawer at pre-prod tab (§14.1 pattern from PROJECT_CONTEXT)

**Filter rail (left):**
- Filter by POC
- Filter by stage (show only orders stuck at Lab Dip, etc.)
- Filter by overdue only
- Filter by round > 1 (orders that have had at least one rejection)

---

### 9.4 Vendor Portal — Pre-Production View (`/vendor-portal?view=pre-prod`)

Already has a pre-prod view stub. This should show:

- List of sub-orders in `pre-prod` stage assigned to this vendor
- Per order: 7-dot progress strip (read-only), current stage status
- When a stage is approved: green indicator, approved date, approver name
- When a stage is rejected: red indicator — **full rejection notes and all submitted photos are visible to the vendor**. Vendor needs the complete picture to resubmit correctly. Tags are shown as readable labels (e.g. "Shade too dark"), not raw keys.
- For PP Sample: both designer approval status and fit-tech approval status shown separately — vendor can see which reviewer approved and which rejected.

> Vendor cannot submit via this view in Phase 1. Submit capability is deferred to the Sampling module.

---

## 10. Business Rules

### 10.1 Stage Sequencing

- Stages must be progressed in order (1→7).
- A stage cannot be marked `submitted` (new iteration opened) if the previous stage is a **hard gate** and is not `approved`.
- Soft gate stages can be submitted regardless of the previous soft gate's status.
- Exception: POC can override the hard-gate block with an explicit confirmation ("I understand the previous stage is not yet approved. Proceed anyway?"). This override is logged in the activity trail but does not change the gate type or the stage's locked/unlocked state.

### 10.2 Production Gate

- Default: order cannot advance from `pre-prod` to `production` stage until all 7 stages are `approved`.
- Manual override: POC, Sourcing Manager, or Sourcing Director can unlock production with a mandatory reason. Same pattern as `PreProdUnlockBanner` — see `prd-preprod-unlock.md` for implementation reference.
- Auto-trigger: when the last stage (`PP Fit`) is approved, the production gate clears automatically and the order's `currentStage` advances to `production`.

### 10.3 REPLEN Order Exception

- Applies when: `SubOrder.orderType === 'REPLEN'` AND the same `styleCode` has a past sub-order for the same `vendor.id` where all 7 stages reached `approved` in a previous season.
- When detected: system pre-ticks a "Skip production gate" suggestion on the Production Gate Banner.
- POC must explicitly click [Confirm Skip] — auto-skip never happens silently.
- On confirmation: `preprodSkippedForReplen = true`, confirmed by/at recorded. Order may advance to production without stage completion.
- If no prior approved run is found for the same styleCode + vendor: REPLEN exception does not trigger. Normal gate applies.

### 10.4 Reviewer Role Matching

- Only the designated reviewer role can approve/reject a stage.
  - `lab-dip`, `strike-off`: `designer` only
  - `fit-sample`, `pp-fit`: `fit-technician` only
  - `pp-sample`: **both** `designer` and `fit-technician` must approve independently (AND logic). Both roles see it in their queue simultaneously. The stage tracks two sub-approvals: `designerApproval` and `fitTechApproval`, each with their own status, reviewer, and notes. Stage status becomes `approved` only when both sub-approvals are `approved`. If either rejects, the stage status is `rejected` and a new iteration is required.
  - `fabric-inward`, `gpt`: `sourcing-poc` (POC self-reviews tracking stages; no external reviewer needed)
- POC can always **submit** (create an iteration) for any stage.
- POC can **record** an approval on behalf of a designer/fit-tech (e.g., verbal approval over call). The POC selects the reviewer from the user list (not free text) — this keeps the record tied to a real user ID and allows the personal history timeline to work correctly for that reviewer. Shown in history as "Recorded by [POC] on behalf of [Reviewer]".

### 10.5 Photo Requirement

- Minimum 1 photo required to mark a stage as submitted for all stages except `fabric-inward` and `gpt` (where it is optional — confirmation of delivery/test result is the primary record).
- Photos are stored as URLs. In the mock data, static placeholder URLs are used.

### 10.6 Planned Dates

- POC sets a planned date for each stage when the order enters `pre-prod`.
- A stage is `overdue` when `plannedDate < today` and `status !== 'approved'`.
- Planned dates are editable by POC at any time. Edit is logged in the activity trail.

### 10.7 Activity Log

Every significant action pushes an `ActivityLog` entry to `SubOrder.history`:
- Stage submitted / started (by whom, which round)
- Stage approved (by whom, on behalf of if applicable)
- Stage rejected (by whom, tags used)
- Production gate unlocked / re-locked (by whom, reason)
- REPLEN skip confirmed (by whom)
- Planned date changed (from → to, by whom)

### 10.8 Reviewer-Initiated Start (added during build)

A Designer or Fit Technician can **start** a stage themselves from the `/pre-prod` queue, rather than waiting for the POC to mark it submitted. Gating:

- The stage must be `not-started` and belong to the reviewer's role-stage set.
- The order's pre-prod must be **unlocked** — `costStatus === 'approved' || preProdUnlocked === true`. Locked orders never produce start cards.
- The queue surfaces only the **earliest ready** not-started stage per order — i.e. the immediately preceding stage is `approved` (or it is the first stage). This preserves the §10.1 sequencing.
- Starting requires ≥1 photo (§10.5) and creates a new `pending` iteration, which then flows through the normal review path.

> This is an extension of the original Phase 1 "POC-driven only" model. **Vendor**-initiated starts remain out of scope (Sampling module).

---

## 11. Notifications

### 11.1 In-App (existing `VendorNotificationStore` pattern)

| Event | Recipient | Content |
|-------|-----------|---------|
| Stage submitted | Designated reviewer | "Lab Dip (Round 2) submitted for [styleCode] — ready for your review" |
| Stage approved | Sourcing POC | "[Reviewer] approved [Stage] for [styleCode]" |
| Stage rejected | Sourcing POC | "[Reviewer] rejected [Stage] for [styleCode] — [first rejection tag]" |
| Stage approved | Vendor (via VendorNotificationStore) | "[Stage] approved for [styleCode]. Ready to proceed." |
| Stage rejected | Vendor (via VendorNotificationStore) | "[Stage] rejected for [styleCode]. [Notes excerpt]" |
| All stages approved | Sourcing POC | "All pre-prod stages cleared for [styleCode]. Production gate open." |
| Stage overdue | Sourcing POC (queue item) | Existing `'pre-prod-overdue'` queue action type — already defined |

### 11.2 New VendorNotificationStore types

Extend the existing `VendorNotificationType` union:

```typescript
| 'preprod-stage-approved'   // payload: stageKey, stageName, styleCode
| 'preprod-stage-rejected'   // payload: stageKey, stageName, styleCode, rejectionNotes
```

### 11.3 Sidebar badge

For `designer` and `fit-technician` roles: a badge with the count of items waiting (pending reviews + ready-to-start) is shown on the **My Queue** toggle inside the page. **Not yet built:** a live count badge on the sidebar nav item itself (the entry currently has no dynamic badge) — a small follow-up to recompute from `subOrders` on render.

---

## 12. Sidebar Changes

| Role | New sidebar item |
|------|-----------------|
| `designer` | "Pre-Production" → `/pre-prod` with **stage sub-items**: Lab Dip · Strike Off · PP Sample |
| `fit-technician` | "Pre-Production" → `/pre-prod` with **stage sub-items**: Fit Sample · PP Fit · PP Sample |
| `sourcing-poc` | "Pre-Production" already in portfolio sub-nav; no new top-level item needed |
| `sourcing-manager` | Access via portfolio view; no new top-level item |

**Stage sub-items (added during build):** Each sub-item deep-links to `/pre-prod?tab=<stageKey>`, which the page reads to pre-filter the queue to that stage. The parent "Pre-Production" label links to the full queue (all stages) — implemented via a `linkToBase` flag on the nav item so it doesn't auto-redirect to the first sub-item. Because the sidebar's sub-items are static per entry, this is built as **two separate nav entries** (one `visibleTo: ['designer']`, one `['fit-technician']`); only one renders per role, so each reviewer sees only their own stages. Sub-item icons: Lab Dip → droplet, Strike Off → stamp, Fit Sample / PP Fit → ruler, PP Sample → shirt.

---

## 13. Mock Data to Seed

### 13.1 New demo users (as built)

Added to the login page demo picker:

```
Subashree Nair   · designer       · designer@demo.com  · initials: SN  (id u10)
Meera Pillai     · fit-technician · fittech@demo.com   · initials: MP  (id u11)
```

(Internal user ids `u10` / `u11` are also referenced as reviewers in seeded stage iterations. "Priya M" / "Rahul K" / "Meena K" / "Rekha P" remain as historical external-reviewer names on already-approved orders but are not demo logins.)

### 13.2 Pre-prod stage scenarios (as built)

Seeded across sub-orders in `pre-prod` stage:

| Sub-Order | Scenario |
|-----------|----------|
| `NNKNTW250002` | **Rejection iteration** — Lab Dip Round 1 rejected by Subashree (`shade-too-dark`), Round 2 pending review |
| `NNKNTW250004` | **Reviewer-start** — Lab Dip approved, Strike Off not-started → designer "Start" card |
| `NNKNTW250025` | **Overdue** — Lab Dip submitted, planned date passed, still pending → overdue chip |
| `NNKNTW250026` | **PP Sample review** — stages 1–4 approved, PP Sample pending (appears in both Designer & Fit-Tech queues) |
| `NNKNTW250040` | **Mid-progress** — Lab Dip ✓, Strike Off ✓, Fit Sample pending (Fit-Tech review) |
| various | **All approved** — historical orders (e.g. `NNKNTW250011`, `…012`, `…027`) with all 7 stages approved, production gate cleared |

### 13.3 REPLEN demo order

`NNKNTW250035` — `orderType: 'REPLEN'`, same `styleCode` + `vendor` as an existing all-approved run, all stages not-started, pre-prod unlocked. Triggers the REPLEN skip suggestion on the production gate banner, and (being unlocked) surfaces a Lab Dip "Start" card in the designer queue.

> **Note:** during build, a pre-existing duplicate sub-order id `NNKNTW250032` was found (two distinct orders shared it). The non-split order (Boys Graphic Tee) was reassigned to `NNKNTW250033`; the CORAL split parent keeps `NNKNTW250032` because its `-A`/`-B` children reference it.

---

## 14. Routes & Navigation Summary

| Route | View | Who sees it |
|-------|------|-------------|
| `/portfolio/[id]?tab=pre-prod` | Stage tracker + production gate | POC, Manager, Director |
| `/pre-prod?view=queue` | Review + Start queue (all stages) | Designer, Fit Tech |
| `/pre-prod?tab=<stageKey>` | Queue pre-filtered to one stage (from sidebar) | Designer, Fit Tech |
| `/pre-prod?view=history` | Personal approval timeline | Designer, Fit Tech (own history) |
| `/portfolio?tab=pre-production` | Portfolio health view | Manager, Director, POC |
| `/vendor-portal?view=pre-prod` | Read-only stage status + notifications | Vendor |

---

## 15. Out of Scope (Phase 1)

- **Vendor-initiated submissions** — vendor marks sample as submitted via portal. Deferred to Sampling module.
- **Email / WhatsApp notification links** — reviewer gets an email with inline approve/reject. Deferred; in-app queue is Phase 1.
- **Photo annotation / markup** — reviewer draws on photos to indicate issues. Deferred.
- **Product-type stage gating** — certain stages skipped based on category (e.g., no Lab Dip for solids). All 7 stages mandatory in Phase 1.
- **Parallel stage tracking** — stages treated as strictly sequential in Phase 1. Parallel Lab Dip + Fit Sample tracks not modelled.
- **Measurement spec sheet** — structured size-spec comparison in Fit Sample rejection. Deferred to a future Techpack/Spec module.
- **D365 / ERP integration** for pre-prod milestone dates

---

## 16. Open Questions

All questions resolved. No open items.

| # | Question | Resolution |
|---|----------|------------|
| 1 | PP Sample: AND or OR approval logic? | **AND** — both Designer and Fit Tech must approve independently. POC may record on behalf of either. See §8.2a for dual-approval data model. |
| 2 | How much of rejection detail does vendor see? | **Full** — complete rejection notes, all photos, and rejection tags (rendered as readable labels) visible in vendor portal. |
| 3 | POC "on behalf" — typed name or user picker? | **User picker** from the user list. Preserves real user ID linkage so the reviewer's personal history timeline is populated correctly. |
