import { describe, expect, it } from 'vitest';
import {
  addPartnerPair,
  getAvailablePartnerPlayers,
  getCompatiblePartnerPlayers,
  getMaxPartnerPairs,
  type LockedPartnerPair,
} from '../app/queue/components/LiveManagement/LiveManagement';

describe('live partner controls', () => {
  it('sets the pair limit from the number of players', () => {
    expect(getMaxPartnerPairs(0)).toBe(0);
    expect(getMaxPartnerPairs(5)).toBe(2);
    expect(getMaxPartnerPairs(30)).toBe(15);
  });

  it('removes already paired players from the available choices', () => {
    const pairs: LockedPartnerPair[] = [['A', 'B'], ['C', 'D']];
    expect(getAvailablePartnerPlayers(['A', 'B', 'C', 'D', 'E'], pairs)).toEqual(['E']);
  });

  it('prevents invalid, duplicate, and over-limit partner pairs', () => {
    const players = ['A', 'B', 'C', 'D', 'E'];
    const firstPair: LockedPartnerPair[] = [['A', 'B']];
    const full: LockedPartnerPair[] = [['A', 'B'], ['C', 'D']];

    expect(addPartnerPair(players, firstPair, 'A', 'C')).toBe(firstPair);
    expect(addPartnerPair(players, firstPair, 'C', 'Missing')).toBe(firstPair);
    expect(addPartnerPair(players, firstPair, 'C', 'C')).toBe(firstPair);
    expect(addPartnerPair(players, full, 'E', 'D')).toBe(full);
    expect(addPartnerPair(players, firstPair, 'C', 'D')).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('only offers partners from the same court or waiting group', () => {
    const available = ['A', 'B', 'C', 'D', 'E', 'F'];
    const groups = [['E', 'F'], ['A', 'B'], ['C', 'D']];
    expect(getCompatiblePartnerPlayers(available, groups, null)).toEqual(available);
    expect(getCompatiblePartnerPlayers(available, groups, 'A')).toEqual(['A', 'B']);
    expect(getCompatiblePartnerPlayers(available, groups, 'E')).toEqual(['E', 'F']);
  });
});
