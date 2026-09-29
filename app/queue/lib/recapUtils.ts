import type { PlayerStat, MatchHistoryEntry } from './types';

export interface StandoutHighlight {
  label: string;
  value: string;
  subtext?: string;
}

export interface SessionRecapData {
  totalMatches: number;
  totalPlayers: number;
  sortedPlayers: PlayerStat[];
  podium: PlayerStat[];
  runnersUp: PlayerStat[];
  topStreakPlayer: PlayerStat | null;
  mostWinsPlayer: PlayerStat | null;
  highestWinRatePlayer: PlayerStat | null;
  highlights: StandoutHighlight[];
}

export function computeSessionRecap(
  stats: PlayerStat[],
  history: MatchHistoryEntry[] = [],
): SessionRecapData {
  const totalMatches = history.length;
  const totalPlayers = stats.length;

  // Sort players by: wins DESC, then winRate DESC, then gamesPlayed DESC, then name ASC
  const sortedPlayers = [...stats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    return a.name.localeCompare(b.name);
  });

  const podium = sortedPlayers.slice(0, 3);
  const runnersUp = sortedPlayers.slice(3);

  // Notable standout stats (only when games have been played)
  const activePlayers = sortedPlayers.filter(p => p.gamesPlayed > 0);

  const topStreakPlayer =
    activePlayers.reduce<PlayerStat | null>((best, p) => {
      if (p.streak >= 2 && (!best || p.streak > best.streak)) return p;
      return best;
    }, null);

  const mostWinsPlayer =
    activePlayers.length > 0 && activePlayers[0].wins > 0 ? activePlayers[0] : null;

  const highestWinRatePlayer =
    activePlayers.reduce<PlayerStat | null>((best, p) => {
      if (p.wins === 0) return best;
      if (!best) return p;
      if (p.winRate > best.winRate) return p;
      if (p.winRate === best.winRate && p.wins > best.wins) return p;
      return best;
    }, null);

  const highlights: StandoutHighlight[] = [];

  highlights.push({
    label: 'Total Matches',
    value: String(totalMatches),
    subtext: totalMatches === 1 ? '1 Match Played' : `${totalMatches} Matches Played`,
  });

  if (mostWinsPlayer) {
    highlights.push({
      label: 'Most Wins',
      value: `${mostWinsPlayer.wins}W`,
      subtext: mostWinsPlayer.name,
    });
  }

  if (topStreakPlayer) {
    highlights.push({
      label: 'Best Streak',
      value: `🔥 ${topStreakPlayer.streak}`,
      subtext: topStreakPlayer.name,
    });
  } else if (highestWinRatePlayer) {
    highlights.push({
      label: 'Peak Win Rate',
      value: `${highestWinRatePlayer.winRate}%`,
      subtext: highestWinRatePlayer.name,
    });
  }

  return {
    totalMatches,
    totalPlayers,
    sortedPlayers,
    podium,
    runnersUp,
    topStreakPlayer,
    mostWinsPlayer,
    highestWinRatePlayer,
    highlights,
  };
}

export function formatRecapDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();
}
