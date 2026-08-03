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
): PlannedCourtResult | null {
  const slot = state.courtSlots.find(court => court.id === courtId);
  if (!slot || slot.onCourt.length !== 4) return null;
  if (slot.onCourt.some((player, index) => player !== expectedPlayers[index])) return null;

  const teamA = slot.onCourt.slice(0, 2) as [string, string];
  const teamB = slot.onCourt.slice(2, 4) as [string, string];
  const winner = (winningSide === 'A' ? teamA : teamB).join(' & ');
  const unavailable = new Set(state.sittingOut ?? []);
  const occupiedElsewhere = new Set(
    state.courtSlots
      .filter(court => court.id !== courtId)
      .flatMap(court => court.onCourt),
  );
  const eligibleWaiting = state.queue.filter(
    player => !unavailable.has(player) && !occupiedElsewhere.has(player),
  );
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
