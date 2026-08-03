import { describe, expect, it } from 'vitest';
import { estimateV1EventCapacity } from '@/lib/v1CapacityModel';

const players = Array.from({ length: 30 }, (_, index) => `Player ${index + 1}`);
const sessionPayload = {
  players,
  queue: players.slice(12),
  courtSlots: Array.from({ length: 3 }, (_, index) => ({
    id: `court-${index}`,
    name: `Court ${index + 1}`,
    onCourt: players.slice(index * 4, index * 4 + 4),
  })),
  lockedPartners: Array.from({ length: 15 }, (_, index) => ({
    a: players[index * 2],
    b: players[index * 2 + 1],
  })),
  sittingOut: [],
};
const historyPayload = {
  id: 1750000000000,
  mode: 'Doubles (Court 3)',
  players: 'Player 21 & Player 22 vs Player 23 & Player 24',
  winner: 'Player 21 & Player 22',
  timestamp: '8:30:00 PM',
  commandId: '11111111-1111-4111-8111-111111111111',
  revision: 150,
};
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe('V1 Firebase Spark capacity model', () => {
  it('keeps one full 30-viewer, 150-match event well below the operating budget', () => {
    const estimate = estimateV1EventCapacity({
      viewers: 30,
      matchResults: 150,
      historyViewers: 30,
      operationalUpdates: 30,
      sessionDocumentBytes: bytes(sessionPayload),
      historyDocumentBytes: bytes(historyPayload),
    });

    expect(estimate.reads).toBeLessThan(35_000);
    expect(estimate.writes).toBeLessThan(10_000);
    expect(estimate.deletesOnCleanup).toBeLessThan(20_000);
    expect(estimate.storageBytesBeforeCleanup).toBeLessThan(1_000_000);
    expect(estimate.transferBytes).toBeLessThan(100_000_000);
  });

  it('keeps two simultaneous full rooms below the same daily read/write guardrails', () => {
    const oneRoom = estimateV1EventCapacity({
      viewers: 30,
      matchResults: 150,
      historyViewers: 30,
      operationalUpdates: 30,
      sessionDocumentBytes: bytes(sessionPayload),
      historyDocumentBytes: bytes(historyPayload),
    });

    expect(oneRoom.reads * 2).toBeLessThan(35_000);
    expect(oneRoom.writes * 2).toBeLessThan(10_000);
  });
});
