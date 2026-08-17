// hooks/useSession.ts
// ═══════════════════════════════════════════════════════════
// Bridge between Firebase Firestore and the PADQ UI.
//
// WHAT IT DOES:
//  1. On mount — checks localStorage and resumes a session if found
//  2. Exposes typed write functions for the host
//  3. Subscribes to Firestore (onSnapshot) and feeds changes
//     back into local React state for all clients in real-time
//
// The host is identified by Firebase Anonymous Auth. Match writes carry a
// revision and deterministic command ID so concurrent results cannot overwrite.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import {
  createSession,
  loadSession,
  updateSession,
  updateSessionSafely,
  updateQueueSafely,
  batchMatchResult,
  commitMultiCourtResult,
  clearHistory,
  deleteSessionData,
  deleteLatestHistoryEntry,
  touchSession,
  subscribeToSession,
  subscribeToHistory,
  saveHostToStorage,
  loadHostFromStorage,
  clearHostFromStorage,
  loadCourtGroup,
  SessionDoc,
  MatchHistoryEntry,
  TournamentMatch,
  LiveScoreState,
  CourtSlot,
  StaleSessionRevisionError,
  type CommitMatchResult,
  type CourtResultCommand,
  type CourtResultCommit,
} from '@/lib/sessionService';

// ── Types ──────────────────────────────────────────────────

type QueueMode       = 'default' | 'tournament' | 'playall' | 'skilled';
type EliminationType = 'single' | 'double';

export interface SessionState {
  sessionId:         string | null;
  revision:          number;
  isHost:            boolean;
  isConnected:       boolean;   // true once first Firestore snapshot arrives
  isSaving:          boolean;   // true while a write is in-flight
  isReconnecting:    boolean;   // true when onSnapshot drops and is retrying
  isExpired:         boolean;   // true when session was deleted (TTL or hard reset)

  // Persisted fields (mirrors Firestore document)
  players:           string[];
  queue:             string[];
  playAllRel:        Record<string, number>;
  queueMode:         QueueMode;
  elimType:          EliminationType;
  tournamentMatches: TournamentMatch[];
  tournamentActive:  boolean;
  tournamentWinner:  string | null;
  matchHistory:      MatchHistoryEntry[];
  liveScore:         LiveScoreState | null;
  isLive:            boolean;   // true only after host explicitly clicks "Go Live"
  courtSlots:        CourtSlot[];  // empty = single-court mode
  lockedPartners:    [string, string][];
  doublesEngineState: Record<string, unknown> | null;
  singlesEngineState: Record<string, unknown> | null;
  sittingOut:        string[];
}

export interface SessionActions {
  startSession:      (data: Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt' | 'updatedAt'>) => Promise<StartSessionResult>;
  joinSession:       (sessionId: string) => Promise<boolean>;
  endSession:        () => void;
  commitMatchResult: (patch: Partial<SessionDoc>, entry: Omit<MatchHistoryEntry, 'commandId' | 'revision'>) => Promise<MatchResultOutcome | null>;
  commitCourtResult: (command: CourtResultCommand) => Promise<CourtResultOutcome | null>;
  undoLastMatch:     (patch: Partial<SessionDoc>) => Promise<void>;
  syncField:         (patch: Partial<Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt'>>) => Promise<void>;
  clearMatchHistory: () => Promise<void>;
  deleteHostedSession: () => Promise<void>;
}

type CourtResultFailureReason = 'permission' | 'unavailable' | 'unknown';

export type MatchResultOutcome = CommitMatchResult | {
  status: 'stale';
} | {
  status: 'failed';
  reason: CourtResultFailureReason;
};

export type CourtResultOutcome = CourtResultCommit | {
  status: 'failed';
  reason: CourtResultFailureReason;
};

function courtResultFailureReason(error: unknown): CourtResultFailureReason {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code.includes('permission-denied') || code.includes('unauthenticated')) return 'permission';
  if (code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('network')) return 'unavailable';
  return 'unknown';
}

export type StartSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; message: string };

function startSessionErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
    return 'PADQ could not start the room because Anonymous Authentication is disabled in Firebase.';
  }
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Firebase blocked room creation. Confirm the deployed Firestore rules and try again.';
  }
  if (code === 'unavailable' || code === 'firestore/unavailable') {
    return 'Firebase is temporarily unavailable. Check your connection and try again.';
  }
  return 'PADQ could not create the live room. No queue was started; please try again.';
}

// ── Initial state ──────────────────────────────────────────

const INITIAL_STATE: SessionState = {
  sessionId:         null,
  revision:          0,
  isHost:            false,
  isConnected:       false,
  isSaving:          false,
  isReconnecting:    false,
  isExpired:         false,
  players:           [],
  queue:             [],
  playAllRel:        {},
  queueMode:         'default',
  elimType:          'single',
  tournamentMatches: [],
  tournamentActive:  false,
  tournamentWinner:  null,
  matchHistory:      [],
  liveScore:         null,
  isLive:            false,
  courtSlots:        [],
  lockedPartners:    [],
  doublesEngineState: null,
  singlesEngineState: null,
  sittingOut:        [],
};

// ── Hook ───────────────────────────────────────────────────

export function useSession(): SessionState & SessionActions {

  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  // Refs so async callbacks always see the latest values
  // without stale closures
  const sessionIdRef        = useRef<string | null>(null);
  const revisionRef         = useRef(0);
  // Queue host writes so rapid UI actions (for example, finishing a scored
  // match and immediately editing the roster) cannot race or reuse a revision.
  const revisionWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const unsubSessionRef     = useRef<(() => void) | null>(null);
  const unsubHistoryRef     = useRef<(() => void) | null>(null);

  // ── Helpers ───────────────────────────────────────────────

  /** Map a Firestore SessionDoc to the SessionState persisted fields */
  const docToState = (data: SessionDoc): Partial<SessionState> => ({
    revision:          data.revision ?? 0,
    players:           data.players           ?? [],
    queue:             data.queue             ?? [],
    playAllRel:        data.playAllRel        ?? {},
    queueMode:         data.queueMode         ?? 'default',
    elimType:          data.elimType          ?? 'single',
    tournamentMatches: data.tournamentMatches ?? [],
    tournamentActive:  data.tournamentActive  ?? false,
    tournamentWinner:  data.tournamentWinner  ?? null,
    liveScore:         data.liveScore         ?? null,
    isLive:            data.isLive            ?? false,
    courtSlots:        data.courtSlots        ?? [],
    lockedPartners:    (data.lockedPartners ?? []).map(({ a, b }) => [a, b]),
    doublesEngineState: (data.doublesEngineState as Record<string, unknown>) ?? null,
    singlesEngineState: (data.singlesEngineState as Record<string, unknown>) ?? null,
    sittingOut:         data.sittingOut ?? [],
  });

  // ── Listener setup ─────────────────────────────────────────

  const attachListeners = useCallback((sessionId: string) => {
    // Tear down any existing listeners first
    unsubSessionRef.current?.();
    unsubHistoryRef.current?.();

    // Main document — all queue/tournament/mode fields
    unsubSessionRef.current = subscribeToSession(
      sessionId,
      // onChange: normal update
      (data) => {
        revisionRef.current = data.revision ?? 0;
        setState(prev => ({
          ...prev,
          isConnected:    true,
          isReconnecting: false,
          isExpired:      false,
          ...docToState(data),
        }));
      },
      // onError: Firestore connection dropped — show "Reconnecting…"
      (err) => {
        console.error('[useSession] onSnapshot error:', err);
        setState(prev => ({ ...prev, isConnected: false, isReconnecting: true }));
      },
      // onDeleted: TTL fired or document deleted — mark as expired
      () => {
        console.warn('[useSession] session document deleted (TTL or hard reset)');
        clearHostFromStorage();
        setState(prev => ({
          ...INITIAL_STATE,
          isExpired: true,
        }));
      },
    );

    // History subcollection — match results, ordered newest-first
    unsubHistoryRef.current = subscribeToHistory(sessionId, (entries) => {
      setState(prev => ({ ...prev, matchHistory: entries }));
    });
  }, []);

  // ── Heartbeat: prevent TTL deletion while host is active ───

  useEffect(() => {
    if (!state.isHost) return;
    const id = setInterval(() => {
      const sid = sessionIdRef.current;
      if (sid) touchSession(sid);
      // Touch all other courts in the group so idle courts don't expire
      loadCourtGroup().forEach(c => {
        if (c.sessionId !== sid) touchSession(c.sessionId);
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [state.isHost]);

  // ── Mount: resume from localStorage ────────────────────────

  useEffect(() => {
    const { sessionId } = loadHostFromStorage();
    if (!sessionId) return;

    loadSession(sessionId).then(data => {
      if (!data) {
        // Session expired (TTL deleted it) or never existed.
        // Clear stale storage so the host starts fresh.
        clearHostFromStorage();
        setState(prev => ({ ...INITIAL_STATE, isExpired: true }));
        return;
      }

      sessionIdRef.current = sessionId;
      // Anonymous Auth persistence proves ownership on this browser.

      // Touch the session so TTL clock resets on resume.
      // Fire-and-forget — don't await, don't block the UI.
      touchSession(sessionId);

      setState(prev => ({
        ...prev,
        sessionId,
        isHost: data.hostUid === auth.currentUser?.uid,
        ...docToState(data),
      }));

      attachListeners(sessionId);
    });

    return () => {
      unsubSessionRef.current?.();
      unsubHistoryRef.current?.();
    };
  // attachListeners is stable (useCallback with no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ────────────────────────────────────────────────

  /**
   * startSession
   * Called by the host when they click "Start Queue".
   * Creates a Firestore document and saves credentials to localStorage.
   */
  const startSession = useCallback(async (
    initialData: Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt' | 'updatedAt'>,
  ): Promise<StartSessionResult> => {
    setState(prev => ({ ...prev, isSaving: true }));
    try {
      const { sessionId } = await createSession(initialData);

      sessionIdRef.current = sessionId;
      revisionRef.current = 0;

      saveHostToStorage(sessionId, initialData.gameMode);

      setState(prev => ({
        ...prev,
        sessionId,
        revision: 0,
        isHost:   true,
        isSaving: false,
        ...docToState(initialData as SessionDoc),
      }));

      attachListeners(sessionId);
      return { ok: true, sessionId };
    } catch (err) {
      console.error('[useSession] startSession error:', err);
      setState(prev => ({ ...prev, isSaving: false }));
      return { ok: false, message: startSessionErrorMessage(err) };
    }
  }, [attachListeners]);

  /**
   * joinSession
   * Called by a viewer entering a room code.
   * Returns false if the session doesn't exist (expired or invalid code).
   */
  const joinSession = useCallback(async (sessionId: string): Promise<boolean> => {
    const upperCode = sessionId.toUpperCase();
    const data = await loadSession(upperCode);

    // Session not found — expired via TTL or bad code
    if (!data) return false;

    sessionIdRef.current = upperCode;
    // Destructure ownership metadata out of viewer state.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hostUid: _owner, ...safeData } = data;

    setState(prev => ({
      ...prev,
      sessionId:   upperCode,
      isHost:      false,
      isConnected: false,
      isExpired:   false,
      ...docToState(safeData as SessionDoc),
    }));

    attachListeners(upperCode);
    return true;
  }, [attachListeners]);

  /**
   * endSession
   * Detaches listeners and clears localStorage.
   * Does NOT delete the Firestore document — history is preserved.
   */
  const endSession = useCallback(() => {
    unsubSessionRef.current?.();
    unsubHistoryRef.current?.();
    clearHostFromStorage();
    sessionIdRef.current = null;
    revisionRef.current = 0;
    setState(INITIAL_STATE);
  }, []);

  /**
   * commitMatchResult  ← race-condition-safe
   *
   * Uses a Firestore transaction to atomically update the queue
   * and append a history entry. If two writes happen simultaneously
   * (e.g. host double-clicks), Firestore retries automatically.
   *
   * The caller (page.tsx) has already applied the queue logic locally
   * via useQueue, then passes the resulting `queue` array in `patch`.
   * We trust that — the transaction just persists it safely.
   */
  const commitMatchResult = useCallback(async (
    patch: Partial<SessionDoc>,
    entry: Omit<MatchHistoryEntry, 'commandId' | 'revision'>,
  ): Promise<MatchResultOutcome | null> => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return null;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { status: 'failed', reason: 'unavailable' };
    }
    const commandId = crypto.randomUUID();
    setState(prev => ({ ...prev, isSaving: true }));
    try {
      const write = revisionWriteChainRef.current.then(() =>
        batchMatchResult(sessionId, revisionRef.current, commandId, patch, entry),
      );
      revisionWriteChainRef.current = write.then(() => undefined, () => undefined);
      const result = await write;
      revisionRef.current = result.revision;
      setState(prev => ({ ...prev, revision: result.revision }));
      return result;
    } catch (err) {
      console.error('[useSession] commitMatchResult error:', err);
      if (err instanceof StaleSessionRevisionError) return { status: 'stale' };
      return { status: 'failed', reason: courtResultFailureReason(err) };
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, []);

  const commitCourtResult = useCallback(async (command: CourtResultCommand): Promise<CourtResultOutcome | null> => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return null;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { status: 'failed', reason: 'unavailable' };
    }

    setState(prev => ({ ...prev, isSaving: true }));
    try {
      const write = revisionWriteChainRef.current.then(() =>
        commitMultiCourtResult(sessionId, crypto.randomUUID(), command),
      );
      revisionWriteChainRef.current = write.then(() => undefined, () => undefined);
      const result = await write;
      revisionRef.current = Math.max(revisionRef.current, result.revision);
      setState(prev => ({
        ...prev,
        revision: Math.max(prev.revision, result.revision),
        queue: result.queue,
        courtSlots: result.courtSlots,
      }));
      return result;
    } catch (err) {
      console.error('[useSession] commitCourtResult error:', err);
      return { status: 'failed', reason: courtResultFailureReason(err) };
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, []);

  /**
   * undoLastMatch
   * Restores the queue and engine state from before the last match
   * and deletes the most recent history entry from Firestore.
   */
  const undoLastMatch = useCallback(async (patch: Partial<SessionDoc>) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    setState(prev => ({ ...prev, isSaving: true }));
    try {
      const write = revisionWriteChainRef.current.then(async () => {
        const revision = await updateQueueSafely(sessionId, revisionRef.current, () => patch);
        revisionRef.current = revision;
        await deleteLatestHistoryEntry(sessionId);
      });
      revisionWriteChainRef.current = write.catch(() => undefined);
      await write;
    } catch (err) {
      console.error('[useSession] undoLastMatch error:', err);
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, []);

  /**
   * syncField
   * Non-transactional update for fields that don't depend on
   * reading the current state first.
   * Safe for: queueMode, elimType, players list, queue reorder.
   */
  const syncField = useCallback(async (
    patch: Partial<Omit<SessionDoc, 'hostUid' | 'revision' | 'createdAt'>>,
  ) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !state.isHost) return;

    try {
      const revisionSensitive = new Set<keyof SessionDoc>([
        'players', 'queue', 'playAllRel', 'queueMode', 'elimType',
        'tournamentMatches', 'tournamentActive', 'tournamentWinner',
        'doublesEngineState', 'singlesEngineState', 'courtSlots',
        'lockedPartners', 'sittingOut',
      ]);
      const needsRevision = Object.keys(patch).some(key => revisionSensitive.has(key as keyof SessionDoc));
      const write = revisionWriteChainRef.current.then(async () => {
        if (needsRevision) {
          const revision = await updateSessionSafely(sessionId, revisionRef.current, patch);
          revisionRef.current = revision;
          setState(prev => ({ ...prev, revision }));
        } else {
          await updateSession(sessionId, patch);
        }
      });
      revisionWriteChainRef.current = write.catch(() => undefined);
      await write;
    } catch (err) {
      console.error(`[useSession] syncField error (${Object.keys(patch).join(', ')}):`, err);
    }
  }, [state.isHost]);

  /**
   * clearMatchHistory
   * Deletes all history documents from Firestore subcollection
   * AND clears the local matchHistory state immediately.
   * The onSnapshot listener will fire with an empty array after the batch delete,
   * which keeps everything in sync.
   */
  const clearMatchHistory = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setState(prev => ({ ...prev, matchHistory: [] }));
      return;
    }
    if (!state.isHost) return;
    setState(prev => ({ ...prev, matchHistory: [] }));
    try {
      await clearHistory(sessionId);
    } catch (err) {
      console.error('[useSession] clearMatchHistory error:', err);
    }
  }, [state.isHost]);

  /** Permanently deletes the host-owned event and all of its match history. */
  const deleteHostedSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !state.isHost) throw new Error('Only the host can delete this event.');
    setState(prev => ({ ...prev, isSaving: true }));
    try {
      await deleteSessionData(sessionId);
      unsubSessionRef.current?.();
      unsubHistoryRef.current?.();
      clearHostFromStorage();
      sessionIdRef.current = null;
      revisionRef.current = 0;
      setState(INITIAL_STATE);
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }));
      throw error;
    }
  }, [state.isHost]);

  return {
    ...state,
    startSession,
    joinSession,
    endSession,
    commitMatchResult,
    commitCourtResult,
    undoLastMatch,
    syncField,
    clearMatchHistory,
    deleteHostedSession,
  };
}
