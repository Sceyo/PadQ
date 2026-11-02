import { describe, it, expect } from 'vitest';
import { planMultiCourtResult, MULTI_COURT_SINGLES_MAX_STREAK } from '../app/queue/lib/multiCourtResult';

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
});
