export interface SinglesMatch {
  playerA: string;
  playerB: string;
  isForced: boolean;
}

export interface SinglesState {
  queue: string[];
  king: string | null;
  matchIndex: number;
  lastPlayedMap: Record<string, number>;
  winStreak: Record<string, number>;
  playedThisCycle: Set<string>;
  waitingQueue: string[];
}

export const SINGLES_MAX_WIN_STREAK = 3;

export function freshSinglesState(players: string[]): SinglesState {
  return {
    queue:           [...players],
    king:            null,
    matchIndex:      0,
    lastPlayedMap:   {},
    winStreak:       {},
    playedThisCycle: new Set(),
    waitingQueue:    [],
  };
}

function isFatigued(player: string, state: SinglesState): boolean {
  const last = state.lastPlayedMap[player];
  if (last === undefined) return false;
  return state.matchIndex - last <= 1;
}

function isStreakMaxed(player: string, state: SinglesState): boolean {
  return (state.winStreak[player] ?? 0) >= SINGLES_MAX_WIN_STREAK;
}

function shouldForceRotation(king: string, state: SinglesState, activePlayerCount = 3): boolean {
  if (activePlayerCount < 3) return false;
  return isStreakMaxed(king, state);
}

function selectChallenger(
  queue: string[],
  state: SinglesState,
): { challenger: string; remainingQueue: string[] } {
  if (queue.length === 0) return { challenger: '', remainingQueue: [] };
  const lastMatchIdx = state.matchIndex - 1;
  for (let i = 0; i < queue.length; i++) {
    const candidate = queue[i];
    if (candidate === state.king) continue;
    const lastPlayed = state.lastPlayedMap[candidate] ?? -1;
    if (lastPlayed !== lastMatchIdx) {
      const remaining = queue.filter((_, j) => j !== i);
      return { challenger: candidate, remainingQueue: remaining };
    }
  }
  const nonKingIdx = queue.findIndex(p => p !== state.king);
  if (nonKingIdx !== -1) {
    return {
      challenger: queue[nonKingIdx],
      remainingQueue: queue.filter((_, j) => j !== nonKingIdx),
    };
  }
  const [challenger, ...remaining] = queue;
  return { challenger, remainingQueue: remaining };
}

export function buildSinglesMatch(state: SinglesState): SinglesMatch {
  if (state.king === null) {
    return { playerA: state.queue[0] ?? '', playerB: state.queue[1] ?? '', isForced: false };
  }
  const activeCount = 1 + state.queue.length;
  if (activeCount >= 3 && shouldForceRotation(state.king, state, activeCount)) {
    return { playerA: state.queue[0] ?? '', playerB: state.queue[1] ?? '', isForced: true };
  }
  const { challenger } = selectChallenger(state.queue, state);
  return { playerA: state.king, playerB: challenger, isForced: false };
}

export function advanceSinglesState(
  state: SinglesState,
  winner: string,
  allPlayers: string[],
  priorityPlayers: string[] = [],
): { nextState: SinglesState; newQueue: string[]; consumedPriority: string[] } {
  const eligible = new Set(allPlayers);
  const merged = [...state.queue, ...state.waitingQueue].filter(
    (p, i, arr) => p && eligible.has(p) && arr.indexOf(p) === i,
  );
  const effectiveKing = state.king && eligible.has(state.king) ? state.king : null;
  let nextQueue = effectiveKing ? merged.filter(p => p !== effectiveKing) : merged;
  for (const p of allPlayers) {
    if (p !== effectiveKing && !nextQueue.includes(p)) {
      nextQueue.push(p);
    }
  }
  const nextWaiting: string[] = [];

  const normalizedState: SinglesState = {
    ...state,
    king: effectiveKing,
    queue: nextQueue,
    waitingQueue: [],
  };
  const match     = buildSinglesMatch(normalizedState);
  const loser     = match.playerA === winner ? match.playerB : match.playerA;
  const wasInit   = effectiveKing === null;
  const activeCount = (effectiveKing ? 1 : 0) + nextQueue.length;
  const wasForced = !wasInit && activeCount >= 3 && shouldForceRotation(effectiveKing!, normalizedState, activeCount);

  const nextLastPlayedMap: Record<string, number> = { ...state.lastPlayedMap };
  nextLastPlayedMap[match.playerA] = state.matchIndex;
  nextLastPlayedMap[match.playerB] = state.matchIndex;

  const newPlayed = new Set(state.playedThisCycle);
  newPlayed.add(match.playerA);
  newPlayed.add(match.playerB);

  const allHavePlayed = allPlayers.every(p => newPlayed.has(p));
  const nextPlayedThisCycle = allHavePlayed ? new Set<string>() : newPlayed;

  let nextKing: string | null;
  const nextWinStreak: Record<string, number> = { ...state.winStreak };

  if (wasInit) {
    nextQueue = nextQueue.filter(p => p !== match.playerA && p !== match.playerB);
    nextQueue = [...nextQueue, loser];
    nextKing  = winner;
    nextWinStreak[winner] = 1;
  } else if (wasForced) {
    const oldKing = effectiveKing!;
    const actualLoser = [match.playerA, match.playerB, oldKing].find(
      p => p && p !== winner && (p === match.playerA || p === match.playerB || p === oldKing),
    ) ?? loser;
    nextQueue = nextQueue.filter(p => p !== winner && p !== actualLoser && p !== oldKing);
    if (actualLoser !== oldKing) {
      nextQueue = [...nextQueue, actualLoser, oldKing];
    } else {
      nextQueue = [...nextQueue, oldKing];
    }
    nextKing  = winner;
    nextWinStreak[oldKing] = 0;
    nextWinStreak[winner]  = 1;
  } else {
    const { remainingQueue } = selectChallenger(nextQueue, normalizedState);
    nextQueue = remainingQueue;
    if (winner === effectiveKing) {
      nextKing = effectiveKing;
      nextWinStreak[nextKing] = (nextWinStreak[nextKing] ?? 0) + 1;
      nextQueue = [...nextQueue, loser];
    } else {
      const oldKing = effectiveKing!;
      nextKing = winner;
      nextWinStreak[oldKing] = 0;
      nextWinStreak[nextKing] = 1;
      nextQueue = [...nextQueue, oldKing];
    }
  }

  for (const p of allPlayers) {
    if (p !== nextKing && !nextQueue.includes(p)) {
      nextQueue.push(p);
    }
  }

  if (priorityPlayers.length > 0) {
    const priorityEligible = priorityPlayers.filter(
      (p, idx, arr) => eligible.has(p) && p !== nextKing && arr.indexOf(p) === idx,
    );
    if (priorityEligible.length > 0) {
      const prioritySet = new Set(priorityEligible);
      const restQueue = nextQueue.filter(p => !prioritySet.has(p));
      nextQueue = [...priorityEligible, ...restQueue];
    }
  }

  const nextState: SinglesState = {
    queue:           nextQueue,
    king:            nextKing,
    matchIndex:      state.matchIndex + 1,
    lastPlayedMap:   nextLastPlayedMap,
    winStreak:       nextWinStreak,
    playedThisCycle: nextPlayedThisCycle,
    waitingQueue:    nextWaiting,
  };

  const nextMatch = buildSinglesMatch(nextState);
  const onCourt = [nextMatch.playerA, nextMatch.playerB].filter(Boolean);
  const onCourtSet = new Set(onCourt);
  const restQueue = (nextKing ? [nextKing, ...nextQueue] : [...nextQueue]).filter(p => p && !onCourtSet.has(p));
  const newQueue = [...onCourt, ...restQueue];
  const consumedPriority = priorityPlayers.filter(
    (p, idx, arr) => onCourt.includes(p) && arr.indexOf(p) === idx,
  );
  return { nextState, newQueue, consumedPriority };
}

export function addPlayerToSinglesWaiting(
  state: SinglesState,
  playerName: string,
  priority = false,
): SinglesState {
  if (
    state.queue.includes(playerName) ||
    state.king === playerName ||
    state.waitingQueue.includes(playerName)
  ) return state;
  return {
    ...state,
    waitingQueue: priority
      ? [playerName, ...state.waitingQueue]
      : [...state.waitingQueue, playerName],
  };
}

export interface SerializableSinglesState extends Omit<SinglesState, 'playedThisCycle'> {
  playedThisCycle: string[];
}

export function serializeSinglesState(s: SinglesState): SerializableSinglesState {
  return { ...s, playedThisCycle: [...s.playedThisCycle] };
}

export function deserializeSinglesState(s: SerializableSinglesState): SinglesState {
  return { ...s, playedThisCycle: new Set(s.playedThisCycle) };
}
