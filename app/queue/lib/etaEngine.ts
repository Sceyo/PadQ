/**
 * Deterministic Queue Wait Time (ETA) Formula (ADR-0002)
 *
 * Computes deterministic match-count waiting estimates without clock drift,
 * telemetry, or Firestore timestamp tracking.
 */

/**
 * Calculates deterministic number of matches ahead.
 *
 * @param k 1-based index in eligible waiting queue (k >= 1)
 * @param s Players per match (4 for doubles, 2 for singles)
 * @returns Match estimate m >= 1 (or 0 if invalid input)
 */
export function estimateMatchesAhead(k: number, s: number): number {
  if (k <= 0 || s <= 0) return 0;
  return Math.ceil(k / s);
}

/**
 * Formats deterministic ETA label for UI chips and status pills.
 *
 * @param k 1-based index in eligible waiting queue
 * @param s Players per match (4 for doubles, 2 for singles)
 * @param isMultiCourt Whether the session is in multi-court mode
 * @returns User-facing label or null if not labeled
 */
export function formatEtaLabel(
  k: number,
  s: number,
  isMultiCourt: boolean,
): string | null {
  if (k <= 0 || s <= 0) return null;
  const m = estimateMatchesAhead(k, s);
  if (!isMultiCourt) {
    return m === 1 ? 'On deck' : null;
  }
  return m === 1 ? 'Up next' : `Wait: ${m} matches`;
}
