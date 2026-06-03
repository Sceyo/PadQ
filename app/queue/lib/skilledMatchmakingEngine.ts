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

// ── Snake team ordering ───────────────────────────────────────
// Sorts 4 players by skill descending then interleaves so each team
// gets one strong + one weak player:
//   sorted[0] → Team A slot 0  (strongest)
//   sorted[1] → Team B slot 0
//   sorted[2] → Team B slot 1
//   sorted[3] → Team A slot 1  (weakest pairs with strongest)
// Stored as [TeamA[0], TeamA[1], TeamB[0], TeamB[1]] so that
// court.players.slice(0,2) = Team A and slice(2,4) = Team B.
function snakeOrder(selected: string[], sq: SkillQueue): string[] {
  const levelOf = (name: string): number => {
    if (sq.advanced.includes(name))     return 3;
    if (sq.intermediate.includes(name)) return 2;
    return 1;
  };
  const s = [...selected].sort((a, b) => levelOf(b) - levelOf(a));
  return [s[0], s[3], s[1], s[2]];
}

// ── Pick algorithm ────────────────────────────────────────────

interface PickResult {
  players:    string[];
  skillMatch: SkillMatch;
  matchLevel: SkillLevel | 'mixed';
}

/**
 * Select the best group of 4 from the skill queue using strict priority rules.
 *
 * P1  — Pure match: all 4 same level
 * P2  — Majority + 1 adjacent fill (never 1+3 skip)
 * P3  — Split fill across adjacent pairs (2+2, 3+1, 1+3 within adjacent only)
 * P3B — Cross-bracket fill: B+A allowed when P1–P3 all fail and ≥4 total exist.
 *       Teams are snake-ordered so no team gets both Advanced players.
 */
function pickBestGroup(sq: SkillQueue): PickResult | null {
  if (totalWaiting(sq) < 4) return null;

  const { beginner: B, intermediate: I, advanced: A } = sq;

  // ── P1: Pure match ─────────────────────────────────────────
  if (B.length >= 4) return { players: B.slice(0, 4), skillMatch: 'pure', matchLevel: 'beginner' };
  if (I.length >= 4) return { players: I.slice(0, 4), skillMatch: 'pure', matchLevel: 'intermediate' };
  if (A.length >= 4) return { players: A.slice(0, 4), skillMatch: 'pure', matchLevel: 'advanced' };

  // ── P2: Majority + adjacent fill ───────────────────────────
  // Determine majority level (most players), break ties by level index
  const levels: [string[], SkillLevel, string[][]][] = [
    [B, 'beginner',     [I]],         // beginner fills only from intermediate
    [I, 'intermediate', [B, A]],      // intermediate fills from B or A (try larger first)
    [A, 'advanced',     [I]],         // advanced fills only from intermediate
  ];

  for (const [pool, , fills] of levels.sort((a, b) => b[0].length - a[0].length)) {
    if (pool.length < 1) continue;
    const need = 4 - pool.length;
    // For intermediate, prefer the fill pool with more players
    const sortedFills = [...fills].sort((a, b) => (b as string[]).length - (a as string[]).length);
    for (const fill of sortedFills as string[][]) {
      if (fill.length >= need) {
        return {
          players:    [...pool, ...fill.slice(0, need)],
          skillMatch: 'mixed',
          matchLevel: 'mixed',
        };
      }
    }
  }

  // ── P3: Split fill across adjacent pairs ───────────────────
  // B+I (any proportion summing to 4)
  if (B.length + I.length >= 4) {
    const bTake = Math.min(B.length, 4);
    const iTake = 4 - bTake;
    if (iTake <= I.length) {
      return { players: [...B.slice(0, bTake), ...I.slice(0, iTake)], skillMatch: 'mixed', matchLevel: 'mixed' };
    }
    const iTake2 = Math.min(I.length, 4);
    const bTake2 = 4 - iTake2;
    if (bTake2 <= B.length) {
      return { players: [...B.slice(0, bTake2), ...I.slice(0, iTake2)], skillMatch: 'mixed', matchLevel: 'mixed' };
    }
  }

  // I+A (any proportion summing to 4)
  if (I.length + A.length >= 4) {
    const iTake = Math.min(I.length, 4);
    const aTake = 4 - iTake;
    if (aTake <= A.length) {
      return { players: [...I.slice(0, iTake), ...A.slice(0, aTake)], skillMatch: 'mixed', matchLevel: 'mixed' };
    }
    const aTake2 = Math.min(A.length, 4);
    const iTake2 = 4 - aTake2;
    if (iTake2 <= I.length) {
      return { players: [...I.slice(0, iTake2), ...A.slice(0, aTake2)], skillMatch: 'mixed', matchLevel: 'mixed' };
    }
  }

  // ── P3B: Cross-bracket fill (B+A allowed) ──────────────────
  // Triggers when P1–P3 all fail but ≥4 players exist in any combination.
  // Snake-order the 4 selected players so each team gets one strong + one weak.
  const all = flattenQueue(sq);
  if (all.length >= 4) {
    if (I.length === 0) {
      console.warn('[SkilledEngine] P3B — cross-bracket B+A fill, no Intermediates available');
    }
    return {
      players:    snakeOrder(all.slice(0, 4), sq),
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
): { courts: SkilledCourt[]; remainingQueue: SkillQueue } {
  let sq = { ...skillQueue, beginner: [...skillQueue.beginner], intermediate: [...skillQueue.intermediate], advanced: [...skillQueue.advanced] };
  const courts: SkilledCourt[] = [];

  for (const def of courtDefs) {
    const group = pickBestGroup(sq);
    if (!group) {
      courts.push({ id: def.id, name: def.name, players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 0, earlyReturns: [] });
    } else {
      sq = removeFromQueue(sq, group.players);
      courts.push({ id: def.id, name: def.name, players: group.players, skillMatch: group.skillMatch, matchLevel: group.matchLevel, idleCycles: 0, earlyReturns: [] });
    }
  }

  return { courts, remainingQueue: sq };
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
  let sq = {
    beginner:     [...state.skillQueue.beginner],
    intermediate: [...state.skillQueue.intermediate],
    advanced:     [...state.skillQueue.advanced],
  };
  for (const entry of state.restPool) {
    const remaining = entry.cyclesRemaining - 1;
    if (remaining <= 0) {
      if (!sq[entry.skillLevel].includes(entry.name)) {
        sq[entry.skillLevel] = [...sq[entry.skillLevel], entry.name];
      }
    } else {
      stillResting.push({ ...entry, cyclesRemaining: remaining });
    }
  }

  // Route completed players
  let newRestPool: RestEntry[];
  if (state.restEnabled) {
    const fresh: RestEntry[] = completedPlayers
      .filter(name => !stillResting.some(e => e.name === name))
      .map(name => ({ name, skillLevel: getLevel(name), cyclesRemaining: state.restCycleLength }));
    newRestPool = [...stillResting, ...fresh];
  } else {
    newRestPool = stillResting;
    for (const name of completedPlayers) {
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
): SkilledState {
  const prevIdle = state.courts.find(c => c.id === courtId)?.idleCycles ?? 0;
  const group    = pickBestGroup(state.skillQueue);
  const newQueue = group ? removeFromQueue(state.skillQueue, group.players) : state.skillQueue;
  const courts   = state.courts.map(c =>
    c.id === courtId
      ? {
          ...c,
          players:      group?.players ?? [],
          skillMatch:   group?.skillMatch ?? 'pure',
          matchLevel:   group?.matchLevel ?? ('mixed' as SkillLevel | 'mixed'),
          idleCycles:   group ? 0 : prevIdle + 1,
          earlyReturns: [],
        }
      : c
  );
  return { ...state, skillQueue: newQueue, courts, waitingQueue: flattenQueue(newQueue) };
}

/**
 * Full initialization: build skill queue, fill all courts.
 */
export function initSkilledState(
  players:       string[],
  skillBrackets: { beginner: string[]; intermediate: string[]; advanced: string[] },
  courtDefs:     CourtDef[],
  sitOut:        string[] = [],
): SkilledState {
  const active = players.filter(p => !sitOut.includes(p));
  const sq     = buildSkillQueue(active, skillBrackets);
  const { courts, remainingQueue } = assignCourts(sq, courtDefs);
  const { restEnabled, restCycleLength } = computeRestThreshold(active.length, courtDefs.length);
  return {
    skillQueue:      remainingQueue,
    courts,
    waitingQueue:    flattenQueue(remainingQueue),
    sitOut,
    restPool:        [],
    restEnabled,
    restCycleLength,
    totalPlayers:    active.length,
    gamesCycleCount: 0,
  };
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
    let sq = {
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
): SkilledState {
  let s = state;

  for (const court of s.courts) {
    if (court.players.length > 0) continue;

    const waiting        = totalWaiting(s.skillQueue);
    const totalAvailable = waiting + (s.restEnabled ? s.restPool.length : 0);

    // Legitimately short-handed — court must wait
    if (totalAvailable < 4) continue;

    if (waiting >= 4) {
      // Active queue alone has enough — cross-bracket fill (P3B)
      const all     = flattenQueue(s.skillQueue);
      const sel     = all.slice(0, 4);
      const ordered = snakeOrder(sel, s.skillQueue);
      const newSq   = removeFromQueue(s.skillQueue, sel);

      console.warn(`[SkilledEngine] Immediate idle fill court ${court.id} (queue=${waiting})`);

      s = {
        ...s,
        skillQueue:   newSq,
        waitingQueue: flattenQueue(newSq),
        courts: s.courts.map(c =>
          c.id === court.id
            ? { ...c, players: ordered, skillMatch: 'mixed' as SkillMatch, matchLevel: 'mixed' as SkillLevel | 'mixed', idleCycles: 0, earlyReturns: [] }
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

      let tempSq = {
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
      const ordered = snakeOrder(sel, tempSq);
      const finalSq = removeFromQueue(tempSq, sel);

      console.warn(`[SkilledEngine] Emergency idle fill court ${court.id}: early rest return [${earlyNames.join(', ')}]`);

      s = {
        ...s,
        skillQueue:   finalSq,
        waitingQueue: flattenQueue(finalSq),
        restPool:     newRest,
        courts: s.courts.map(c =>
          c.id === court.id
            ? { ...c, players: ordered, skillMatch: 'mixed' as SkillMatch, matchLevel: 'mixed' as SkillLevel | 'mixed', idleCycles: 0, earlyReturns: earlyNames }
            : c
        ),
      };
    }
  }

  return s;
}
