import { describe, expect, it } from 'vitest';
import {
  addPartnerPair,
  getAvailablePartnerPlayers,
  getCompatiblePartnerPlayers,
  getMaxPartnerPairs,
  getPlayerLocationLabel,
  type LockedPartnerPair,
} from '../app/queue/components/LiveManagement/LiveManagement';

describe('live partner controls', () => {
  it('sets the pair limit from the number of players', () => {
    expect(getMaxPartnerPairs(0)).toBe(0);
    expect(getMaxPartnerPairs(5)).toBe(1);
    expect(getMaxPartnerPairs(7)).toBe(2);
    expect(getMaxPartnerPairs(8)).toBe(4);
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
    expect(addPartnerPair(players, firstPair, 'C', 'D')).toBe(firstPair);
    expect(addPartnerPair([...players, 'F'], firstPair, 'C', 'D')).toEqual([['A', 'B'], ['C', 'D']]);
  }, 30_000);

  it('allows pairing any available player across courts or queue (Option 2)', () => {
    const available = ['A', 'B', 'C', 'D', 'E', 'F'];
    const groups = [['E', 'F'], ['A', 'B'], ['C', 'D']];
    expect(getCompatiblePartnerPlayers(available, groups, null)).toEqual(available);
    // When 'A' (Court 1) is selected, players across all groups remain selectable
    expect(getCompatiblePartnerPlayers(available, groups, 'A')).toEqual(available);
    expect(getCompatiblePartnerPlayers(available, groups, 'E')).toEqual(available);
  });

  it('determines the correct player location label from player groups', () => {
    const groups = [['Queue1', 'Queue2'], ['C1_1', 'C1_2'], ['C2_1', 'C2_2']];
    expect(getPlayerLocationLabel('Queue1', groups)).toBe('Queue');
    expect(getPlayerLocationLabel('C1_1', groups)).toBe('Court 1');
    expect(getPlayerLocationLabel('C2_2', groups)).toBe('Court 2');
    expect(getPlayerLocationLabel('Unknown', groups)).toBeNull();
    expect(getPlayerLocationLabel('Any', [])).toBeNull();
  });
});
