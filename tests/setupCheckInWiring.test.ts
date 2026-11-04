import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  resolvePastedPlayers,
  uncheckAllPlayers,
  persistSessionLateArrivals,
  loadSessionLateArrivals,
  saveSessionLateArrivals,
  CHECKIN_DRAFT_KEY,
  saveCheckInDraft,
  loadCheckInDraft,
} from '../app/queue/lib/checkInState';

describe('Pre-Session Check-In & Smart Paste Wiring', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
    });
  });

  describe('resolvePastedPlayers (Bug #1)', () => {
  it('sanitizes numbered Reclub/WhatsApp lists and stops at Waitlist header', () => {
    const raw = 'Confirmed:\n1. Juan (PAID)\n2. Maria ✅ - Guest\nWaitlist:\n3. Sub Player';
    const res = resolvePastedPlayers(raw, { expected: [], checkedIn: [] }, 'checkedIn', 30);
    expect(res.nextState.checkedIn).toEqual(['Juan', 'Maria']);
    expect(res.addedCount).toBe(2);
    expect(res.duplicateCount).toBe(0);
  });

  it('promotes an expected player to checkedIn on paste and counts already-checked-in names as duplicates', () => {
    const raw = '1. Ana (PAID)\n2. Ben\n3. Ana\n4. Cara';
    const initial = { expected: ['Ben'], checkedIn: ['Ana'] };
    const res = resolvePastedPlayers(raw, initial, 'checkedIn', 30);
    expect(res.nextState.checkedIn).toEqual(['Ana', 'Ben', 'Cara']);
    expect(res.nextState.expected).toEqual([]);
    expect(res.addedCount).toBe(2); // Ben promoted + Cara added
    expect(res.duplicateCount).toBe(2); // Ana appeared twice while already checked in
  });

  it('enforces the 30-player total cap across expected + checkedIn', () => {
    const existing = Array.from({ length: 29 }, (_, i) => `P${i + 1}`);
    const res = resolvePastedPlayers('1. NewOne\n2. NewTwo', { expected: [], checkedIn: existing }, 'checkedIn', 30);
    expect(res.nextState.checkedIn).toHaveLength(30);
    expect(res.nextState.checkedIn[29]).toBe('NewOne');
  });
});

describe('Pre-Session Check-In handoff & batch uncheck (Bug #3)', () => {
  it('moves all checked-in players into expected without duplicates on uncheckAllPlayers', () => {
    const next = uncheckAllPlayers({ expected: ['Zed'], checkedIn: ['Ana', 'Ben'] });
    expect(next).toEqual({ expected: ['Zed', 'Ana', 'Ben'], checkedIn: [] });
  });

  it('persists remaining expected players under padq_late_arrivals_<startResult.sessionId> and clears draft', () => {
    saveCheckInDraft(CHECKIN_DRAFT_KEY, { expected: ['Late1', 'Late2'], checkedIn: ['P1', 'P2', 'P3', 'P4', 'P5'] });
    const handedOff = persistSessionLateArrivals('ABC234', ['Late1', 'Late2']);
    expect(handedOff).toEqual(['Late1', 'Late2']);
    expect(loadSessionLateArrivals('ABC234')).toEqual(['Late1', 'Late2']);
    expect(loadCheckInDraft(CHECKIN_DRAFT_KEY)).toBeNull();
  });
});
});
