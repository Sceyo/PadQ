import { describe, it, expect } from 'vitest';
import {
  toSingleCourtViewModel,
  toSingleCourtQueueViewModel,
  toMultiCourtQueueViewModel,
} from '@/app/queue/lib/viewModels';

describe('viewModels pure mappers', () => {
  describe('toSingleCourtViewModel', () => {
    it('creates a playing court model when 4 players are in queue', () => {
      const court = toSingleCourtViewModel({
        queue: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'],
      });
      expect(court.id).toBe('court-1');
      expect(court.status).toBe('playing');
      expect(court.teams[0].players).toEqual(['Alice', 'Bob']);
      expect(court.teams[1].players).toEqual(['Charlie', 'Dave']);
      expect(court.score.scoreA).toBe(0);
      expect(court.score.scoreB).toBe(0);
      expect(court.score.hasStarted).toBe(false);
      expect(court.canEdit).toBe(true);
    });

    it('honors suggested novel pairings when provided', () => {
      const court = toSingleCourtViewModel({
        queue: ['Alice', 'Bob', 'Charlie', 'Dave'],
        suggestedTeamA: ['Alice', 'Charlie'],
        suggestedTeamB: ['Bob', 'Dave'],
      });
      expect(court.teams[0].players).toEqual(['Alice', 'Charlie']);
      expect(court.teams[1].players).toEqual(['Bob', 'Dave']);
    });

    it('locks edit mode once scoring has started', () => {
      const court = toSingleCourtViewModel({
        queue: ['Alice', 'Bob', 'Charlie', 'Dave'],
        liveScore: { scoreA: 3, scoreB: 1 },
      });
      expect(court.score.scoreA).toBe(3);
      expect(court.score.scoreB).toBe(1);
      expect(court.score.hasStarted).toBe(true);
      expect(court.canEdit).toBe(false);
    });

    it('sets waiting status when fewer than 4 players', () => {
      const court = toSingleCourtViewModel({
        queue: ['Alice', 'Bob'],
      });
      expect(court.status).toBe('waiting');
    });
  });

  describe('toSingleCourtQueueViewModel', () => {
    it('splits queue into nextUp, waiting and onBreak with priority', () => {
      const queueModel = toSingleCourtQueueViewModel({
        queue: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'],
        priorityPlayers: ['P5'],
        sittingOut: ['Resting1'],
        formatEta: (pos) => `~${pos * 5}m`,
      });

      // nextUp is next 4 (P5, P6, P7, P8)
      expect(queueModel.nextUp.map(p => p.name)).toEqual(['P5', 'P6', 'P7', 'P8']);
      expect(queueModel.nextUp[0].priority).toBe(true);
      expect(queueModel.nextUp[1].priority).toBe(false);

      // Deduplicated waiting is remaining players after nextUp (P9)
      expect(queueModel.waiting.length).toBe(1);
      expect(queueModel.waiting[0].name).toBe('P9');
      expect(queueModel.waiting[0].etaLabel).toBe('~25m');

      // onBreak
      expect(queueModel.onBreak).toEqual([{ name: 'Resting1' }]);
    });
  });

  describe('toMultiCourtQueueViewModel', () => {
    it('maps waitingPlayers array directly to nextUp and waiting list', () => {
      const queueModel = toMultiCourtQueueViewModel({
        waitingPlayers: ['W1', 'W2', 'W3', 'W4', 'W5'],
        priorityPlayers: ['W1'],
        sittingOut: ['B1', 'B2'],
        formatEta: (pos, _, isMulti) => isMulti ? `ETA ${pos * 3}m` : null,
      });

      expect(queueModel.nextUp.map(p => p.name)).toEqual(['W1', 'W2', 'W3', 'W4']);
      expect(queueModel.nextUp[0].priority).toBe(true);
      // Deduplicated waiting is remaining players after nextUp (W5)
      expect(queueModel.waiting.length).toBe(1);
      expect(queueModel.waiting[0].name).toBe('W5');
      expect(queueModel.waiting[0].etaLabel).toBe('ETA 15m');
      expect(queueModel.onBreak).toEqual([{ name: 'B1' }, { name: 'B2' }]);
    });
  });
});
