# Costing & PO — Feature Changelog

> **Module:** My Portfolio → Costing & PO  
> **Date:** 2026-06-02  
> **Files changed:** `src/app/portfolio/page.tsx`, `src/lib/costing-store.tsx`, `src/lib/purchase-orders.ts` (new)

---

## 1. Purchase Orders Sub-tab

A new **Purchase Orders** tab was added to the Costing & PO module (alongside Orders / RFQ).

### Summary tiles (5)
| Tile | What it shows |
|------|---------------|
| Total POs | Count of all PO records for this portfolio |
| Complete | POs fully confirmed and closed |
| PO Raised | POs raised in D365, awaiting final confirmation |
| Requested | POs requested but not yet pushed |
| Failed | D365 push failures — shown with a red badge on the tab |

### Alert banner
An amber alert appears at the top when there are **approved costing orders with no PO raised yet**, listing the affected style codes and prompting action.

### PO status flow
```
requested → pushing → po-raised → complete
                ↘ failed ↗ (via Manual Entry)
```

### Per-row actions
| Status | Action button shown |
|--------|---------------------|
| `requested` | Awaiting MIS |
| `pushing` | Awaiting MIS |
| `po-raised` | Attach PDF |
| `failed` | Manual Entry (opens modal) |
| `complete` | Done (disabled) |

### Manual PO Entry modal
Triggered when a D365 push has failed. Shows the failure reason in a red banner, accepts a PO number input, and an optional PDF file name. On save:
- If PDF provided → status becomes `complete`
- If no PDF → status becomes `po-raised`
- Sets `manualPoEntry: true` flag on the record

### New types / lib
- `POStatus`: `'requested' | 'pushing' | 'po-raised' | 'failed' | 'complete'`
- `PORecord`: holds D365 code, OTB lines, size breakdown, failure reason, manual entry flag
- `src/lib/purchase-orders.ts`: static seed data (8 records across 4 styles), helper functions `getOTBLines()`, `getWH()`, `poTotalQty()`, `poTotalValue()`

---

## 2. Bulk Costing Update Sub-tab

A fourth sub-tab **Bulk Update** was added to Costing & PO. It provides a spreadsheet-style table for updating costing data across all orders at once — without opening individual order drawers.

### Filter chips
`All` · `No Vendor` · `Pending` · `Submitted` · `Approved` · `Escalated` · `Rejected`

### Column structure (21 columns)

| # | Column | Editable? | Notes |
|---|--------|-----------|-------|
| 1 | Style | — | Style code, name, order ID |
| 2 | Colour | — | Read-only |
| 3 | Vendor | ✓ | Searchable dropdown picker |
| 4 | QTY | — | Read-only |
| 5 | Target ₹ | — | Read-only |
| 6 | Quoted ₹ | ✓ | Auto-recomputed when any breakdown field changes |
| 7 | Variance | — | % diff from target, colour-coded |
| 8 | MF ₹/m | ✓ | Main fabric price per metre |
| 9 | MF m | ✓ | Main fabric consumption (metres) |
| 10 | TF ₹/m | ✓ | Trim fabric price per metre |
| 11 | TF m | ✓ | Trim fabric consumption (metres) |
| 12 | Trim+Thread ₹ | ✓ | Trims + thread cost |
| 13 | CMP ₹ | ✓ | Cut, make, pack cost |
| 14 | Value Add ₹ | ✓ | Embroidery, print, etc. |
| 15 | Testing ₹ | ✓ | Lab testing cost |
| 16 | Logistic ₹ | ✓ | Freight cost |
| 17 | Rej % | ✓ | Rejection % (applied on TTL product cost) |
| 18 | Margin % | ✓ | Margin % (applied on TTL product cost) |
| 19 | Status | — | Costing status badge |
| 20 | Notes | ✓ | Free-text notes field |
| 21 | Actions | — | Approve / Reject / Split / Re-split / Delete |

A **column group sub-header row** labels the breakdown groups: MAIN FABRIC · TRIM FABRIC · PROCESSING · OVERHEADS · %

### Auto-recompute (Quoted ₹)
Editing any of the 11 `OpenCostingBreakdown` fields triggers an immediate recompute of Quoted ₹ using `deriveOpenCostingTotals()`. An amber **"↻ Auto-updated"** prompt appears on the cell to signal it was recalculated and may need review. Manually overwriting Quoted ₹ clears the prompt.

#### Formula (mirrors sourcing cost sheet columns DP–EC)
```
mainFabricCost   = mainFabricPrice × mainFabricConsumption
trimFabricCost   = trimFabricPrice × trimFabricConsumption
ttlFabricCost    = mainFabricCost + trimFabricCost
ttlProductCost   = ttlFabricCost + trimCostThread + cmp + valueAddition
rejectionAmt     = ttlProductCost × (rejectionPct / 100)
marginAmt        = ttlProductCost × (marginPct / 100)
openCostingTotal = ttlProductCost + testing + logistic + rejectionAmt + marginAmt
```

### Vendor picker
- Inline searchable dropdown (opens on click, closes on outside-click)
- Shows vendor name + location
- "+ Assign vendor" dashed-border button shown when no vendor is assigned

### Staged edits / Save
Changes are held in a local `BulkRowDraft` state per row. A **"Save N changes"** button appears in the header bar once any row is dirty. Saving commits all drafts to the costing store in one pass.

---

## 3. Order Splitting

### Split flow
An order can be split into multiple child sub-orders from the Bulk Update tab (or from the Orders tab). Each child is assigned its own vendor and quantity.

**Rules:**
- A child order **cannot** be further split
- Sum of child quantities must be **≤ parent quantity** (partial allocation is allowed)
- At least 2 split entries are required

### Split parent row behaviour (Bulk Update)
When an order has `isSplit: true`, its row in the Bulk Update table:
- Shows only **Style / Colour / QTY / Target** — all costing columns are locked blank
- Vendor cell shows *"See child rows"* in italic
- A **"Re-split"** button (violet, always visible) appears in the actions column
- Row has a subtle `bg-violet-50` background tint
- A "SPLIT n" chip (with `GitBranch` icon) shows the child count next to the style code

### Child row behaviour (Bulk Update)
- Style cell is indented with a violet left border
- All 11 breakdown fields are **fully editable**
- A **trash / delete** button appears on hover (`opacity-0 → group-hover:opacity-100`)
  - Delete is available only when `costStatus !== 'approved'`
  - Deleting the last child clears `isSplit` from the parent

### SplitOrderModal validation change
| Before | After |
|--------|-------|
| Sum must **equal** parent qty | Sum must **not exceed** parent qty |
| Strict balance required | Partial allocation allowed |

---

## 4. Seed data additions (`src/lib/costing-store.tsx`)

Three new orders were added to demonstrate the split behaviour in the Bulk Update tab:

| ID | Style | Colour | QTY | Role |
|----|-------|--------|-----|------|
| NNKNTW250040 | NN440-180 Girls Printed Midi Dress | TEAL PRINT | 800 | Split parent |
| NNKNTW250040-A | NN440-180 | TEAL PRINT | 480 | Child 1 → BS FASHION (submitted, ₹298) |
| NNKNTW250040-B | NN440-180 | TEAL PRINT | 320 | Child 2 → SWARA CREATION (pending) |

---

## 5. Technical notes

### New state & types
```typescript
// Local draft state per row in BulkCostingTab
type BulkRowDraft = {
  vendorId, mainFabricPrice, mainFabricConsumption,
  trimFabricPrice, trimFabricConsumption, trimCostThread,
  cmp, valueAddition, testing, logistic,
  rejectionPct, marginPct,
  quoted, notes,
  isDirty, isRecalculated
}
```

### CostingOrder fields used for split
```typescript
isSplit?: boolean       // true on the parent
parentId?: string       // set on each child
splitSeq?: number       // 1, 2, … for ordering children
```

### Key components added to `portfolio/page.tsx`
| Component | Purpose |
|-----------|---------|
| `POStatusBadge` | Coloured status chip for PO records |
| `ManualPOEntryModal` | Modal for failed D365 → manual PO entry |
| `POSubTab` | Full Purchase Orders tab UI |
| `BulkCostingTab` | Bulk Update spreadsheet tab |
| `NumInput` (inline) | Minimal numeric input with transparent style |
| `LockedCell` (inline) | Renders a blank merged cell for split parent costing columns |
