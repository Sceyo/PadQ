// Skill-based court assignment engine for Skilled queue mode.
// Takes a queue of players and a skill level map (1=Beginner, 2=Intermediate, 3=Advanced)
// and picks the best group of 4 using a three-priority cascade.

export type SkillLevel = 1 | 2 | 3;
export type FillType   = 'pure' | 'adjacent' | 'any';

export interface SkillPickResult {
  picked:   string[];
  isMixed:  boolean;
  fillType: FillType;
}

/**
 * Pick the best group of `n` players from `waiting` (in queue order).
 *
 * Priority 1 — pure:     all same level
 * Priority 2 — adjacent: ±1 level (1+2 or 2+3); never 1+3 while 2 exists
 * Priority 3 — any:      first n in queue order (last resort; 1+3 only if no 2 available)
 *
 * Queue order within each level is always preserved.
 * Returns null if fewer than n players are waiting.
 */
export function pickSkillGroup(
  waiting:  string[],
  skillMap: Record<string, SkillLevel>,
  n:        number = 4,
): SkillPickResult | null {
  if (waiting.length < n) return null;

  const lvl = (name: string): SkillLevel => (skillMap[name] ?? 2) as SkillLevel;

  const byLevel: Record<SkillLevel, string[]> = { 1: [], 2: [], 3: [] };
  for (const name of waiting) byLevel[lvl(name)].push(name);

  // ── Priority 1: pure match ──────────────────────────────────
  for (const level of [1, 2, 3] as SkillLevel[]) {
    if (byLevel[level].length >= n)
      return { picked: byLevel[level].slice(0, n), isMixed: false, fillType: 'pure' };
  }

  // ── Priority 2: adjacent fill ───────────────────────────────
  // Try 1+2 then 2+3. Never try 1+3 directly — that is reserved for P3.
  for (const [lo, hi] of [[1, 2], [2, 3]] as [SkillLevel, SkillLevel][]) {
    const combined = [...byLevel[lo], ...byLevel[hi]];
    if (combined.length >= n)
      return { picked: combined.slice(0, n), isMixed: true, fillType: 'adjacent' };
  }

  // ── Priority 3: any (last resort) ──────────────────────────
  // Takes the first n in their original queue order.
  // Beginner+Advanced pairing is allowed here only if no Intermediate exists,
  // which is already implied by the fact that P2 (adjacent) already failed.
  return { picked: waiting.slice(0, n), isMixed: true, fillType: 'any' };
}

/**
 * Re-arrange the queue so the skill-optimal group is at positions 0..n-1.
 * The remaining players follow in their original relative order.
 */
export function arrangeQueueBySkill(
  queue:    string[],
  skillMap: Record<string, SkillLevel>,
  n:        number = 4,
): { queue: string[]; isMixed: boolean; fillType: FillType } {
  if (queue.length < n) return { queue, isMixed: false, fillType: 'pure' };

  const result = pickSkillGroup(queue, skillMap, n);
  if (!result)  return { queue, isMixed: false, fillType: 'pure' };

  const pickedSet = new Set(result.picked);
  const rest      = queue.filter(p => !pickedSet.has(p));
  return { queue: [...result.picked, ...rest], isMixed: result.isMixed, fillType: result.fillType };
}

/**
 * After a skilled match, rotate the played players to the back of the queue
 * and pick the next best skill group for the front.
 */
export function advanceSkilledQueue(
  currentQueue: string[],
  played:       string[],
  skillMap:     Record<string, SkillLevel>,
  n:            number = 4,
): { queue: string[]; isMixed: boolean; fillType: FillType } {
  const playedSet = new Set(played);
  const waiting   = [...currentQueue.filter(p => !playedSet.has(p)), ...played];
  return arrangeQueueBySkill(waiting, skillMap, n);
}
