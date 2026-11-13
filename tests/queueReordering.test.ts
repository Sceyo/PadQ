import { describe, expect, it } from 'vitest';
import { accountPlayers } from '@/app/queue/lib/queueTransitions';

function simulateMoveWaitingPlayer({
  queue,
  courtSlots = [],
  sittingOut = [],
  priorityPlayers = [],
  gameMode = 'doubles',
  playerName,
  direction,
}: {
  queue: string[];
  courtSlots?: Array<{ id: string; name: string; onCourt: string[] }>;
  sittingOut?: string[];
  priorityPlayers?: string[];
  gameMode?: 'singles' | 'doubles';
  playerName: string;
  direction: -1 | 1;
}) {
  const queued = accountPlayers({
    gameMode,
    players: [...queue, ...sittingOut],
    queue,
    courtSlots,
    sittingOut,
  }).queued.filter(p => !sittingOut.includes(p));

  const prioritySet = new Set(priorityPlayers);
  const priorityQueued = priorityPlayers.filter(p => queued.includes(p));
  const restQueued = queued.filter(p => !prioritySet.has(p));
  const waitingPlayers = [...priorityQueued, ...restQueued];

  const curIdx = waitingPlayers.indexOf(playerName);
  if (curIdx === -1) return { queue, priorityPlayers };
  const targetIdx = curIdx + direction;
  if (targetIdx < 0 || targetIdx >= waitingPlayers.length) return { queue, priorityPlayers };
  const otherPlayer = waitingPlayers[targetIdx];

  const qIdx1 = queue.indexOf(playerName);
  const qIdx2 = queue.indexOf(otherPlayer);
  if (qIdx1 === -1 || qIdx2 === -1) return { queue, priorityPlayers };

  const newQueue = [...queue];
  newQueue[qIdx1] = otherPlayer;
  newQueue[qIdx2] = playerName;

  let nextPriority = [...priorityPlayers];
  const isPlayerPriority = nextPriority.includes(playerName);
  const isOtherPriority = nextPriority.includes(otherPlayer);

  if (isPlayerPriority && isOtherPriority) {
    const pIdx1 = nextPriority.indexOf(playerName);
    const pIdx2 = nextPriority.indexOf(otherPlayer);
    nextPriority[pIdx1] = otherPlayer;
    nextPriority[pIdx2] = playerName;
  } else if (!isPlayerPriority && isOtherPriority && direction === -1) {
    const pIdx = nextPriority.indexOf(otherPlayer);
    nextPriority.splice(pIdx, 0, playerName);
  } else if (isPlayerPriority && !isOtherPriority && direction === 1) {
    nextPriority = nextPriority.filter(p => p !== playerName);
  }

  return { queue: newQueue, priorityPlayers: nextPriority };
}

describe('Queue Reordering (Move Up / Move Down)', () => {
  describe('Single-Court Doubles', () => {
    it('moves a waiting player up and down in line (players after on-court 4)', () => {
      // Court has 4 players: A, B, C, D. Waiting line is E, F, G.
      const initialQueue = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

      // Move F up (-1) -> should swap with E
      const res1 = simulateMoveWaitingPlayer({
        queue: initialQueue,
        courtSlots: [],
        gameMode: 'doubles',
        playerName: 'F',
        direction: -1,
      });
      expect(res1.queue).toEqual(['A', 'B', 'C', 'D', 'F', 'E', 'G']);

      // Move F down (+1) -> should swap back with E
      const res2 = simulateMoveWaitingPlayer({
        queue: res1.queue,
        courtSlots: [],
        gameMode: 'doubles',
        playerName: 'F',
        direction: 1,
      });
      expect(res2.queue).toEqual(initialQueue);
    });

    it('does not allow the first waiting player to move up into active match', () => {
      const initialQueue = ['A', 'B', 'C', 'D', 'E', 'F'];
      const res = simulateMoveWaitingPlayer({
        queue: initialQueue,
        courtSlots: [],
        gameMode: 'doubles',
        playerName: 'E',
        direction: -1,
      });
      // Target index is -1, queue should remain unchanged
      expect(res.queue).toEqual(initialQueue);
    });
  });

  describe('Single-Court Singles', () => {
    it('moves waiting players after on-court 2 in singles', () => {
      // Court has 2 players: S1, S2. Waiting line is W1, W2, W3.
      const initialQueue = ['S1', 'S2', 'W1', 'W2', 'W3'];

      const res = simulateMoveWaitingPlayer({
        queue: initialQueue,
        courtSlots: [],
        gameMode: 'singles',
        playerName: 'W2',
        direction: -1,
      });
      expect(res.queue).toEqual(['S1', 'S2', 'W2', 'W1', 'W3']);
    });
  });

  describe('Multi-Court', () => {
    it('moves players in multi-court waiting queue', () => {
      const courtSlots = [
        { id: 'c1', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] },
        { id: 'c2', name: 'Court 2', onCourt: ['E', 'F', 'G', 'H'] },
      ];
      const queue = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'W1', 'W2', 'W3'];

      const res = simulateMoveWaitingPlayer({
        queue,
        courtSlots,
        playerName: 'W3',
        direction: -1,
      });
      expect(res.queue).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'W1', 'W3', 'W2']);
    });

    it('correctly reorders when moving two priority players relative to each other', () => {
      const courtSlots = [
        { id: 'c1', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] },
      ];
      const queue = ['A', 'B', 'C', 'D', 'P1', 'P2', 'Normal1'];
      const priorityPlayers = ['P1', 'P2'];

      // Move P2 up (-1) ahead of P1
      const res = simulateMoveWaitingPlayer({
        queue,
        courtSlots,
        priorityPlayers,
        playerName: 'P2',
        direction: -1,
      });
      expect(res.queue).toEqual(['A', 'B', 'C', 'D', 'P2', 'P1', 'Normal1']);
      expect(res.priorityPlayers).toEqual(['P2', 'P1']);
    });

    it('promotes a player into priority when host manually moves them up past a priority player', () => {
      const courtSlots = [
        { id: 'c1', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] },
      ];
      const queue = ['A', 'B', 'C', 'D', 'P1', 'Normal1'];
      const priorityPlayers = ['P1'];

      // Move Normal1 up ahead of priority P1
      const res = simulateMoveWaitingPlayer({
        queue,
        courtSlots,
        priorityPlayers,
        playerName: 'Normal1',
        direction: -1,
      });
      expect(res.queue).toEqual(['A', 'B', 'C', 'D', 'Normal1', 'P1']);
      expect(res.priorityPlayers).toEqual(['Normal1', 'P1']);
    });
  });
});
