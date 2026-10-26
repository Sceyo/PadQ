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
