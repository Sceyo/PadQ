export interface CourtTeamModel {
  side: 'A' | 'B';
  label: string;
  players: string[];
}

export interface CourtViewModel {
  id: string;
  name: string;
  status: 'playing' | 'ready' | 'waiting';
  teams: [CourtTeamModel, CourtTeamModel];
  score: {
    enabled: boolean;
    limit: number;
    baseLimit?: number;
    scoreA: number;
    scoreB: number;
    hasStarted: boolean;
    deuce?: boolean;
    finished?: boolean;
    winner?: 'A' | 'B' | null;
  };
  pendingWinner: 'A' | 'B' | null;
  canEdit: boolean;
}

export interface QueueViewModel {
  nextUp: Array<{ name: string; priority?: boolean }>;
  waiting: Array<{ name: string; etaLabel?: string; priority?: boolean }>;
  onBreak: Array<{ name: string }>;
}

export function toSingleCourtViewModel(params: {
  queue: string[];
  suggestedTeamA?: string[] | null;
  suggestedTeamB?: string[] | null;
  liveScore?: {
    scoreA: number;
    scoreB: number;
    limit?: number;
    baseLimit?: number;
    deuce?: boolean;
    active?: boolean;
  } | null;
  canEdit?: boolean;
  gameMode?: 'singles' | 'doubles' | null;
  scoreEnabled?: boolean;
}): CourtViewModel {
  const { queue, suggestedTeamA, suggestedTeamB, liveScore, canEdit = true, gameMode = 'doubles', scoreEnabled } = params;
  const isSingles = gameMode === 'singles';
  const onCourtCount = isSingles ? 2 : 4;
  const onCourt = queue.slice(0, onCourtCount);
  const teamA = isSingles
    ? onCourt.slice(0, 1)
    : (suggestedTeamA && suggestedTeamA.length === 2 ? suggestedTeamA : onCourt.slice(0, 2));
  const teamB = isSingles
    ? onCourt.slice(1, 2)
    : (suggestedTeamB && suggestedTeamB.length === 2 ? suggestedTeamB : onCourt.slice(2, 4));
  const isPlaying = onCourt.length === onCourtCount;
  const scoreA = liveScore?.scoreA ?? 0;
  const scoreB = liveScore?.scoreB ?? 0;
  const hasStarted = scoreA > 0 || scoreB > 0;
  const baseLimit = liveScore?.baseLimit ?? liveScore?.limit ?? 11;
  const isWonA = scoreA >= baseLimit && scoreA - scoreB >= 2;
  const isWonB = scoreB >= baseLimit && scoreB - scoreA >= 2;
  const finished = isWonA || isWonB;
  const inDeuce = !finished && scoreA >= baseLimit - 1 && scoreB >= baseLimit - 1;
  const effectiveLimit = inDeuce ? Math.max(baseLimit, Math.min(scoreA, scoreB) + 2) : baseLimit;
  const enabled = scoreEnabled !== undefined ? scoreEnabled : (liveScore?.active ?? true);

  return {
    id: 'court-1',
    name: 'Court 1',
    status: isPlaying ? 'playing' : 'waiting',
    teams: [
      { side: 'A', label: isSingles ? 'Player 1' : 'Team 1', players: teamA },
      { side: 'B', label: isSingles ? 'Player 2' : 'Team 2', players: teamB },
    ],
    score: {
      enabled,
      limit: effectiveLimit,
      baseLimit,
      scoreA,
      scoreB,
      hasStarted,
      deuce: inDeuce,
      finished,
      winner: finished ? (isWonA ? 'A' : 'B') : null,
    },
    pendingWinner: null,
    canEdit: canEdit && !hasStarted && !isSingles,
  };
}

export function toSingleCourtQueueViewModel(params: {
  queue: string[];
  priorityPlayers?: string[];
  sittingOut?: string[];
  formatEta?: (position: number, onCourtCount: number, isMultiCourt: boolean) => string | null;
  gameMode?: 'singles' | 'doubles' | null;
}): QueueViewModel {
  const { queue, priorityPlayers = [], sittingOut = [], formatEta, gameMode = 'doubles' } = params;
  const groupSize = gameMode === 'singles' ? 2 : 4;
  const waitingList = queue.slice(groupSize);
  const nextUp = waitingList.slice(0, groupSize).map(name => ({
    name,
    priority: priorityPlayers.includes(name),
  }));

  // Deduplication: waiting list displays players waiting after nextUp (index groupSize+)
  const waiting = waitingList.slice(groupSize).map((name, idx) => ({
    name,
    priority: priorityPlayers.includes(name),
    etaLabel: formatEta ? (formatEta(idx + groupSize + 1, groupSize, false) ?? undefined) : undefined,
  }));

  const onBreak = sittingOut.map(name => ({ name }));

  return {
    nextUp,
    waiting,
    onBreak,
  };
}

export function toMultiCourtQueueViewModel(params: {
  waitingPlayers: string[];
  priorityPlayers?: string[];
  sittingOut?: string[];
  formatEta?: (position: number, onCourtCount: number, isMultiCourt: boolean) => string | null;
  gameMode?: 'singles' | 'doubles' | null;
}): QueueViewModel {
  const { waitingPlayers, priorityPlayers = [], sittingOut = [], formatEta, gameMode = 'doubles' } = params;
  const groupSize = gameMode === 'singles' ? 2 : 4;
  const nextUp = waitingPlayers.slice(0, groupSize).map(name => ({
    name,
    priority: priorityPlayers.includes(name),
  }));

  // Deduplication: waiting list displays players waiting after nextUp (index groupSize+)
  const waiting = waitingPlayers.slice(groupSize).map((name, idx) => ({
    name,
    priority: priorityPlayers.includes(name),
    etaLabel: formatEta ? (formatEta(idx + groupSize + 1, groupSize, true) ?? undefined) : undefined,
  }));

  const onBreak = sittingOut.map(name => ({ name }));

  return {
    nextUp,
    waiting,
    onBreak,
  };
}


export function getSingleCourtLiveScoreLabels(params: {
  queue: string[];
  gameMode?: 'singles' | 'doubles' | null;
  suggestedTeamA?: string[] | null;
  suggestedTeamB?: string[] | null;
}): { labelA: string; labelB: string } {
  const isSingles = params.gameMode === 'singles';
  if (isSingles) {
    return {
      labelA: params.queue[0] ?? 'Player 1',
      labelB: params.queue[1] ?? 'Player 2',
    };
  }
  const teamA = (params.suggestedTeamA && params.suggestedTeamA.length === 2)
    ? params.suggestedTeamA
    : params.queue.slice(0, 2);
  const teamB = (params.suggestedTeamB && params.suggestedTeamB.length === 2)
    ? params.suggestedTeamB
    : params.queue.slice(2, 4);
  return {
    labelA: teamA.join(' / ') || 'Team A',
    labelB: teamB.join(' / ') || 'Team B',
  };
}
