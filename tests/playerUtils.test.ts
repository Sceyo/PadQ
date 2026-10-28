import { describe, it, expect } from 'vitest';
import { bracketSkillValue, calcRank, buildPlayerStats, generateSuggestions, comparePlayerStats, parseMatchScore, formatPointDiff, formatMatchupStrength } from '@/app/queue/lib/playerUtils';
import type { MatchHistoryEntry, PlayerStat } from '@/app/queue/lib/types';

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

  it('computes point differential in singles for scored matches', () => {
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'singles', players: 'P1 vs P2', winner: 'P1', score: '11 – 7', timestamp: '2026-01-01' },
      { id: 2, mode: 'singles', players: 'P1 vs P3', winner: 'P3', score: '9 – 11', timestamp: '2026-01-02' },
    ];
    const stats = buildPlayerStats(['P1', 'P2', 'P3'], history);
    const p1 = stats.find(s => s.name === 'P1')!;
    const p2 = stats.find(s => s.name === 'P2')!;
    const p3 = stats.find(s => s.name === 'P3')!;

    expect(p1.pointsScored).toBe(20);
    expect(p1.pointsConceded).toBe(18);
    expect(p1.pointDiff).toBe(2);
    expect(p1.scoredGames).toBe(2);

    expect(p2.pointsScored).toBe(7);
    expect(p2.pointsConceded).toBe(11);
    expect(p2.pointDiff).toBe(-4);
    expect(p2.scoredGames).toBe(1);

    expect(p3.pointsScored).toBe(11);
    expect(p3.pointsConceded).toBe(9);
    expect(p3.pointDiff).toBe(2);
    expect(p3.scoredGames).toBe(1);
  });

  it('computes point differential in doubles crediting both teammates', () => {
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'doubles', players: 'P1 & P2 vs P3 & P4', winner: 'P1 & P2', score: '21 – 15', timestamp: '2026-01-01' },
    ];
    const stats = buildPlayerStats(['P1', 'P2', 'P3', 'P4'], history);
    const p1 = stats.find(s => s.name === 'P1')!;
    const p2 = stats.find(s => s.name === 'P2')!;
    const p3 = stats.find(s => s.name === 'P3')!;
    const p4 = stats.find(s => s.name === 'P4')!;

    expect(p1.pointDiff).toBe(6);
    expect(p2.pointDiff).toBe(6);
    expect(p3.pointDiff).toBe(-6);
    expect(p4.pointDiff).toBe(-6);
  });

  it('handles unscored matches gracefully without affecting pointDiff', () => {
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'doubles', players: 'P1 & P2 vs P3 & P4', winner: 'P1 & P2', timestamp: '2026-01-01' },
    ];
    const stats = buildPlayerStats(['P1', 'P2', 'P3', 'P4'], history);
    const p1 = stats.find(s => s.name === 'P1')!;
    expect(p1.wins).toBe(1);
    expect(p1.gamesPlayed).toBe(1);
    expect(p1.scoredGames).toBe(0);
    expect(p1.pointsScored).toBe(0);
    expect(p1.pointsConceded).toBe(0);
    expect(p1.pointDiff).toBe(0);
  });

  it('computes Matchup Strength (OWP) excluding matches against the player', () => {
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'singles', players: 'P1 vs P2', winner: 'P1', timestamp: '2026-01-01' },
      { id: 2, mode: 'singles', players: 'P2 vs P3', winner: 'P2', timestamp: '2026-01-02' },
      { id: 3, mode: 'singles', players: 'P3 vs P4', winner: 'P3', timestamp: '2026-01-03' },
    ];
    const stats = buildPlayerStats(['P1', 'P2', 'P3', 'P4'], history);
    const p1 = stats.find(s => s.name === 'P1')!;
    expect(p1.matchupStrength).toBe(100);
  });

  it('defaults Matchup Strength (OWP) to 50 for players with zero games or whose opponents have no other games', () => {
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'singles', players: 'P1 vs P2', winner: 'P1', timestamp: '2026-01-01' },
    ];
    const stats = buildPlayerStats(['P1', 'P2', 'P3'], history);
    const p1 = stats.find(s => s.name === 'P1')!;
    const p3 = stats.find(s => s.name === 'P3')!;
    expect(p1.matchupStrength).toBe(50);
    expect(p3.matchupStrength).toBe(50);
  });

  it('correctly maps opponents in doubles (partner is not opponent)', () => {
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'doubles', players: 'P1 & P2 vs P3 & P4', winner: 'P1 & P2', timestamp: '2026-01-01' },
      { id: 2, mode: 'singles', players: 'P3 vs P5', winner: 'P3', timestamp: '2026-01-02' },
      { id: 3, mode: 'singles', players: 'P4 vs P5', winner: 'P5', timestamp: '2026-01-03' },
    ];
    const stats = buildPlayerStats(['P1', 'P2', 'P3', 'P4', 'P5'], history);
    const p1 = stats.find(s => s.name === 'P1')!;
    expect(p1.matchupStrength).toBe(50);
  });

  it('safely handles prototype keys as player names without crashing or polluting prototype', () => {
    const specialPlayers = ['constructor', 'toString', '__proto__', 'Bob'];
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'singles', players: 'constructor vs Bob', winner: 'constructor', score: '11 – 9', timestamp: '2026-01-01' },
    ];
    const stats = buildPlayerStats(specialPlayers, history);
    expect(stats).toHaveLength(4);
    const ctor = stats.find(s => s.name === 'constructor');
    expect(ctor?.wins).toBe(1);
    expect(ctor?.pointDiff).toBe(2);
    expect(Object.prototype.hasOwnProperty('constructor')).toBe(true);
  });
});

describe('playerUtils — comparePlayerStats', () => {
  const baseStat = (name: string, partial: Partial<PlayerStat>): PlayerStat => ({
    name, wins: 0, losses: 0, gamesPlayed: 0, winRate: 0, streak: 0, rank: 'Bronze',
    pointDiff: 0, pointsScored: 0, pointsConceded: 0, scoredGames: 0, matchupStrength: 50,
    ...partial,
  });

  it('ranks higher wins first', () => {
    const a = baseStat('A', { wins: 3 });
    const b = baseStat('B', { wins: 4 });
    expect(comparePlayerStats(a, b)).toBeGreaterThan(0);
  });

  it('breaks ties by win rate when wins are equal', () => {
    const a = baseStat('A', { wins: 3, winRate: 60 });
    const b = baseStat('B', { wins: 3, winRate: 75 });
    expect(comparePlayerStats(a, b)).toBeGreaterThan(0);
  });

  it('breaks ties by point differential when wins and win rate are equal', () => {
    const a = baseStat('A', { wins: 3, winRate: 75, pointDiff: 5 });
    const b = baseStat('B', { wins: 3, winRate: 75, pointDiff: 12 });
    expect(comparePlayerStats(a, b)).toBeGreaterThan(0);
  });

  it('breaks ties by matchup strength when wins, win rate, and pointDiff are equal', () => {
    const a = baseStat('A', { wins: 3, winRate: 75, pointDiff: 5, matchupStrength: 45 });
    const b = baseStat('B', { wins: 3, winRate: 75, pointDiff: 5, matchupStrength: 60 });
    expect(comparePlayerStats(a, b)).toBeGreaterThan(0);
  });

  it('breaks ties by games played when prior metrics are equal', () => {
    const a = baseStat('A', { wins: 3, winRate: 75, pointDiff: 5, matchupStrength: 50, gamesPlayed: 4 });
    const b = baseStat('B', { wins: 3, winRate: 75, pointDiff: 5, matchupStrength: 50, gamesPlayed: 6 });
    expect(comparePlayerStats(a, b)).toBeGreaterThan(0);
  });

  it('breaks ties alphabetically when all metrics are equal', () => {
    const a = baseStat('Alice', { wins: 3, winRate: 75, pointDiff: 5, matchupStrength: 50, gamesPlayed: 4 });
    const b = baseStat('Bob', { wins: 3, winRate: 75, pointDiff: 5, matchupStrength: 50, gamesPlayed: 4 });
    expect(comparePlayerStats(a, b)).toBeLessThan(0);
  });
});

describe('playerUtils — parseMatchScore', () => {
  it('parses en-dash scores correctly', () => {
    expect(parseMatchScore('11 – 7')).toEqual({ sA: 11, sB: 7 });
  });

  it('parses hyphen scores with or without spaces', () => {
    expect(parseMatchScore('21 - 15')).toEqual({ sA: 21, sB: 15 });
    expect(parseMatchScore('15-10')).toEqual({ sA: 15, sB: 10 });
  });

  it('parses colon scores and em-dash scores', () => {
    expect(parseMatchScore('11:9')).toEqual({ sA: 11, sB: 9 });
    expect(parseMatchScore('11—8')).toEqual({ sA: 11, sB: 8 });
  });

  it('returns null for undefined, empty, or invalid score strings', () => {
    expect(parseMatchScore(undefined)).toBeNull();
    expect(parseMatchScore('')).toBeNull();
    expect(parseMatchScore('forfeit')).toBeNull();
    expect(parseMatchScore('11')).toBeNull();
    expect(parseMatchScore('11 - abc')).toBeNull();
  });
});

describe('playerUtils — formatPointDiff', () => {
  it('formats positive differential with + prefix', () => {
    expect(formatPointDiff(12)).toBe('+12');
    expect(formatPointDiff(1)).toBe('+1');
  });

  it('formats zero or undefined differential as +0', () => {
    expect(formatPointDiff(0)).toBe('+0');
    expect(formatPointDiff(undefined)).toBe('+0');
  });

  it('formats negative differential with minus sign', () => {
    expect(formatPointDiff(-6)).toBe('-6');
    expect(formatPointDiff(-1)).toBe('-1');
  });
});

describe('playerUtils — formatMatchupStrength', () => {
  it('returns em-dash for 0 games played', () => {
    expect(formatMatchupStrength(50, 0)).toBe('—');
    expect(formatMatchupStrength(undefined, 0)).toBe('—');
  });

  it('returns rounded percentage for active players', () => {
    expect(formatMatchupStrength(58.33, 4)).toBe('58%');
    expect(formatMatchupStrength(100, 1)).toBe('100%');
    expect(formatMatchupStrength(undefined, 2)).toBe('50%');
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
    const balance = suggestions.find(s => s.type === 'team-balance');
    expect(balance).toBeDefined();
    expect(balance?.message).toContain('Next doubles match (A & B vs C & D) may be unbalanced (90% vs 10% avg win rate). Try swapping B and C.');
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