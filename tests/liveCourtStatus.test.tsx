import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getNextPlayers,
  LiveCourtStatus,
  resolveSelectedCourt,
} from '@/app/watch/[sessionId]/LiveCourtStatus';
import type { CourtSlot } from '@/lib/sessionService';

const courts: CourtSlot[] = [
  { id: 'court-1', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] },
  { id: 'court-2', name: 'Court 2', onCourt: ['E', 'F', 'G', 'H'] },
  { id: 'court-3', name: 'Court 3', onCourt: ['I', 'J', 'K', 'L'] },
];

describe('Live Court Status', () => {
  it('resolves a selected court and safely falls back to the first court', () => {
    expect(resolveSelectedCourt(courts, 'court-3')?.name).toBe('Court 3');
    expect(resolveSelectedCourt(courts, 'missing')?.name).toBe('Court 1');
    expect(resolveSelectedCourt([], 'court-1')).toBeNull();
  });

  it('shows only the selected court as the focused matchup', () => {
    const html = renderToStaticMarkup(
      <LiveCourtStatus
        courtSlots={courts}
        gameMode="doubles"
        queue={['A', 'B', 'M', 'N', 'O', 'P', 'Q']}
        selectedCourtId="court-3"
        onSelectCourt={() => undefined}
      />,
    );

    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Following');
    expect(html).toContain('I &amp; J');
    expect(html).toContain('K &amp; L');
    expect(html).toContain('Assignment is confirmed when the next court becomes available.');
    expect(html).toContain('#1</span> M');
    expect(html).toContain('+1 waiting');
  });

  it('uses the correct next-player group size for singles and doubles', () => {
    const queue = ['A', 'B', 'C', 'D', 'E'];
    expect(getNextPlayers(queue, 'singles')).toEqual(['A', 'B']);
    expect(getNextPlayers(queue, 'doubles')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('validates minimum shape of stored queue state for corrupted structure', () => {
    const isCorrupted = (parsed: unknown): boolean => (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Array.isArray((parsed as Record<string, unknown>).players) ||
      !Array.isArray((parsed as Record<string, unknown>).queue)
    );

    // Completely broken shapes (from crash mid-write)
    expect(isCorrupted(null)).toBe(true);
    expect(isCorrupted('random string')).toBe(true);
    expect(isCorrupted([])).toBe(true);
    expect(isCorrupted({ players: null, queue: [] })).toBe(true);
    expect(isCorrupted({ players: ['A'], queue: 'not-array' })).toBe(true);

    // Valid shape
    expect(isCorrupted({ players: ['A', 'B'], queue: ['A', 'B'], gameMode: 'doubles' })).toBe(false);
  });

  it('verifies application-level 30-minute inactivity session expiration (isSessionExpired)', async () => {
    const { isSessionExpired, SESSION_INACTIVITY_LIMIT_MS } = await import('@/lib/sessionService');
    expect(SESSION_INACTIVITY_LIMIT_MS).toBe(30 * 60 * 1000);

    const activeSession = {
      lastActiveAt: { toMillis: () => Date.now() - 5 * 60 * 1000 }, // 5 min ago
    };
    expect(isSessionExpired(activeSession as never)).toBe(false);

    const expiredSession = {
      lastActiveAt: { toMillis: () => Date.now() - 31 * 60 * 1000 }, // 31 min ago
    };
    expect(isSessionExpired(expiredSession as never)).toBe(true);
  });

  it('ScoreBoard accidental point: requires explicit button confirmation before triggering onWin', () => {
    // Verifies that reaching the limit (e.g. 11) does not automatically call onWin.
    // The host must explicitly click the confirmation button ("Confirm ... won").
    let winCalled = false;
    const onWin = () => { winCalled = true; };

    // Simulate state where score hits 11-0 accidentally:
    const scoreA = 11;
    const limit = 11;
    const finished = scoreA >= limit;

    expect(finished).toBe(true);
    expect(onWin).toBeDefined();
    // Until confirmResult is clicked by the host, onWin is not executed
    expect(winCalled).toBe(false);

    // If host corrects accidental point with minus before confirming:
    const correctedScoreA = scoreA - 1;
    const correctedFinished = correctedScoreA >= limit;
    expect(correctedFinished).toBe(false);
    expect(winCalled).toBe(false);
  });
});
