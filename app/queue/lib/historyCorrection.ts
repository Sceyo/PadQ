import type { MatchHistoryEntry } from '@/lib/sessionService';

/**
 * Flips the winner of a match history entry between Team A and Team B,
 * reversing the score string if present.
 */
export function flipHistoryEntryWinner(
  entry: MatchHistoryEntry,
  newScore?: string,
): MatchHistoryEntry {
  const parts = entry.players.split(' vs ');
  if (parts.length < 2) {
    return { ...entry, ...(newScore !== undefined ? { score: newScore } : {}) };
  }

  const teamA = parts[0].trim();
  const teamB = parts[1].trim();

  let nextWinner = entry.winner;
  if (entry.winner === teamA) {
    nextWinner = teamB;
  } else if (entry.winner === teamB) {
    nextWinner = teamA;
  } else {
    nextWinner = entry.winner.includes(teamA) ? teamB : teamA;
  }

  let nextScore = entry.score;
  if (newScore !== undefined) {
    nextScore = newScore;
  } else if (entry.score) {
    const match = entry.score.match(/^(\d+)(\s*[-–:]\s*)(\d+)$/);
    if (match) {
      const [, s1, sep, s2] = match;
      nextScore = `${s2}${sep}${s1}`;
    }
  }

  return {
    ...entry,
    winner: nextWinner,
    ...(nextScore !== undefined ? { score: nextScore } : {}),
  };
}
