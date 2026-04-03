// lib/sessionService.ts
// ═══════════════════════════════════════════════════════════
// All Firestore operations for PADQ sessions are here.
// The UI never imports firebase/firestore directly —
// it only calls these typed functions.
//
// WHY A SERVICE LAYER?
//  • Single place to change if we switch databases
//  • Race conditions handled centrally with runTransaction
//  • Easy to mock in tests
// ═══════════════════════════════════════════════════════════

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  collection,
  addDoc,
  query,
  orderBy,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────

export interface MatchHistoryEntry {
  id: number;
  mode: string;
  players: string;
  winner: string;
  score?: string;
  timestamp: string;
  hostToken?: string;   // attached server-side for rule validation
}

export interface TournamentMatch {
  id: number;
  round: number;
  slot: number;
  bracket: 'W' | 'L' | 'GF';
  player1: string | null;
  player2: string | null;
  winner: string | null;
  loser: string | null;
  isBye: boolean;
}

/** Live score state — written by host on every point, read by viewers in real-time */
export interface LiveScoreState {
  scoreA:    number;
  scoreB:    number;
  labelA:    string;
  labelB:    string;
  limit:     number;    // current winning threshold (extends during deuce)
  baseLimit: number;    // original limit chosen by host
  deuce:     boolean;   // true when both sides reached baseLimit - 1
  active:    boolean;   // false when scoring toggled off or match finished
}

/**
 * The shape of a PADQ session document in Firestore.
 * All fields are optional so partial updates work cleanly.
 */
export interface SessionDoc {
  hostToken: string;
  gameMode: 'singles' | 'doubles';
  queueMode: 'default' | 'tournament' | 'playall';
  elimType: 'single' | 'double';
  players: string[];
  queue: string[];
  playAllRel: Record<string, number>;
  tournamentMatches: TournamentMatch[];
  tournamentActive: boolean;
  tournamentWinner: string | null;
  liveScore?: LiveScoreState | null;   // ← live score for viewer sync
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastActiveAt?: Timestamp;
  expiresAt?: Timestamp;
}

// ── Helpers ───────────────────────────────────────────────

/** Generate a UUID-style room code */
function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10).toUpperCase();
}

/** Short human-readable room code shown in the UI (e.g. "AB3X") */
export function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

const sessionRef = (id: string) => doc(db, 'sessions', id);

// ── Core CRUD ─────────────────────────────────────────────

/**
 * createSession
 * Called when the host clicks "Start Queue".
 * Returns { sessionId, hostToken } — host saves both to localStorage.
 */
export async function createSession(
  data: Omit<SessionDoc, 'hostToken' | 'createdAt' | 'updatedAt'>,
): Promise<{ sessionId: string; hostToken: string }> {
  const sessionId  = generateRoomCode();     // short, shareable
  const hostToken  = generateId();           // long, secret

  const now = Date.now();

  await setDoc(sessionRef(sessionId), {
    ...data,
    hostToken,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    expiresAt: new Date(now + 24 * 60 * 60 * 1000), // +24h
  });

  return { sessionId, hostToken };
}

/**
 * loadSession
 * Called on page load if localStorage has a sessionId.
 * Returns null if the session doesn't exist.
 */
export async function loadSession(sessionId: string): Promise<SessionDoc | null> {
  const snap = await getDoc(sessionRef(sessionId));
  return snap.exists() ? (snap.data() as SessionDoc) : null;
}

/**
 * updateSession
 * Partial update — only sends the fields that changed.
 * Silently ignores optimistic concurrency conflicts (failed-precondition)
 * because the next onSnapshot will reconcile state.
 */
export async function updateSession(
  sessionId: string,
  hostToken: string,
  patch: Partial<Omit<SessionDoc, 'hostToken' | 'createdAt'>>,
): Promise<void> {
  try {
    await updateDoc(sessionRef(sessionId), {
      ...patch,
      hostToken,
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (err: any) {
    if (err?.code === 'failed-precondition') return;
    throw err;
  }
}

/**
 * updateQueueSafely  ← race-condition-proof queue update
 *
 * Uses a Firestore transaction so concurrent writes don't silently
 * overwrite each other. Firestore retries automatically on conflict.
 *
 * "failed-precondition" errors happen when the document was updated
 * between the transaction's read and write (optimistic concurrency).
 * These are expected in rapid-fire scenarios (e.g. score sync + queue
 * update happening at the same millisecond). We catch and ignore them
 * because the subsequent onSnapshot will deliver the correct state.
 */
export async function updateQueueSafely(
  sessionId: string,
  hostToken: string,
  updater: (current: Pick<SessionDoc, 'queue' | 'players' | 'tournamentMatches'>) =>
    Partial<SessionDoc>,
): Promise<void> {
  const ref = sessionRef(sessionId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Session not found');

      const current = snap.data() as SessionDoc;
      if (current.hostToken !== hostToken) throw new Error('Not the host');

      const patch = updater({
        queue:             current.queue,
        players:           current.players,
        tournamentMatches: current.tournamentMatches,
      });

      tx.update(ref, {
        ...patch,
        hostToken,
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });
  } catch (err: any) {
    // Silently ignore optimistic concurrency conflicts — the real-time
    // listener (onSnapshot) will reconcile state automatically.
    // Any other error (auth, network) is re-thrown.
    if (err?.code === 'failed-precondition') return;
    throw err;
  }
}

/**
 * addHistoryEntry
 * Match history is a Firestore subcollection.
 * IMPORTANT: Firestore rejects `undefined` values — we strip them here
 * so optional fields like `score` don't cause "Unsupported field value" errors.
 */
export async function addHistoryEntry(
  sessionId: string,
  hostToken: string,
  entry: Omit<MatchHistoryEntry, 'hostToken'>,
): Promise<void> {
  const histRef = collection(db, 'sessions', sessionId, 'history');
  // Build a clean object with no undefined values
  const clean: Record<string, unknown> = {
    id:        entry.id,
    mode:      entry.mode,
    players:   entry.players,
    winner:    entry.winner,
    timestamp: entry.timestamp,
    hostToken,
  };
  // Only include score if it's actually set
  if (entry.score !== undefined) clean.score = entry.score;
  await addDoc(histRef, clean);
}

// ── Real-time Subscriptions ───────────────────────────────

/**
 * subscribeToSession
 * Sets up a real-time listener on the session document.
 * Calls onChange every time any field changes.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeToSession(
  sessionId: string,
  onChange: (data: SessionDoc) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    sessionRef(sessionId),
    (snap) => {
      if (snap.exists()) onChange(snap.data() as SessionDoc);
    },
    (err) => onError?.(err),
  );
}

/**
 * subscribeToHistory
 * Real-time listener on the history subcollection.
 * Ordered newest-first to match the existing UI expectation.
 */
export function subscribeToHistory(
  sessionId: string,
  onChange: (entries: MatchHistoryEntry[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'sessions', sessionId, 'history'),
    orderBy('id', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map(d => d.data() as MatchHistoryEntry);
    onChange(entries);
  });
}

// ── localStorage helpers ──────────────────────────────────
// Keep session identity in localStorage so the host can
// reload the page and resume as host without re-entering anything.

const LS_SESSION_ID  = 'padq_session_id';
const LS_HOST_TOKEN  = 'padq_host_token';
const LS_GAME_MODE   = 'padq_game_mode';

export function saveHostToStorage(sessionId: string, hostToken: string, gameMode: string) {
  localStorage.setItem(LS_SESSION_ID, sessionId);
  localStorage.setItem(LS_HOST_TOKEN, hostToken);
  localStorage.setItem(LS_GAME_MODE,  gameMode);
}

export function loadHostFromStorage(): {
  sessionId: string | null;
  hostToken: string | null;
  gameMode: string | null;
} {
  return {
    sessionId: localStorage.getItem(LS_SESSION_ID),
    hostToken:  localStorage.getItem(LS_HOST_TOKEN),
    gameMode:   localStorage.getItem(LS_GAME_MODE),
  };
}

export function clearHostFromStorage() {
  localStorage.removeItem(LS_SESSION_ID);
  localStorage.removeItem(LS_HOST_TOKEN);
  localStorage.removeItem(LS_GAME_MODE);
}