# Pre-Production Early Unlock — PRD

> **Module:** My Portfolio → Sub-order Detail → Overview Tab  
> **Date:** 2026-06-03  
> **Status:** In progress  
> **Author:** Sahil Sharma

---

## 1. Problem

The sourcing spine enforces a strict gate: pre-production stages cannot be started until costing is `approved`. In practice, POCs and managers often need to kick off pre-prod activities (fabric approval, fit sample, PP sample) while costing is still being negotiated — especially under tight inward-date pressure.

Today there is no escape hatch. The Pre-Production tab is locked, stages can't be created, and the vendor has no official signal to proceed. Teams work around this via WhatsApp/email, losing auditability.

---

## 2. Goal

Let an authorised user (POC or Sourcing Manager) **reversibly unlock pre-production** on an order before costing is formally approved, with a mandatory reason and a visible audit trail.

---

## 3. Non-goals

- This does not skip costing — PO can still only be raised after costing is approved.
- This does not change the vendor's quoted cost or approval workflow.
- This does not apply to split child orders (unlock is per-parent).
- No notification to the vendor is in scope for Phase 1.

---

## 4. User Stories

| # | Role | Story |
|---|------|-------|
| 1 | Sourcing POC | I can unlock pre-production for an order with a reason, so the vendor can proceed while costing is finalised. |
| 2 | Sourcing Manager | I can unlock or re-lock any order's pre-prod, so I have override control. |
| 3 | Any user | I can see whether pre-prod was unlocked early, by whom, and why, so I have full auditability. |
| 4 | Sourcing POC | I can re-lock pre-production if the situation changes (e.g. costing was rejected and vendor needs to pause), so the unlock is not permanent. |

---

## 5. Permission Matrix

| Role | Can unlock | Can re-lock |
|------|-----------|------------|
| `sourcing-poc` | ✓ Own orders only | ✓ |
| `sourcing-manager` | ✓ All orders | ✓ |
| `sourcing-director` | ✓ All orders | ✓ |
| `category-head` | — | — |
| `vendor` | — | — |
| All other roles | — | — |

---

## 6. UX Flow

### 6.1 Entry point — Overview tab amber banner

When `costStatus !== 'approved'` and the order is at `costing` stage (or vendor stage):

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠  Pre-production is locked                                     │
│    Costing is not yet approved. Vendor cannot formally start    │
│    pre-prod stages until costing is closed.                     │
│                                                                  │
│    [ Unlock Pre-Production ]   (amber button, POC/Mgr only)    │
└─────────────────────────────────────────────────────────────────┘
```

When already unlocked, the banner changes to:

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡  Pre-production unlocked early                                │
│    Unlocked by Parthipan Kumar · 2 Jun 2026                     │
│    Reason: Tight inward date — vendor needs to start fabric     │
│    approval now.                                                 │
│    Costing still pending. PO cannot be raised until approved.   │
│                                                                  │
│    [ Re-lock Pre-Production ]  (slate ghost button)             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Unlock modal

Triggered by clicking "Unlock Pre-Production":

- **Header:** "Unlock pre-production early"
- **Risk banner (red):** "Vendor will proceed before costing is finalised. No PO can be raised until costing is approved."
- **Reason field** (mandatory, textarea): "Why is pre-production being unlocked?"
- **Risk acknowledgment** (checkbox): "I understand the vendor proceeds at their own risk until costing is approved."
- **Footer:**
  - `Cancel`
  - `Unlock Pre-Production` (amber, disabled until reason filled + checkbox ticked)

### 6.3 After unlock

- Banner turns amber ⚡ (see 6.1)
- **Pre-Production tab** becomes accessible regardless of `costStatus`
- Pre-Prod tab shows a small amber pill at the top: `⚡ Unlocked early — costing pending`
- **ProgressStrip:** pre-prod stage node shows amber colour (instead of locked-grey) with a `⚡` icon when unlocked but costing not approved
- **Activity log** entry: `[Name] unlocked pre-production — "[reason]"`

### 6.4 Re-lock flow

- Clicking "Re-lock Pre-Production" asks for optional reason, then re-locks.
- If any pre-prod stages have been `approved` or `pending`, a warning is shown:  
  `"3 stages are in progress — re-locking will not revert their status, but the vendor will be aware pre-prod is paused."`
- Activity log entry: `[Name] re-locked pre-production`

### 6.5 When costing is approved

- Banner is dismissed entirely (costing approved = no lock needed).
- ProgressStrip pre-prod node returns to normal active colour.
- `preProdUnlocked` flag is retained on the record (for history), but the banner no longer shows.

---

## 7. Data Model

### New fields on `SubOrder`

```typescript
preProdUnlocked?: boolean       // true when manually unlocked before costing approval
preProdUnlockReason?: string    // mandatory reason entered at unlock time
preProdUnlockedBy?: string      // name of the person who last toggled it
preProdUnlockedAt?: string      // ISO date string
```

### Activity log entries

```typescript
// Unlock
{
  action: 'Pre-production unlocked',
  details: reason,
  actor: user.name,
  actorRole: user.role,
  timestamp: new Date().toISOString(),
}

// Re-lock
{
  action: 'Pre-production re-locked',
  details: reason ?? undefined,
  actor: user.name,
  actorRole: user.role,
  timestamp: new Date().toISOString(),
}
```

---

## 8. Pre-Prod Tab Gate Logic

**Before this feature:**
```
accessible = order.currentStage === 'pre-prod'
```

**After this feature:**
```
accessible = order.currentStage === 'pre-prod'
          || order.costStatus === 'approved'
          || order.preProdUnlocked === true
```

---

## 9. ProgressStrip States (pre-prod node)

| Condition | Node style |
|-----------|-----------|
| `currentStage < pre-prod` AND not unlocked | Grey, locked padlock icon |
| `currentStage < pre-prod` AND `preProdUnlocked` | Amber, ⚡ icon, pulsing ring |
| `currentStage === 'pre-prod'` | Active (violet), progress % shown |
| `currentStage > pre-prod` | Completed (green check) |

---

## 10. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Costing rejected after unlock | Banner stays amber, warns costing is rejected not just pending |
| Costing approved after unlock | Banner disappears, node returns to normal |
| Order split — parent + children | Unlock applies only to the parent; children inherit if their own costing is approved |
| POC tries to unlock another POC's order | Button hidden / shows "Contact manager to unlock" tooltip |

---

## 11. Vendor Notification on Unlock

When a pre-prod unlock is confirmed (single-vendor or per-child), a **notification is pushed to the vendor** for that allocation.

### Notification content
```
[Order ID] · [Style] · [Colour]
Pre-production unlocked — you can begin activities now

"[Reason given by POC]"

Note: Costing is not yet finalised. No PO will be raised until
costing is approved. Proceed at your own risk.

— [POC Name] · [Date]
```

### Where it appears
- **Vendor Portal** → a `Notifications` tab (new) alongside Orders / RFQ / Pre-Prod
- A **red badge** on the Notifications tab for unread count
- Each notification card shows: order reference, style name, unlock reason, timestamp, and a CTA → "View Pre-Production Stages"

### Trigger
The notification is created at the moment `handleUnlockConfirm` executes:
- Single vendor: notification for `order.vendor`
- Split child: notification for the specific child's vendor

### State
Notifications are held in a shared `VendorNotificationStore` context (localStorage-backed in the prototype). Key: `vendorId`. Each entry: `{ id, vendorId, orderId, styleCode, colour, reason, unlockedBy, unlockedAt, read }`.

---

## 12. Auto Re-lock on Costing Rejection

When `costStatus` transitions to `'rejected'`:

### What happens
1. Any active pre-prod unlock on that order is **automatically cleared**:
   - Single-vendor: `preProdUnlocked → false`
   - Split parent: all children with `unlocked: true` are re-locked
2. The Overview tab banner changes to a **red auto-lock banner**:
   ```
   ┌─────────────────────────────────────────────────────────────────┐
   │ 🔒  Pre-production automatically re-locked                      │
   │     Costing was rejected — pre-prod activities must pause.      │
   │     Vendor has been notified.                                   │
   └─────────────────────────────────────────────────────────────────┘
   ```
3. A **vendor notification** is pushed: "Pre-production has been paused — costing was rejected for [Order]. Please pause all activities until further notice."
4. An **activity log** entry is added: `"Pre-production auto-locked — costing rejected"`

### Trigger point
In `handleReject` (costing module, `portfolio/page.tsx`), after setting `costStatus: 'rejected'`, also set `preProdUnlocked: false` and clear `preProdUnlockReason / preProdUnlockedBy / preProdUnlockedAt`.

In `SubOrderPanel` (`SubOrderDetailClient.tsx`), a `useEffect` watching `order.costStatus` detects the transition and syncs local unlock state:
```typescript
useEffect(() => {
  if (order.costStatus === 'rejected') {
    setPPUnlocked(false)
    // Clear all child unlocks too
    setChildUnlockMap(prev =>
      Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, unlocked: false }]))
    )
  }
}, [order.costStatus])
```

### Banner variant: auto-locked
Different from the normal "locked" banner — red border, explicit reason:
- Shows for orders where `costStatus === 'rejected'` (regardless of current unlock state)
- Can be dismissed but pre-prod remains inaccessible until a new costing cycle is started

---

## 13. Out of Scope

- Manager approval required before unlock takes effect (two-step)
- Automatic WhatsApp / email push to vendor (Phase 3 — external integrations)
