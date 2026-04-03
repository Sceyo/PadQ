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
// FIX v2:
//  • joinSession: destructure hostToken out of `data` before
//    spreading so `hostToken: null` is never overwritten by
//    the Firestore document's hostToken (TS error 2783)
//  • commitMatchResult: removed simplified queue logic; the
//    caller now passes the already-computed queue from useQueue
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createSession,
  loadSession,
  updateSession,
  updateQueueSafely,
  addHistoryEntry,
  subscribeToSession,
  subscribeToHistory,
  saveHostToStorage,
  loadHostFromStorage,
  clearHostFromStorage,
  SessionDoc,
  MatchHistoryEntry,
  TournamentMatch,
  LiveScoreState,
} from '@/lib/sessionService';

// ── Types ──────────────────────────────────────────────────

type QueueMode       = 'default' | 'tournament' | 'playall';
type EliminationType = 'single' | 'double';

export interface SessionState {
  sessionId:         string | null;
  hostToken:         string | null;
  isHost:            boolean;
  isConnected:       boolean;   // true once first Firestore snapshot arrives
  isSaving:          boolean;   // true while a write is in-flight

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
}

export interface SessionActions {
  startSession:      (data: Omit<SessionDoc, 'hostToken' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  joinSession:       (sessionId: string) => Promise<boolean>;
  endSession:        () => void;
  commitMatchResult: (patch: Partial<SessionDoc>, entry: Omit<MatchHistoryEntry, 'hostToken'>) => Promise<void>;
  syncField:         (patch: Partial<Omit<SessionDoc, 'hostToken' | 'createdAt'>>) => Promise<void>;
}

// ── Initial state ──────────────────────────────────────────

const INITIAL_STATE: SessionState = {
  sessionId:         null,
  hostToken:         null,
  isHost:            false,
  isConnected:       false,
  isSaving:          false,
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
};

// ── Hook ───────────────────────────────────────────────────

export function useSession(): SessionState & SessionActions {

  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  // Refs so async callbacks always see the latest values
  // without stale closures
  const sessionIdRef        = useRef<string | null>(null);
  const hostTokenRef        = useRef<string | null>(null);
  const unsubSessionRef     = useRef<(() => void) | null>(null);
  const unsubHistoryRef     = useRef<(() => void) | null>(null);

  // ── Helpers ───────────────────────────────────────────────

  /** Map a Firestore SessionDoc to the SessionState persisted fields */
  const docToState = (data: SessionDoc): Partial<SessionState> => ({
    players:           data.players           ?? [],
    queue:             data.queue             ?? [],
    playAllRel:        data.playAllRel        ?? {},
    queueMode:         data.queueMode         ?? 'default',
    elimType:          data.elimType          ?? 'single',
    tournamentMatches: data.tournamentMatches ?? [],
    tournamentActive:  data.tournamentActive  ?? false,
    tournamentWinner:  data.tournamentWinner  ?? null,
    liveScore:         data.liveScore         ?? null,
  });

  // ── Listener setup ─────────────────────────────────────────

  const attachListeners = useCallback((sessionId: string) => {
    // Tear down any existing listeners first
    unsubSessionRef.current?.();
    unsubHistoryRef.current?.();

    // Main document — all queue/tournament/mode fields
    unsubSessionRef.current = subscribeToSession(
      sessionId,
      (data) => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          ...docToState(data),
        }));
      },
      (err) => console.error('[useSession] onSnapshot error:', err),
    );

    // History subcollection — match results, ordered newest-first
    unsubHistoryRef.current = subscribeToHistory(sessionId, (entries) => {
      setState(prev => ({ ...prev, matchHistory: entries }));
    });
  }, []);

  // ── Mount: resume from localStorage ────────────────────────

  useEffect(() => {
    const { sessionId, hostToken } = loadHostFromStorage();
    if (!sessionId || !hostToken) return;

    loadSession(sessionId).then(data => {
      if (!data) {
        // Session was deleted from Firestore — clear stale storage
        clearHostFromStorage();
        return;
      }

      sessionIdRef.current = sessionId;
      hostTokenRef.current = hostToken;

      setState(prev => ({
        ...prev,
        sessionId,
        hostToken,
        isHost: true,
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
    initialData: Omit<SessionDoc, 'hostToken' | 'createdAt' | 'updatedAt'>,
  ) => {
    setState(prev => ({ ...prev, isSaving: true }));
    try {
      const { sessionId, hostToken } = await createSession(initialData);

      sessionIdRef.current = sessionId;
      hostTokenRef.current = hostToken;

      saveHostToStorage(sessionId, hostToken, initialData.gameMode);

      setState(prev => ({
        ...prev,
        sessionId,
        hostToken,
        isHost:   true,
        isSaving: false,
        ...docToState(initialData as SessionDoc),
      }));

      attachListeners(sessionId);
    } catch (err) {
      console.error('[useSession] startSession error:', err);
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [attachListeners]);

  /**
   * joinSession
   * Called by a viewer entering a room code.
   * Returns false if the session doesn't exist in Firestore.
   *
   * FIX: we destructure `hostToken` out of `data` before spreading
   * so the viewer's `hostToken: null` is never overwritten.
   * Previously: { hostToken: null, ...data } — data.hostToken
   *             would overwrite the null (TS error 2783).
   * Now:        we explicitly exclude hostToken from the spread.
   */
  const joinSession = useCallback(async (sessionId: string): Promise<boolean> => {
    const upperCode = sessionId.toUpperCase();
    const data = await loadSession(upperCode);
    if (!data) return false;

    sessionIdRef.current = upperCode;
    // hostTokenRef stays null — viewers cannot write

    // Destructure hostToken out so it never reaches our state
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hostToken: _secret, ...safeData } = data;

    setState(prev => ({
      ...prev,
      sessionId:   upperCode,
      hostToken:   null,      // viewers never get the secret
      isHost:      false,
      isConnected: false,     // will flip true on first snapshot
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
    hostTokenRef.current = null;
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
    entry: Omit<MatchHistoryEntry, 'hostToken'>,
  ) => {
    const sessionId = sessionIdRef.current;
    const hostToken = hostTokenRef.current;
    if (!sessionId || !hostToken) return;

    setState(prev => ({ ...prev, isSaving: true }));
    try {
      await updateQueueSafely(sessionId, hostToken, () => patch);
      await addHistoryEntry(sessionId, hostToken, entry);
    } catch (err) {
      console.error('[useSession] commitMatchResult error:', err);
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
    patch: Partial<Omit<SessionDoc, 'hostToken' | 'createdAt'>>,
  ) => {
    const sessionId = sessionIdRef.current;
    const hostToken = hostTokenRef.current;
    if (!sessionId || !hostToken) return;

    try {
      await updateSession(sessionId, hostToken, patch);
    } catch (err) {
      console.error('[useSession] syncField error:', err);
    }
  }, []);

  return {
    ...state,
    startSession,
    joinSession,
    endSession,
    commitMatchResult,
    syncField,
  };
}