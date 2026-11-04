import { sanitizePlayerName, cleanPlayerName, HEADER_PATTERN } from './pasteParser';

export interface PreSessionCheckInState {
  expected: string[];
  checkedIn: string[];
}

const WAITLIST_CUTOFF_PATTERN = /^\s*(?:waitlist|waiting\s*list)\s*:?\s*$/i;

/**
 * Resolves pasted player lists against the current check-in state.
 * Stops processing at any Waitlist section, sanitizes noisy chat/bullet markers,
 * deduplicates against both checkedIn and expected lists, and promotes expected
 * players to checkedIn when target is 'checkedIn'.
 */
export function resolvePastedPlayers(
  rawInput: string,
  state: PreSessionCheckInState,
  target: 'expected' | 'checkedIn',
  maxTotal = 30,
): { nextState: PreSessionCheckInState; addedCount: number; duplicateCount: number } {
  if (!rawInput || !rawInput.trim()) {
    return { nextState: state, addedCount: 0, duplicateCount: 0 };
  }

  let effectiveText = rawInput;
  const lines = rawInput.split(/\r?\n/);
  const waitlistIndex = lines.findIndex(l => WAITLIST_CUTOFF_PATTERN.test(l.trim()));
  if (waitlistIndex !== -1) {
    effectiveText = lines.slice(0, waitlistIndex).join('\n');
  }

  const rawSegments: string[] = [];
  const effectiveLines = effectiveText.split(/\r?\n/);
  for (const line of effectiveLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (HEADER_PATTERN.test(trimmed)) continue;

    if (!trimmed.includes('|') && (trimmed.includes(',') || trimmed.includes(';'))) {
      const parts = trimmed.split(/[,;]+/);
      for (const p of parts) {
        if (p.trim()) rawSegments.push(p.trim());
      }
    } else {
      rawSegments.push(trimmed);
    }
  }

  const expected = [...state.expected];
  const checkedIn = [...state.checkedIn];
  let addedCount = 0;
  let duplicateCount = 0;

  for (const raw of rawSegments) {
    const clean = cleanPlayerName(raw);
    if (!clean) continue;
    const lower = clean.toLowerCase();

    const inExpectedIdx = expected.findIndex(p => p.toLowerCase() === lower);
    const inCheckedInIdx = checkedIn.findIndex(p => p.toLowerCase() === lower);

    if (target === 'checkedIn') {
      if (inCheckedInIdx !== -1) {
        duplicateCount++;
        continue;
      }
      if (inExpectedIdx !== -1) {
        const existingName = expected[inExpectedIdx];
        expected.splice(inExpectedIdx, 1);
        checkedIn.push(existingName);
        addedCount++;
      } else {
        if (checkedIn.length + expected.length < maxTotal) {
          checkedIn.push(clean);
          addedCount++;
        }
      }
    } else {
      // target === 'expected'
      if (inCheckedInIdx !== -1 || inExpectedIdx !== -1) {
        duplicateCount++;
        continue;
      }
      if (checkedIn.length + expected.length < maxTotal) {
        expected.push(clean);
        addedCount++;
      }
    }
  }

  return {
    nextState: { expected, checkedIn },
    addedCount,
    duplicateCount,
  };
}

export function createInitialCheckInState(): PreSessionCheckInState {
  return {
    expected: [],
    checkedIn: [],
  };
}

export function initCheckInState(expectedNames: string[] = []): PreSessionCheckInState {
  const initial = createInitialCheckInState();
  if (expectedNames.length > 0) {
    return addPlayersToCheckIn(initial, expectedNames, 'expected');
  }
  return initial;
}

/**
 * Adds new player names to either 'expected' or 'checkedIn'.
 * Automatically deduplicates case-insensitively across both lists.
 * If target is 'checkedIn' and player was already in 'expected', they move to 'checkedIn'.
 */
export function addPlayersToCheckIn(
  state: PreSessionCheckInState,
  names: string[],
  target: 'expected' | 'checkedIn',
  maxTotal = 30,
): PreSessionCheckInState {
  const expected = [...state.expected];
  const checkedIn = [...state.checkedIn];

  for (const raw of names) {
    const clean = sanitizePlayerName(raw);
    if (!clean) continue;
    const lower = clean.toLowerCase();

    const inExpectedIdx = expected.findIndex(p => p.toLowerCase() === lower);
    const inCheckedInIdx = checkedIn.findIndex(p => p.toLowerCase() === lower);

    if (target === 'checkedIn') {
      if (inCheckedInIdx !== -1) {
        // Already checked in
        continue;
      }
      if (inExpectedIdx !== -1) {
        // Move from expected to checked in
        const existingName = expected[inExpectedIdx];
        expected.splice(inExpectedIdx, 1);
        checkedIn.push(existingName);
      } else {
        if (checkedIn.length + expected.length < maxTotal) {
          checkedIn.push(clean);
        }
      }
    } else {
      // target === 'expected'
      if (inCheckedInIdx !== -1 || inExpectedIdx !== -1) {
        // Already exists in one of the lists
        continue;
      }
      if (checkedIn.length + expected.length < maxTotal) {
        expected.push(clean);
      }
    }
  }

  return { expected, checkedIn };
}

/**
 * Moves a player from expected to the end of checkedIn (preserving arrival order).
 */
export function checkInPlayer(state: PreSessionCheckInState, name: string): PreSessionCheckInState {
  const lower = name.toLowerCase().trim();
  const idx = state.expected.findIndex(p => p.toLowerCase() === lower);
  if (idx === -1) {
    return state;
  }

  const existingName = state.expected[idx];
  const nextExpected = state.expected.filter((_, i) => i !== idx);
  const nextCheckedIn = [...state.checkedIn, existingName];

  return {
    expected: nextExpected,
    checkedIn: nextCheckedIn,
  };
}

/**
 * Moves a player from checkedIn back into expected (alphabetized).
 */
export function undoCheckInPlayer(state: PreSessionCheckInState, name: string): PreSessionCheckInState {
  const lower = name.toLowerCase().trim();
  const idx = state.checkedIn.findIndex(p => p.toLowerCase() === lower);
  if (idx === -1) {
    return state;
  }

  const existingName = state.checkedIn[idx];
  const nextCheckedIn = state.checkedIn.filter((_, i) => i !== idx);
  const nextExpected = [...state.expected, existingName];

  return {
    expected: nextExpected,
    checkedIn: nextCheckedIn,
  };
}

/**
 * Checks in all remaining expected players in order, up to maxCheckedIn capacity.
 */
export function checkInAllPlayers(
  state: PreSessionCheckInState,
  maxCheckedIn = 30,
): PreSessionCheckInState {
  const availableSlots = Math.max(0, maxCheckedIn - state.checkedIn.length);
  const toCheckIn = state.expected.slice(0, availableSlots);
  const remainingExpected = state.expected.slice(availableSlots);

  return {
    expected: remainingExpected,
    checkedIn: [...state.checkedIn, ...toCheckIn],
  };
}

/**
 * Completely removes a player from either list.
 */
export function removePlayerFromCheckIn(
  state: PreSessionCheckInState,
  name: string,
): PreSessionCheckInState {
  const lower = name.toLowerCase().trim();
  return {
    expected: state.expected.filter(p => p.toLowerCase() !== lower),
    checkedIn: state.checkedIn.filter(p => p.toLowerCase() !== lower),
  };
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

/**
 * Safely saves the check-in draft to localStorage.
 */
export function saveCheckInDraft(storageKey: string, state: PreSessionCheckInState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage full or blocked errors
  }
}

/**
 * Safely loads the check-in draft from localStorage.
 */
export function loadCheckInDraft(storageKey: string): PreSessionCheckInState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.expected) && Array.isArray(parsed.checkedIn)) {
      return {
        expected: parsed.expected.filter((p: unknown): p is string => typeof p === 'string'),
        checkedIn: parsed.checkedIn.filter((p: unknown): p is string => typeof p === 'string'),
      };
    }
  } catch {
    // Ignore invalid JSON or storage errors
  }
  return null;
}

export const CHECKIN_DRAFT_KEY = 'padq_checkin_draft';
export const lateArrivalsStorageKey = (sessionId: string) => `padq_late_arrivals_${sessionId}`;

/**
 * Moves all checked-in players back into expected arrivals without duplicates.
 */
export function uncheckAllPlayers(state: PreSessionCheckInState): PreSessionCheckInState {
  const expected = [...state.expected];
  for (const name of state.checkedIn) {
    if (!expected.some(p => p.toLowerCase() === name.toLowerCase())) {
      expected.push(name);
    }
  }
  return {
    expected,
    checkedIn: [],
  };
}

/**
 * Safely clears the check-in draft from localStorage.
 */
export function clearCheckInDraft(storageKey: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Persists late arrival expected players under their official session room code key
 * and cleans up pre-session drafts.
 */
export function persistSessionLateArrivals(sessionId: string, expected: string[]): string[] {
  saveSessionLateArrivals(sessionId, expected);
  clearCheckInDraft(CHECKIN_DRAFT_KEY);
  return [...expected];
}

/**
 * Saves late arrivals for a live session.
 */
export function saveSessionLateArrivals(sessionId: string, lateArrivals: string[]): void {
  const storage = getStorage();
  if (!storage) return;
  const key = lateArrivalsStorageKey(sessionId);
  try {
    if (lateArrivals.length > 0) {
      storage.setItem(key, JSON.stringify(lateArrivals));
    } else {
      storage.removeItem(key);
    }
  } catch {}
}

/**
 * Safely updates the late arrivals list after an attempted check-in.
 * Only removes the player case-insensitively when didAdd is true.
 */
export function applyLateArrivalCheckIn(
  lateArrivals: string[],
  name: string,
  didAdd: boolean,
): string[] {
  if (!didAdd) return [...lateArrivals];
  const lower = name.toLowerCase().trim();
  return lateArrivals.filter(p => p.toLowerCase().trim() !== lower);
}

/**
 * Loads late arrivals for a live session.
 */
export function loadSessionLateArrivals(sessionId: string): string[] {
  const storage = getStorage();
  if (!storage) return [];
  const key = lateArrivalsStorageKey(sessionId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p: unknown): p is string => typeof p === 'string');
    }
  } catch {}
  return [];
}
