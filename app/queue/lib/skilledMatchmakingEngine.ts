/**
 * Skilled Matchmaking Engine
 * Completely isolated from the Default mode engine.
 * All functions are pure — they take state and return new state.
 */

// ── Types ─────────────────────────────────────────────────────

export type SkillLevel    = 'beginner' | 'intermediate' | 'advanced';
export type SkillMatch    = 'pure' | 'mixed' | 'open';

export interface SkillQueue {
  beginner:     string[];
  intermediate: string[];
  advanced:     string[];
}

export interface SkilledCourt {
  id:           string;
  name:         string;
  players:      string[];               // exactly 4 when live, [] when idle
  pickOrder?:   string[];               // pre-snakeOrder FIFO queue order for fair return routing
  skillMatch:   SkillMatch;
  matchLevel:   SkillLevel | 'mixed';
  idleCycles:   number;                 // consecutive reassignments that left this court empty
  earlyReturns: string[];              // players pulled early from rest for this court
}

export interface RestEntry {
  name:            string;
  skillLevel:      SkillLevel;
  cyclesRemaining: number;
}

export interface SkilledState {
  skillQueue:      SkillQueue;           // players waiting, grouped by level
  courts:          SkilledCourt[];
  waitingQueue:    string[];             // flat ordered list (B→I→A) for display
  sitOut:          string[];
  restPool:        RestEntry[];          // players sitting out between games
  restEnabled:     boolean;             // true when totalPlayers > courts × 4
  restCycleLength: 1 | 2;              // game cycles before re-entering queue
  totalPlayers:    number;              // active players (not sitting out)
  gamesCycleCount: number;             // increments every time any court finishes a game
  bracketWaitCycles: Record<SkillLevel, number>;
  // Consecutive pickBestGroup calls since a bracket last had ≥1 player
  // selected onto a court, despite having players waiting. Resets to 0
  // whenever the bracket is empty (nothing to starve) or gets picked.
  // Used to force a starvation override (see STARVATION_THRESHOLD below)
  // so a small bracket (e.g. 2 advanced players against a 30+ beginner
  // pool) can't be skipped indefinitely by P1/P2 always succeeding first.
  starvationThreshold: number;
  // Court-count-aware starvation threshold: max(2, courtCount).
  // A bracket that has been skipped this many consecutive picks despite
  // having waiting players gets force-included in the next pick.
  // Using courtCount as the base means "one full rotation" is the
  // natural fairness unit — at N courts, a bracket can be skipped at
  // most N times (one per court's pick) before the override fires,
  // regardless of how many players are in other brackets.
  // Floor of 2 prevents the override from firing on literally every
  // other pick at single-court sessions.
}

export interface CourtDef {
  id:   string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────

function removeFromQueue(sq: SkillQueue, players: string[]): SkillQueue {
  const ps = new Set(players);
  return {
    beginner:     sq.beginner.filter(p => !ps.has(p)),
    intermediate: sq.intermediate.filter(p => !ps.has(p)),
    advanced:     sq.advanced.filter(p => !ps.has(p)),
  };
}

function flattenQueue(sq: SkillQueue): string[] {
  return [...sq.beginner, ...sq.intermediate, ...sq.advanced];
}

function totalWaiting(sq: SkillQueue): number {
  return sq.beginner.length + sq.intermediate.length + sq.advanced.length;
}

// ── Starvation prevention ─────────────────────────────────────
// The starvation threshold is now court-count-aware and stored per
// session in SkilledState.starvationThreshold (computed at init as
// max(2, courtCount)). A bracket that has been skipped for this many
// consecutive picks — despite having waiting players — gets
// force-included in the next pick, bypassing the normal P1→P2→P3
// cascade. Using courtCount as the base means one full rotation worth
// of skips is the fairness unit: at N courts, no bracket waits more
// than N consecutive picks before the override fires.
// The floor of 2 prevents over-aggressive overriding at 1-court setups.

/**
 * After a pick (successful or not), update each bracket's wait-cycle
 * counter: reset to 0 if the bracket is now empty or had a player picked,
 * otherwise increment.
 */
function updateWaitCycles(
  prev:         Record<SkillLevel, number>,
  sqBeforePick: SkillQueue,
  pickedPlayers: string[],
): Record<SkillLevel, number> {
  const pickedSet = new Set(pickedPlayers);
  const next: Record<SkillLevel, number> = { ...prev };
  (['beginner', 'intermediate', 'advanced'] as SkillLevel[]).forEach(level => {
    const pool = sqBeforePick[level];
    const wasPicked = pool.some(p => pickedSet.has(p));
    if (pool.length === 0 || wasPicked) {
      next[level] = 0;
    } else {
      next[level] = (prev[level] ?? 0) + 1;
    }
  });
  return next;
}

const CANONICAL_LEVELS: readonly SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

function countActiveCourtsByLevel(
  courts: SkilledCourt[],
  excludeCourtId?: string,
): Record<SkillLevel, number> {
  const counts: Record<SkillLevel, number> = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const c of courts) {
    if (c.id === excludeCourtId || c.players.length === 0) continue;
    if (c.matchLevel === 'beginner' || c.matchLevel === 'intermediate' || c.matchLevel === 'advanced') {
      counts[c.matchLevel] += 1;
    }
  }
  return counts;
}

function sortLevelsByFairness(
  waitCycles:   Record<SkillLevel, number>,
  activeCourts: Record<SkillLevel, number>,
): SkillLevel[] {
  return [...CANONICAL_LEVELS].sort((a, b) => {
    const waitDiff = (waitCycles[b] ?? 0) - (waitCycles[a] ?? 0);
    if (waitDiff !== 0) return waitDiff;
    const courtDiff = (activeCourts[a] ?? 0) - (activeCourts[b] ?? 0);
    if (courtDiff !== 0) return courtDiff;
    return CANONICAL_LEVELS.indexOf(a) - CANONICAL_LEVELS.indexOf(b);
  });
}

function getAdjacentFillOrder(sq: SkillQueue, level: SkillLevel): string[][] {
  if (level === 'beginner') return [sq.intermediate, sq.advanced];
  if (level === 'advanced') return [sq.intermediate, sq.beginner];
  return sq.beginner.length >= sq.advanced.length
    ? [sq.beginner, sq.advanced]
    : [sq.advanced, sq.beginner];
}

/**
 * Force-build a group when `starvedLevel` exceeds `starvationThreshold`.
 * Schedules a pure 4-player match if ≥4 players are waiting in that bracket;
 * otherwise includes all waiting players from `starvedLevel` and fills
 * remaining slots from adjacent brackets first (I before B/A cross-fill).
 */
function forceIncludeGroup(
  sq: SkillQueue,
  starvedLevel: SkillLevel,
  recentPartners?: Set<string> | Map<string, number>,
): PickResult | null {
  const starvedPool = sq[starvedLevel];
  if (starvedPool.length === 0) return null;

  if (starvedPool.length >= 4) {
    const raw = starvedPool.slice(0, 4);
    return {
      players:    snakeOrder(raw, sq, recentPartners),
      pickOrder:  raw,
      skillMatch: 'pure',
      matchLevel: starvedLevel,
    };
  }

  const base = [...starvedPool];
  const need = 4 - base.length;
  const adjacentFillers = getAdjacentFillOrder(sq, starvedLevel).flat();
  if (adjacentFillers.length < need) return null;

  const selected = [...base, ...adjacentFillers.slice(0, need)];
  return {
    players:    snakeOrder(selected, sq, recentPartners),
    pickOrder:  selected,
    skillMatch: 'mixed',
    matchLevel: 'mixed',
  };
}

// ── Rest threshold ────────────────────────────────────────────
// restEnabled  : totalPlayers > courts × 4  (at least 1 spare)
// restCycle = 2: totalPlayers ≥ courts × 4 + courts × 2  (2 courts worth of spares)
function computeRestThreshold(
  totalPlayers: number,
  courtCount:   number,
): { restEnabled: boolean; restCycleLength: 1 | 2 } {
  const needed = courtCount * 4;
  return {
    restEnabled:     totalPlayers > needed,
    restCycleLength: totalPlayers >= needed + courtCount * 2 ? 2 : 1,
  };
}

// ── Partner pairing and snake team ordering ───────────────────

/**
 * Canonical key for an undirected pair of players: "playerA|playerB" with playerA < playerB.
 */
export function makePairKey(p1: string, p2: string): string {
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}

/**
 * Extracts recent partner frequency/recency penalties from match history.
 * More recent matches are weighted more heavily to avoid immediate repeats.
 */
export function extractRecentPartnerPairs(
  history: { players: string }[],
  lookbackMatches: number = 20,
): Map<string, number> {
  const counts = new Map<string, number>();
  const recent = history.slice(0, lookbackMatches);

  for (let i = 0; i < recent.length; i++) {
    const entry = recent[i];
    if (!entry.players) continue;
    const sides = entry.players.split(' vs ');
    if (sides.length !== 2) continue;

    const sideA = sides[0].split(' & ').map(s => s.trim()).filter(Boolean);
    const sideB = sides[1].split(' & ').map(s => s.trim()).filter(Boolean);

    const recencyWeight = (lookbackMatches - i);

    if (sideA.length === 2) {
      const key = makePairKey(sideA[0], sideA[1]);
      counts.set(key, (counts.get(key) ?? 0) + recencyWeight);
    }
    if (sideB.length === 2) {
      const key = makePairKey(sideB[0], sideB[1]);
      counts.set(key, (counts.get(key) ?? 0) + recencyWeight);
    }
  }

  return counts;
}

function getPairPenalty(
  p1: string,
  p2: string,
  recentPartners?: Set<string> | Map<string, number>,
): number {
  if (!recentPartners) return 0;
  const key = makePairKey(p1, p2);
  if (recentPartners instanceof Map) {
    return recentPartners.get(key) ?? 0;
  }
  return recentPartners.has(key) ? 1 : 0;
}

/**
 * Orders 4 players into Team A (slots 0-1) and Team B (slots 2-3).
 * Evaluates all 3 possible doubles divisions:
 *   Div 1: [s[0], s[3]] vs [s[1], s[2]] (classic snake: highest + lowest vs middle two)
 *   Div 2: [s[0], s[2]] vs [s[1], s[3]]
 *   Div 3: [s[0], s[1]] vs [s[2], s[3]]
 *
 * Selection priority:
 *   1. Minimum skill difference (|skill(Team A) - skill(Team B)|)
 *   2. Minimum partner penalty (avoid back-to-back duplicate partners)
 *   3. Division index (classic snake tie-breaker)
 *
 * Stored as [TeamA[0], TeamA[1], TeamB[0], TeamB[1]] so that
 * court.players.slice(0,2) = Team A and slice(2,4) = Team B.
 */
export function snakeOrder(
  selected: string[],
  sq: SkillQueue,
  recentPartners?: Set<string> | Map<string, number>,
): string[] {
  if (selected.length !== 4) return selected;

  const levelOf = (name: string): number => {
    if (sq.advanced.includes(name))     return 3;
    if (sq.intermediate.includes(name)) return 2;
    return 1;
  };

  const s = [...selected].sort((a, b) => levelOf(b) - levelOf(a));

  const divisions = [
    { teamA: [s[0], s[3]] as [string, string], teamB: [s[1], s[2]] as [string, string] },
    { teamA: [s[0], s[2]] as [string, string], teamB: [s[1], s[3]] as [string, string] },
    { teamA: [s[0], s[1]] as [string, string], teamB: [s[2], s[3]] as [string, string] },
  ];

  const scored = divisions.map((div, index) => {
    const skillA = levelOf(div.teamA[0]) + levelOf(div.teamA[1]);
    const skillB = levelOf(div.teamB[0]) + levelOf(div.teamB[1]);
    const skillDiff = Math.abs(skillA - skillB);
    const penalty =
      getPairPenalty(div.teamA[0], div.teamA[1], recentPartners) +
      getPairPenalty(div.teamB[0], div.teamB[1], recentPartners);
    return { div, skillDiff, penalty, index };
  });

  scored.sort((a, b) => {
    if (a.skillDiff !== b.skillDiff) return a.skillDiff - b.skillDiff;
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    return a.index - b.index;
  });

  const best = scored[0].div;
  return [best.teamA[0], best.teamA[1], best.teamB[0], best.teamB[1]];
}

// ── Pick algorithm ────────────────────────────────────────────

interface PickResult {
  players:    string[];
  pickOrder:  string[];
  skillMatch: SkillMatch;
  matchLevel: SkillLevel | 'mixed';
}

function trySplitPair(
  first: string[],
  second: string[],
  sq: SkillQueue,
  recentPartners?: Set<string> | Map<string, number>,
): PickResult | null {
  if (first.length + second.length < 4) return null;
  const firstTake = Math.min(first.length, 4);
  const secondTake = 4 - firstTake;
  if (secondTake <= second.length) {
    const raw = [...first.slice(0, firstTake), ...second.slice(0, secondTake)];
    return { players: snakeOrder(raw, sq, recentPartners), pickOrder: raw, skillMatch: 'mixed', matchLevel: 'mixed' };
  }
  const secondTake2 = Math.min(second.length, 4);
  const firstTake2 = 4 - secondTake2;
  if (firstTake2 <= first.length) {
    const raw = [...first.slice(0, firstTake2), ...second.slice(0, secondTake2)];
    return { players: snakeOrder(raw, sq, recentPartners), pickOrder: raw, skillMatch: 'mixed', matchLevel: 'mixed' };
  }
  return null;
}

/**
 * Select the best group of 4 from the skill queue using fairness-rotated priority rules.
 *
 * P0  — Starvation override (ordered by waitCycles desc, activeCourts asc)
 * P1  — Pure match: all 4 same level (ordered by waitCycles desc, activeCourts asc)
 * P2  — Majority + 1 adjacent fill (never 1+3 skip; ties broken by wait/activeCourts)
 * P3  — Split fill across adjacent pairs (B+I vs I+A prioritized by max waitCycles)
 * P3B — Cross-bracket fill: B+A allowed when P1–P3 all fail and ≥4 total exist.
 *       Teams are snake-ordered so no team gets both Advanced players.
 */
function pickBestGroup(
  sq: SkillQueue,
  waitCycles: Record<SkillLevel, number> = { beginner: 0, intermediate: 0, advanced: 0 },
  threshold: number = 3,
  recentPartners?: Set<string> | Map<string, number>,
  activeCourts: Record<SkillLevel, number> = { beginner: 0, intermediate: 0, advanced: 0 },
): PickResult | null {
  if (totalWaiting(sq) < 4) return null;

  const { beginner: B, intermediate: I, advanced: A } = sq;
  const orderedLevels = sortLevelsByFairness(waitCycles, activeCourts);

  // ── P0: Starvation override ─────────────────────────────────
  for (const level of orderedLevels) {
    if (sq[level].length > 0 && (waitCycles[level] ?? 0) >= threshold) {
      const forced = forceIncludeGroup(sq, level, recentPartners);
      if (forced) return forced;
    }
  }

  // ── P1: Pure match ─────────────────────────────────────────
  for (const level of orderedLevels) {
    if (sq[level].length >= 4) {
      const raw = sq[level].slice(0, 4);
      return {
        players:    snakeOrder(raw, sq, recentPartners),
        pickOrder:  raw,
        skillMatch: 'pure',
        matchLevel: level,
      };
    }
  }

  // ── P2: Majority + adjacent fill ───────────────────────────
  const levels: [string[], SkillLevel, string[][]][] = [
    [B, 'beginner',     [I]],         // beginner fills only from intermediate
    [I, 'intermediate', [B, A]],      // intermediate fills from B or A (try larger first)
    [A, 'advanced',     [I]],         // advanced fills only from intermediate
  ];

  levels.sort((a, b) => {
    const lenDiff = b[0].length - a[0].length;
    if (lenDiff !== 0) return lenDiff;
    const waitDiff = (waitCycles[b[1]] ?? 0) - (waitCycles[a[1]] ?? 0);
    if (waitDiff !== 0) return waitDiff;
    return (activeCourts[a[1]] ?? 0) - (activeCourts[b[1]] ?? 0);
  });

  for (const [pool, , fills] of levels) {
    if (pool.length < 1) continue;
    const need = 4 - pool.length;
    const sortedFills = [...fills].sort((a, b) => b.length - a.length);
    for (const fill of sortedFills) {
      if (fill.length >= need) {
        const raw = [...pool, ...fill.slice(0, need)];
        return {
          players:    snakeOrder(raw, sq, recentPartners),
          pickOrder:  raw,
          skillMatch: 'mixed',
          matchLevel: 'mixed',
        };
      }
    }
  }

  // ── P3: Split fill across adjacent pairs ───────────────────
  const maxWaitBI = Math.max(waitCycles.beginner ?? 0, waitCycles.intermediate ?? 0);
  const maxWaitIA = Math.max(waitCycles.intermediate ?? 0, waitCycles.advanced ?? 0);
  const splitOrder: [string[], string[]][] = maxWaitIA > maxWaitBI
    ? [[I, A], [B, I]]
    : [[B, I], [I, A]];

  for (const [first, second] of splitOrder) {
    const split = trySplitPair(first, second, sq, recentPartners);
    if (split) return split;
  }

  // ── P3B: Cross-bracket fill (B+A allowed) ──────────────────
  // Triggers when P1–P3 all fail but ≥4 players exist in any combination.
  // Snake-order the 4 selected players so each team gets one strong + one weak.
  const all = flattenQueue(sq);
  if (all.length >= 4) {
    if (I.length === 0) {
      console.warn('[SkilledEngine] P3B — cross-bracket B+A fill, no Intermediates available');
    }
    const raw = all.slice(0, 4);
    return {
      players:    snakeOrder(raw, sq, recentPartners),
      pickOrder:  raw,
      skillMatch: 'mixed',
      matchLevel: 'mixed',
    };
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Build a grouped skill queue from the full player list and bracket assignments.
 * Players with no tag default to Intermediate.
 * Only players present in the `players` array are included.
 */
export function buildSkillQueue(
  players:       string[],
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
): SkillQueue {
  const playerSet = new Set(players);
  const tagged    = new Set([
    ...skillBrackets.beginner,
    ...skillBrackets.intermediate,
    ...skillBrackets.advanced,
  ]);
  const untagged = players.filter(p => !tagged.has(p));

  return {
    beginner:     skillBrackets.beginner.filter(p => playerSet.has(p)),
    intermediate: [
      ...skillBrackets.intermediate.filter(p => playerSet.has(p)),
      ...untagged,
    ],
    advanced:     skillBrackets.advanced.filter(p => playerSet.has(p)),
  };
}

/**
 * Fill `courtDefs` with skill-optimal groups from `skillQueue`.
 * Returns filled courts and the remaining queue.
 */
export function assignCourts(
  skillQueue: SkillQueue,
  courtDefs:  CourtDef[],
  waitCycles: Record<SkillLevel, number> = { beginner: 0, intermediate: 0, advanced: 0 },
  threshold:  number = 3,
  recentPartners?: Set<string> | Map<string, number>,
): { courts: SkilledCourt[]; remainingQueue: SkillQueue; waitCycles: Record<SkillLevel, number> } {
  let sq = { ...skillQueue, beginner: [...skillQueue.beginner], intermediate: [...skillQueue.intermediate], advanced: [...skillQueue.advanced] };
  let wc = { ...waitCycles };
  const courts: SkilledCourt[] = [];

  for (const def of courtDefs) {
    const sqBefore = sq;
    const group = pickBestGroup(sq, wc, threshold, recentPartners, countActiveCourtsByLevel(courts));
    if (!group) {
      courts.push({ id: def.id, name: def.name, players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 0, earlyReturns: [] });
    } else {
      sq = removeFromQueue(sq, group.players);
      wc = updateWaitCycles(wc, sqBefore, group.players);
      courts.push({ id: def.id, name: def.name, players: group.players, pickOrder: group.pickOrder, skillMatch: group.skillMatch, matchLevel: group.matchLevel, idleCycles: 0, earlyReturns: [] });
    }
  }

  return { courts, remainingQueue: sq, waitCycles: wc };
}

/**
 * After a game ends:
 *   1. Increment gamesCycleCount.
 *   2. Tick every resting player down by 1 cycle; graduate any that reach 0.
 *   3. Route the 4 just-finished players into the rest pool (if restEnabled)
 *      or straight back into their skill queue (if not).
 */
export function rotatePlayers(
  completedPlayers: string[],
  state:            SkilledState,
  skillBrackets:    { beginner: string[]; intermediate: string[]; advanced: string[] },
): SkilledState {
  const getLevel = (name: string): SkillLevel => {
    if (skillBrackets.beginner.includes(name)) return 'beginner';
    if (skillBrackets.advanced.includes(name)) return 'advanced';
    return 'intermediate';
  };

  const newCycleCount = state.gamesCycleCount + 1;

  // Tick the rest pool — graduate players whose rest is done
  const stillResting: RestEntry[] = [];
  const sq = {
    beginner:     [...state.skillQueue.beginner],
    intermediate: [...state.skillQueue.intermediate],
    advanced:     [...state.skillQueue.advanced],
  };
  for (const entry of state.restPool) {
    if (state.sitOut.includes(entry.name)) continue;
    const remaining = entry.cyclesRemaining - 1;
    if (remaining <= 0) {
      if (!sq[entry.skillLevel].includes(entry.name)) {
        sq[entry.skillLevel] = [...sq[entry.skillLevel], entry.name];
      }
    } else {
      stillResting.push({ ...entry, cyclesRemaining: remaining });
    }
  }

  // Route completed players in their pre-snakeOrder FIFO pickOrder so snake-paired
  // lower slots don't leapfrog earlier-picked players when re-entering the queue.
  const matchedCourt = state.courts.find(
    c => c.players.length === completedPlayers.length && c.players.every(p => completedPlayers.includes(p)),
  );
  const orderedCompleted = matchedCourt?.pickOrder && matchedCourt.pickOrder.length === completedPlayers.length
    ? [
        ...matchedCourt.pickOrder.filter(p => completedPlayers.includes(p)),
        ...completedPlayers.filter(p => !matchedCourt.pickOrder!.includes(p)),
      ]
    : completedPlayers;
  const activeCompleted = orderedCompleted.filter(name => !state.sitOut.includes(name));
  let newRestPool: RestEntry[];
  if (state.restEnabled) {
    const fresh: RestEntry[] = activeCompleted
      .filter(name => !stillResting.some(e => e.name === name))
      .map(name => ({ name, skillLevel: getLevel(name), cyclesRemaining: state.restCycleLength }));
    newRestPool = [...stillResting, ...fresh];
  } else {
    newRestPool = stillResting;
    for (const name of activeCompleted) {
      const level = getLevel(name);
      if (!sq[level].includes(name)) sq[level] = [...sq[level], name];
    }
  }

  return {
    ...state,
    skillQueue:      sq,
    waitingQueue:    flattenQueue(sq),
    restPool:        newRestPool,
    gamesCycleCount: newCycleCount,
  };
}

/**
 * When a court opens, select the next best group of 4 and assign to that court.
 */
export function reassignCourt(
  courtId:       string,
  state:         SkilledState,
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
  recentPartners?: Set<string> | Map<string, number>,
): SkilledState {
  const prevIdle = state.courts.find(c => c.id === courtId)?.idleCycles ?? 0;
  const sqBefore = state.skillQueue;
  const group    = pickBestGroup(
    state.skillQueue,
    state.bracketWaitCycles,
    state.starvationThreshold,
    recentPartners,
    countActiveCourtsByLevel(state.courts, courtId),
  );
  const newQueue = group ? removeFromQueue(state.skillQueue, group.players) : state.skillQueue;
  const newWaitCycles = group
    ? updateWaitCycles(state.bracketWaitCycles, sqBefore, group.players)
    : state.bracketWaitCycles;
  const courts   = state.courts.map(c =>
    c.id === courtId
      ? {
          ...c,
          players:      group?.players ?? [],
          pickOrder:    group?.pickOrder,
          skillMatch:   group?.skillMatch ?? 'pure',
          matchLevel:   group?.matchLevel ?? ('mixed' as SkillLevel | 'mixed'),
          idleCycles:   group ? 0 : prevIdle + 1,
          earlyReturns: [],
        }
      : c
  );
  return { ...state, skillQueue: newQueue, courts, waitingQueue: flattenQueue(newQueue), bracketWaitCycles: newWaitCycles };
}

/**
 * Full initialization: build skill queue, fill all courts.
 */
export function initSkilledState(
  players:       string[],
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
  courtDefs:     CourtDef[],
  sitOut:        string[] = [],
  recentPartners?: Set<string> | Map<string, number>,
): SkilledState {
  const active    = players.filter(p => !sitOut.includes(p));
  const sq        = buildSkillQueue(active, skillBrackets);
  const threshold = Math.max(2, courtDefs.length);
  const { courts, remainingQueue, waitCycles } = assignCourts(sq, courtDefs, undefined, threshold, recentPartners);
  const { restEnabled, restCycleLength } = computeRestThreshold(active.length, courtDefs.length);
  return {
    skillQueue:          remainingQueue,
    courts,
    waitingQueue:        flattenQueue(remainingQueue),
    sitOut,
    restPool:            [],
    restEnabled,
    restCycleLength,
    totalPlayers:        active.length,
    gamesCycleCount:     0,
    bracketWaitCycles:   waitCycles,
    starvationThreshold: threshold,
  };
}

/**
 * Hydrate a SkilledState preserving on-court players from existing courtSlots.
 * Used on page reload when reconnecting to an active skilled session.
 */
export function hydrateSkilledStateFromCourtSlots(
  players:       string[],
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
  courtSlots:    { id: string; name: string; onCourt: string[] }[],
  sitOut:        string[] = [],
): SkilledState {
  const onCourt = courtSlots.flatMap(c => c.onCourt);
  const activeWaiting = players.filter(p => !sitOut.includes(p) && !onCourt.includes(p));
  const sq = buildSkillQueue(activeWaiting, skillBrackets);
  const threshold = Math.max(2, courtSlots.length);
  const totalActive = players.filter(p => !sitOut.includes(p)).length;
  const { restEnabled, restCycleLength } = computeRestThreshold(totalActive, courtSlots.length);

  const courts: SkilledCourt[] = courtSlots.map(slot => {
    const levels = slot.onCourt.map(p => getPlayerBracketLevel(p, skillBrackets));
    const isPure = levels.length === 4 && levels.every(l => l === levels[0]);
    return {
      id:           slot.id,
      name:         slot.name,
      players:      [...slot.onCourt],
      skillMatch:   isPure ? 'pure' : 'mixed',
      matchLevel:   isPure ? levels[0] : 'mixed',
      idleCycles:   0,
      earlyReturns: [],
    };
  });

  return {
    skillQueue:          sq,
    courts,
    waitingQueue:        flattenQueue(sq),
    sitOut,
    restPool:            [],
    restEnabled,
    restCycleLength,
    totalPlayers:        totalActive,
    gamesCycleCount:     0,
    bracketWaitCycles:   { beginner: 0, intermediate: 0, advanced: 0 },
    starvationThreshold: threshold,
  };
}

/**
 * Projects skilled courts to standard CourtSlot format for Firestore synchronization.
 */
export function projectSkilledCourtsToSlots(
  courts: SkilledCourt[],
): { id: string; name: string; onCourt: string[] }[] {
  return courts.map(c => ({
    id:      c.id,
    name:    c.name,
    onCourt: [...c.players],
  }));
}


/**
 * Add a new player (joined mid-session) to the back of their skill group in the queue.
 */
export function addPlayerToSkilledState(
  player:        string,
  state:         SkilledState,
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
): SkilledState {
  const everywhere = [
    ...flattenQueue(state.skillQueue),
    ...state.courts.flatMap(c => c.players),
    ...state.sitOut,
    ...state.restPool.map(e => e.name),
  ];
  if (everywhere.includes(player)) return state;

  const level: SkillLevel = skillBrackets.beginner.includes(player)  ? 'beginner'
    : skillBrackets.advanced.includes(player) ? 'advanced'
    : 'intermediate';

  const sq = { ...state.skillQueue, [level]: [...state.skillQueue[level], player] };
  return { ...state, skillQueue: sq, waitingQueue: flattenQueue(sq) };
}

/**
 * Move a player to a different skill group (called when host re-tags a player).
 * Only affects players in the waiting queue — on-court players are unchanged
 * and will be re-tagged after their game ends via rotatePlayers.
 */
export function retagPlayerInQueue(
  player:   string,
  newLevel: SkillLevel,
  state:    SkilledState,
): SkilledState {
  const isOnCourt = state.courts.some(c => c.players.includes(player));
  if (isOnCourt) return state;
  if (state.sitOut.includes(player)) return state;

  if (state.restPool.some(e => e.name === player)) {
    return {
      ...state,
      restPool: state.restPool.map(e => e.name === player ? { ...e, skillLevel: newLevel } : e),
    };
  }

  const wasInQueue =
    state.skillQueue.beginner.includes(player) ||
    state.skillQueue.intermediate.includes(player) ||
    state.skillQueue.advanced.includes(player);
  if (!wasInQueue) return state;

  const sq: SkillQueue = {
    beginner:     state.skillQueue.beginner.filter(p => p !== player),
    intermediate: state.skillQueue.intermediate.filter(p => p !== player),
    advanced:     state.skillQueue.advanced.filter(p => p !== player),
  };
  sq[newLevel] = [...sq[newLevel], player];
  return { ...state, skillQueue: sq, waitingQueue: flattenQueue(sq) };
}

/**
 * Recompute rest thresholds after the active player count changes (player added / sit-out toggled).
 * If rest becomes disabled, every resting player is immediately flushed back into the skill queue.
 * If rest stays enabled, only the cycle length may change — resting players are not disturbed.
 */
export function recalculateRest(
  state:       SkilledState,
  totalActive: number,
): SkilledState {
  const courtCount = state.courts.length;
  const { restEnabled, restCycleLength } = computeRestThreshold(totalActive, courtCount);

  let s: SkilledState = { ...state, restEnabled, restCycleLength, totalPlayers: totalActive };

  // Flush the rest pool if rest just became impossible
  if (!restEnabled && state.restPool.length > 0) {
    const sq = {
      beginner:     [...s.skillQueue.beginner],
      intermediate: [...s.skillQueue.intermediate],
      advanced:     [...s.skillQueue.advanced],
    };
    for (const entry of state.restPool) {
      if (!sq[entry.skillLevel].includes(entry.name)) {
        sq[entry.skillLevel] = [...sq[entry.skillLevel], entry.name];
      }
    }
    s = { ...s, skillQueue: sq, waitingQueue: flattenQueue(sq), restPool: [] };
  }

  return s;
}

/** Utility: get the display label for a player's bracket. */
export function getPlayerBracketLevel(
  name:          string,
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
): SkillLevel {
  if (skillBrackets.beginner.includes(name))  return 'beginner';
  if (skillBrackets.advanced.includes(name))  return 'advanced';
  return 'intermediate';
}

export type PlayerDisplayLevel = SkillLevel | 'untagged';

/** Utility: get the exact bracket tag or 'untagged' if not explicitly assigned. */
export function getPlayerSkillTag(
  name:          string,
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
): PlayerDisplayLevel {
  if (skillBrackets.beginner.includes(name))     return 'beginner';
  if (skillBrackets.intermediate.includes(name)) return 'intermediate';
  if (skillBrackets.advanced.includes(name))     return 'advanced';
  return 'untagged';
}

/**
 * After a normal court reassignment, scan every court that is still idle.
 * A court must never remain idle when ≥4 players exist across the active queue
 * AND rest pool combined — fill it immediately, even if the rest pool players
 * haven't finished their rest cycle yet.
 *
 * NOTE: the old idleThreshold guard (skip courts idle for < N cycles) has been
 * removed.  idleCycles is only incremented for the court that just finished a
 * game, so a permanently-idle court (one that started empty) would never reach
 * the threshold.  totalAvailable ≥ 4 is the sole gate now.
 */
export function fillIdleCourts(
  state: SkilledState,
  recentPartners?: Set<string> | Map<string, number>,
): SkilledState {
  let s = state;

  for (const court of s.courts) {
    if (court.players.length > 0) continue;

    const waiting        = totalWaiting(s.skillQueue);
    const totalAvailable = waiting + (s.restEnabled ? s.restPool.length : 0);

    // Legitimately short-handed — court must wait
    if (totalAvailable < 4) continue;

    if (waiting >= 4) {
      // Active queue alone has enough — respect full priority cascade via pickBestGroup
      const group = pickBestGroup(
        s.skillQueue,
        s.bracketWaitCycles,
        s.starvationThreshold,
        recentPartners,
        countActiveCourtsByLevel(s.courts, court.id),
      );
      if (!group) continue;
      const newSq = removeFromQueue(s.skillQueue, group.players);
      const newWaitCycles = updateWaitCycles(s.bracketWaitCycles, s.skillQueue, group.players);

      console.warn(`[SkilledEngine] Immediate idle fill court ${court.id} (queue=${waiting})`);

      s = {
        ...s,
        skillQueue:   newSq,
        waitingQueue: flattenQueue(newSq),
        bracketWaitCycles: newWaitCycles,
        courts: s.courts.map(c =>
          c.id === court.id
            ? { ...c, players: group.players, pickOrder: group.pickOrder, skillMatch: group.skillMatch, matchLevel: group.matchLevel, idleCycles: 0, earlyReturns: [] }
            : c
        ),
      };
    } else {
      // Active queue is short — pull from queue first, then supplement from rest pool.
      // Take the most-overdue rest players first (lowest cyclesRemaining = closest to graduating).
      const needed     = 4 - waiting;
      const candidates = [...s.restPool].sort((a, b) => a.cyclesRemaining - b.cyclesRemaining);
      const earlyOnes  = candidates.slice(0, needed);
      const earlyNames = earlyOnes.map(e => e.name);
      const newRest    = s.restPool.filter(e => !earlyNames.includes(e.name));

      const tempSq = {
        beginner:     [...s.skillQueue.beginner],
        intermediate: [...s.skillQueue.intermediate],
        advanced:     [...s.skillQueue.advanced],
      };
      for (const entry of earlyOnes) {
        if (!tempSq[entry.skillLevel].includes(entry.name)) {
          tempSq[entry.skillLevel] = [...tempSq[entry.skillLevel], entry.name];
        }
      }

      const all     = flattenQueue(tempSq);
      const sel     = all.slice(0, 4);
      const ordered = snakeOrder(sel, tempSq, recentPartners);
      const finalSq = removeFromQueue(tempSq, sel);
      const newWaitCycles = updateWaitCycles(s.bracketWaitCycles, tempSq, sel);

      console.warn(`[SkilledEngine] Emergency idle fill court ${court.id}: early rest return [${earlyNames.join(', ')}]`);

      s = {
        ...s,
        skillQueue:   finalSq,
        waitingQueue: flattenQueue(finalSq),
        restPool:     newRest,
        bracketWaitCycles: newWaitCycles,
        courts: s.courts.map(c =>
          c.id === court.id
            ? { ...c, players: ordered, pickOrder: [...sel], skillMatch: 'mixed' as SkillMatch, matchLevel: 'mixed' as SkillLevel | 'mixed', idleCycles: 0, earlyReturns: earlyNames }
            : c
        ),
      };
    }
  }

  return s;
}