import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createInitialCheckInState,
  addPlayersToCheckIn,
  checkInPlayer,
  undoCheckInPlayer,
  checkInAllPlayers,
  removePlayerFromCheckIn,
  saveCheckInDraft,
  loadCheckInDraft,
  clearCheckInDraft,
} from '../app/queue/lib/checkInState';

describe('checkInState', () => {
  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
    });
  });

  it('manages transitions between expected and checkedIn while preserving arrival order', () => {
    let state = createInitialCheckInState();
    state = addPlayersToCheckIn(state, ['Alice', 'Bob', 'Charlie'], 'expected');
    expect(state.expected).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(state.checkedIn).toEqual([]);

    // Bob arrives first
    state = checkInPlayer(state, 'Bob');
    expect(state.checkedIn).toEqual(['Bob']);
    expect(state.expected).toEqual(['Alice', 'Charlie']);

    // Alice arrives second
    state = checkInPlayer(state, 'Alice');
    expect(state.checkedIn).toEqual(['Bob', 'Alice']);
    expect(state.expected).toEqual(['Charlie']);

    // Undo Alice check-in
    state = undoCheckInPlayer(state, 'Alice');
    expect(state.checkedIn).toEqual(['Bob']);
    expect(state.expected).toContain('Alice');
  });

  it('checks in all remaining players at once respecting capacity bounds', () => {
    let state = createInitialCheckInState();
    state = addPlayersToCheckIn(state, ['A', 'B', 'C'], 'expected');
    state = checkInPlayer(state, 'B');
    state = checkInAllPlayers(state, 30);
    expect(state.expected).toEqual([]);
    expect(state.checkedIn).toEqual(['B', 'A', 'C']);
  });

  it('removes a player completely from either expected or checkedIn', () => {
    let state = createInitialCheckInState();
    state = addPlayersToCheckIn(state, ['Alice', 'Bob'], 'expected');
    state = checkInPlayer(state, 'Alice');
    state = removePlayerFromCheckIn(state, 'Alice');
    state = removePlayerFromCheckIn(state, 'Bob');
    expect(state.expected).toEqual([]);
    expect(state.checkedIn).toEqual([]);
  });

  it('deduplicates case-insensitively and clamps names to 60 chars', () => {
    let state = createInitialCheckInState();
    state = addPlayersToCheckIn(state, ['Alice', 'alice', '  Bob  '], 'expected');
    expect(state.expected).toEqual(['Alice', 'Bob']);

    // Trying to add Bob to checkedIn when already in expected will move or ignore
    state = addPlayersToCheckIn(state, ['bob'], 'checkedIn');
    expect(state.checkedIn).toEqual(['Bob']);
    expect(state.expected).toEqual(['Alice']);
  });

  it('safely serializes and restores draft from localStorage without throwing', () => {
    const state = {
      expected: ['Charlie'],
      checkedIn: ['Alice', 'Bob'],
    };
    saveCheckInDraft('test_key', state);
    const loaded = loadCheckInDraft('test_key');
    expect(loaded).toEqual(state);

    clearCheckInDraft('test_key');
    expect(loadCheckInDraft('test_key')).toBeNull();
  });
});
