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
}

export interface PlannedCourtResult {
  queue: string[];
  courtSlots: MultiCourtSlot[];
  courtName: string;
  players: string;
  winner: string;
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

  if (gameMode === 'singles') {
    const [playerA, playerB] = slot.onCourt;
    const winner = winningSide === 'A' ? playerA : playerB;
    const loser = winningSide === 'A' ? playerB : playerA;
    const nextChallenger = eligibleWaiting[0];
    const nextOnCourt = nextChallenger ? [winner, nextChallenger] : [winner, loser];
    const queue = nextChallenger
      ? [...state.queue.filter(player => player !== nextChallenger), loser]
      : [...state.queue];
    const courtSlots = state.courtSlots.map(court =>
      court.id === courtId ? { ...court, onCourt: nextOnCourt } : court,
    );

    return {
      queue,
      courtSlots,
      courtName: slot.name,
      players: `${playerA} vs ${playerB}`,
      winner,
    };
  }

  const teamA = slot.onCourt.slice(0, 2) as [string, string];
  const teamB = slot.onCourt.slice(2, 4) as [string, string];
  const winner = (winningSide === 'A' ? teamA : teamB).join(' & ');
  const lockedPartners: LockedPartnerPair[] = (state.lockedPartners ?? []).map(
    pair => [pair.a, pair.b],
  );
  const next = rotateMultiCourtDoubles(eligibleWaiting, slot.onCourt, lockedPartners);
  const courtSlots = state.courtSlots.map(court =>
    court.id === courtId ? { ...court, onCourt: next.onCourt } : court,
  );

  return {
    queue: next.waiting,
    courtSlots,
    courtName: slot.name,
    players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}`,
    winner,
  };
}
