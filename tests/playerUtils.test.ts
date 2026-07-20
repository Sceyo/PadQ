import { describe, it, expect } from 'vitest';
import { bracketSkillValue, calcRank, buildPlayerStats, generateSuggestions } from '@/app/queue/lib/playerUtils';
import type { MatchHistoryEntry } from '@/app/queue/lib/types';

describe('playerUtils — bracketSkillValue', () => {
  it('maps beginner/intermediate/advanced to 25/50/75', () => {
    expect(bracketSkillValue('beginner')).toBe(25);
    expect(bracketSkillValue('intermediate')).toBe(50);
    expect(bracketSkillValue('advanced')).toBe(75);
  });

  it('defaults to 50 when undefined', () => {
    expect(bracketSkillValue(undefined)).toBe(50);
  });
});

describe('playerUtils — calcRank', () => {
  it('always returns Bronze under 3 games played, regardless of win rate', () => {
    expect(calcRank(100, 0)).toBe('Bronze');
    expect(calcRank(100, 2)).toBe('Bronze');
  });

  it('boundary: exactly 3 games played uses win-rate tiers, not the under-3 floor', () => {
    expect(calcRank(80, 3)).toBe('Diamond');
  });

  it('tier boundaries are inclusive at the documented thresholds', () => {
    expect(calcRank(80, 5)).toBe('Diamond');
    expect(calcRank(79, 5)).toBe('Platinum');
    expect(calcRank(65, 5)).toBe('Platinum');
    expect(calcRank(64, 5)).toBe('Gold');
    expect(calcRank(50, 5)).toBe('Gold');
    expect(calcRank(49, 5)).toBe('Silver');
    expect(calcRank(35, 5)).toBe('Silver');
    expect(calcRank(34, 5)).toBe('Bronze');
  });
});

describe('playerUtils — buildPlayerStats', () => {
  const entry = (winner: string, players: string, id: number): MatchHistoryEntry => ({
    id, mode: 'doubles', players, winner, timestamp: new Date(2026, 0, id).toISOString(),
  });

  it('counts wins and losses correctly for a simple singles history', () => {
    const history = [entry('P1', 'P1 vs P2', 1)];
    const stats = buildPlayerStats(['P1', 'P2'], history);
    const p1 = stats.find(s => s.name === 'P1')!;
    const p2 = stats.find(s => s.name === 'P2')!;
    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(0);
    expect(p2.wins).toBe(0);
    expect(p2.losses).toBe(1);
  });

  it('handles doubles "&" winner format, crediting both teammates', () => {
    const history = [entry('P1 & P2', 'P1 & P2 vs P3 & P4', 1)];
    const stats = buildPlayerStats(['P1', 'P2', 'P3', 'P4'], history);
    expect(stats.find(s => s.name === 'P1')!.wins).toBe(1);
    expect(stats.find(s => s.name === 'P2')!.wins).toBe(1);
    expect(stats.find(s => s.name === 'P3')!.losses).toBe(1);
    expect(stats.find(s => s.name === 'P4')!.losses).toBe(1);
  });

  it('ignores players in history who are not in the current players list', () => {
    const history = [entry('Ghost', 'Ghost vs P1', 1)];
    const stats = buildPlayerStats(['P1'], history);
    expect(stats).toHaveLength(1);
    expect(stats[0].name).toBe('P1');
    expect(stats[0].losses).toBe(1); // P1 still recorded as losing to Ghost
  });

  it('computes streak by processing history oldest-to-newest (reversed input)', () => {
    // history is presumably stored newest-first; buildPlayerStats reverses it.
    // 3 entries, most recent (index 0) is a win, before that 2 wins -> streak should be 3
    // if input array order is [newest, ..., oldest] and reversing gives oldest->newest processing,
    // BUT streak should reflect the LATEST state after processing in chronological order.
    const history = [
      entry('P1', 'P1 vs P2', 3), // newest
      entry('P1', 'P1 vs P2', 2),
      entry('P1', 'P1 vs P2', 1), // oldest
    ];
    const stats = buildPlayerStats(['P1', 'P2'], history);
    expect(stats.find(s => s.name === 'P1')!.streak).toBe(3);
  });

  it('a loss resets streak to 0, and only the most recent run counts', () => {
    const history = [
      entry('P1', 'P1 vs P2', 3), // newest: win
      entry('P2', 'P1 vs P2', 2), // middle: P1 lost
      entry('P1', 'P1 vs P2', 1), // oldest: win
    ];
    const stats = buildPlayerStats(['P1', 'P2'], history);
    expect(stats.find(s => s.name === 'P1')!.streak).toBe(1); // only the newest win counts
  });

  it('winRate is rounded to nearest integer and 0 when no games played', () => {
    const stats = buildPlayerStats(['Idle'], []);
    expect(stats[0].winRate).toBe(0);
    expect(stats[0].gamesPlayed).toBe(0);
  });

  it('assigns rank using calcRank based on final winRate/gamesPlayed', () => {
    const history = [entry('P1', 'P1 vs P2', 1), entry('P1', 'P1 vs P2', 2), entry('P1', 'P1 vs P2', 3)];
    const stats = buildPlayerStats(['P1', 'P2'], history);
    expect(stats.find(s => s.name === 'P1')!.rank).toBe('Diamond'); // 100% over 3 games
  });
});

describe('playerUtils — generateSuggestions', () => {
  const stat = (name: string, gamesPlayed: number, winRate: number, streak: number) => ({
    name, wins: 0, losses: 0, gamesPlayed, winRate, streak, rank: 'Bronze' as const,
  });

  it('returns no suggestions for an empty stats list', () => {
    expect(generateSuggestions([], [])).toEqual([]);
  });

  it('flags overused players (>1.5x average AND >2 games)', () => {
    const stats = [stat('Heavy', 10, 50, 0), stat('Light', 1, 50, 0), stat('Light2', 1, 50, 0)];
    const suggestions = generateSuggestions(stats, []);
    const overused = suggestions.find(s => s.type === 'overused');
    expect(overused?.players).toContain('Heavy');
  });

  it('flags players with 0 games played as underused', () => {
    const stats = [stat('Played', 5, 50, 0), stat('NeverPlayed', 0, 0, 0)];
    const suggestions = generateSuggestions(stats, []);
    const underused = suggestions.find(s => s.type === 'underused');
    expect(underused?.players).toEqual(['NeverPlayed']);
  });

  it('flags hot streaks at streak >= 3', () => {
    const stats = [stat('OnFire', 5, 80, 3), stat('Normal', 5, 50, 1)];
    const suggestions = generateSuggestions(stats, []);
    const hot = suggestions.find(s => s.type === 'hot-streak');
    expect(hot?.players).toEqual(['OnFire']);
  });

  it('does NOT flag a hot streak at exactly 2 (boundary check)', () => {
    const stats = [stat('Almost', 5, 80, 2)];
    const suggestions = generateSuggestions(stats, []);
    expect(suggestions.find(s => s.type === 'hot-streak')).toBeUndefined();
  });

  it('flags team-balance imbalance when the next 4 in queue differ by more than 30 combined win rate', () => {
    const stats = [stat('A', 5, 90, 0), stat('B', 5, 90, 0), stat('C', 5, 10, 0), stat('D', 5, 10, 0)];
    const suggestions = generateSuggestions(stats, ['A', 'B', 'C', 'D']);
    expect(suggestions.find(s => s.type === 'team-balance')).toBeDefined();
  });

  it('does not check team-balance if queue has fewer than 4 players', () => {
    const stats = [stat('A', 5, 90, 0), stat('B', 5, 10, 0)];
    const suggestions = generateSuggestions(stats, ['A', 'B']);
    expect(suggestions.find(s => s.type === 'team-balance')).toBeUndefined();
  });

  it('uses a default win rate of 50 for queue players with no matching stat entry (nitpick: silent fallback)', () => {
    // Players in queue who aren't in stats[] (e.g. a brand new player) default to winRate 50.
    const stats = [stat('A', 5, 90, 0), stat('B', 5, 90, 0)];
    const suggestions = generateSuggestions(stats, ['A', 'B', 'Unknown1', 'Unknown2']);
    // A+B = 180, Unknown1+Unknown2 default to 50+50=100, diff=80 > 30 -> should flag
    expect(suggestions.find(s => s.type === 'team-balance')).toBeDefined();
  });
});