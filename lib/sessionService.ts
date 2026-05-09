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
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
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
  liveScore?: LiveScoreState | null;
  /**
   * isLive — set to true only when the host explicitly clicks "Go Live".
   * When false, the session exists in Firestore but viewers are blocked
   * from connecting — the watch page shows "Session not live yet".
   * This prevents accidental exposure before the host is ready.
   */
  isLive?: boolean;
  /**
   * accessPin — optional 4-char uppercase PIN set by the host.
   * null/undefined = anyone with the room code can view.
   * string = viewer must enter PIN before seeing session content.
   * Stored in plain text; sessions expire in 30 min so brute-force
   * within that window is impractical given Firebase's rate limits.
   */
  accessPin?: string | null;
  /** Display name for this court, shown in CourtTabs (host UI only). */
  courtName?: string;
  doublesEngineState?: Record<string, unknown> | null;
  singlesEngineState?: Record<string, unknown> | null;
  /**
   * courtSlots — multi-court mode.
   * Each slot holds the 4 players currently on that court.
   * onCourt[0..1] = Team A, onCourt[2..3] = Team B.
   * When undefined, the session runs in single-court mode.
   */
  courtSlots?: CourtSlot[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  /**
   * lastActiveAt — stamped on EVERY host write.
   * Used by Firestore TTL policy to auto-delete idle sessions.
   * Configure TTL in Firebase Console → Firestore → TTL policies:
   *   Collection: sessions  |  Field: lastActiveAt  |  TTL: 30 minutes
   * (See SETUP.md for exact steps — it's 3 clicks, no Cloud Functions needed)
   */
  lastActiveAt?: Timestamp;
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
  data: Omit<SessionDoc, 'hostToken' | 'createdAt' | 'updatedAt' | 'lastActiveAt'>,
): Promise<{ sessionId: string; hostToken: string }> {
  const sessionId  = generateRoomCode();
  const hostToken  = generateId();

  await setDoc(sessionRef(sessionId), {
    ...data,
    hostToken,
    isLive:       false,           // ← host must explicitly go live
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
    lastActiveAt: serverTimestamp(),
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
      updatedAt:    serverTimestamp(),
      lastActiveAt: serverTimestamp(),   // ← resets TTL countdown on every host write
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
        updatedAt:    serverTimestamp(),
        lastActiveAt: serverTimestamp(),   // ← resets TTL countdown
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

/**
 * touchSession
 * Lightweight heartbeat — only updates lastActiveAt.
 * Call this when the host resumes a session without making a data write
 * (e.g. reopening the tab), so the TTL clock is reset.
 */
export async function touchSession(
  sessionId: string,
  hostToken: string,
): Promise<void> {
  try {
    await updateDoc(sessionRef(sessionId), {
      hostToken,
      lastActiveAt: serverTimestamp(),
    });
  } catch {
    // Non-critical — ignore errors silently
  }
}

/**
 * deleteSession
 * Permanently removes a session document.
 * Note: Firestore TTL handles automatic cleanup — this is for
 * explicit host-initiated deletion (e.g. hard reset).
 */
export async function deleteSession(
  sessionId: string,
  hostToken: string,
): Promise<void> {
  // Firestore delete rule requires hostToken in the request —
  // we do a final update (which validates hostToken) then delete.
  // The rules allow delete if request.resource.data.hostToken matches,
  // so we use updateDoc first to confirm identity, then deleteDoc.
  try {
    await updateDoc(sessionRef(sessionId), { hostToken, lastActiveAt: serverTimestamp() });
    await deleteDoc(sessionRef(sessionId));
  } catch {
    // If already deleted, ignore
  }
}

/**
 * clearHistory
 * Deletes all documents in the history subcollection using a batch.
 * Firestore batch deletes up to 500 docs atomically.
 * Called when the host clicks "Clear History".
 */
export async function clearHistory(
  sessionId: string,
): Promise<void> {
  const histRef = collection(db, 'sessions', sessionId, 'history');
  const snap = await getDocs(histRef);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

/**
 * subscribeToSession
 * Real-time listener on the session document.
 * Handles three events:
 *   onChange  — document updated (normal operation)
 *   onDeleted — document was deleted (TTL fired or host hard-reset)
 *   onError   — Firestore connection error
 */
export function subscribeToSession(
  sessionId: string,
  onChange:  (data: SessionDoc) => void,
  onError?:  (err: Error) => void,
  onDeleted?: () => void,
): Unsubscribe {
  return onSnapshot(
    sessionRef(sessionId),
    (snap) => {
      if (snap.exists()) {
        onChange(snap.data() as SessionDoc);
      } else {
        // Document gone — either TTL deleted it or hard reset
        onDeleted?.();
      }
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

// ── Multi-court types ────────────────────────────────────

/**
 * CourtSlot — one court in a multi-court session.
 * onCourt is always 4 players ordered [teamA[0], teamA[1], teamB[0], teamB[1]].
 */
export interface CourtSlot {
  id: string;        // stable identifier: 'court-0', 'court-1', …
  name: string;      // display name: 'Court 1', 'Court 2', …
  onCourt: string[]; // exactly 4 players when a match is live, [] when initialising
}

// ── Court Group localStorage helpers ─────────────────────
// Tracks multiple active court sessions so a host can manage
// more than one court from a single device.

const LS_COURT_GROUP = 'padq_court_group';

export interface CourtEntry {
  sessionId: string;
  hostToken: string;
  gameMode: string;
  name: string;      // "Court 1", "Court 2", etc.
}

export function loadCourtGroup(): CourtEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_COURT_GROUP) ?? '[]');
  } catch {
    return [];
  }
}

export function saveCourtGroup(courts: CourtEntry[]) {
  localStorage.setItem(LS_COURT_GROUP, JSON.stringify(courts));
}

export function addCourtToGroup(entry: CourtEntry) {
  const current = loadCourtGroup().filter(c => c.sessionId !== entry.sessionId);
  saveCourtGroup([...current, entry]);
}

export function removeCourtFromGroup(sessionId: string) {
  saveCourtGroup(loadCourtGroup().filter(c => c.sessionId !== sessionId));
}

export function clearCourtGroup() {
  localStorage.removeItem(LS_COURT_GROUP);
}

// ── Club Roster localStorage helpers ─────────────────────
// Persistent list of player names the host builds once and
// pulls from when setting up each court — no re-typing needed.

const LS_ROSTER = 'padq_roster';

export function loadRoster(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_ROSTER) ?? '[]'); }
  catch { return []; }
}

export function saveRoster(names: string[]): void {
  localStorage.setItem(LS_ROSTER, JSON.stringify(names));
}

/** Merge new names into the roster (deduplicates, preserves order). */
export function mergeIntoRoster(names: string[]): void {
  const current = loadRoster();
  const seen = new Set(current);
  const added = names.filter(n => !seen.has(n));
  if (added.length > 0) saveRoster([...current, ...added]);
}

export function removeFromRoster(name: string): void {
  saveRoster(loadRoster().filter(n => n !== name));
}