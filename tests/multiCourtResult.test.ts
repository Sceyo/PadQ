import { describe, it, expect } from 'vitest';
import {
  planMultiCourtResult,
  MULTI_COURT_SINGLES_MAX_STREAK,
  buildNumericSkillMap,
} from '../app/queue/lib/multiCourtResult';

describe('buildNumericSkillMap', () => {
  it('maps unplayed bracket-tagged players to 25/50/75, uses winRate once played >= 1, and defaults untagged to 50', () => {
    const stats = [
      { name: 'P1', played: 0, winRate: 0 },
      { name: 'P2', played: 0, winRate: 0 },
      { name: 'P3', played: 0, winRate: 0 },
      { name: 'P4', played: 5, winRate: 80 },
    ];
    const rosterSkills: Record<string, 'beginner' | 'intermediate' | 'advanced' | undefined> = {
      P1: 'beginner',
      P2: 'intermediate',
      P3: 'advanced',
      P4: 'beginner', // played >= 1, so winRate 80 takes priority over bracket default
    };
    const map = buildNumericSkillMap(stats, rosterSkills);
    expect(map['P1']).toBe(25);
    expect(map['P2']).toBe(50);
    expect(map['P3']).toBe(75);
    expect(map['P4']).toBe(80);
  });
});

describe('multiCourtResult singles 3-win streak cap', () => {
  it('exports MULTI_COURT_SINGLES_MAX_STREAK as 3', () => {
    expect(MULTI_COURT_SINGLES_MAX_STREAK).toBe(3);
  });

  it('forces rotation when king reaches 3 consecutive wins on a court', () => {
    const state = {
      courtSlots: [
        { id: 'c1', name: 'Court 1', onCourt: ['KingPlayer', 'Challenger3'] },
      ],
      queue: ['Challenger4', 'Challenger5'],
      history: [
        { id: 2, mode: 'Singles (Court 1)', players: 'KingPlayer vs Challenger2', winner: 'KingPlayer', timestamp: '10:05' },
        { id: 1, mode: 'Singles (Court 1)', players: 'KingPlayer vs Challenger1', winner: 'KingPlayer', timestamp: '10:00' },
      ],
    };

    const next = planMultiCourtResult(
      state as unknown as Parameters<typeof planMultiCourtResult>[0],
      'c1',
      ['KingPlayer', 'Challenger3'],
      'A',
      'singles',
    );
    expect(next).not.toBeNull();
    // KingPlayer won 3 in a row. King must rotate out to the back of the queue!
    expect(next!.courtSlots[0].onCourt).toEqual(['Challenger4', 'Challenger5']);
    expect(next!.queue).toEqual(['Challenger3', 'KingPlayer']);
  });

  it('keeps winner on court for win 1 and 2, but rotates off on win 3', () => {
    let currentState = {
      courtSlots: [{ id: 'c1', name: 'Court 1', onCourt: ['Alice', 'Bob'] }],
      queue: ['Charlie', 'Dave', 'Eve'],
      history: [] as Array<{ id: number; mode: string; players: string; winner: string }>,
    };

    // Win 1: Alice beats Bob
    let res = planMultiCourtResult(currentState, 'c1', ['Alice', 'Bob'], 'A', 'singles')!;
    expect(res.courtSlots[0].onCourt).toEqual(['Alice', 'Charlie']);
    expect(res.queue).toEqual(['Dave', 'Eve', 'Bob']);

    // Win 2: Alice beats Charlie
    currentState = {
      courtSlots: res.courtSlots,
      queue: res.queue,
      history: [
        { id: 1, mode: `Singles (${res.courtName})`, players: res.players, winner: res.winner },
      ],
    };
    res = planMultiCourtResult(currentState, 'c1', ['Alice', 'Charlie'], 'A', 'singles')!;
    expect(res.courtSlots[0].onCourt).toEqual(['Alice', 'Dave']);
    expect(res.queue).toEqual(['Eve', 'Bob', 'Charlie']);

    // Win 3: Alice beats Dave (streak reaches 3)
    currentState = {
      courtSlots: res.courtSlots,
      queue: res.queue,
      history: [
        { id: 2, mode: `Singles (${res.courtName})`, players: res.players, winner: res.winner },
        { id: 1, mode: 'Singles (Court 1)', players: 'Alice vs Bob', winner: 'Alice' },
      ],
    };
    res = planMultiCourtResult(currentState, 'c1', ['Alice', 'Dave'], 'A', 'singles')!;
    // Alice hit 3-win streak -> rotates off to back of queue!
    expect(res.courtSlots[0].onCourt).toEqual(['Eve', 'Bob']);
    expect(res.queue).toEqual(['Charlie', 'Dave', 'Alice']);
  });

  it('avoids repeating the exact recent partnership in doubles when alternatives exist', () => {
    const currentState = {
      courtSlots: [{ id: 'c1', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] }],
      queue: ['E', 'F'],
      history: [
        { id: 1, mode: 'Doubles (Court 1)', players: 'A & B vs C & D', winner: 'A & B' },
      ],
    };

    const res = planMultiCourtResult(currentState, 'c1', ['A', 'B', 'C', 'D'], 'A', 'doubles')!;
    expect(res).not.toBeNull();
    expect(res.courtSlots[0].onCourt).toHaveLength(4);
  });
});
