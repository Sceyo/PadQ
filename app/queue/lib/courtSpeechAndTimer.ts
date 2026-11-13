/**
 * Court Match Timer and TTS Voice Callouts.
 *
 * Provides:
 *  - Deterministic mm:ss formatting for elapsed match time
 *  - SpeechSynthesis voice callouts for announcing matchups
 *  - Zero-Firestore-schema client-side court start timestamp persistence
 */

export function formatElapsedSeconds(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function buildCourtCalloutText(
  courtName: string,
  teamA: string[],
  teamB: string[],
  gameMode: 'singles' | 'doubles',
): string {
  const strA = teamA.join(' and ');
  const strB = teamB.join(' and ');
  if (gameMode === 'singles') {
    return `${courtName}: ${strA} versus ${strB}.`;
  }
  return `${courtName}: ${strA}, versus ${strB}.`;
}

export function speakCourtCallout(text: string): boolean {
  try {
    const synth =
      typeof window !== 'undefined'
        ? window.speechSynthesis
        : (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    const UtteranceClass =
      typeof window !== 'undefined'
        ? window.SpeechSynthesisUtterance
        : (globalThis as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance })
            .SpeechSynthesisUtterance;

    if (!synth || !UtteranceClass) return false;

    synth.cancel();
    const utterance = new UtteranceClass(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage
    ) {
      return (globalThis as unknown as { sessionStorage: Storage }).sessionStorage;
    }
  } catch {
    return null;
  }
  return null;
}

const memoryCourtTimers = new Map<string, { lineupKey: string; startedAt: number }>();

export function getOrInitCourtStartTime(courtId: string, lineupKey: string): number {
  if (!lineupKey) return Date.now();

  const storageKey = `padq_timer_${courtId}`;
  const storage = getStorage();

  if (storage) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.lineupKey === lineupKey && typeof parsed.startedAt === 'number') {
          return parsed.startedAt;
        }
      }
    } catch {
      // fallback
    }
  } else {
    const mem = memoryCourtTimers.get(courtId);
    if (mem && mem.lineupKey === lineupKey) {
      return mem.startedAt;
    }
  }

  const now = Date.now();
  if (storage) {
    try {
      storage.setItem(storageKey, JSON.stringify({ lineupKey, startedAt: now }));
    } catch {
      // ignore
    }
  }
  memoryCourtTimers.set(courtId, { lineupKey, startedAt: now });
  return now;
}
