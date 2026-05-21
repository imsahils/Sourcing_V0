// ─── Assignment Auto-Suggest (Phase D) ──────────────────────────────────────
//
// Pure rules engine that proposes a Sourcing POC for an unassigned style.
// PRD §5.6 says suggestions are configurable in the system. For Phase D the
// only configured rule is **Category Match** (POCs handle one or more
// `productGroup` values). Tie-breaker: lowest current open-SubOrder count
// (so we don't pile work on one POC).
//
// The mapping below is intentionally hard-coded for the prototype. In Phase 2
// it will be sourced from a Settings → Sourcing Rules screen (admin UI).
//

export type AutoSuggestRule = {
  pocName: string
  productGroups: string[]   // matches against the row's productGroup (uppercase)
}

// Default seed mapping — drives the prototype. Three Sourcing POCs aligned to
// product categories, mirroring the existing MOCK_ASSIGN_GRIDS data.
export const DEFAULT_SUGGEST_RULES: AutoSuggestRule[] = [
  { pocName: 'Parthipan Kumar', productGroups: ['OUTER_WEAR', 'BOTTOM_WEAR'] },
  { pocName: 'Rajesh Menon',    productGroups: ['CLOTHING_SET', 'WINTER_WEAR', 'TOP_WEAR'] },
  { pocName: 'Kavitha Menon',   productGroups: ['TOP_WEAR', 'INNERWEAR', 'ACCESSORIES'] },
]

export type SuggestableStyle = {
  id:           string
  productGroup?: string
  assignedTo:   string   // current value — empty string means "unassigned"
}

/**
 * For each unassigned style, propose the POC with the matching productGroup
 * and the lowest current workload. Returns one suggestion per row that is
 * currently unassigned and matches at least one rule.
 *
 * Workload is the count of styles already assigned across all grids. The
 * caller passes a `workload` map keyed by POC name.
 */
export function suggestAssignments(
  styles:   SuggestableStyle[],
  rules:    AutoSuggestRule[],
  workload: Record<string, number>,
): { styleId: string; pocName: string }[] {
  const out: { styleId: string; pocName: string }[] = []
  // Mutable copy so workload-based ties update as we suggest.
  const load = { ...workload }

  for (const s of styles) {
    if (s.assignedTo) continue
    const candidates = rules.filter(r =>
      s.productGroup && r.productGroups.includes(s.productGroup),
    )
    if (candidates.length === 0) continue

    // Pick the candidate with the lowest current load. Stable order (first match wins on ties).
    let best = candidates[0]
    let bestLoad = load[best.pocName] ?? 0
    for (let i = 1; i < candidates.length; i++) {
      const l = load[candidates[i].pocName] ?? 0
      if (l < bestLoad) {
        best = candidates[i]
        bestLoad = l
      }
    }

    out.push({ styleId: s.id, pocName: best.pocName })
    load[best.pocName] = bestLoad + 1
  }

  return out
}

/**
 * Compute current workload (assigned-style count) per POC across every grid.
 * Caller pulls this from the store and passes into suggestAssignments.
 */
export function computeWorkload(styles: { assignedTo: string }[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const s of styles) {
    if (!s.assignedTo) continue
    map[s.assignedTo] = (map[s.assignedTo] ?? 0) + 1
  }
  return map
}
