import { shuffleArray } from './playerUtils';

export type CyclePhase = 'INIT' | 'WINNERS' | 'LOSERS';
export type Team = [string, string];

export interface Match {
  teamA: Team;
  teamB: Team;
}

export interface PaddleState {
  phase: CyclePhase;
  matchIndexInPhase: number;
  matchCount: number;
  w1: string[];
  l1: string[];
  waitingQueue: string[];
  playedThisCycle: Set<string>;
  recentPairs: string[];
  recentMatches: string[];
  lastPlayedMap: Record<string, number>;
  winnersPool: Team[];
  losersPool: Team[];
}

const RECENT_PAIRS_CAP    = 6;
const RECENT_MATCHES_CAP  = 4;
const SELECTION_WINDOW    = 8;
const MAX_POOL_SIZE        = 8;
const MAX_SHUFFLE_ATTEMPTS = 6;

const PENALTY_REPEAT_PAIR    = 3;
const PENALTY_REPEAT_MATCH   = 5;
const PENALTY_FATIGUE        = 2;
const PENALTY_SKILL_IMBALANCE = 1;

function toTeamArray(players: string[]): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    teams.push([players[i], players[i + 1]] as Team);
  }
  return teams;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

export function teamPairKey(teamA: Team, teamB: Team): string {
  const ka = [...teamA].sort().join('+');
  const kb = [...teamB].sort().join('+');
  return [ka, kb].sort().join('|');
}

function scoreCandidate(
  teamA: Team,
  teamB: Team,
  recentPairs: string[],
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number>,
): number {
  let score = 0;
  if (recentPairs.includes(pairKey(teamA[0], teamA[1]))) score += PENALTY_REPEAT_PAIR;
  if (recentPairs.includes(pairKey(teamB[0], teamB[1]))) score += PENALTY_REPEAT_PAIR;
  if (recentMatches.includes(teamPairKey(teamA, teamB))) score += PENALTY_REPEAT_MATCH;
  for (const p of [...teamA, ...teamB]) {
    if (lastMatchPlayers.has(p)) score += PENALTY_FATIGUE;
  }
  if (Object.keys(skillMap).length > 0) {
    const skillA = (skillMap[teamA[0]] ?? 50) + (skillMap[teamA[1]] ?? 50);
    const skillB = (skillMap[teamB[0]] ?? 50) + (skillMap[teamB[1]] ?? 50);
    score += Math.abs(skillA - skillB) * PENALTY_SKILL_IMBALANCE;
  }
  return score;
}

function allPairings(players: [string, string, string, string]): Array<{ teamA: Team; teamB: Team }> {
  const [a, b, c, d] = players;
  return [
    { teamA: [a, b] as Team, teamB: [c, d] as Team },
    { teamA: [a, c] as Team, teamB: [b, d] as Team },
    { teamA: [a, d] as Team, teamB: [b, c] as Team },
  ];
}

function lastMatchPlayerSet(recentMatches: string[]): Set<string> {
  if (!recentMatches.length) return new Set();
  const last = recentMatches[recentMatches.length - 1];
  return new Set(last.split(/[|+]/));
}

function formTeams(
  p1: string, p2: string, p3: string, p4: string,
  recentPairs: string[],
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number> = {},
): { teamA: Team; teamB: Team } {
  const players: [string, string, string, string] = [p1, p2, p3, p4];
  // allPairings enumerates all 3 distinct splits of 4 players exhaustively.
  // Shuffling before calling it produces the same 3 splits after pairKey
  // normalisation, so the old shuffle loop added noise with no benefit.
  const candidates = allPairings(players).map(c => ({
    ...c,
    score: scoreCandidate(c.teamA, c.teamB, recentPairs, recentMatches, lastMatchPlayers, skillMap),
  }));
  candidates.sort((a, b) => a.score - b.score);
  return { teamA: candidates[0].teamA, teamB: candidates[0].teamB };
}

function smartSelectPool(
  candidates: string[],
  recentPairs: string[],
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number>,
): string[] {
  const window = candidates.slice(0, SELECTION_WINDOW);
  if (window.length <= 4) return window.slice(0, 4);

  let bestScore = Infinity;
  let bestCombo: string[] = window.slice(0, 4);

  for (let i = 0; i < window.length - 3; i++) {
    for (let j = i + 1; j < window.length - 2; j++) {
      for (let k = j + 1; k < window.length - 1; k++) {
        for (let l = k + 1; l < window.length; l++) {
          const [a, b, c, d] = [window[i], window[j], window[k], window[l]];
          const pairings = allPairings([a, b, c, d] as [string, string, string, string]);
          const minPairingScore = Math.min(
            ...pairings.map(p =>
              scoreCandidate(p.teamA, p.teamB, recentPairs, recentMatches, lastMatchPlayers, skillMap),
            ),
          );
          if (minPairingScore < bestScore) {
            bestScore = minPairingScore;
            bestCombo = [a, b, c, d];
          }
        }
      }
    }
  }
  return bestCombo;
}

export function swapPartners(
  pairA: Team,
  pairB: Team,
  history: string[],
): { teamA: Team; teamB: Team } {
  const primary   = { teamA: [pairA[0], pairB[0]] as Team, teamB: [pairA[1], pairB[1]] as Team };
  const alternate = { teamA: [pairA[0], pairB[1]] as Team, teamB: [pairA[1], pairB[0]] as Team };
  return history.includes(teamPairKey(primary.teamA, primary.teamB)) ? alternate : primary;
}

function balancePools(
  w1:      string[],
  l1:      string[],
  waiting: string[] = [],
): { w1: string[]; l1: string[]; waiting: string[] } {
  let nextW1      = w1;
  let nextL1      = l1;
  let nextWaiting = waiting;

  // Loop (rather than a single corrective pass) because moving w1's
  // overflow into l1 can itself push l1 over the cap, and that
  // re-inflation needs to be re-checked — a single if/if pass left w1
  // free to grow unbounded once both pools hit MAX_POOL_SIZE at the same
  // time (see: long INIT phase with 30+ players, where every round adds
  // 2 players to each pool in lockstep).
  //
  // Once a single bounce between just w1/l1 can no longer make progress
  // (both still over cap, but trimming one would just re-inflate the
  // other past it) the true excess is routed into `waiting` instead of
  // being left to sit oversized in either pool — this is the same
  // release valve the INIT->WINNERS transition already uses for players
  // who haven't been seeded into a match yet, so it's consistent with
  // how the rest of the engine treats "exists but not currently active."
  let progressed = true;
  while (progressed && (nextW1.length > MAX_POOL_SIZE || nextL1.length > MAX_POOL_SIZE)) {
    progressed = false;

    if (nextW1.length > MAX_POOL_SIZE) {
      // Trim from the back — front entries have priority (most recently
      // injected or most deserving of next play).
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

  // Either both pools are now within cap, or bouncing further between
  // just the two of them can't make progress (combined size > 2 *
  // MAX_POOL_SIZE). In the latter case, drain genuine excess into
  // `waiting` so both pools end up exactly at the cap.
  // Trim from the BACK (oldest/most-established entries at the tail),
  // not the front — callers prepend priority players to the front, so
  // front-trimming would immediately re-evict the very players that were
  // just injected to get priority treatment.
  if (nextW1.length > MAX_POOL_SIZE) {
    const overflow = nextW1.slice(MAX_POOL_SIZE);
    nextW1 = nextW1.slice(0, MAX_POOL_SIZE);
    nextWaiting = [...nextWaiting, ...overflow];
  }
  if (nextL1.length > MAX_POOL_SIZE) {
    const overflow = nextL1.slice(MAX_POOL_SIZE);
    nextL1 = nextL1.slice(0, MAX_POOL_SIZE);
    nextWaiting = [...nextWaiting, ...overflow];
  }

  return { w1: nextW1, l1: nextL1, waiting: nextWaiting };
}

export function freshPaddleState(): PaddleState {
  return {
    phase: 'INIT',
    matchIndexInPhase: 0,
    matchCount: 0,
    w1: [],
    l1: [],
    waitingQueue: [],
    playedThisCycle: new Set(),
    recentPairs: [],
    recentMatches: [],
    lastPlayedMap: {},
    winnersPool: [],
    losersPool: [],
  };
}

function fallbackMatch(available: string[]): Match {
  const unique = available.filter((p, i, a) => p && a.indexOf(p) === i);
  return {
    teamA: [unique[0] ?? '', unique[1] ?? ''] as Team,
    teamB: [unique[2] ?? '', unique[3] ?? ''] as Team,
  };
}

export function buildNextMatch(
  state: PaddleState,
  allPlayers: string[],
  skillMap: Record<string, number> = {},
): Match {
  const lastMatchPlayers = lastMatchPlayerSet(state.recentMatches);

  if (state.phase === 'INIT') {
    const base = state.matchIndexInPhase * 4;
    const pool = allPlayers.slice(base, base + 4);
    const padded =
      pool.length >= 4
        ? pool
        : [...pool, ...allPlayers.filter(p => !pool.includes(p))].slice(0, 4);
    if (padded.length < 4) return fallbackMatch(padded);
    return formTeams(padded[0], padded[1], padded[2], padded[3], state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap);
  }

  if (state.phase === 'WINNERS') {
    let candidates = [...state.w1];
    if (candidates.length < 4) {
      candidates = [...candidates, ...state.l1.slice(0, 4 - candidates.length)];
    }
    if (candidates.length < 4) return fallbackMatch(candidates);
    const selected = smartSelectPool(candidates, state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap);
    if (selected.length < 4) return fallbackMatch(selected);
    return formTeams(selected[0], selected[1], selected[2], selected[3], state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap);
  }

  let candidates = [...state.l1];
  if (candidates.length < 4) {
    candidates = [...candidates, ...state.w1.slice(0, 4 - candidates.length)];
  }
  if (candidates.length < 4) return fallbackMatch(candidates);
  const selected = smartSelectPool(candidates, state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap);
  if (selected.length < 4) return fallbackMatch(selected);
  return formTeams(selected[0], selected[1], selected[2], selected[3], state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap);
}

export function advancePaddleState(
  state: PaddleState,
  winnerTeam: Team,
  loserTeam: Team,
  allPlayers: string[],
  skillMap: Record<string, number> = {},
): { nextState: PaddleState; newQueue: string[] } {
  const allFour        = [...winnerTeam, ...loserTeam];
  const nextMatchCount = state.matchCount + 1;

  const updatedRecentPairs = [
    ...state.recentPairs,
    pairKey(winnerTeam[0], winnerTeam[1]),
    pairKey(loserTeam[0],  loserTeam[1]),
  ].slice(-(RECENT_PAIRS_CAP * 2));

  const updatedRecentMatches = [
    ...state.recentMatches,
    teamPairKey(winnerTeam, loserTeam),
  ].slice(-RECENT_MATCHES_CAP);

  const updatedLastPlayedMap: Record<string, number> = { ...state.lastPlayedMap };
  for (const p of allFour) {
    updatedLastPlayedMap[p] = state.matchCount;
  }

  const newPlayed = new Set(state.playedThisCycle);
  allFour.forEach(p => newPlayed.add(p));

  const playedSet   = new Set(allFour);
  let   nextW1      = state.w1.filter(p => !playedSet.has(p));
  let   nextL1      = state.l1.filter(p => !playedSet.has(p));
  let   nextWaiting = state.waitingQueue.filter(p => !playedSet.has(p));

  nextW1 = [...nextW1, ...winnerTeam];
  nextL1 = [...nextL1, ...loserTeam];

  ({ w1: nextW1, l1: nextL1, waiting: nextWaiting } = balancePools(nextW1, nextL1, nextWaiting));

  let nextPhase           = state.phase;
  let nextMatchIndex      = state.matchIndexInPhase + 1;
  let nextPlayedThisCycle = newPlayed;

  if (state.phase === 'INIT') {
    const initMatchesNeeded = Math.max(1, Math.floor(allPlayers.length / 4));
    if (nextMatchIndex >= initMatchesNeeded) {
      const seededSet = new Set(allPlayers.slice(0, initMatchesNeeded * 4));
      const overflow  = allPlayers.filter(p => !seededSet.has(p) && !nextWaiting.includes(p));
      nextWaiting = [...nextWaiting, ...overflow];

      const unplayed = nextWaiting.filter(p => !nextPlayedThisCycle.has(p));
      // Prepend unplayed players so they get priority; balancePools trims
      // from the back, so newly-injected front-entries are preserved.
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));
      ({ w1: nextW1, l1: nextL1, waiting: nextWaiting } = balancePools(nextW1, nextL1, nextWaiting));

      nextPhase      = 'WINNERS';
      nextMatchIndex = 0;
    }
  } else if (state.phase === 'WINNERS') {
    nextPhase      = 'LOSERS';
    nextMatchIndex = 0;
  } else {
    // Only consider players who are actively in rotation (w1 or l1) or
    // have already played this cycle. Players still parked in waitingQueue
    // haven't entered the rotation yet — requiring them to appear in
    // playedThisCycle before the cycle resets creates a permanent deadlock
    // for any player who was never seeded in INIT (e.g. the last 1-3
    // players in a non-divisible-by-4 pool), since they'd block the cycle
    // from ever resetting and therefore never get injected via `unplayed`.
    const activePlayers = new Set([...nextW1, ...nextL1, ...nextPlayedThisCycle]);
    const allHavePlayed = [...activePlayers].every(p => nextPlayedThisCycle.has(p));
    if (allHavePlayed) {
      nextPlayedThisCycle = new Set();
    }

    const unplayed = nextWaiting.filter(p => !nextPlayedThisCycle.has(p));
    if (unplayed.length > 0) {
      // Prepend unplayed players to give them priority — they displace
      // existing w1 occupants who'll flow to waiting via balancePools.
      // balancePools now trims from the back (oldest/most-established
      // entries) rather than the front, so the newly-injected unplayed
      // players at the front are preserved, not immediately re-evicted.
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));
      ({ w1: nextW1, l1: nextL1, waiting: nextWaiting } = balancePools(nextW1, nextL1, nextWaiting));
    }

    nextPhase      = 'WINNERS';
    nextMatchIndex = 0;
  }

  const nextWinnersPool = toTeamArray(nextW1);
  const nextLosersPool  = toTeamArray(nextL1);

  const nextState: PaddleState = {
    phase:             nextPhase,
    matchIndexInPhase: nextMatchIndex,
    matchCount:        nextMatchCount,
    w1:                nextW1,
    l1:                nextL1,
    waitingQueue:      nextWaiting,
    playedThisCycle:   nextPlayedThisCycle,
    recentPairs:       updatedRecentPairs,
    recentMatches:     updatedRecentMatches,
    lastPlayedMap:     updatedLastPlayedMap,
    winnersPool:       nextWinnersPool,
    losersPool:        nextLosersPool,
  };

  const nextMatch = buildNextMatch(nextState, allPlayers, skillMap);
  const onCourt   = new Set([...nextMatch.teamA, ...nextMatch.teamB]);
  const offCourt  = allPlayers.filter(p => !onCourt.has(p));
  const newQueue  = [...nextMatch.teamA, ...nextMatch.teamB, ...offCourt];

  return { nextState, newQueue };
}

export function addPlayerToWaiting(state: PaddleState, playerName: string): PaddleState {
  if (
    state.waitingQueue.includes(playerName) ||
    state.w1.includes(playerName) ||
    state.l1.includes(playerName)
  ) return state;
  return { ...state, waitingQueue: [...state.waitingQueue, playerName] };
}

// Firestore does not support nested arrays, so Team ([string, string]) must be
// stored as an object and converted back on load.
type SerializableTeam = { a: string; b: string };

export interface SerializablePaddleState extends Omit<PaddleState, 'playedThisCycle' | 'winnersPool' | 'losersPool'> {
  playedThisCycle: string[];
  winnersPool: SerializableTeam[];
  losersPool:  SerializableTeam[];
}

export function serializePaddleState(s: PaddleState): SerializablePaddleState {
  return {
    ...s,
    playedThisCycle: [...s.playedThisCycle],
    winnersPool: s.winnersPool.map(([a, b]) => ({ a, b })),
    losersPool:  s.losersPool.map(([a, b]) => ({ a, b })),
  };
}

export function deserializePaddleState(s: SerializablePaddleState): PaddleState {
  return {
    ...s,
    playedThisCycle: new Set(s.playedThisCycle),
    winnersPool: s.winnersPool.map(t => [t.a, t.b] as Team),
    losersPool:  s.losersPool.map(t => [t.a, t.b] as Team),
  };
}