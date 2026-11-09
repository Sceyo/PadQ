import { describe, it, expect } from 'vitest';
import { parsePlayerListPaste } from '../app/queue/lib/pasteParser';
import {
  initCheckInState,
  checkInPlayer,
} from '../app/queue/lib/checkInState';
import {
  seedMultiCourtDoubles,
  balanceSelectedMatch,
} from '../app/queue/lib/doublesEngine';
import {
  planMultiCourtResult,
  MULTI_COURT_SINGLES_MAX_STREAK,
} from '../app/queue/lib/multiCourtResult';
import { formatEtaLabel } from '../app/queue/lib/etaEngine';
import {
  getPlayerTurnZone,
  shouldTriggerTurnAlert,
} from '../app/queue/lib/turnAlert';
import { flipHistoryEntryWinner } from '../app/queue/lib/historyCorrection';
import { buildPlayerStats } from '../app/queue/lib/playerUtils';
import { computeSessionRecap } from '../app/queue/lib/recapUtils';
import type { MatchHistoryEntry } from '@/lib/sessionService';

describe('PADQ Full Session Parity & UX Lifecycle Integration', () => {
  it('executes full end-to-end session workflow across intake, engine parity, spectator alerts, and recap', () => {
    // 1. Smart Paste Intake (Task 1)
    const rawRosterPaste = `
      1. Alice (Paid)
      2. Bob [Confirmed]
      3. Charlie
      4. Dana
      5. Eve - waitlist
      6. Frank
      7. Grace
      8. Heidi
      9. Ivan
      10. Judy
      11. Kevin
      12. Laura
      13. Mallory (Late)
      14. Niaj
      15. Oscar
      16. Peggy
    `;

    const parsedEntries = parsePlayerListPaste(rawRosterPaste);
    const parsedNames = parsedEntries.map(e => e.name);
    expect(parsedNames.length).toBe(16);
    expect(parsedNames).toContain('Alice');
    expect(parsedNames).toContain('Bob');
    expect(parsedNames).toContain('Mallory');

    // 2. Pre-Session Check-In Engine (Task 5 & 6)
    let checkIn = initCheckInState(parsedNames);
    expect(checkIn.expected.length).toBe(16);
    expect(checkIn.checkedIn.length).toBe(0);

    // Arrive first 12 players in order, leaving 4 as expected/late
    for (let i = 0; i < 12; i++) {
      checkIn = checkInPlayer(checkIn, parsedNames[i]);
    }
    expect(checkIn.checkedIn.length).toBe(12);
    expect(checkIn.expected).toEqual(['Mallory', 'Niaj', 'Oscar', 'Peggy']);

    // 3. Partner Lock & Multi-Court Doubles Seeding (Task 4)
    const lockedPartners: [string, string][] = [['Alice', 'Bob']];
    const seeded = seedMultiCourtDoubles(checkIn.checkedIn, 2, lockedPartners);
    expect(seeded.courts.length).toBe(2);
    // Alice & Bob seeded together as Team A on Court 1
    expect(seeded.courts[0].slice(0, 2)).toEqual(['Alice', 'Bob']);
    expect(seeded.waiting.length).toBe(4); // 12 - 8 on court = 4 waiting

    // 4. Multi-Court Doubles Balancing & Anti-Repeat (Task 2)
    const candidates = ['Charlie', 'Dana', 'Eve', 'Frank'];
    const balancedMatch = balanceSelectedMatch(
      candidates,
      [],
      ['Charlie|Dana'],
      [],
      new Set(),
      { Charlie: 3.5, Dana: 3.5, Eve: 3.0, Frank: 3.0 },
    );

    // Should avoid repeating Charlie & Dana as partners
    const pair1 = `${balancedMatch[0]}|${balancedMatch[1]}`;
    const pair2 = `${balancedMatch[2]}|${balancedMatch[3]}`;
    expect(pair1).not.toBe('Charlie|Dana');
    expect(pair1).not.toBe('Dana|Charlie');
    expect(pair2).not.toBe('Charlie|Dana');
    expect(pair2).not.toBe('Dana|Charlie');

    // 5. Multi-Court Singles 3-Win Streak Limit Parity (Task 3)
    const singlesState = {
      courtSlots: [
        { id: 'c1', name: 'Court 1', onCourt: ['KingAlex', 'Challenger3'] },
      ],
      queue: ['Challenger4', 'Challenger5'],
      history: [
        { id: 2, mode: 'Singles (Court 1)', players: 'KingAlex vs Challenger2', winner: 'KingAlex', timestamp: '19:15' },
        { id: 1, mode: 'Singles (Court 1)', players: 'KingAlex vs Challenger1', winner: 'KingAlex', timestamp: '19:00' },
      ],
    };

    const nextSingles = planMultiCourtResult(
      singlesState as unknown as Parameters<typeof planMultiCourtResult>[0],
      'c1',
      ['KingAlex', 'Challenger3'],
      'A',
      'singles',
    );
    expect(nextSingles).not.toBeNull();
    expect(nextSingles!.courtSlots[0].onCourt).toEqual(['Challenger4', 'Challenger5']);
    expect(nextSingles!.queue).toEqual(['Challenger3', 'KingAlex']);
    expect(MULTI_COURT_SINGLES_MAX_STREAK).toBe(3);

    // 6. Late-Arrival Check-In (Task 7)
    // Mallory arrives late and is checked in to waiting queue
    const activeQueue = [...nextSingles!.queue, 'Mallory'];
    expect(activeQueue[activeQueue.length - 1]).toBe('Mallory');

    // 7. Full Queue Visibility, Deterministic ETA & Turn Alerts (Task 8 & 9)
    // 2 players needed for singles, 2 courts
    const etaForMallory = formatEtaLabel(activeQueue.length, 2, true);
    expect(typeof etaForMallory).toBe('string');

    // Spectator Mallory is in queue
    const zoneBefore = getPlayerTurnZone('Mallory', nextSingles!.courtSlots, activeQueue, 2);
    expect(zoneBefore.zone).toBe('waiting');

    // As queue advances, Mallory reaches on-deck
    const shouldAlert = shouldTriggerTurnAlert(zoneBefore.zone, 'on-deck');
    expect(shouldAlert).toBe(true);

    // 8. History Winner Correction & Standings Recalculation (Task 11)
    const misreportedMatch: MatchHistoryEntry = {
      id: 201,
      mode: 'Doubles (Court 1)',
      players: 'Alice & Bob vs Charlie & Dana',
      winner: 'Alice & Bob',
      score: '11–8',
      timestamp: '20:00',
    };

    const correctedMatch = flipHistoryEntryWinner(misreportedMatch);
    expect(correctedMatch.winner).toBe('Charlie & Dana');
    expect(correctedMatch.score).toBe('8–11');

    const statsAfterCorrection = buildPlayerStats(
      ['Alice', 'Bob', 'Charlie', 'Dana'],
      [correctedMatch],
    );
    const charlieStat = statsAfterCorrection.find(s => s.name === 'Charlie')!;
    const aliceStat = statsAfterCorrection.find(s => s.name === 'Alice')!;
    expect(charlieStat.wins).toBe(1);
    expect(charlieStat.pointDiff).toBe(3);
    expect(aliceStat.wins).toBe(0);
    expect(aliceStat.pointDiff).toBe(-3);

    // 9. Session Recap Spotlight (Task 12)
    const recap = computeSessionRecap(statsAfterCorrection, [correctedMatch]);
    expect(recap.sortedPlayers[0].name).toBe('Charlie');
    expect(recap.sortedPlayers.length).toBe(4);
  });
});
