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
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db, ensureAuthenticated } from './firebase';
import { generateRoomCode } from './roomCode';

// ── Types ─────────────────────────────────────────────────

export interface MatchHistoryEntry {
  id: number;
  mode: string;
  players: string;
  winner: string;
  score?: string;
  timestamp: string;
  commandId?: string;
  revision?: number;
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
  hostUid: string;
  revision: number;
  gameMode: 'singles' | 'doubles';
  queueMode: 'default' | 'tournament' | 'playall' | 'skilled';
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
  /** Firestore-safe partner pairs (nested arrays are not supported). */
  lockedPartners?: Array<{ a: string; b: string }>;
  sittingOut?: string[];
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

class RoomCodeCollisionError extends Error {}

const sessionRef = (id: string) => doc(db, 'sessions', id);

// ── Core CRUD ─────────────────────────────────────────────

/**
 * createSession
 * Called when the host clicks "Start Queue".
 * Returns the room code; Firebase Auth persistence proves host ownership.
 */
export async function createSession(
  data: Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt' | 'updatedAt' | 'lastActiveAt'>,
): Promise<{ sessionId: string }> {
  const user = await ensureAuthenticated();
  for (let attempt = 0; attempt < 8; attempt++) {
    const sessionId = generateRoomCode();
    try {
      await runTransaction(db, async tx => {
        const ref = sessionRef(sessionId);
        if ((await tx.get(ref)).exists()) throw new RoomCodeCollisionError();
        tx.set(ref, {
          ...data,
          hostUid: user.uid,
          revision: 0,
          isLive:       false,
          createdAt:    serverTimestamp(),
          updatedAt:    serverTimestamp(),
          lastActiveAt: serverTimestamp(),
        });
      });
      return { sessionId };
    } catch (error) {
      if (!(error instanceof RoomCodeCollisionError)) throw error;
    }
  }
  throw new Error('Unable to reserve a room code. Please try again.');
}

/**
 * loadSession
 * Called on page load if localStorage has a sessionId.
 * Returns null if the session doesn't exist.
 */
export async function loadSession(sessionId: string): Promise<SessionDoc | null> {
  await ensureAuthenticated();
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
  patch: Partial<Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt'>>,
): Promise<void> {
  await ensureAuthenticated();
  try {
    await updateDoc(sessionRef(sessionId), {
      ...patch,
      updatedAt:    serverTimestamp(),
      lastActiveAt: serverTimestamp(),   // ← resets TTL countdown on every host write
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'failed-precondition') return;
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
  expectedRevision: number,
  updater: (current: Pick<SessionDoc, 'queue' | 'players' | 'tournamentMatches'>) =>
    Partial<SessionDoc>,
): Promise<number> {
  const user = await ensureAuthenticated();
  const ref = sessionRef(sessionId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Session not found');

      const current = snap.data() as SessionDoc;
      if (current.hostUid !== user.uid) throw new Error('Not the host');
      if (current.revision !== expectedRevision) {
        throw new StaleSessionRevisionError(expectedRevision, current.revision);
      }

      const patch = updater({
        queue:             current.queue,
        players:           current.players,
        tournamentMatches: current.tournamentMatches,
      });

      tx.update(ref, {
        ...patch,
        revision: expectedRevision + 1,
        updatedAt:    serverTimestamp(),
        lastActiveAt: serverTimestamp(),   // ← resets TTL countdown
      });
      return expectedRevision + 1;
    });
    return expectedRevision + 1;
  } catch (err: unknown) {
    // Silently ignore optimistic concurrency conflicts — the real-time
    // listener (onSnapshot) will reconcile state automatically.
    // Any other error (auth, network) is re-thrown.
    if ((err as { code?: string })?.code === 'failed-precondition') {
      throw new StaleSessionRevisionError(expectedRevision, expectedRevision + 1);
    }
    throw err;
  }
}

/** Revision-checked update for fields that can change the next match assignment. */
export async function updateSessionSafely(
  sessionId: string,
  expectedRevision: number,
  patch: Partial<Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt'>>,
): Promise<number> {
  const user = await ensureAuthenticated();
  return runTransaction(db, async tx => {
    const ref = sessionRef(sessionId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Session not found');
    const current = snap.data() as SessionDoc;
    if (current.hostUid !== user.uid) throw new Error('Not the host');
    if (current.revision !== expectedRevision) {
      throw new StaleSessionRevisionError(expectedRevision, current.revision);
    }
    const nextRevision = expectedRevision + 1;
    tx.update(ref, {
      ...patch,
      revision: nextRevision,
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });
    return nextRevision;
  });
}

/**
 * batchMatchResult  ← atomic queue update + history write
 *
 * Combines the queue patch and history entry into a single Firestore
 * writeBatch so viewers never see the new queue without the matching
 * history entry. Replaces the two-step updateQueueSafely + addHistoryEntry
 * pattern used in commitMatchResult.
 */
export class StaleSessionRevisionError extends Error {
  constructor(public expected: number, public actual: number) {
    super(`Session changed before this result was saved (expected revision ${expected}, found ${actual})`);
    this.name = 'StaleSessionRevisionError';
  }
}

export type CommitMatchResult = { status: 'committed' | 'duplicate'; revision: number };

export async function batchMatchResult(
  sessionId: string,
  expectedRevision: number,
  commandId: string,
  patch: Partial<Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt'>>,
  entry: Omit<MatchHistoryEntry, 'commandId' | 'revision'>,
): Promise<CommitMatchResult> {
  const user = await ensureAuthenticated();
  const sRef   = sessionRef(sessionId);
  const hRef   = doc(db, 'sessions', sessionId, 'history', commandId);

  return runTransaction(db, async tx => {
    const sessionSnap = await tx.get(sRef);
    const historySnap = await tx.get(hRef);
    if (!sessionSnap.exists()) throw new Error('Session not found');
    const current = sessionSnap.data() as SessionDoc;
    if (current.hostUid !== user.uid) throw new Error('Not the host');
    if (historySnap.exists()) return { status: 'duplicate', revision: current.revision };
    if (current.revision !== expectedRevision) {
      throw new StaleSessionRevisionError(expectedRevision, current.revision);
    }

    const nextRevision = expectedRevision + 1;
    tx.update(sRef, {
      ...patch,
      revision: nextRevision,
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });
    const clean: Record<string, unknown> = {
      id: entry.id, mode: entry.mode, players: entry.players,
      winner: entry.winner, timestamp: entry.timestamp,
      commandId, revision: nextRevision,
    };
    if (entry.score !== undefined) clean.score = entry.score;
    tx.set(hRef, clean);
    return { status: 'committed', revision: nextRevision };
  });
}

/**
 * touchSession
 * Lightweight heartbeat — only updates lastActiveAt.
 * Call this when the host resumes a session without making a data write
 * (e.g. reopening the tab), so the TTL clock is reset.
 */
export async function touchSession(
  sessionId: string,
): Promise<void> {
  try {
    await ensureAuthenticated();
    await updateDoc(sessionRef(sessionId), {
      updatedAt: serverTimestamp(),
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
): Promise<void> {
  // Firestore rules validate the current authenticated UID against hostUid.
  try {
    await ensureAuthenticated();
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
  const user = await ensureAuthenticated();
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (sessionSnap.exists() && (sessionSnap.data() as SessionDoc).hostUid !== user.uid) {
    throw new Error('Not the host');
  }
  const histRef = collection(db, 'sessions', sessionId, 'history');
  const snap = await getDocs(histRef);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

/**
 * deleteLatestHistoryEntry
 * Removes the most-recently-written history document (highest `id` value).
 * Used by the undo feature to roll back the last match result.
 */
export async function deleteLatestHistoryEntry(sessionId: string): Promise<void> {
  await ensureAuthenticated();
  const q = query(
    collection(db, 'sessions', sessionId, 'history'),
    orderBy('id', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (!snap.empty) await deleteDoc(snap.docs[0].ref);
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
    limit(100),
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

export function saveHostToStorage(sessionId: string, gameMode: string) {
  localStorage.setItem(LS_SESSION_ID, sessionId);
  localStorage.setItem(LS_GAME_MODE,  gameMode);
}

export function loadHostFromStorage(): {
  sessionId: string | null;
  gameMode: string | null;
} {
  return {
    sessionId: localStorage.getItem(LS_SESSION_ID),
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
// Persistent list of player names (with optional skill bracket)
// the host builds once and pulls from when setting up each court.

export type SkillBracket = 'beginner' | 'intermediate' | 'advanced';

export interface RosterEntry {
  name:   string;
  skill?: SkillBracket;
}

const LS_ROSTER = 'padq_roster';

export function loadRoster(): RosterEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_ROSTER) ?? '[]');
    // Migrate from legacy string[] format
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      return (raw as string[]).map(name => ({ name }));
    }
    return raw as RosterEntry[];
  } catch {
    return [];
  }
}

export function saveRoster(entries: RosterEntry[]): void {
  localStorage.setItem(LS_ROSTER, JSON.stringify(entries));
}

/** Merge new names into the roster (deduplicates case-insensitively, preserves order). */
export function mergeIntoRoster(names: string[]): void {
  const current = loadRoster();
  const seen    = new Set(current.map(e => e.name.toLowerCase()));
  const added   = names.filter(n => !seen.has(n.toLowerCase())).map(n => ({ name: n }));
  if (added.length > 0) saveRoster([...current, ...added]);
}

export function removeFromRoster(name: string): void {
  saveRoster(loadRoster().filter(e => e.name !== name));
}

/** Set or clear the skill bracket for one roster entry. */
export function setRosterEntrySkill(name: string, skill: SkillBracket | undefined): void {
  const updated = loadRoster().map(e =>
    e.name === name ? (skill ? { ...e, skill } : { name: e.name }) : e
  );
  saveRoster(updated);
}

// ── Career Stats localStorage helpers ─────────────────────
// Accumulates per-player wins/losses across sessions on this device.
// Survives session TTL expiry — keyed by player name.

export interface PlayerCareerStat {
  wins:        number;
  losses:      number;
  gamesPlayed: number;
}

export type CareerStatsMap = Record<string, PlayerCareerStat>;

const LS_CAREER_STATS = 'padq_career_stats';

export function loadCareerStats(): CareerStatsMap {
  try { return JSON.parse(localStorage.getItem(LS_CAREER_STATS) ?? '{}'); }
  catch { return {}; }
}

export function saveCareerStats(stats: CareerStatsMap): void {
  localStorage.setItem(LS_CAREER_STATS, JSON.stringify(stats));
}

/**
 * recordCareerResult
 * Merges one match result into the persistent career stats store.
 * `players` format: "A vs B" or "A & B vs C & D"
 * `winner`  format: "A" or "A & B"
 */
export function recordCareerResult(players: string, winner: string): void {
  const stats       = loadCareerStats();
  const winnerNames = winner.split(' & ').map(n => n.trim());
  const allNames    = players
    .split(' vs ').flatMap(s => s.split(' & ')).map(n => n.trim()).filter(Boolean);

  for (const name of allNames) {
    if (!stats[name]) stats[name] = { wins: 0, losses: 0, gamesPlayed: 0 };
    stats[name].gamesPlayed++;
    if (winnerNames.includes(name)) stats[name].wins++;
    else                             stats[name].losses++;
  }
  saveCareerStats(stats);
}

// ── Skilled Brackets localStorage helpers ─────────────────
// Persists per-session skill-bracket assignments across page refreshes.
// Shape mirrors SkilledBrackets in SkilledView.tsx.

export interface SkilledBracketsStore {
  beginner:     string[];
  intermediate: string[];
  advanced:     string[];
}

const LS_SKILLED_BRACKETS = 'padq_skilled_brackets';

export function loadSkilledBrackets(): SkilledBracketsStore {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SKILLED_BRACKETS) ?? 'null');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as SkilledBracketsStore;
  } catch { /* ignore */ }
  return { beginner: [], intermediate: [], advanced: [] };
}

export function saveSkilledBrackets(b: SkilledBracketsStore): void {
  localStorage.setItem(LS_SKILLED_BRACKETS, JSON.stringify(b));
}

export function clearSkilledBrackets(): void {
  localStorage.removeItem(LS_SKILLED_BRACKETS);
}
