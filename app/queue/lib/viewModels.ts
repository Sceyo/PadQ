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
    scoreA: number;
    scoreB: number;
    hasStarted: boolean;
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
  liveScore?: { scoreA: number; scoreB: number; limit?: number; active?: boolean } | null;
  canEdit?: boolean;
}): CourtViewModel {
  const { queue, suggestedTeamA, suggestedTeamB, liveScore, canEdit = true } = params;
  const firstFour = queue.slice(0, 4);
  const teamA = suggestedTeamA && suggestedTeamA.length === 2 ? suggestedTeamA : firstFour.slice(0, 2);
  const teamB = suggestedTeamB && suggestedTeamB.length === 2 ? suggestedTeamB : firstFour.slice(2, 4);
  const isPlaying = firstFour.length === 4;
  const scoreA = liveScore?.scoreA ?? 0;
  const scoreB = liveScore?.scoreB ?? 0;
  const hasStarted = scoreA > 0 || scoreB > 0;
  const limit = liveScore?.limit ?? 11;
  const enabled = liveScore?.active ?? true;

  return {
    id: 'court-1',
    name: 'Court 1',
    status: isPlaying ? 'playing' : 'waiting',
    teams: [
      { side: 'A', label: 'Team 1', players: teamA },
      { side: 'B', label: 'Team 2', players: teamB },
    ],
    score: {
      enabled,
      limit,
      scoreA,
      scoreB,
      hasStarted,
    },
    pendingWinner: null,
    canEdit: canEdit && !hasStarted,
  };
}

export function toSingleCourtQueueViewModel(params: {
  queue: string[];
  priorityPlayers?: string[];
  sittingOut?: string[];
  formatEta?: (position: number, onCourtCount: number, isMultiCourt: boolean) => string | null;
}): QueueViewModel {
  const { queue, priorityPlayers = [], sittingOut = [], formatEta } = params;
  const waitingList = queue.slice(4);
  const nextUp = waitingList.slice(0, 4).map(name => ({
    name,
    priority: priorityPlayers.includes(name),
  }));

  // Deduplication: waiting list displays players waiting after nextUp (index 4+)
  const waiting = waitingList.slice(4).map((name, idx) => ({
    name,
    priority: priorityPlayers.includes(name),
    etaLabel: formatEta ? (formatEta(idx + 5, 4, false) ?? undefined) : undefined,
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
}): QueueViewModel {
  const { waitingPlayers, priorityPlayers = [], sittingOut = [], formatEta } = params;
  const nextUp = waitingPlayers.slice(0, 4).map(name => ({
    name,
    priority: priorityPlayers.includes(name),
  }));

  // Deduplication: waiting list displays players waiting after nextUp (index 4+)
  const waiting = waitingPlayers.slice(4).map((name, idx) => ({
    name,
    priority: priorityPlayers.includes(name),
    etaLabel: formatEta ? (formatEta(idx + 5, 4, true) ?? undefined) : undefined,
  }));

  const onBreak = sittingOut.map(name => ({ name }));

  return {
    nextUp,
    waiting,
    onBreak,
  };
}
