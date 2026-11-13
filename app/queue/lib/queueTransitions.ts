import type { CourtSlot } from '@/lib/sessionService';
import { addPlayerToWaiting, type PaddleState } from './doublesEngine';
import { addPlayerToSinglesWaiting, type SinglesState } from './singleEngine';
import {
  addPlayerToPoolSinglesWaiting,
  removePlayerFromPoolSinglesState,
  type PoolSinglesState,
} from './singlesPoolEngine';

export interface QueueTransitionSnapshot {
  gameMode: 'singles' | 'doubles';
  singlesFormat?: 'king' | 'pool';
  players: string[];
  queue: string[];
  courtSlots?: CourtSlot[];
  sittingOut: string[];
  priorityPlayers?: string[];
  singlesState?: SinglesState | null;
  paddleState?: PaddleState | null;
  poolSinglesState?: PoolSinglesState | null;
}

export interface TransitionResult {
  queue: string[];
  sittingOut: string[];
  courtSlots?: CourtSlot[];
  priorityPlayers?: string[];
  singlesState?: SinglesState;
  paddleState?: PaddleState;
  poolSinglesState?: PoolSinglesState;
}

export interface PlayerAccounting {
  onCourt: string[];
  queued: string[];
  onBreak: string[];
  missing: string[];
  duplicates: string[];
}

/**
 * Pure helper to consume priority status for players who just played or were called into a match.
 */
export function consumePriority(
  priorityPlayers: string[],
  matchPlayers: string[],
): string[] {
  if (!priorityPlayers.length || !matchPlayers.length) return priorityPlayers;
  const matchSet = new Set(matchPlayers);
  return priorityPlayers.filter(p => !matchSet.has(p));
}

/**
 * Pure transition for toggling a player's sit-out status.
 * Current baseline behavior:
 * - If sitting out: removes from sittingOut, appends to queue, restores to waiting engine pool.
 * - If active: adds to sittingOut, filters from queue, filters from engine pools.
 */
export function toggleSitOutTransition(
  snapshot: QueueTransitionSnapshot,
  name: string,
): TransitionResult {
  const isSittingOut = snapshot.sittingOut.includes(name);
  const newSittingOut = isSittingOut
    ? snapshot.sittingOut.filter(n => n !== name)
    : [...snapshot.sittingOut, name];
  const newQueue = isSittingOut
    ? [...snapshot.queue.filter(n => n !== name), name]
    : snapshot.queue.filter(n => n !== name);

  const basePriority = (snapshot.priorityPlayers ?? []).filter(p => p !== name);
  const newPriorityPlayers = isSittingOut
    ? [...basePriority, name]
    : basePriority;

  let newSinglesState = snapshot.singlesState ?? undefined;
  let newPaddleState = snapshot.paddleState ?? undefined;
  let newPoolSinglesState = snapshot.poolSinglesState ?? undefined;

  if (snapshot.gameMode === 'singles') {
    if (snapshot.singlesFormat === 'pool') {
      if (snapshot.poolSinglesState) {
        newPoolSinglesState = isSittingOut
          ? addPlayerToPoolSinglesWaiting(snapshot.poolSinglesState, name, true)
          : removePlayerFromPoolSinglesState(snapshot.poolSinglesState, name);
      }
    } else if (snapshot.singlesState) {
      if (isSittingOut) {
        const nextLastPlayed = { ...snapshot.singlesState.lastPlayedMap };
        delete nextLastPlayed[name];
        newSinglesState = {
          ...snapshot.singlesState,
          queue: [name, ...snapshot.singlesState.queue.filter(p => p !== name)],
          waitingQueue: snapshot.singlesState.waitingQueue.filter(p => p !== name),
          lastPlayedMap: nextLastPlayed,
        };
      } else {
        newSinglesState = {
          ...snapshot.singlesState,
          king: snapshot.singlesState.king === name ? null : snapshot.singlesState.king,
          queue: snapshot.singlesState.queue.filter(p => p !== name),
          waitingQueue: snapshot.singlesState.waitingQueue.filter(p => p !== name),
        };
      }
    }
  } else if (snapshot.gameMode === 'doubles' && snapshot.paddleState) {
    if (isSittingOut) {
      newPaddleState = addPlayerToWaiting(snapshot.paddleState, name);
    } else {
      newPaddleState = {
        ...snapshot.paddleState,
        w1: snapshot.paddleState.w1.filter(p => p !== name),
        l1: snapshot.paddleState.l1.filter(p => p !== name),
        waitingQueue: snapshot.paddleState.waitingQueue.filter(p => p !== name),
      };
    }
  }

  return {
    queue: newQueue,
    sittingOut: newSittingOut,
    courtSlots: snapshot.courtSlots,
    priorityPlayers: newPriorityPlayers,
    singlesState: newSinglesState ?? undefined,
    paddleState: newPaddleState ?? undefined,
    poolSinglesState: newPoolSinglesState ?? undefined,
  };
}

/**
 * Pure transition for replacing a called or on-court player (ADR-0003).
 * If target player cannot play:
 * - target player is moved to sittingOut.
 * - replacement fills the target's exact slot (in courtSlots if multi-court, or in queue if single-court).
 * - if explicitReplacement is omitted, the first eligible waiting player is selected automatically
 *   using priority-aware, pool-aware selection tiers.
 * - partner stays locked in place for that match.
 */
export function replaceCalledPlayerTransition(
  snapshot: QueueTransitionSnapshot,
  target: string,
  explicitReplacement?: string,
): TransitionResult | null {
  const isMultiCourt = Boolean(snapshot.courtSlots && snapshot.courtSlots.length > 0);
  const onCourtSlots = snapshot.courtSlots ?? [];
  const onCourtTargetSlotIdx = onCourtSlots.findIndex(slot => slot.onCourt.includes(target));

  const onCourtCount = snapshot.gameMode === 'doubles' ? 4 : 2;
  const activeMatchSet = isMultiCourt
    ? new Set(onCourtSlots.flatMap(slot => slot.onCourt))
    : new Set(snapshot.queue.slice(0, onCourtCount));

  const sittingOutSet = new Set(snapshot.sittingOut);
  const playerSet = new Set(snapshot.players);
  const isEligibleCandidate = (p: string) =>
    p !== target &&
    playerSet.has(p) &&
    !sittingOutSet.has(p) &&
    !activeMatchSet.has(p) &&
    snapshot.queue.includes(p);

  let replacement: string | undefined = explicitReplacement;

  if (replacement) {
    if (!isEligibleCandidate(replacement)) {
      return null;
    }
  } else {
    const priorityList = snapshot.priorityPlayers ?? [];
    if (isMultiCourt) {
      const candidates = [
        ...priorityList,
        ...snapshot.queue,
      ];
      replacement = candidates.find(isEligibleCandidate);
    } else if (snapshot.gameMode === 'doubles' && snapshot.paddleState) {
      const { w1, l1, waitingQueue } = snapshot.paddleState;
      const targetInW1 = w1.includes(target);
      const targetInL1 = !targetInW1 && l1.includes(target);
      const samePool = targetInW1 ? w1 : targetInL1 ? l1 : [];
      const otherPool = targetInW1 ? l1 : targetInL1 ? w1 : [...w1, ...l1];
      const candidates = [
        ...priorityList,
        ...samePool,
        ...waitingQueue,
        ...otherPool,
        ...snapshot.queue.slice(onCourtCount),
      ];
      replacement = candidates.find(isEligibleCandidate);
    } else if (snapshot.gameMode === 'singles') {
      const engineCandidates =
        snapshot.singlesFormat === 'pool' && snapshot.poolSinglesState
          ? [
              ...(snapshot.poolSinglesState.w1.includes(target)
                ? snapshot.poolSinglesState.w1
                : snapshot.poolSinglesState.l1.includes(target)
                  ? snapshot.poolSinglesState.l1
                  : []),
              ...snapshot.poolSinglesState.waitingQueue,
              ...snapshot.poolSinglesState.w1,
              ...snapshot.poolSinglesState.l1,
            ]
          : snapshot.singlesState
            ? [...snapshot.singlesState.queue, ...snapshot.singlesState.waitingQueue]
            : [];
      const candidates = [
        ...priorityList,
        ...engineCandidates,
        ...snapshot.queue.slice(onCourtCount),
      ];
      replacement = candidates.find(isEligibleCandidate);
    } else {
      const candidates = [
        ...priorityList,
        ...snapshot.queue.slice(onCourtCount),
      ];
      replacement = candidates.find(isEligibleCandidate);
    }

    if (!replacement) {
      return null;
    }
  }

  // 2. Target must be on court or in queue (and not already sitting out)
  const isTargetInCourtSlots = onCourtTargetSlotIdx !== -1;
  const isTargetInQueue = snapshot.queue.includes(target);

  if ((!isTargetInCourtSlots && !isTargetInQueue) || sittingOutSet.has(target)) {
    return null;
  }

  // 3. Update sittingOut
  const newSittingOut = snapshot.sittingOut.includes(target)
    ? snapshot.sittingOut
    : [...snapshot.sittingOut, target];

  let newQueue = [...snapshot.queue];
  let newCourtSlots = snapshot.courtSlots;
  let newSinglesState = snapshot.singlesState ?? undefined;
  let newPaddleState = snapshot.paddleState ?? undefined;
  let newPoolSinglesState = snapshot.poolSinglesState ?? undefined;

  if (isMultiCourt && isTargetInCourtSlots) {
    newCourtSlots = onCourtSlots.map((slot, idx) => {
      if (idx !== onCourtTargetSlotIdx) return slot;
      return {
        ...slot,
        onCourt: slot.onCourt.map(p => (p === target ? replacement! : p)),
      };
    });
    const newSittingOutSet = new Set(newSittingOut);
    newQueue = newQueue.filter(p => p !== replacement && !newSittingOutSet.has(p));
  } else {
    const targetIdx = newQueue.indexOf(target);
    const repIdx = newQueue.indexOf(replacement);
    if (targetIdx !== -1) {
      newQueue[targetIdx] = replacement;
      if (repIdx !== -1 && repIdx !== targetIdx) {
        newQueue = newQueue.filter((p, i) => i === targetIdx || p !== replacement);
      }
    } else {
      newQueue = newQueue.filter(p => p !== replacement);
    }

    if (snapshot.gameMode === 'singles') {
      if (snapshot.singlesFormat === 'pool' && snapshot.poolSinglesState) {
        const ps = snapshot.poolSinglesState;
        const targetW1Idx = ps.w1.indexOf(target);
        const targetL1Idx = ps.l1.indexOf(target);
        const cleanW1 = ps.w1.filter(p => p !== target && p !== replacement);
        const cleanL1 = ps.l1.filter(p => p !== target && p !== replacement);
        const cleanWait = ps.waitingQueue.filter(p => p !== target && p !== replacement);
        if (targetW1Idx !== -1) {
          cleanW1.splice(Math.min(targetW1Idx, cleanW1.length), 0, replacement);
        } else if (targetL1Idx !== -1) {
          cleanL1.splice(Math.min(targetL1Idx, cleanL1.length), 0, replacement);
        } else {
          cleanWait.push(replacement);
        }
        newPoolSinglesState = {
          ...ps,
          w1: cleanW1,
          l1: cleanL1,
          waitingQueue: cleanWait,
        };
      } else if (snapshot.singlesState) {
        const wasKing = snapshot.singlesState.king === target;
        const currentKing = snapshot.singlesState.king;
        const cleanQueue = snapshot.singlesState.queue.filter(
          p => p !== target && p !== replacement && p !== currentKing,
        );
        const cleanWaiting = snapshot.singlesState.waitingQueue.filter(
          p => p !== target && p !== replacement && p !== currentKing,
        );
        if (wasKing) {
          newSinglesState = {
            ...snapshot.singlesState,
            king: replacement,
            queue: cleanQueue,
            waitingQueue: cleanWaiting,
          };
        } else if (currentKing === null) {
          // INIT state: queue holds both on-court players and waiting players
          const targetIdxInEngine = snapshot.singlesState.queue.indexOf(target);
          const repIdxInEngine = snapshot.singlesState.queue.indexOf(replacement);
          const updatedEngineQueue = [...snapshot.singlesState.queue];
          if (targetIdxInEngine !== -1) {
            updatedEngineQueue[targetIdxInEngine] = replacement;
            const deduped = updatedEngineQueue.filter(
              (p, idx) => idx === targetIdxInEngine || (p !== replacement && p !== target),
            );
            newSinglesState = {
              ...snapshot.singlesState,
              queue: deduped,
              waitingQueue: cleanWaiting,
            };
          } else {
            newSinglesState = {
              ...snapshot.singlesState,
              queue: [replacement, ...cleanQueue],
              waitingQueue: cleanWaiting,
            };
          }
          void repIdxInEngine;
        } else {
          // Challenger replaced: put replacement at front of singlesState.queue and reset their lastPlayedMap so selectChallenger picks them
          const nextLastPlayed = { ...snapshot.singlesState.lastPlayedMap };
          delete nextLastPlayed[replacement];
          newSinglesState = {
            ...snapshot.singlesState,
            king: currentKing,
            queue: [replacement, ...cleanQueue],
            waitingQueue: cleanWaiting,
            lastPlayedMap: nextLastPlayed,
          };
        }
      }
    } else if (snapshot.gameMode === 'doubles' && snapshot.paddleState) {
      const ps = snapshot.paddleState;
      const targetW1Idx = ps.w1.indexOf(target);
      const targetL1Idx = ps.l1.indexOf(target);
      const targetWaitIdx = ps.waitingQueue.indexOf(target);

      const cleanW1 = ps.w1.filter(p => p !== target && p !== replacement);
      const cleanL1 = ps.l1.filter(p => p !== target && p !== replacement);
      const cleanWait = ps.waitingQueue.filter(p => p !== target && p !== replacement);

      if (targetW1Idx !== -1) {
        // Compute adjusted index if replacement was before target in w1
        const repW1Idx = ps.w1.indexOf(replacement);
        const insertIdx = repW1Idx !== -1 && repW1Idx < targetW1Idx ? targetW1Idx - 1 : targetW1Idx;
        cleanW1.splice(Math.min(insertIdx, cleanW1.length), 0, replacement);
      } else if (targetL1Idx !== -1) {
        const repL1Idx = ps.l1.indexOf(replacement);
        const insertIdx = repL1Idx !== -1 && repL1Idx < targetL1Idx ? targetL1Idx - 1 : targetL1Idx;
        cleanL1.splice(Math.min(insertIdx, cleanL1.length), 0, replacement);
      } else if (targetWaitIdx !== -1) {
        const repWaitIdx = ps.waitingQueue.indexOf(replacement);
        const insertIdx = repWaitIdx !== -1 && repWaitIdx < targetWaitIdx ? targetWaitIdx - 1 : targetWaitIdx;
        cleanWait.splice(Math.min(insertIdx, cleanWait.length), 0, replacement);
      }

      newPaddleState = {
        ...ps,
        w1: cleanW1,
        l1: cleanL1,
        waitingQueue: cleanWait,
      };
    }
  }

  const newPriorityPlayers = (snapshot.priorityPlayers ?? []).filter(
    p => p !== target && p !== replacement,
  );

  return {
    queue: newQueue,
    sittingOut: newSittingOut,
    courtSlots: newCourtSlots,
    priorityPlayers: newPriorityPlayers,
    singlesState: newSinglesState,
    paddleState: newPaddleState,
    poolSinglesState: newPoolSinglesState,
  };
}

export interface PaddleStateConsistency {
  valid: boolean;
  overlappingPools: string[];
  unknownPlayers: string[];
  sittingOutInPools: string[];
}

/**
 * Pure helper to verify single-court doubles engine pool consistency (F4):
 * - w1, l1, waitingQueue are pairwise disjoint.
 * - Every member of w1 ∪ l1 ∪ waitingQueue is in players.
 * - Nobody in sittingOut appears in w1, l1, or waitingQueue.
 */
export function checkPaddleStateConsistency(
  state: PaddleState,
  players: string[],
  sittingOut: string[],
): PaddleStateConsistency {
  const playerSet = new Set(players);
  const sitSet = new Set(sittingOut);
  const seen = new Set<string>();
  const overlappingPools: string[] = [];
  const unknownPlayers: string[] = [];
  const sittingOutInPools: string[] = [];

  for (const p of [...state.w1, ...state.l1, ...state.waitingQueue]) {
    if (seen.has(p) && !overlappingPools.includes(p)) {
      overlappingPools.push(p);
    }
    seen.add(p);
    if (!playerSet.has(p) && !unknownPlayers.includes(p)) {
      unknownPlayers.push(p);
    }
    if (sitSet.has(p) && !sittingOutInPools.includes(p)) {
      sittingOutInPools.push(p);
    }
  }

  return {
    valid:
      overlappingPools.length === 0 &&
      unknownPlayers.length === 0 &&
      sittingOutInPools.length === 0,
    overlappingPools,
    unknownPlayers,
    sittingOutInPools,
  };
}

/**
 * Pure transition for manual queue removal (ManualQueuePanel X button).
 * Phase 1 fix (Row 11):
 * - Sends the player to break (sittingOut) instead of making them vanish.
 * - Removes from queue at index.
 * - Adds to sittingOut (if not already present).
 * - Defensively removes from engine pools so they do not get paired.
 */
export function removeFromQueueTransition(
  snapshot: QueueTransitionSnapshot,
  index: number,
): TransitionResult {
  const removedPlayer = snapshot.queue[index];
  const newQueue = snapshot.queue.filter((_, j) => j !== index);
  const newSittingOut = removedPlayer && !snapshot.sittingOut.includes(removedPlayer)
    ? [...snapshot.sittingOut, removedPlayer]
    : snapshot.sittingOut;

  let newPaddleState = snapshot.paddleState ?? undefined;
  let newSinglesState = snapshot.singlesState ?? undefined;
  let newPoolSinglesState = snapshot.poolSinglesState ?? undefined;

  if (removedPlayer) {
    if (snapshot.gameMode === 'doubles' && snapshot.paddleState) {
      newPaddleState = {
        ...snapshot.paddleState,
        w1: snapshot.paddleState.w1.filter(p => p !== removedPlayer),
        l1: snapshot.paddleState.l1.filter(p => p !== removedPlayer),
        waitingQueue: snapshot.paddleState.waitingQueue.filter(p => p !== removedPlayer),
      };
    } else if (snapshot.gameMode === 'singles') {
      if (snapshot.singlesFormat === 'pool' && snapshot.poolSinglesState) {
        newPoolSinglesState = removePlayerFromPoolSinglesState(snapshot.poolSinglesState, removedPlayer);
      } else if (snapshot.singlesState) {
        newSinglesState = {
          ...snapshot.singlesState,
          king: snapshot.singlesState.king === removedPlayer ? null : snapshot.singlesState.king,
          queue: snapshot.singlesState.queue.filter(p => p !== removedPlayer),
          waitingQueue: snapshot.singlesState.waitingQueue.filter(p => p !== removedPlayer),
        };
      }
    }
  }

  const newPriorityPlayers = (snapshot.priorityPlayers ?? []).filter(
    p => p !== removedPlayer,
  );

  return {
    queue: newQueue,
    sittingOut: newSittingOut,
    courtSlots: snapshot.courtSlots,
    priorityPlayers: newPriorityPlayers,
    singlesState: newSinglesState,
    paddleState: newPaddleState,
    poolSinglesState: newPoolSinglesState,
  };
}

/**
 * Pure transition for substituting an absent player (handleConfirmSub).
 * - Replaces absent with replacement in queue.
 * - Adds absent to sittingOut.
 * - Does not touch courtSlots.
 */
export function confirmSubTransition(
  snapshot: QueueTransitionSnapshot,
  absent: string,
  replacement: string,
): TransitionResult | null {
  const absentIdx = snapshot.queue.indexOf(absent);
  const repIdx = snapshot.queue.indexOf(replacement);
  if (absentIdx === -1 || repIdx === -1) return null;

  const newQueue = [...snapshot.queue];
  newQueue[absentIdx] = replacement;
  newQueue.splice(repIdx, 1);
  const newSittingOut = [...snapshot.sittingOut, absent];

  let newSinglesState = snapshot.singlesState ?? undefined;
  let newPaddleState = snapshot.paddleState ?? undefined;
  let newPoolSinglesState = snapshot.poolSinglesState ?? undefined;

  if (snapshot.gameMode === 'singles') {
    if (snapshot.singlesFormat === 'pool') {
      if (snapshot.poolSinglesState) {
        let ns = removePlayerFromPoolSinglesState(snapshot.poolSinglesState, absent);
        ns = addPlayerToPoolSinglesWaiting(ns, replacement);
        newPoolSinglesState = ns;
      }
    } else if (snapshot.singlesState) {
      const wasKing = snapshot.singlesState.king === absent;
      newSinglesState = {
        ...snapshot.singlesState,
        king: wasKing ? replacement : snapshot.singlesState.king,
        queue: snapshot.singlesState.queue
          .filter(p => p !== replacement)
          .map(p => p === absent ? replacement : p),
        waitingQueue: snapshot.singlesState.waitingQueue.filter(p => p !== absent && p !== replacement),
      };
    }
  } else if (snapshot.gameMode === 'doubles' && snapshot.paddleState) {
    newPaddleState = {
      ...snapshot.paddleState,
      w1: snapshot.paddleState.w1.filter(p => p !== absent),
      l1: snapshot.paddleState.l1.filter(p => p !== absent),
      waitingQueue: snapshot.paddleState.waitingQueue.filter(p => p !== absent),
    };
  }

  const newPriorityPlayers = (snapshot.priorityPlayers ?? []).filter(
    p => p !== absent && p !== replacement,
  );

  return {
    queue: newQueue,
    sittingOut: newSittingOut,
    courtSlots: snapshot.courtSlots,
    priorityPlayers: newPriorityPlayers,
    singlesState: newSinglesState,
    paddleState: newPaddleState,
    poolSinglesState: newPoolSinglesState,
  };
}



/**
 * Fundamental player accounting selector.
 * Evaluates whether every player in snapshot.players partitions cleanly into:
 *   onCourt + queued + onBreak === players.length
 * Without overlap or missing players.
 *
 * Notice: queued is honest to the queue state; it does not mask players who
 * might be erroneously duplicated in sittingOut or onCourt.
 */
export function accountPlayers(snapshot: QueueTransitionSnapshot): PlayerAccounting {
  const breakSet = new Set(snapshot.sittingOut ?? []);
  const onBreak = snapshot.players.filter(p => breakSet.has(p));

  let onCourt: string[] = [];
  let queued: string[] = [];

  const isMultiCourt = Boolean(snapshot.courtSlots && snapshot.courtSlots.length > 0);

  if (isMultiCourt) {
    onCourt = (snapshot.courtSlots ?? []).flatMap(c => c.onCourt);
    const onCourtSet = new Set(onCourt);
    queued = snapshot.queue.filter(p => !onCourtSet.has(p));
  } else {
    const onCourtCount = snapshot.gameMode === 'doubles' ? 4 : 2;
    onCourt = snapshot.queue.slice(0, onCourtCount);
    queued = snapshot.queue.slice(onCourtCount);
  }

  const zoneCounts = new Map<string, number>();
  for (const p of onCourt) zoneCounts.set(p, (zoneCounts.get(p) ?? 0) + 1);
  for (const p of queued) zoneCounts.set(p, (zoneCounts.get(p) ?? 0) + 1);
  for (const p of onBreak) zoneCounts.set(p, (zoneCounts.get(p) ?? 0) + 1);

  const missing: string[] = [];
  const duplicates: string[] = [];

  for (const p of snapshot.players) {
    const count = zoneCounts.get(p) ?? 0;
    if (count === 0) missing.push(p);
    else if (count > 1) duplicates.push(p);
  }

  return {
    onCourt,
    queued,
    onBreak,
    missing,
    duplicates,
  };
}
