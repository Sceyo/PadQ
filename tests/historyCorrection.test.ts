import { describe, it, expect } from 'vitest';
import { flipHistoryEntryWinner } from '../app/queue/lib/historyCorrection';
import { buildPlayerStats } from '../app/queue/lib/playerUtils';

describe('historyCorrection', () => {
  it('flips the winner between Team A and Team B and reverses score string if present', () => {
    const entry = {
      id: 101,
      mode: 'Doubles (Court 1)',
      players: 'Alice & Bob vs Charlie & Dana',
      winner: 'Alice & Bob',
      score: '11–9',
      timestamp: '19:30',
    };

    const flipped = flipHistoryEntryWinner(entry);
    expect(flipped.winner).toBe('Charlie & Dana');
    expect(flipped.score).toBe('9–11');

    const stats = buildPlayerStats(['Alice', 'Bob', 'Charlie', 'Dana'], [flipped]);
    const charlie = stats.find(s => s.name === 'Charlie')!;
    const alice = stats.find(s => s.name === 'Alice')!;
    expect(charlie.wins).toBe(1);
    expect(charlie.pointDiff).toBe(2);
    expect(alice.wins).toBe(0);
    expect(alice.pointDiff).toBe(-2);
  });

  it('handles standard hyphen score and custom new score override', () => {
    const entry = {
      id: 102,
      mode: 'Singles (Court 2)',
      players: 'Carlos vs Jannik',
      winner: 'Carlos',
      score: '15-13',
      timestamp: '20:00',
    };

    const flipped = flipHistoryEntryWinner(entry);
    expect(flipped.winner).toBe('Jannik');
    expect(flipped.score).toBe('13-15');

    const manualScoreFlipped = flipHistoryEntryWinner(entry, '11–8');
    expect(manualScoreFlipped.winner).toBe('Jannik');
    expect(manualScoreFlipped.score).toBe('11–8');
  });

  it('preserves history entry without score when score is absent', () => {
    const entry = {
      id: 103,
      mode: 'Doubles (Court 1)',
      players: 'P1 & P2 vs P3 & P4',
      winner: 'P1 & P2',
      timestamp: '20:15',
    };

    const flipped = flipHistoryEntryWinner(entry);
    expect(flipped.winner).toBe('P3 & P4');
    expect(flipped.score).toBeUndefined();
  });
});
