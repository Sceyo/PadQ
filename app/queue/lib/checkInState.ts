import { sanitizePlayerName } from './pasteParser';

export interface PreSessionCheckInState {
  expected: string[];
  checkedIn: string[];
}

export function createInitialCheckInState(): PreSessionCheckInState {
  return {
    expected: [],
    checkedIn: [],
  };
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
  let expected = [...state.expected];
  let checkedIn = [...state.checkedIn];

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
