import { describe, it, expect } from 'vitest';
import { computeSessionRecap, formatRecapDate } from '@/app/queue/lib/recapUtils';
import type { PlayerStat, MatchHistoryEntry } from '@/app/queue/lib/types';

describe('computeSessionRecap', () => {
  it('handles empty stats gracefully', () => {
    const recap = computeSessionRecap([], []);
    expect(recap.totalMatches).toBe(0);
    expect(recap.totalPlayers).toBe(0);
    expect(recap.podium).toHaveLength(0);
    expect(recap.runnersUp).toHaveLength(0);
    expect(recap.mostWinsPlayer).toBeNull();
    expect(recap.topStreakPlayer).toBeNull();
    expect(recap.highlights[0].value).toBe('0');
  });

  it('correctly ranks top 3 podium and separates runners-up', () => {
    const mockStats: PlayerStat[] = [
      { name: 'Alex', wins: 5, losses: 1, gamesPlayed: 6, winRate: 83, streak: 3, rank: 'Diamond' },
      { name: 'Blake', wins: 4, losses: 2, gamesPlayed: 6, winRate: 67, streak: 2, rank: 'Platinum' },
      { name: 'Charlie', wins: 3, losses: 3, gamesPlayed: 6, winRate: 50, streak: 0, rank: 'Gold' },
      { name: 'Dana', wins: 2, losses: 4, gamesPlayed: 6, winRate: 33, streak: 1, rank: 'Silver' },
      { name: 'Evan', wins: 1, losses: 5, gamesPlayed: 6, winRate: 17, streak: 0, rank: 'Bronze' },
    ];

    const mockHistory: MatchHistoryEntry[] = [
      { id: 1, mode: 'doubles', players: 'Alex & Blake vs Charlie & Dana', winner: 'Alex & Blake', timestamp: '10:00 AM' },
      { id: 2, mode: 'doubles', players: 'Alex & Charlie vs Blake & Evan', winner: 'Alex & Charlie', timestamp: '10:15 AM' },
    ];

    const recap = computeSessionRecap(mockStats, mockHistory);

    expect(recap.totalMatches).toBe(2);
    expect(recap.totalPlayers).toBe(5);
    expect(recap.podium.map(p => p.name)).toEqual(['Alex', 'Blake', 'Charlie']);
    expect(recap.runnersUp.map(p => p.name)).toEqual(['Dana', 'Evan']);
    expect(recap.mostWinsPlayer?.name).toBe('Alex');
    expect(recap.topStreakPlayer?.name).toBe('Alex');
  });

  it('handles ties by checking win rate, games played, and alphabetical name', () => {
    const tiedStats: PlayerStat[] = [
      { name: 'Bob', wins: 3, losses: 2, gamesPlayed: 5, winRate: 60, streak: 1, rank: 'Gold' },
      { name: 'Alice', wins: 3, losses: 1, gamesPlayed: 4, winRate: 75, streak: 2, rank: 'Gold' },
    ];

    const recap = computeSessionRecap(tiedStats, []);
    expect(recap.sortedPlayers[0].name).toBe('Alice');
    expect(recap.sortedPlayers[1].name).toBe('Bob');
  });

  it('formats dates cleanly in sports uppercase format', () => {
    const fixedDate = new Date(2026, 8, 19); // Sep 19, 2026
    const formatted = formatRecapDate(fixedDate);
    expect(formatted).toBe('SEP 19, 2026');
  });
});
