# Costing & PO — Product Requirements Document

> **Module:** My Portfolio → Costing & PO  
> **Date:** 2026-06-05  
> **Status:** Active  
> **Author:** Sahil Sharma  
> **Related docs:** `prd-vendor-assignment.md`, `prd-preprod-unlock.md`, `changelog-costing-po.md`

---

## 1. Problem Statement

The current costing process at Nautinati relies on WhatsApp threads, email chains, and spreadsheets shared between sourcing POCs, managers, category heads, and vendors. Key pain points:

- **No single source of truth** — costs tracked in personal spreadsheets, approvals via chat, no audit trail
- **Approval routing is manual** — POC has to know who to escalate to based on variance; no enforced workflow
- **Multi-vendor comparison is blind** — when multiple vendors quote for the same order, there's no structured comparison view
- **PO status is opaque** — vendors don't know when a PO has been raised; D365 failures go unnoticed
- **Pre-production starts informally** — vendors begin activities before costing is approved, with no documented acknowledgment of risk

---

## 2. Goals

1. Centralise the full costing lifecycle — from RFQ dispatch to PO confirmation — in one place
2. Enforce variance-based approval routing automatically
3. Enable multi-vendor quote comparison with structured split approval
4. Give vendors visibility into their quote status and PO progress
5. Make all communications (approvals, rejections, unlocks) auditable and traceable

---

## 3. Roles & Permissions

| Role | Can do |
|------|--------|
| **Sourcing POC** | Send RFQ, review quotes, submit for approval, unlock pre-prod, confirm inward dates |
| **Sourcing Manager** | All POC actions + approve/reject costings within their threshold, escalate to Category Head |
| **Category Head** | Approve escalated high-variance costings |
| **Vendor** | View RFQs, submit quotes, view approval status, receive notifications, view pre-prod unlock |
| **MIS** | Raise POs in D365, perform manual PO entry on D365 failure |
| **Finance** | View-only access to approved costings and PO data |

---

## 4. Full Costing Lifecycle

```
Order Brief
    ↓
Vendor Assignment (RFQ sent)
    ↓
Vendor Quotes
    ↓
[Single vendor]          [Multiple vendors]
POC Reviews              POC Compares → Selects vendor(s)
    ↓                         ↓
Submit for Approval      Submit for Approval (with split if needed)
    ↓
Approval Routing (variance-based)
    ↓
[≤0% variance]   [0–5% variance]   [>5% variance]
POC approves     Manager approves  Category Head approves
    ↓                ↓                   ↓
            Costing Approved
                ↓
        Pre-Production Unlocked (auto, on approval)
        OR
        Pre-Production Manually Unlocked Early (POC/Manager toggle)
                ↓
            PO Raised (MIS → D365)
                ↓
        [D365 success]      [D365 failure]
        PO Confirmed        Manual PO Entry (MIS)
                ↓
        Vendor Receives PO Notification
```

---

## 5. Stage-by-Stage Detail

### 5.1 RFQ Dispatch

**Trigger:** POC assigns vendor(s) to an order and sends RFQ from the Vendor RFQ tab.

**Actions:**
- POC selects one or more vendors from the vendor master
- Attaches tech pack URL
- Sets RFQ deadline
- Sends RFQ

**Communication — on RFQ send:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Vendor(s) | Vendor Portal → RFQ Inbox | "New RFQ: [Style] [Colour] — [QTY] pcs. Target ₹[price]. Deadline [date]." |
| POC | In-app confirmation | Toast: "RFQ sent to [N] vendor(s)" |

**State change:** `rfqStatus: 'sent'`

---

### 5.2 Vendor Quotes

**Trigger:** Vendor logs into portal and submits a quote before deadline.

**Actions:**
- Vendor fills in: quoted price, cost breakdown (11 fields), promised inward date, notes
- Submits quote

**Communication — on quote submission:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Sourcing POC | In-app queue item | "Quote received for [Style] from [Vendor] — ₹[cost]" |
| POC | Email (Phase 2) | Quote summary with breakdown |

**State change:** `rfqStatus: 'responded'`, `costStatus: 'submitted'`

**If multiple vendors quote the same order:**
- POC sees a **"N vendor quotes"** badge on the order row in the Orders tab
- Button changes to **"Compare & Approve"**

---

### 5.3 Quote Review & Comparison

**Trigger:** POC clicks "Review & Approve" or "Compare & Approve" on an order.

**Actions — single vendor:**
- Right drawer opens showing quoted price, variance, cost breakdown
- POC can approve or reject with a reason

**Actions — multi-vendor (compare mode):**
- Right drawer opens with side-by-side comparison table
- Columns: one per vendor, rows: quoted price, variance, mix bar, 9 breakdown fields, notes
- "Best value" badge on lowest-cost vendor
- POC selects vendor(s) to approve — can select all for a split approval
- If split: POC allocates quantities (must not exceed order qty; partial allocation allowed)
- "Approve & Split" creates child orders per vendor

**Communication — no communication at review stage** (internal action, no external party involved)

---

### 5.4 Approval Routing

Approval routing is determined by variance from target price:

| Variance | Approver | Rationale |
|----------|----------|-----------|
| ≤ 0% (at or below target) | Sourcing POC | Within budget — no escalation needed |
| 0–5% above target | Sourcing Manager | Minor overage — manager sign-off |
| > 5% above target | Category Head | Significant overage — senior approval |

**Communication — on submission to approver:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Approver (Manager or Cat Head) | In-app notification + queue item | "[POC name] submitted costing for [Style] — ₹[cost] vs target ₹[target] ([+X%]). Review required." |
| Vendor | No notification at this stage | |

**Communication — on approval:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| POC | In-app toast + queue item resolved | "Costing approved ✓ — [Style]" |
| Vendor | Vendor Portal → RFQ status updated | RFQ status changes to "Accepted" |
| Vendor | Vendor Portal → Notification (Phase 2) | "Your quote for [Style] has been approved. PO will follow." |

**Communication — on rejection:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| POC | In-app toast + queue item | "Costing rejected — [reason]. Vendor must resubmit." |
| Vendor | Vendor Portal → RFQ status | Status changes to "Rejected" with reason visible |
| Vendor | Vendor Portal → Notification | "Your quote for [Style] was not approved. [Reason]. Please resubmit with a revised price." |

**Communication — on escalation (>5% variance):**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Category Head | In-app notification | "[Manager name] escalated costing for [Style] — ₹[cost], [+X%] above target. Approval needed." |
| POC | In-app status update | Status shows "Escalated" |

**State changes:** `costStatus: 'approved'` / `'rejected'` / `'escalated'`

---

### 5.5 Pre-Production

Pre-production stages are formally unlocked when costing is approved. A manual early unlock is available for POC and Manager before approval.

**Normal path (costing approved):**
- Pre-prod tab becomes accessible automatically
- All 7 canonical stages (Lab Dip, Strike Off, Fit Sample, Fabric Inward, PP Sample, GPT, PPF) are editable

**Early unlock path (costing not yet approved):**
- POC or Manager toggles unlock manually with a mandatory reason
- For split orders: unlock is per vendor allocation (each child unlocked independently)
- Requires: vendor must be assigned

**Communication — on manual early unlock:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Vendor | Vendor Portal → Notifications (🔔) | "Pre-production unlocked for [Order] — you can begin activities now. Note: Costing not yet finalised. No PO until approved. Proceed at own risk." + italic reason |
| POC | In-app confirmation (toggle state change) | Banner shows "Unlocked by [name] · [date] · [reason]" |

**Communication — on auto re-lock (costing rejected):**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Vendor | Vendor Portal → Notifications (🔔) | "Pre-production paused — costing for [Order] was rejected. Please pause all activities until a new costing cycle is confirmed." |
| POC | In-app banner (red) | "Pre-production automatically re-locked — costing was rejected." |

**Communication — on manual re-lock:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Vendor | No notification (manual re-lock is internal) | |
| POC | Banner reverts to locked state | |

See `prd-preprod-unlock.md` for full detail on the unlock feature.

---

### 5.6 Purchase Orders

**Trigger:** Costing is approved → MIS team raises PO in D365.

**PO status flow:**
```
requested → pushing → po-raised → complete
                 ↘ failed ↗ (via Manual Entry)
```

| Status | Meaning |
|--------|---------|
| `requested` | PO request created, not yet pushed to D365 |
| `pushing` | D365 push in progress |
| `po-raised` | Successfully created in D365, awaiting PDF |
| `failed` | D365 push failed — needs manual entry |
| `complete` | PO confirmed + PDF attached |

**Communication — on PO raised (D365 success):**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Vendor | Vendor Portal → My Orders (PO number visible) | PO number and warehouse details appear on confirmed order card |
| POC | In-app (PO tile updates) | Summary tile "PO Raised" count increments |

**Communication — on D365 failure:**
| Recipient | Channel | Message |
|-----------|---------|---------|
| MIS | In-app alert (red badge on Purchase Orders tab) | "PO push failed for [Style] — manual entry required" |
| POC | In-app alert on Costing & PO → Purchase Orders tab | Red badge with failure count |

**Communication — on manual PO entry (MIS resolves failure):**
| Recipient | Channel | Message |
|-----------|---------|---------|
| Vendor | Vendor Portal → My Orders | PO number appears (from manual entry) |
| MIS | In-app | Status moves to `po-raised` (no PDF) or `complete` (with PDF) |

**Alert — approved costings with no PO:**
An amber banner appears at the top of the Purchase Orders tab listing style codes where costing is approved but no PO has been raised, prompting MIS to act.

---

## 6. Bulk Costing Update

A spreadsheet-style table for POC to update costing data across multiple orders simultaneously — without opening individual order drawers.

**Columns:** Style, Colour, Vendor, QTY, Target ₹, Quoted ₹ (auto-recomputed), Variance, 9 breakdown fields, Status, Notes, Actions

**Auto-recompute formula:**
```
mainFabricCost   = mainFabricPrice × mainFabricConsumption
trimFabricCost   = trimFabricPrice × trimFabricConsumption
ttlFabricCost    = mainFabricCost + trimFabricCost
ttlProductCost   = ttlFabricCost + trimCostThread + cmp + valueAddition
rejectionAmt     = ttlProductCost × (rejectionPct / 100)
marginAmt        = ttlProductCost × (marginPct / 100)
openCostingTotal = ttlProductCost + testing + logistic + rejectionAmt + marginAmt
```

An amber **"↻ Auto-updated"** prompt appears on Quoted ₹ when auto-recomputed. Manually overwriting clears the prompt.

**Staged edits:** Changes held locally until POC clicks **"Save N changes"** — all committed in one pass.

**Communication:** No external communication triggered from Bulk Update. The save action updates the costing store. Subsequent approval submission triggers the normal approval-routing notifications.

---

## 7. Order Splitting

An order can be split into multiple child sub-orders, each assigned to a different vendor with its own quantity allocation.

**Rules:**
- Sum of child quantities must not exceed parent quantity (partial allocation allowed)
- A child order cannot be further split
- At least 2 split entries required

**Split parent behaviour:** Row in Bulk Update shows only Style / Colour / QTY / Target — all costing columns locked. Vendor cell shows "See child rows."

**Child row behaviour:** All 11 breakdown fields editable. Trash/delete available when `costStatus !== 'approved'`. Deleting last child clears `isSplit` from parent.

**Communication — split approval:**
When POC approves with split (multi-vendor Compare & Approve):
| Recipient | Channel | Message |
|-----------|---------|---------|
| Each selected vendor | Vendor Portal → Notifications | "Your allocation for [Style] has been approved — [qty] pcs at ₹[cost]. PO will follow." (Phase 2) |
| POC | Toast | "Approved & split across N vendors ✓" |

---

## 8. Communication Summary Matrix

| Event | POC | Manager / Cat Head | Vendor | MIS |
|-------|-----|--------------------|--------|-----|
| RFQ sent | Toast ✓ | — | Portal RFQ Inbox 🔔 | — |
| Vendor quotes | Queue item 🟠 | — | Status: Responded | — |
| Submitted for approval | Status update | Queue item 🟠 | — | — |
| Costing approved | Toast ✓ | — | Status: Accepted | — |
| Costing rejected | Queue item 🔴 | — | Status: Rejected + reason 🔔 | — |
| Costing escalated | Status update | Notification 🟠 | — | — |
| Pre-prod unlocked early | Banner state | — | Notifications 🔔 | — |
| Pre-prod auto-relocked | Red banner | — | Notifications 🔔 | — |
| PO raised | Tile update | — | My Orders: PO visible | — |
| D365 PO failed | Red badge | — | — | Alert 🔴 |
| Manual PO entry done | Tile update | — | My Orders: PO visible | — |

**Legend:** 🔔 = in-app notification card · 🟠 = amber queue item · 🔴 = red alert · ✓ = toast

---

## 9. Notification Channels (Current vs Planned)

| Channel | Phase 1 (now) | Phase 2 (planned) |
|---------|--------------|-------------------|
| In-app portal (vendor) | ✅ Notifications tab with unread badge | — |
| In-app queue (sourcing) | ✅ Queue items | — |
| In-app toast | ✅ All key actions | — |
| Email | ❌ | ✅ Approval requests, rejections |
| WhatsApp / SMS | ❌ | ✅ Vendor alerts (PO raised, unlock) |
| Push notification | ❌ | ✅ Mobile app (future) |

---

## 10. Data Model Reference

### `CostingOrder` (costing-store.tsx)
```typescript
costStatus: 'no-vendor' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'escalated'
submittedCost?: number
breakdown?: OpenCostingBreakdown        // 11 fields
approvedBy?: string
approvedOn?: string
rejectedReason?: string
isSplit?: boolean
parentId?: string
splitSeq?: number
inwardDateConfirmed?: boolean
confirmedInwardDate?: string
```

### `OpenCostingBreakdown` (11 fields)
`mainFabricPrice`, `mainFabricConsumption`, `trimFabricPrice`, `trimFabricConsumption`, `trimCostThread`, `cmp`, `valueAddition`, `testing`, `logistic`, `rejectionPct`, `marginPct`

### `PORecord` (purchase-orders.ts)
```typescript
status: 'requested' | 'pushing' | 'po-raised' | 'failed' | 'complete'
d365Code?: string
otbLines?: OTBLine[]
failureReason?: string
manualPoEntry?: boolean
```

### `SubOrder.preProdUnlock` fields (types.ts)
```typescript
preProdUnlocked?: boolean
preProdUnlockReason?: string
preProdUnlockedBy?: string
preProdUnlockedAt?: string
```

### `VendorNotification` (vendor-notifications.tsx)
```typescript
type: 'preprod-unlocked' | 'preprod-relocked'
vendorId: string
orderId: string
reason?: string
unlockedBy?: string
createdAt: string
read: boolean
```

---

## 11. Out of Scope (Phase 2)

- Email / WhatsApp notifications to vendor on approval, rejection, PO raised
- Vendor push notification (mobile) on RFQ received
- Two-step unlock approval (Manager must confirm POC's unlock request)
- Auto-lock pre-prod if costing is not approved within X days of unlock
- D365 integration for real PO push (currently manual/simulated)
- Finance approval step before PO is raised
