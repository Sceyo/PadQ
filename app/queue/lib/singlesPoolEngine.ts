export type PoolSinglesPhase = 'INIT' | 'WINNERS' | 'LOSERS';

export interface PoolSinglesMatch {
  playerA: string;
  playerB: string;
}

export interface PoolSinglesState {
  format: 'pool';
  phase: PoolSinglesPhase;
  matchIndexInPhase: number;
  matchCount: number;
  w1: string[];
  l1: string[];
  waitingQueue: string[];
  playedThisCycle: Set<string>;
  recentMatches: string[];
  lastPlayedMap: Record<string, number>;
}

const RECENT_MATCHES_CAP = 6;
const SELECTION_WINDOW   = 6;
const MAX_POOL_SIZE      = 8;
const PENALTY_REPEAT_MATCH    = 5;
const PENALTY_FATIGUE         = 2;
const PENALTY_SKILL_IMBALANCE = 1;

export function matchKey(playerA: string, playerB: string): string {
  return [playerA, playerB].sort().join('|');
}

function scoreCandidate(
  playerA: string,
  playerB: string,
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number>,
): number {
  let score = 0;

  if (recentMatches.includes(matchKey(playerA, playerB))) {
    score += PENALTY_REPEAT_MATCH;
  }

  if (lastMatchPlayers.has(playerA)) score += PENALTY_FATIGUE;
  if (lastMatchPlayers.has(playerB)) score += PENALTY_FATIGUE;

  if (Object.keys(skillMap).length > 0) {
    const skillA = skillMap[playerA] ?? 50;
    const skillB = skillMap[playerB] ?? 50;
    score += Math.abs(skillA - skillB) * PENALTY_SKILL_IMBALANCE;
  }

  return score;
}

function lastMatchPlayerSet(recentMatches: string[]): Set<string> {
  if (!recentMatches.length) return new Set();
  const last = recentMatches[recentMatches.length - 1];
  return new Set(last.split('|'));
}

export function smartSelectPair(
  candidates: string[],
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number> = {},
): [string, string] {
  const window = candidates.slice(0, SELECTION_WINDOW);
  if (window.length <= 2) return [window[0] ?? '', window[1] ?? ''];

  let bestScore = Infinity;
  let bestPair: [string, string] = [window[0], window[1]];

  for (let i = 0; i < window.length - 1; i++) {
    for (let j = i + 1; j < window.length; j++) {
      const a = window[i];
      const b = window[j];
      const score = scoreCandidate(a, b, recentMatches, lastMatchPlayers, skillMap);

      if (score < bestScore) {
        bestScore = score;
        bestPair = [a, b];
      }
    }
  }
  return bestPair;
}

export function balancePools(
  w1: string[],
  l1: string[],
  waiting: string[] = [],
): { w1: string[]; l1: string[]; waiting: string[] } {
  let nextW1 = w1;
  let nextL1 = l1;
  let nextWaiting = waiting;

  let progressed = true;
  while (progressed && (nextW1.length > MAX_POOL_SIZE || nextL1.length > MAX_POOL_SIZE)) {
    progressed = false;

    if (nextW1.length > MAX_POOL_SIZE) {
      const overflow = nextW1.slice(MAX_POOL_SIZE);
      const trimmed  = nextW1.slice(0, MAX_POOL_SIZE);
      if (nextL1.length + overflow.length <= MAX_POOL_SIZE) {
        nextW1 = trimmed;
        nextL1 = [...nextL1, ...overflow];
        progressed = true;
      }
    }
    if (nextL1.length > MAX_POOL_SIZE) {
      const overflow = nextL1.slice(MAX_POOL_SIZE);
      const trimmed  = nextL1.slice(0, MAX_POOL_SIZE);
      if (nextW1.length + overflow.length <= MAX_POOL_SIZE) {
        nextL1 = trimmed;
        nextW1 = [...nextW1, ...overflow];
        progressed = true;
      }
    }
  }

  if (nextW1.length > MAX_POOL_SIZE) {
    const overflow = nextW1.slice(MAX_POOL_SIZE);
    nextW1 = nextW1.slice(0, MAX_POOL_SIZE);
    nextWaiting = [...nextWaiting, ...overflow.filter(p => !nextWaiting.includes(p))];
  }
  if (nextL1.length > MAX_POOL_SIZE) {
    const overflow = nextL1.slice(MAX_POOL_SIZE);
    nextL1 = nextL1.slice(0, MAX_POOL_SIZE);
    nextWaiting = [...nextWaiting, ...overflow.filter(p => !nextWaiting.includes(p))];
  }

  return { w1: nextW1, l1: nextL1, waiting: nextWaiting };
}

export function freshPoolSinglesState(): PoolSinglesState {
  return {
    format: 'pool',
    phase: 'INIT',
    matchIndexInPhase: 0,
    matchCount: 0,
    w1: [],
    l1: [],
    waitingQueue: [],
    playedThisCycle: new Set(),
    recentMatches: [],
    lastPlayedMap: {},
  };
}

function fallbackMatch(available: string[]): PoolSinglesMatch {
  const unique = available.filter((p, i, a) => p && a.indexOf(p) === i);
  return {
    playerA: unique[0] ?? '',
    playerB: unique[1] ?? '',
  };
}

export function buildNextPoolSinglesMatch(
  state: PoolSinglesState,
  allPlayers: string[],
  skillMap: Record<string, number> = {},
): PoolSinglesMatch {
  const lastMatchPlayers = lastMatchPlayerSet(state.recentMatches);
  const eligible = new Set(allPlayers);

  if (state.phase === 'INIT') {
    const base = state.matchIndexInPhase * 2;
    const pool = allPlayers.slice(base, base + 2);
    const padded = pool.length >= 2
      ? pool
      : [...pool, ...allPlayers.filter(p => !pool.includes(p))].slice(0, 2);

    if (padded.length < 2) return fallbackMatch(padded);
    return { playerA: padded[0], playerB: padded[1] };
  }

  if (state.phase === 'WINNERS') {
    let candidates = state.w1.filter(p => eligible.has(p));
    if (candidates.length < 2) {
      candidates = [
        ...candidates,
        ...state.l1.filter(p => eligible.has(p)).slice(0, 2 - candidates.length),
      ];
    }
    if (candidates.length < 2) {
      candidates = [
        ...candidates,
        ...allPlayers.filter(p => eligible.has(p) && !candidates.includes(p)).slice(0, 2 - candidates.length),
      ];
    }
    if (candidates.length < 2) return fallbackMatch(candidates);
    const [pA, pB] = smartSelectPair(candidates, state.recentMatches, lastMatchPlayers, skillMap);
    return { playerA: pA, playerB: pB };
  }

  let candidates = state.l1.filter(p => eligible.has(p));
  if (candidates.length < 2) {
    candidates = [
      ...candidates,
      ...state.w1.filter(p => eligible.has(p)).slice(0, 2 - candidates.length),
    ];
  }
  if (candidates.length < 2) {
    candidates = [
      ...candidates,
      ...allPlayers.filter(p => eligible.has(p) && !candidates.includes(p)).slice(0, 2 - candidates.length),
    ];
  }
  if (candidates.length < 2) return fallbackMatch(candidates);
  const [pA, pB] = smartSelectPair(candidates, state.recentMatches, lastMatchPlayers, skillMap);
  return { playerA: pA, playerB: pB };
}

export function advancePoolSinglesState(
  state: PoolSinglesState,
  winner: string,
  loser: string,
  allPlayers: string[],
  skillMap: Record<string, number> = {},
): { nextState: PoolSinglesState; newQueue: string[] } {
  const bothPlayers = [winner, loser];
  const nextMatchCount = state.matchCount + 1;

  const updatedRecentMatches = [
    ...state.recentMatches,
    matchKey(winner, loser),
  ].slice(-RECENT_MATCHES_CAP);

  const updatedLastPlayedMap: Record<string, number> = { ...state.lastPlayedMap };
  for (const p of bothPlayers) {
    updatedLastPlayedMap[p] = state.matchCount;
  }

  const newPlayed = new Set(state.playedThisCycle);
  bothPlayers.forEach(p => newPlayed.add(p));

  const playedSet = new Set(bothPlayers);
  let nextW1      = state.w1.filter(p => !playedSet.has(p));
  let nextL1      = state.l1.filter(p => !playedSet.has(p));
  let nextWaiting = state.waitingQueue.filter(p => !playedSet.has(p));

  nextW1 = [...nextW1, winner];
  nextL1 = [...nextL1, loser];

  ({ w1: nextW1, l1: nextL1, waiting: nextWaiting } = balancePools(nextW1, nextL1, nextWaiting));

  let nextPhase           = state.phase;
  let nextMatchIndex      = state.matchIndexInPhase + 1;
  let nextPlayedThisCycle = newPlayed;

  if (state.phase === 'INIT') {
    const initMatchesNeeded = Math.max(1, Math.floor(allPlayers.length / 2));
    if (nextMatchIndex >= initMatchesNeeded) {
      const overflow = allPlayers.filter(
        p => !nextW1.includes(p) && !nextL1.includes(p) && !nextWaiting.includes(p),
      );
      nextWaiting = [...nextWaiting, ...overflow];

      const unplayed = nextWaiting.filter(p => !nextPlayedThisCycle.has(p));
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextL1      = nextL1.filter(p => !unplayed.includes(p));
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));

      ({ w1: nextW1, l1: nextL1, waiting: nextWaiting } = balancePools(nextW1, nextL1, nextWaiting));

      nextPhase      = 'WINNERS';
      nextMatchIndex = 0;
    }
  } else if (state.phase === 'WINNERS') {
    nextPhase      = 'LOSERS';
    nextMatchIndex = 0;
  } else {
    const activePlayers = new Set([...nextW1, ...nextL1, ...nextPlayedThisCycle]);
    const allHavePlayed = [...activePlayers].every(p => nextPlayedThisCycle.has(p));

    if (allHavePlayed) {
      nextPlayedThisCycle = new Set();
    }

    const unplayed = nextWaiting.filter(p => !nextPlayedThisCycle.has(p));
    if (unplayed.length > 0) {
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextL1      = nextL1.filter(p => !unplayed.includes(p));
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));
      ({ w1: nextW1, l1: nextL1, waiting: nextWaiting } = balancePools(nextW1, nextL1, nextWaiting));
    }

    nextPhase      = 'WINNERS';
    nextMatchIndex = 0;
  }

  const nextState: PoolSinglesState = {
    format:            'pool',
    phase:             nextPhase,
    matchIndexInPhase: nextMatchIndex,
    matchCount:        nextMatchCount,
    w1:                nextW1,
    l1:                nextL1,
    waitingQueue:      nextWaiting,
    playedThisCycle:   nextPlayedThisCycle,
    recentMatches:     updatedRecentMatches,
    lastPlayedMap:     updatedLastPlayedMap,
  };

  const nextMatch = buildNextPoolSinglesMatch(nextState, allPlayers, skillMap);
  const onCourt   = new Set([nextMatch.playerA, nextMatch.playerB]);
  const offCourt  = allPlayers.filter(p => !onCourt.has(p));
  const newQueue  = [nextMatch.playerA, nextMatch.playerB, ...offCourt];

  if (process.env.NODE_ENV !== 'production') {
    try {
      assertPoolSinglesStateConsistent(nextState, allPlayers);
    } catch (err) {
      console.error(err);
    }
  }

  return { nextState, newQueue };
}

/**
 * Guard to verify pool singles engine pool consistency:
 * - w1, l1, waitingQueue are pairwise disjoint.
 * - Every member of w1, l1, waitingQueue is in activePlayers.
 *
 * In test environment: throws Error if inconsistent.
 * In non-test environment: logs console.error without crashing or silent repair.
 */
export function assertPoolSinglesStateConsistent(
  state: PoolSinglesState,
  activePlayers: string[],
): void {
  const activeSet = new Set(activePlayers);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const unknown: string[] = [];

  for (const pool of [state.w1, state.l1, state.waitingQueue]) {
    for (const p of pool) {
      if (seen.has(p) && !duplicates.includes(p)) {
        duplicates.push(p);
      }
      seen.add(p);
      if (!activeSet.has(p) && !unknown.includes(p)) {
        unknown.push(p);
      }
    }
  }

  if (duplicates.length > 0 || unknown.length > 0) {
    const msg = `[assertPoolSinglesStateConsistent] Inconsistency detected! Duplicates: [${duplicates.join(', ')}], Unknown active players: [${unknown.join(', ')}]`;
    if (process.env.NODE_ENV === 'test') {
      throw new Error(msg);
    } else {
      console.error(msg, { state, activePlayers });
    }
  }
}

export function addPlayerToPoolSinglesWaiting(
  state: PoolSinglesState,
  playerName: string,
  priority = false,
): PoolSinglesState {
  if (
    state.w1.includes(playerName) ||
    state.l1.includes(playerName) ||
    state.waitingQueue.includes(playerName)
  ) return state;

  return {
    ...state,
    waitingQueue: priority
      ? [playerName, ...state.waitingQueue]
      : [...state.waitingQueue, playerName],
  };
}

export function removePlayerFromPoolSinglesState(state: PoolSinglesState, playerName: string): PoolSinglesState {
  const newPlayed = new Set(state.playedThisCycle);
  newPlayed.delete(playerName);

  const newLastPlayed = { ...state.lastPlayedMap };
  delete newLastPlayed[playerName];

  return {
    ...state,
    w1: state.w1.filter(p => p !== playerName),
    l1: state.l1.filter(p => p !== playerName),
    waitingQueue: state.waitingQueue.filter(p => p !== playerName),
    playedThisCycle: newPlayed,
    lastPlayedMap: newLastPlayed,
  };
}

export interface SerializablePoolSinglesState extends Omit<PoolSinglesState, 'playedThisCycle'> {
  playedThisCycle: string[];
}

export function serializePoolSinglesState(s: PoolSinglesState): SerializablePoolSinglesState {
  return {
    ...s,
    playedThisCycle: [...s.playedThisCycle],
  };
}

export function deserializePoolSinglesState(s: SerializablePoolSinglesState): PoolSinglesState {
  return {
    ...s,
    format: 'pool',
    playedThisCycle: new Set(s.playedThisCycle ?? []),
    w1: s.w1 ?? [],
    l1: s.l1 ?? [],
    waitingQueue: s.waitingQueue ?? [],
    recentMatches: s.recentMatches ?? [],
    lastPlayedMap: s.lastPlayedMap ?? {},
  };
}
