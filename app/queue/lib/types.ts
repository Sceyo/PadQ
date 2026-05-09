export interface MatchHistoryEntry {
  id: number; mode: string; players: string;
  winner: string; score?: string; timestamp: string;
}
export interface PlayerStat {
  name: string; wins: number; losses: number;
  gamesPlayed: number; winRate: number; streak: number; rank: RankTier;
}
export type RankTier        = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
export type EliminationType = 'single' | 'double';
export type QueueMode       = 'default' | 'tournament' | 'playall';
export type GameTab         = 'queue' | 'analytics';

export interface TournamentMatch {
  id: number; round: number; slot: number; bracket: 'W' | 'L' | 'GF';
  player1: string | null; player2: string | null;
  winner: string | null; loser: string | null; isBye: boolean;
}
export interface SmartSuggestion {
  type: 'overused' | 'underused' | 'hot-streak' | 'team-balance';
  message: string; players: string[];
}
