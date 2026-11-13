/**
 * Turn context resolution for spectator watch views (/watch/[sessionId]).
 * Normalizes multi-court and single-court setups so turn alerts and queue
 * ETA calculations function consistently without off-by-one errors.
 */

export interface WatchTurnContextInput {
  gameMode: 'singles' | 'doubles';
  courtName?: string;
  courtSlots?: Array<{ id: string; name: string; onCourt: string[] }>;
  queue?: string[];
  sittingOut?: string[];
  priorityPlayers?: string[];
}

export interface WatchTurnContext {
  playersPerMatch: 2 | 4;
  effectiveCourts: Array<{ id: string; name: string; onCourt: string[] }>;
  waitingQueue: string[];
  activeCourtCount: number;
}

export function resolveWatchTurnContext(input: WatchTurnContextInput): WatchTurnContext {
  const gameMode = input.gameMode ?? 'doubles';
  const playersPerMatch: 2 | 4 = gameMode === 'singles' ? 2 : 4;
  const courtSlots = input.courtSlots ?? [];
  const rawQueue = input.queue ?? [];
  const sittingOutSet = new Set((input.sittingOut ?? []).map(p => p.toLowerCase()));
  const priorityPlayers = input.priorityPlayers ?? [];
  const prioritySet = new Set(priorityPlayers.map(p => p.toLowerCase()));

  if (courtSlots.length > 0) {
    const effectiveCourts = courtSlots.map(c => ({
      id: c.id,
      name: c.name,
      onCourt: [...c.onCourt],
    }));

    // Filter sittingOut from queue
    const filteredQueue = rawQueue.filter(p => !sittingOutSet.has(p.toLowerCase()));

    // Promote priority players to the front of the waiting queue
    const priorityWaiting = priorityPlayers.filter(p =>
      filteredQueue.some(q => q.toLowerCase() === p.toLowerCase())
    );
    const otherWaiting = filteredQueue.filter(p => !prioritySet.has(p.toLowerCase()));
    const waitingQueue = [...priorityWaiting, ...otherWaiting];

    return {
      playersPerMatch,
      effectiveCourts,
      waitingQueue,
      activeCourtCount: effectiveCourts.length,
    };
  }

  // Single-court:
  // In single-court mode, courtSlots is empty in SessionDoc.
  // The first `playersPerMatch` non-resting players in queue are on court.
  const filteredQueue = rawQueue.filter(p => !sittingOutSet.has(p.toLowerCase()));
  const onCourt = filteredQueue.slice(0, playersPerMatch);
  const remaining = filteredQueue.slice(playersPerMatch);

  const priorityWaiting = priorityPlayers.filter(p =>
    remaining.some(r => r.toLowerCase() === p.toLowerCase())
  );
  const otherWaiting = remaining.filter(p => !prioritySet.has(p.toLowerCase()));
  const waitingQueue = [...priorityWaiting, ...otherWaiting];

  const effectiveCourts = [
    {
      id: 'court-0',
      name: input.courtName || 'Court 1',
      onCourt,
    },
  ];

  return {
    playersPerMatch,
    effectiveCourts,
    waitingQueue,
    activeCourtCount: 1,
  };
}
