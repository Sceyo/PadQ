import { rotateMultiCourtDoubles, type LockedPartnerPair } from './doublesEngine';

export interface MultiCourtSlot {
  id: string;
  name: string;
  onCourt: string[];
}

export interface MultiCourtResultState {
  queue: string[];
  courtSlots: MultiCourtSlot[];
  lockedPartners?: Array<{ a: string; b: string }>;
  sittingOut?: string[];
  priorityPlayers?: string[];
}

export interface PlannedCourtResult {
  queue: string[];
  courtSlots: MultiCourtSlot[];
  courtName: string;
  players: string;
  winner: string;
  priorityPlayers?: string[];
}

export function planMultiCourtResult(
  state: MultiCourtResultState,
  courtId: string,
  expectedPlayers: string[],
  winningSide: 'A' | 'B',
  gameMode: 'singles' | 'doubles' = 'doubles',
): PlannedCourtResult | null {
  const slot = state.courtSlots.find(court => court.id === courtId);
  const expectedCourtSize = gameMode === 'singles' ? 2 : 4;
  if (!slot || slot.onCourt.length !== expectedCourtSize) return null;
  if (slot.onCourt.some((player, index) => player !== expectedPlayers[index])) return null;

  const unavailable = new Set(state.sittingOut ?? []);
  const occupiedElsewhere = new Set(
    state.courtSlots
      .filter(court => court.id !== courtId)
      .flatMap(court => court.onCourt),
  );
  const eligibleWaiting = state.queue.filter(
    player => !unavailable.has(player) && !occupiedElsewhere.has(player),
  );

  const priorityList = state.priorityPlayers ?? [];
  const prioritySet = new Set(priorityList);
  const eligiblePriority = priorityList.filter(
    p => eligibleWaiting.includes(p) && !unavailable.has(p) && !occupiedElsewhere.has(p),
  );
  const remainingEligible = eligibleWaiting.filter(p => !prioritySet.has(p));
  const orderedWaiting = [...eligiblePriority, ...remainingEligible];

  if (gameMode === 'singles') {
    const [playerA, playerB] = slot.onCourt;
    const winner = winningSide === 'A' ? playerA : playerB;
    const loser = winningSide === 'A' ? playerB : playerA;

    const isWinnerAvailable = !unavailable.has(winner);
    const isLoserAvailable = !unavailable.has(loser);

    let nextOnCourt: string[];
    let consumedWaitingCount: number;

    if (isWinnerAvailable) {
      const nextChallenger = orderedWaiting[0];
      if (nextChallenger) {
        nextOnCourt = [winner, nextChallenger];
        consumedWaitingCount = 1;
      } else if (isLoserAvailable) {
        nextOnCourt = [winner, loser];
        consumedWaitingCount = 0;
      } else {
        nextOnCourt = [winner, ''];
        consumedWaitingCount = 0;
      }
    } else {
      // Winner is sitting out -> steps down to break
      const challengerA = orderedWaiting[0] ?? '';
      const challengerB = orderedWaiting[1] ?? (isLoserAvailable ? loser : '');
      nextOnCourt = [challengerA, challengerB];
      consumedWaitingCount = (orderedWaiting[0] ? 1 : 0) + (orderedWaiting[1] ? 1 : 0);
    }

    const consumedChallengers = new Set(orderedWaiting.slice(0, consumedWaitingCount));
    const remainingWaiting = state.queue.filter(
      player => !consumedChallengers.has(player) && !unavailable.has(player),
    );
    const queue = isLoserAvailable && !nextOnCourt.includes(loser)
      ? [...remainingWaiting, loser]
      : remainingWaiting;

    const courtSlots = state.courtSlots.map(court =>
      court.id === courtId ? { ...court, onCourt: nextOnCourt } : court,
    );

    const nextOnCourtSet = new Set(nextOnCourt.filter(Boolean));
    const nextPriorityPlayers = priorityList.filter(
      p => !nextOnCourtSet.has(p) && !unavailable.has(p),
    );

    return {
      queue,
      courtSlots,
      courtName: slot.name,
      players: `${playerA} vs ${playerB}`,
      winner,
      priorityPlayers: nextPriorityPlayers,
    };
  }

  const teamA = slot.onCourt.slice(0, 2) as [string, string];
  const teamB = slot.onCourt.slice(2, 4) as [string, string];
  const winner = (winningSide === 'A' ? teamA : teamB).join(' & ');
  const lockedPartners: LockedPartnerPair[] = (state.lockedPartners ?? []).map(
    pair => [pair.a, pair.b],
  );

  // Defensively exclude any finisher who is sittingOut so they do not re-enter queue or court
  const availableFinishers = slot.onCourt.filter(player => !unavailable.has(player));
  const next = rotateMultiCourtDoubles(orderedWaiting, availableFinishers, lockedPartners);
  const courtSlots = state.courtSlots.map(court =>
    court.id === courtId ? { ...court, onCourt: next.onCourt } : court,
  );

  const nextOnCourtSet = new Set(next.onCourt);
  const nextPriorityPlayers = priorityList.filter(
    p => !nextOnCourtSet.has(p) && !unavailable.has(p),
  );

  return {
    queue: next.waiting.filter(player => !unavailable.has(player)),
    courtSlots,
    courtName: slot.name,
    players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}`,
    winner,
    priorityPlayers: nextPriorityPlayers,
  };
}
