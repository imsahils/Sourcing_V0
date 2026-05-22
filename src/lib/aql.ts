// ─────────────────────────────────────────────────────────────────────────────
// AQL — Acceptable Quality Level sampling helper
//
// Implements ANSI/ASQ Z1.4 single-sampling, General Inspection Level II.
// Provides sample size and accept/reject thresholds for a given lot size
// and AQL level (Major + Minor).
//
// Reference: ANSI/ASQ Z1.4-2003 (R2018), Table II-A (Single Sampling Plans
// for Normal Inspection).
//
// Bewakoof Phase 1 defaults: Major = 2.5, Minor = 4.0 (per PRD §5.6D).
// ─────────────────────────────────────────────────────────────────────────────

export type AQLLevel = 1.0 | 1.5 | 2.5 | 4.0 | 6.5

interface LotBand {
  min:        number
  max:        number
  letterCode: string          // Code letter per Table I
  sampleSize: number
}

// Sample size code letters → sample size (General Inspection Level II)
// Code letters from Table I, sample sizes from Table II-A
const LOT_BANDS: LotBand[] = [
  { min:      2, max:        8, letterCode: 'A', sampleSize:   2 },
  { min:      9, max:       15, letterCode: 'B', sampleSize:   3 },
  { min:     16, max:       25, letterCode: 'C', sampleSize:   5 },
  { min:     26, max:       50, letterCode: 'D', sampleSize:   8 },
  { min:     51, max:       90, letterCode: 'E', sampleSize:  13 },
  { min:     91, max:      150, letterCode: 'F', sampleSize:  20 },
  { min:    151, max:      280, letterCode: 'G', sampleSize:  32 },
  { min:    281, max:      500, letterCode: 'H', sampleSize:  50 },
  { min:    501, max:    1_200, letterCode: 'J', sampleSize:  80 },
  { min:  1_201, max:    3_200, letterCode: 'K', sampleSize: 125 },
  { min:  3_201, max:   10_000, letterCode: 'L', sampleSize: 200 },
  { min: 10_001, max:   35_000, letterCode: 'M', sampleSize: 315 },
  { min: 35_001, max:  150_000, letterCode: 'N', sampleSize: 500 },
  { min: 150_001, max: 500_000, letterCode: 'P', sampleSize: 800 },
]

// Accept numbers (Ac) per letter code × AQL level
// Reject = Ac + 1. If `Ac >= sampleSize`, the plan is effectively "use Ac+1 down" arrow per Table II-A.
const ACCEPT_TABLE: Record<string, Record<AQLLevel, number>> = {
  A: { 1.0: 0, 1.5: 0, 2.5: 0, 4.0: 0, 6.5: 0 },
  B: { 1.0: 0, 1.5: 0, 2.5: 0, 4.0: 0, 6.5: 1 },
  C: { 1.0: 0, 1.5: 0, 2.5: 0, 4.0: 1, 6.5: 1 },
  D: { 1.0: 0, 1.5: 0, 2.5: 1, 4.0: 1, 6.5: 2 },
  E: { 1.0: 0, 1.5: 1, 2.5: 1, 4.0: 2, 6.5: 3 },
  F: { 1.0: 1, 1.5: 1, 2.5: 2, 4.0: 3, 6.5: 5 },
  G: { 1.0: 1, 1.5: 2, 2.5: 3, 4.0: 5, 6.5: 7 },
  H: { 1.0: 2, 1.5: 3, 2.5: 5, 4.0: 7, 6.5: 10 },
  J: { 1.0: 3, 1.5: 5, 2.5: 7, 4.0: 10, 6.5: 14 },
  K: { 1.0: 5, 1.5: 7, 2.5: 10, 4.0: 14, 6.5: 21 },
  L: { 1.0: 7, 1.5: 10, 2.5: 14, 4.0: 21, 6.5: 21 },
  M: { 1.0: 10, 1.5: 14, 2.5: 21, 4.0: 21, 6.5: 21 },
  N: { 1.0: 14, 1.5: 21, 2.5: 21, 4.0: 21, 6.5: 21 },
  P: { 1.0: 21, 1.5: 21, 2.5: 21, 4.0: 21, 6.5: 21 },
}

export interface AQLPlan {
  lotSize:           number
  letterCode:        string
  sampleSize:        number
  aqlMajor:          AQLLevel
  aqlMinor:          AQLLevel
  maxAllowedMajor:   number    // Ac for Major
  maxAllowedMinor:   number    // Ac for Minor
  lotRangeLabel:     string    // e.g. "501 – 1,200"
}

export function computeAQL(
  lotSize: number,
  aqlMajor: AQLLevel = 2.5,
  aqlMinor: AQLLevel = 4.0,
): AQLPlan {
  // Clamp to table bounds. Lot < 2 → fall back to A (sample 2).
  // Lot > 500k → fall back to P.
  const effectiveLot = Math.max(2, Math.min(500_000, Math.floor(lotSize)))
  const band = LOT_BANDS.find(b => effectiveLot >= b.min && effectiveLot <= b.max) || LOT_BANDS[LOT_BANDS.length - 1]
  const accepts = ACCEPT_TABLE[band.letterCode]

  return {
    lotSize:         lotSize,
    letterCode:      band.letterCode,
    sampleSize:      band.sampleSize,
    aqlMajor,
    aqlMinor,
    maxAllowedMajor: accepts[aqlMajor],
    maxAllowedMinor: accepts[aqlMinor],
    lotRangeLabel:   `${band.min.toLocaleString('en-IN')} – ${band.max.toLocaleString('en-IN')}`,
  }
}

export type AQLResult = 'pass' | 'fail'

export function evaluateAQL(plan: AQLPlan, actualMajor: number, actualMinor: number): AQLResult {
  if (actualMajor > plan.maxAllowedMajor) return 'fail'
  if (actualMinor > plan.maxAllowedMinor) return 'fail'
  return 'pass'
}

export function isBorderline(plan: AQLPlan, actualMajor: number, actualMinor: number): boolean {
  // Within 1 defect of the threshold on either dimension.
  if (actualMajor === plan.maxAllowedMajor) return true
  if (actualMinor === plan.maxAllowedMinor) return true
  return false
}
