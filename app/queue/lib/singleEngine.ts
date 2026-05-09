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

function shouldForceRotation(king: string, state: SinglesState): boolean {
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
    const lastPlayed = state.lastPlayedMap[candidate] ?? -1;
    if (lastPlayed !== lastMatchIdx) {
      const remaining = queue.filter((_, j) => j !== i);
      return { challenger: candidate, remainingQueue: remaining };
    }
  }
  const [challenger, ...remaining] = queue;
  return { challenger, remainingQueue: remaining };
}

export function buildSinglesMatch(state: SinglesState): SinglesMatch {
  if (state.king === null) {
    return { playerA: state.queue[0] ?? '', playerB: state.queue[1] ?? '', isForced: false };
  }
  if (shouldForceRotation(state.king, state)) {
    return { playerA: state.queue[0] ?? '', playerB: state.queue[1] ?? '', isForced: true };
  }
  const { challenger } = selectChallenger(state.queue, state);
  return { playerA: state.king, playerB: challenger, isForced: false };
}

export function advanceSinglesState(
  state: SinglesState,
  winner: string,
  allPlayers: string[],
): { nextState: SinglesState; newQueue: string[] } {
  let nextQueue   = [...state.queue, ...state.waitingQueue];
  let nextWaiting: string[] = [];

  const match     = buildSinglesMatch(state);
  const loser     = match.playerA === winner ? match.playerB : match.playerA;
  const wasInit   = state.king === null;
  const wasForced = !wasInit && shouldForceRotation(state.king!, state);

  const nextLastPlayedMap: Record<string, number> = { ...state.lastPlayedMap };
  nextLastPlayedMap[match.playerA] = state.matchIndex;
  nextLastPlayedMap[match.playerB] = state.matchIndex;

  const newPlayed = new Set(state.playedThisCycle);
  newPlayed.add(match.playerA);
  newPlayed.add(match.playerB);

  const allHavePlayed = allPlayers.every(p => newPlayed.has(p));
  const nextPlayedThisCycle = allHavePlayed ? new Set<string>() : newPlayed;

  let nextKing: string | null;
  let nextWinStreak: Record<string, number> = { ...state.winStreak };

  if (wasInit) {
    nextQueue = nextQueue.filter(p => p !== match.playerA && p !== match.playerB);
    nextQueue = [...nextQueue, loser];
    nextKing  = winner;
    nextWinStreak[winner] = 1;
  } else if (wasForced) {
    const oldKing = state.king!;
    nextQueue = nextQueue.filter(p => p !== match.playerA && p !== match.playerB);
    nextQueue = [...nextQueue, loser, oldKing];
    nextKing  = winner;
    nextWinStreak[oldKing] = 0;
    nextWinStreak[winner]  = 1;
  } else {
    const { remainingQueue } = selectChallenger(nextQueue, state);
    nextQueue = remainingQueue;
    if (winner === state.king) {
      nextKing = state.king;
      nextWinStreak[nextKing] = (nextWinStreak[nextKing] ?? 0) + 1;
      nextQueue = [...nextQueue, loser];
    } else {
      const oldKing = state.king!;
      nextKing = winner;
      nextWinStreak[oldKing] = 0;
      nextWinStreak[nextKing] = 1;
      nextQueue = [...nextQueue, oldKing];
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

  const newQueue = nextKing ? [nextKing, ...nextQueue] : [...nextQueue];
  return { nextState, newQueue };
}

export function addPlayerToSinglesWaiting(state: SinglesState, playerName: string): SinglesState {
  if (
    state.queue.includes(playerName) ||
    state.king === playerName ||
    state.waitingQueue.includes(playerName)
  ) return state;
  return { ...state, waitingQueue: [...state.waitingQueue, playerName] };
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
