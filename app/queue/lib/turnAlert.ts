/**
 * Turn Alert utility for spectator (/watch) mode.
 *
 * Allows spectators to "tap their name" to arm a turn alert that vibrates
 * and chimes when their status transitions to "On deck" or "On court".
 */

export type PlayerTurnZone = 'on-court' | 'on-deck' | 'waiting' | 'absent';

export interface TurnZoneResult {
  zone: PlayerTurnZone;
  courtName?: string;
}

export function getPlayerTurnZone(
  playerName: string,
  courtSlots: Array<{ name: string; onCourt: string[] }>,
  waitingQueue: string[],
  playersPerMatch: number,
): TurnZoneResult {
  if (!playerName) return { zone: 'absent' };

  for (const court of courtSlots) {
    if (court.onCourt && court.onCourt.includes(playerName)) {
      return { zone: 'on-court', courtName: court.name };
    }
  }

  const queueIndex = waitingQueue.indexOf(playerName);
  if (queueIndex !== -1) {
    if (queueIndex < playersPerMatch) {
      return { zone: 'on-deck' };
    }
    return { zone: 'waiting' };
  }

  return { zone: 'absent' };
}

export function shouldTriggerTurnAlert(
  prevZone: PlayerTurnZone | null,
  nextZone: PlayerTurnZone,
): boolean {
  if (!prevZone) return false;
  if (prevZone === 'waiting' && nextZone === 'on-deck') return true;
  if (prevZone === 'waiting' && nextZone === 'on-court') return true;
  if (prevZone === 'on-deck' && nextZone === 'on-court') return true;
  return false;
}

export function fireBrowserTurnAlert(_message?: string): void {
  if (typeof window === 'undefined') return;

  // 1. Vibration
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Ignore vibration failures if blocked by policy
  }

  // 2. Web Audio chime
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignore audio failures if autoplay is blocked
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

const memoryWatchedPlayers = new Map<string, string>();

export function getWatchedPlayer(sessionId: string): string | null {
  const storage = getStorage();
  if (storage) {
    try {
      const item = storage.getItem(`padq_watch_player_${sessionId}`);
      if (item !== null) return item;
    } catch {
      // fallback
    }
  }
  return memoryWatchedPlayers.get(sessionId) ?? null;
}

export function setWatchedPlayer(sessionId: string, playerName: string | null): void {
  const storage = getStorage();
  if (storage) {
    try {
      if (playerName) {
        storage.setItem(`padq_watch_player_${sessionId}`, playerName);
      } else {
        storage.removeItem(`padq_watch_player_${sessionId}`);
      }
    } catch {
      // fallback
    }
  }
  if (playerName) {
    memoryWatchedPlayers.set(sessionId, playerName);
  } else {
    memoryWatchedPlayers.delete(sessionId);
  }
}
