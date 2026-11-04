import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveWatchTurnContext } from '../app/queue/lib/watchTurnContext';
import { getPlayerTurnZone } from '../app/queue/lib/turnAlert';
import { WaitingQueueChips } from '../app/watch/[sessionId]/LiveCourtStatus';

describe('Spectator Watch Turn Context & Chips (Bug #5)', () => {
  describe('resolveWatchTurnContext', () => {
    it('synthesizes effectiveCourts and waitingQueue for single-court doubles without off-by-one errors', () => {
      const ctx = resolveWatchTurnContext({
        gameMode: 'doubles',
        courtName: 'Court 1',
        courtSlots: [],
        queue: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'],
      });

      expect(ctx.playersPerMatch).toBe(4);
      expect(ctx.activeCourtCount).toBe(1);
      expect(ctx.effectiveCourts).toEqual([
        { id: 'court-0', name: 'Court 1', onCourt: ['P1', 'P2', 'P3', 'P4'] },
      ]);
      expect(ctx.waitingQueue).toEqual(['P5', 'P6', 'P7', 'P8', 'P9']);

      // Turn Zone classifications
      expect(getPlayerTurnZone('P1', ctx.effectiveCourts, ctx.waitingQueue, ctx.playersPerMatch))
        .toEqual({ zone: 'on-court', courtName: 'Court 1' });
      expect(getPlayerTurnZone('P5', ctx.effectiveCourts, ctx.waitingQueue, ctx.playersPerMatch))
        .toEqual({ zone: 'on-deck' });
      expect(getPlayerTurnZone('P9', ctx.effectiveCourts, ctx.waitingQueue, ctx.playersPerMatch))
        .toEqual({ zone: 'waiting' });
    });

    it('filters sittingOut players and prioritizes priorityPlayers in waitingQueue', () => {
      const ctx = resolveWatchTurnContext({
        gameMode: 'singles',
        courtSlots: [],
        queue: ['P1', 'P2', 'Resting', 'P3', 'PriorityGuy', 'P4'],
        sittingOut: ['Resting'],
        priorityPlayers: ['PriorityGuy'],
      });

      expect(ctx.playersPerMatch).toBe(2);
      expect(ctx.effectiveCourts[0].onCourt).toEqual(['P1', 'P2']);
      // Resting is excluded, PriorityGuy is moved to front of waitingQueue
      expect(ctx.waitingQueue).toEqual(['PriorityGuy', 'P3', 'P4']);
    });
  });

  describe('WaitingQueueChips', () => {
    it('renders accessible buttons with turn alert labels and no win/wins suffixes', () => {
      const html = renderToStaticMarkup(
        React.createElement(WaitingQueueChips, {
          waitingQueue: ['Darwin', 'Alice'],
          playersPerMatch: 4,
          activeCourtCount: 1,
          watchedPlayer: 'Alice',
          onToggleWatchPlayer: () => {},
        })
      );

      expect(html).toContain('<button');
      expect(html).toContain('aria-label="Turn alert: Darwin (off)"');
      expect(html).toContain('aria-pressed="false"');
      expect(html).toContain('aria-label="Turn alert: Alice (on)"');
      expect(html).toContain('aria-pressed="true"');
      // Must not contain winner button labels that would collide with Playwright checks
      expect(html).not.toMatch(/aria-label="[^"]*wins?"/i);
    });
  });
});
