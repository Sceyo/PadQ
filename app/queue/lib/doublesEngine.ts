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
          let comboScore = minPairingScore;
          for (const p of [a, b, c, d]) {
            if (lastMatchPlayers.has(p)) comboScore += PENALTY_FATIGUE;
          }
          if (comboScore < bestScore) {
            bestScore = comboScore;
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

function balancePools(w1: string[], l1: string[]): { w1: string[]; l1: string[] } {
  let nextW1 = w1;
  let nextL1 = l1;
  if (nextW1.length > MAX_POOL_SIZE) {
    const overflow = nextW1.slice(0, nextW1.length - MAX_POOL_SIZE);
    nextW1 = nextW1.slice(nextW1.length - MAX_POOL_SIZE);
    nextL1 = [...overflow, ...nextL1];
  }
  if (nextL1.length > MAX_POOL_SIZE) {
    const overflow = nextL1.slice(0, nextL1.length - MAX_POOL_SIZE);
    nextL1 = nextL1.slice(nextL1.length - MAX_POOL_SIZE);
    nextW1 = [...nextW1, ...overflow];
  }
  return { w1: nextW1, l1: nextL1 };
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

  ({ w1: nextW1, l1: nextL1 } = balancePools(nextW1, nextL1));

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
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));

      nextPhase      = 'WINNERS';
      nextMatchIndex = 0;
    }
  } else if (state.phase === 'WINNERS') {
    nextPhase      = 'LOSERS';
    nextMatchIndex = 0;
  } else {
    const allHavePlayed = allPlayers.every(p => nextPlayedThisCycle.has(p));
    if (allHavePlayed) {
      nextPlayedThisCycle = new Set();
    }

    const unplayed = nextWaiting.filter(p => !nextPlayedThisCycle.has(p));
    if (unplayed.length > 0) {
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));
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
