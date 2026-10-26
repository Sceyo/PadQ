'use client';

import React, {
  useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Swords, Users, Trophy, Shuffle, History,
  Sun, Moon, ArrowLeft,
  Star, Sparkles, RefreshCw, Layers,
  BarChart2, Wifi, WifiOff,
  UserX, ArrowUp, SlidersHorizontal,
} from 'lucide-react';
import useQueue, {
  suggestNextDoublesMatch,
  suggestNextSinglesMatch,
  PlayAllSuggestion,
} from '@/hooks/useQueue';
import { useSession, type MatchResultOutcome } from '@/hooks/useSession';
import type { LiveScoreState } from '@/lib/sessionService';
import {
  loadCourtGroup, addCourtToGroup,
  removeCourtFromGroup, clearCourtGroup, saveHostToStorage,
  loadRoster, mergeIntoRoster, removeFromRoster, setRosterEntrySkill,
  loadCareerStats, recordCareerResult,
  loadSkilledBrackets, saveSkilledBrackets,
  type CourtEntry, type CourtSlot, type SessionDoc, type CareerStatsMap,
  type RosterEntry, type SkillBracket,
} from '@/lib/sessionService';
import './QueueSystem.css';
import './styles/tokens.css';
import { AppShell } from './components/AppShell/AppShell';
import { SingleCourtScreen } from './components/SingleCourtScreen/SingleCourtScreen';
import { MultiCourtScreen } from './components/MultiCourtScreen/MultiCourtScreen';
import {
  toSingleCourtViewModel,
  toSingleCourtQueueViewModel,
  toMultiCourtQueueViewModel,
} from './lib/viewModels';

// ── Lib ──────────────────────────────────────────────────────
import type {
  MatchHistoryEntry, PlayerStat, EliminationType,
  QueueMode, GameTab, TournamentMatch,
} from './lib/types';
import { buildPlayerStats, generateSuggestions, shuffleArray, bracketSkillValue } from './lib/playerUtils';
import {
  initSkilledState, rotatePlayers as rotatePlayersEngine, reassignCourt as reassignCourtEngine,
  addPlayerToSkilledState as addPlayerToSkilledStateEngine, retagPlayerInQueue,
  getPlayerBracketLevel, fillIdleCourts as fillIdleCourtsEngine,
  recalculateRest as recalculateRestEngine,
  type SkilledState, type SkilledCourt, type SkillLevel, type CourtDef,
} from './lib/skilledMatchmakingEngine';
import type { PaddleState, SerializablePaddleState, Team } from './lib/doublesEngine';
import {
  freshPaddleState, advancePaddleState, addPlayerToWaiting,
  serializePaddleState, deserializePaddleState,
  seedMultiCourtDoubles, rotateMultiCourtDoubles,
} from './lib/doublesEngine';
import type { SinglesState, SerializableSinglesState } from './lib/singleEngine';
import { freshSinglesState, advanceSinglesState, addPlayerToSinglesWaiting, serializeSinglesState, deserializeSinglesState } from './lib/singleEngine';
import type { PoolSinglesState, SerializablePoolSinglesState } from './lib/singlesPoolEngine';
import {
  freshPoolSinglesState,
  advancePoolSinglesState,
  addPlayerToPoolSinglesWaiting,
  removePlayerFromPoolSinglesState,
  serializePoolSinglesState,
  deserializePoolSinglesState,
} from './lib/singlesPoolEngine';
import { V1_RELEASE } from './lib/releaseConfig';
import { planMultiCourtResult } from './lib/multiCourtResult';
import { formatEtaLabel } from './lib/etaEngine';
import {
  toggleSitOutTransition,
  removeFromQueueTransition,
  confirmSubTransition,
  replaceCalledPlayerTransition,
  accountPlayers,
  consumePriority,
} from './lib/queueTransitions';

// ── Components ───────────────────────────────────────────────
import { PlayerLabel } from './components/atoms/PlayerLabel';
import { TournamentBracket, buildSingleElim, buildDoubleElim, recordSingleWinner, recordDoubleWinner } from './components/Bracket/Bracket';
import { SinglesTable, DoublesTable } from './components/QueueTable/QueueTable';
import { ScoreBoard } from './components/ScoreBoard/ScoreBoard';
import { DoublesMatch } from './components/DoublesMatch/DoublesMatch';
import { WinnerModal } from './components/WinnerModal/WinnerModal';
import { UserGuide } from './components/UserGuideModal/UserGuideModal';
import { PaddleStatusPanel } from './components/PaddleStatusPanel/PaddleStatusPanel';
import { SinglesStatusPanel } from './components/SinglesStatusPanel/SinglesStatusPanel';
import { PoolSinglesStatusPanel } from './components/PoolSinglesStatusPanel/PoolSinglesStatusPanel';
import { AnalyticsDashboard } from './components/AnalyticsDashboard/AnalyticsDashboard';
import {
  AddPlayerPanel,
  getMaxPartnerPairs,
  ManualQueuePanel,
  PartnerPanel,
} from './components/LiveManagement/LiveManagement';
import { PlayerActionMenu } from './components/PlayerActionMenu/PlayerActionMenu';
import { SmartSuggestions } from './components/SmartSuggestions/SmartSuggestions';
import { SessionBar } from './components/SessionBar/SessionBar';
import { CourtTabs } from './components/CourtTabs/CourtTabs';
import { CourtCard } from './components/CourtCard/CourtCard';
import { SinglesCourtCard } from './components/SinglesCourtCard/SinglesCourtCard';
import { CourtSwapModal } from './components/CourtSwapModal/CourtSwapModal';
import { CourtScoreModal, type PendingCourtMatch } from './components/CourtScoreModal/CourtScoreModal';
import { GearMenu } from './components/GearMenu/GearMenu';
import { CoordinatorOverlay } from './components/CoordinatorOverlay/CoordinatorOverlay';
import { SetupView } from './components/SetupView/SetupView';
import { SitOutPanel } from './components/SitOutPanel/SitOutPanel';
import { SkilledView, type SkilledBrackets } from './components/SkilledView/SkilledView';
import { RecapModal } from './components/RecapCard';

// ── Undo snapshot type ────────────────────────────────────────
interface UndoSnapshot {
  queue:             string[];
  paddleState:       PaddleState;
  singlesState:      SinglesState;
  poolSinglesState?: PoolSinglesState;
  singlesFormat?:    'pool' | 'king';
  courtSlots?:       CourtSlot[];
  priorityPlayers?:  string[];
  sittingOut?:       string[];
}

// Deep-copy helpers so undo doesn't share references with live state
function clonePaddleState(s: PaddleState): PaddleState {
  return {
    ...s,
    w1:              [...s.w1],
    l1:              [...s.l1],
    waitingQueue:    [...s.waitingQueue],
    recentPairs:     [...s.recentPairs],
    recentMatches:   [...s.recentMatches],
    playedThisCycle: new Set(s.playedThisCycle),
    lastPlayedMap:   { ...s.lastPlayedMap },
    winnersPool:     s.winnersPool.map(t => [t[0], t[1]] as Team),
    losersPool:      s.losersPool.map(t => [t[0], t[1]] as Team),
  };
}

function cloneSinglesState(s: SinglesState): SinglesState {
  return {
    ...s,
    queue:           [...s.queue],
    waitingQueue:    [...s.waitingQueue],
    lastPlayedMap:   { ...s.lastPlayedMap },
    winStreak:       { ...s.winStreak },
    playedThisCycle: new Set(s.playedThisCycle),
  };
}

function clonePoolSinglesState(s: PoolSinglesState): PoolSinglesState {
  return {
    ...s,
    w1:              [...s.w1],
    l1:              [...s.l1],
    waitingQueue:    [...s.waitingQueue],
    playedThisCycle: new Set(s.playedThisCycle),
    recentMatches:   [...s.recentMatches],
    lastPlayedMap:   { ...s.lastPlayedMap },
  };
}

function matchResultFailureMessage(result: MatchResultOutcome | null): string | null {
  if (!result || result.status === 'stale') {
    return 'This match was not saved because the session changed. The previous match has been restored.';
  }
  if (result.status !== 'failed') return null;
  if (result.reason === 'permission') {
    return 'Firebase rejected the result. Host access may have expired; the previous match has been restored.';
  }
  if (result.reason === 'unavailable') {
    return 'The result could not reach Firebase. Check the connection and try again; the previous match has been restored.';
  }
  return 'The result could not be saved. The previous match has been restored.';
}

// ═══════════════════════════════════════════════════════════
// § 13  MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════

function QueueSystemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams?.get('mode');
  const gameModeFromUrl = modeParam === 'singles' || modeParam === 'doubles' ? modeParam : null;

  const {
    gameMode, players, queue, playAllRel, restorationWarning, dismissRestorationWarning,
    setGameMode, setPlayers,
    randomizeQueue, setQueue, recordPlayAllDoubles,
    recordPlayAllSingles, resetPlayAllRelationships,
  } = useQueue(gameModeFromUrl);


  const session = useSession();

  // Sync Firebase → local queue hook
  useEffect(() => {
    if (!session.isConnected || !session.players.length) return;
    if (session.players.join(',') !== players.join(',')) setPlayers(session.players);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.players, session.isConnected]);

  useEffect(() => {
    if (!session.isConnected || session.isSaving) return;
    if (session.queue.join(',') !== queue.join(',')) setQueue(session.queue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.queue, session.isConnected, session.isSaving]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  
  // UI-only state
  
  const [tempPlayers,  setTempPlayers]  = useState<string[]>([]);
  const [currentName,  setCurrentName]  = useState('');
  const [pasteInput,   setPasteInput]   = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalWinner,  setModalWinner]  = useState('');
  const [modalScore,   setModalScore]   = useState<string | undefined>(undefined);
  const [swapCourtId,  setSwapCourtId]  = useState<string | null>(null);
  const [autoClose,    setAutoClose]    = useState(false);
  const [scorePromptEnabled, setScorePromptEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('padq_multicourt_scores');
    return saved !== null ? saved === 'true' : false;
  });
  const [pendingCourtScore, setPendingCourtScore] = useState<PendingCourtMatch | null>(null);
  const handleToggleScorePrompt = () => {
    setScorePromptEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('padq_multicourt_scores', String(next));
      }
      return next;
    });
  };
  const [showHistory,  setShowHistory]  = useState(true);
  const [darkMode,     setDarkMode]     = useState(true);
  const [activeTab,    setActiveTab]    = useState<GameTab>('queue');
  const [isLiveLocal,  setIsLiveLocal]  = useState(false);
  const [showGuide,       setShowGuide]       = useState(false);
  const [showCoordinator, setShowCoordinator] = useState(false);
  const [showRecapModal,   setShowRecapModal]   = useState(false);

  // ── Career stats (persists across sessions) ───────────────
  const [careerStats, setCareerStats] = useState<CareerStatsMap>(() => loadCareerStats());

  // ── Host key banner (one-time, shown after startSession) ──
  const queueRef = useRef<string[]>([]);
  const courtSlotsRef = useRef<CourtSlot[]>([]);
  const processingCourtIdsRef = useRef(new Set<string>());

  // ── Roster (setup screen) ──────────────────────────────────
  const [roster,         setRoster]         = useState<RosterEntry[]>([]);
  const [showRoster,     setShowRoster]     = useState(false);
  const [rosterSelected, setRosterSelected] = useState<Set<string>>(new Set());

  // ── Setup: PIN + court name ─────────────────────────────────
  const [setupPin,       setSetupPin]       = useState('');
  const [setupCourtName, setSetupCourtName] = useState('Court 1');
  const [lockedPartners, setLockedPartners] = useState<[string, string][]>([]);
  const lockedPartnersRef = useRef<[string, string][]>([]);
  const [courtCount,     setCourtCount]     = useState(1);

  // ── Multi-court shared-queue slots ──────────────────────────
  const [localCourtSlots, setLocalCourtSlots] = useState<CourtSlot[]>([]);

  useEffect(() => {
    if (!session.isConnected) return;
    setLockedPartners(session.lockedPartners);
    lockedPartnersRef.current = session.lockedPartners;
  }, [session.isConnected, session.lockedPartners]);

  // ── Legacy court group (tab switching between independent sessions) ──
  const [courts, setCourts] = useState<CourtEntry[]>(() => V1_RELEASE.showLegacyCourtCoordinator ? loadCourtGroup() : []);

  // ── Doubles Paddle Queue state ─────────────────────────────
  const paddleStateRef                        = useRef<PaddleState>(freshPaddleState());
  const [paddleStateUI, setPaddleStateUI]     = useState<PaddleState>(freshPaddleState());

  const resetPaddleState = useCallback(() => {
    const fresh = freshPaddleState();
    paddleStateRef.current = fresh;
    setPaddleStateUI(fresh);
  }, []);

  // ── Singles King-of-the-Court & Pool-Rotation state ───────
  const [singlesFormat, setSinglesFormat]             = useState<'pool' | 'king'>('pool');
  const singlesStateRef                               = useRef<SinglesState>(freshSinglesState([]));
  const [singlesStateUI, setSinglesStateUI]           = useState<SinglesState>(freshSinglesState([]));
  const poolSinglesStateRef                           = useRef<PoolSinglesState>(freshPoolSinglesState());
  const [poolSinglesStateUI, setPoolSinglesStateUI]   = useState<PoolSinglesState>(freshPoolSinglesState());

  const resetSinglesState = useCallback((playerList: string[]) => {
    const fresh = freshSinglesState(playerList);
    singlesStateRef.current = fresh;
    setSinglesStateUI(fresh);
  }, []);

  const resetPoolSinglesState = useCallback(() => {
    const fresh = freshPoolSinglesState();
    poolSinglesStateRef.current = fresh;
    setPoolSinglesStateUI(fresh);
  }, []);

  // Rehydrate engine refs once when the host resumes a persisted session
  const engineRehydratedRef = useRef(false);
  useEffect(() => {
    if (!session.isHost || engineRehydratedRef.current) return;
    engineRehydratedRef.current = true;
    if (session.doublesEngineState) {
      const s = deserializePaddleState(session.doublesEngineState as unknown as SerializablePaddleState);
      paddleStateRef.current = s;
      setPaddleStateUI(s);
    } else if (gameMode === 'doubles') {
      // Compatibility for rooms created before V1 persisted their initial
      // engine snapshot. The doubles engine can safely resume from INIT.
      const s = freshPaddleState();
      paddleStateRef.current = s;
      setPaddleStateUI(s);
    }
    if (session.singlesEngineState) {
      const raw = session.singlesEngineState as Record<string, unknown>;
      if (raw.format === 'pool') {
        setSinglesFormat('pool');
        const s = deserializePoolSinglesState(raw as unknown as SerializablePoolSinglesState);
        poolSinglesStateRef.current = s;
        setPoolSinglesStateUI(s);
      } else {
        setSinglesFormat('king');
        const s = deserializeSinglesState(raw as unknown as SerializableSinglesState);
        singlesStateRef.current = s;
        setSinglesStateUI(s);
      }
    } else if (gameMode === 'singles') {
      // Older rooms may have a queue but no initial engine document.
      if (courtCount === 1 && singlesFormat === 'pool') {
        const s = freshPoolSinglesState();
        poolSinglesStateRef.current = s;
        setPoolSinglesStateUI(s);
      } else {
        const s = freshSinglesState(session.queue.length ? session.queue : session.players);
        singlesStateRef.current = s;
        setSinglesStateUI(s);
      }
    }

  }, [session.isHost, session.doublesEngineState, session.singlesEngineState, session.queue, session.players, gameMode, courtCount, singlesFormat]);

  // ── Undo snapshot ──────────────────────────────────────────
  const undoSnapshotRef = useRef<UndoSnapshot | null>(null);
  const [hasUndo, setHasUndo] = useState(false);

  // ── Substitute / absent player ─────────────────────────────
  const [substituteFor, setSubstituteFor] = useState<string | null>(null);
  const [multiCourtSubConfirmed, setMultiCourtSubConfirmed] = useState(false);
  const [localHasScoredPoints, setLocalHasScoredPoints] = useState(false);
  const [selectedPlayerAction, setSelectedPlayerAction] = useState<{
    player: string;
    zone: 'playing' | 'waiting' | 'break';
  } | null>(null);
  const [showHostTools, setShowHostTools] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // ── Skilled brackets — persisted in localStorage ──────────
  const [skilledBrackets,   setSkilledBrackets]   = useState<SkilledBrackets>(() => loadSkilledBrackets());
  const [skilledState,      setSkilledState]       = useState<SkilledState | null>(null);
  const [showSkillBrackets, setShowSkillBrackets]  = useState(false);

  // ── Sit-out state ──────────────────────────────────────────
  const [localSittingOut, setLocalSittingOut] = useState<string[]>([]);
  const [localPriorityPlayers, setLocalPriorityPlayers] = useState<string[]>([]);

  useEffect(() => {
    if (!session.isConnected) return;
    setLocalSittingOut(session.sittingOut ?? []);
  }, [session.sittingOut, session.isConnected]);

  useEffect(() => {
    if (!session.isConnected) return;
    setLocalPriorityPlayers(session.priorityPlayers ?? []);
  }, [session.priorityPlayers, session.isConnected]);

  // Keep bracket assignments in sync when players are removed from the session
  useEffect(() => {
    const playerSet = new Set(players);
    setSkilledBrackets(prev => ({
      beginner:     prev.beginner.filter(n => playerSet.has(n)),
      intermediate: prev.intermediate.filter(n => playerSet.has(n)),
      advanced:     prev.advanced.filter(n => playerSet.has(n)),
    }));

  }, [players]);

  const activeSittingOut = session.isConnected ? (session.sittingOut ?? []) : localSittingOut;
  const activePriorityPlayers = session.isConnected ? (session.priorityPlayers ?? []) : localPriorityPlayers;

  // ── Toast notification with Undo & pause-on-hover ──────────
  interface MatchToast {
    message: string;
    subMessage?: string;
    canUndo?: boolean;
  }
  const [matchToast, setMatchToast] = useState<MatchToast | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRemainingRef = useRef<number>(6000);
  const toastStartRef = useRef<number>(0);
  const isToastPausedRef = useRef<boolean>(false);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearToastTimer();
    setMatchToast(null);
    setToastMsg(null);
    isToastPausedRef.current = false;
  }, [clearToastTimer]);

  const showMatchToast = useCallback((toast: MatchToast, duration = 6000) => {
    clearToastTimer();
    setMatchToast(toast);
    toastRemainingRef.current = duration;
    toastStartRef.current = Date.now();
    isToastPausedRef.current = false;

    toastTimerRef.current = setTimeout(() => {
      setMatchToast(null);
    }, duration);
  }, [clearToastTimer]);

  const pauseToastTimer = useCallback(() => {
    if (isToastPausedRef.current || (!matchToast && !toastMsg)) return;
    clearToastTimer();
    const elapsed = Date.now() - toastStartRef.current;
    toastRemainingRef.current = Math.max(1000, toastRemainingRef.current - elapsed);
    isToastPausedRef.current = true;
  }, [clearToastTimer, matchToast, toastMsg]);

  const resumeToastTimer = useCallback(() => {
    if (!isToastPausedRef.current || (!matchToast && !toastMsg)) return;
    isToastPausedRef.current = false;
    toastStartRef.current = Date.now();
    toastTimerRef.current = setTimeout(() => {
      setMatchToast(null);
      setToastMsg(null);
    }, toastRemainingRef.current);
  }, [matchToast, toastMsg]);

  const showToast = useCallback((msg: string) => {
    showMatchToast({ message: msg, canUndo: false }, 3000);
  }, [showMatchToast]);

  const handleUndoLastMatchRef = useRef<() => void>(() => {});
  const handleToastUndo = useCallback(() => {
    dismissToast();
    handleUndoLastMatchRef.current();
  }, [dismissToast]);

  // ── Inline confirm dialog (replaces native confirm()) ──────
  type ConfirmAction =
    | { type: 'clear-history' }
    | { type: 'hard-reset' }
    | { type: 'back-home' }
    | { type: 'remove-court'; sessionId: string };
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmAction | null>(null);

  // ── Setup-phase validation error (replaces alert() in setup)
  const [setupErrorMsg, setSetupErrorMsg] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // ── Double-click guard for match result handlers ───────────
  const isProcessingMatchRef = useRef(false);

  // Sync session.isLive → local
  useEffect(() => { setIsLiveLocal(session.isLive ?? false); }, [session.isLive]);

  // Sync court slots from Firestore → local
  useEffect(() => {
    if (!session.isConnected) return;
    setLocalCourtSlots(session.courtSlots ?? []);
  }, [session.courtSlots, session.isConnected]);

  // Resolved court slots (Firestore when connected, local otherwise)
  const courtSlots = session.isConnected ? (session.courtSlots ?? []) : localCourtSlots;
  useEffect(() => { courtSlotsRef.current = courtSlots; }, [courtSlots]);

  // Players not on any court (the shared waiting queue in multi-court mode)
  const waitingPlayers = useMemo(() => {
    if (courtSlots.length === 0) return [];
    const queued = accountPlayers({
      gameMode: gameMode ?? 'doubles',
      players,
      queue,
      courtSlots,
      sittingOut: activeSittingOut,
    }).queued;
    const prioritySet = new Set(activePriorityPlayers);
    const priorityQueued = activePriorityPlayers.filter(p => queued.includes(p));
    const restQueued = queued.filter(p => !prioritySet.has(p));
    return [...priorityQueued, ...restQueued];
  }, [players, courtSlots, queue, activeSittingOut, activePriorityPlayers]);

  const handleGoLive = (live: boolean) => {
    setIsLiveLocal(live);
    if (session.sessionId) session.syncField({ isLive: live });
  };

  // Save each accepted point immediately. The former debounce left the last
  // point vulnerable if the host refreshed before its timer fired.
  const handleScoreChange = (score: LiveScoreState | null) => {
    setLocalHasScoredPoints(Boolean(score && (score.scoreA > 0 || score.scoreB > 0)));
    if (!session.sessionId) return;
    void session.syncField({ liveScore: score });
  };
  const isSingleCourtReplaceBlocked = courtSlots.length === 0 && (
    localHasScoredPoints ||
    (session.liveScore?.scoreA ?? 0) > 0 ||
    (session.liveScore?.scoreB ?? 0) > 0
  );

  // Persisted state
  const [localQueueMode,        setLocalQueueMode]        = useState<QueueMode>('default');
  const [localElimType,         setLocalElimType]         = useState<EliminationType>('single');
  const [localTournamentM,      setLocalTournamentM]      = useState<TournamentMatch[]>([]);
  const [localTournamentActive, setLocalTournamentActive] = useState(false);
  const [localTournamentWinner, setLocalTournamentWinner] = useState<string | null>(null);
  const [localHistory,          setLocalHistory]          = useState<MatchHistoryEntry[]>([]);

  const setQueueMode        = (m: QueueMode)          => { setLocalQueueMode(m); if (session.sessionId) session.syncField({ queueMode: m }); };
  const setElimType         = (t: EliminationType)    => { setLocalElimType(t); if (session.sessionId) session.syncField({ elimType: t }); };
  const setTournamentMatches = (tm: TournamentMatch[]) => { setLocalTournamentM(tm); if (session.sessionId) session.syncField({ tournamentMatches: tm }); };
  const setTournamentActive  = (v: boolean)           => { setLocalTournamentActive(v); if (session.sessionId) session.syncField({ tournamentActive: v }); };
  const setTournamentWinner  = (w: string | null)     => { setLocalTournamentWinner(w); if (session.sessionId) session.syncField({ tournamentWinner: w }); };

  const addHistory = (entry: MatchHistoryEntry, newQueue?: string[]) => {
    setLocalHistory(prev => [entry, ...prev]);
    recordCareerResult(entry.players, entry.winner);
    setCareerStats(loadCareerStats());
    const queueToCommit = newQueue ?? queue;
    if (session.sessionId) {
      const enginePatch = gameMode === 'doubles'
        ? { doublesEngineState: serializePaddleState(paddleStateRef.current) as unknown as Record<string, unknown> }
        : activeQueueMode === 'default'
          ? { singlesEngineState: serializeSinglesState(singlesStateRef.current) as unknown as Record<string, unknown> }
          : {};
      void session.commitMatchResult(
        { queue: queueToCommit, liveScore: null, ...enginePatch },
        { id: entry.id, mode: entry.mode, players: entry.players, winner: entry.winner, score: entry.score, timestamp: entry.timestamp }
      ).then(result => {
        const message = matchResultFailureMessage(result);
        if (message) showToast(message);
      });
    }
  };

  // Resolved active values
  const storedQueueMode        = session.isConnected ? session.queueMode         : localQueueMode;
  const activeQueueMode: QueueMode = V1_RELEASE.showQueueModeSelector ? storedQueueMode : V1_RELEASE.queueMode;
  const activeElimType         = session.isConnected ? session.elimType          : localElimType;
  const activeTournamentM      = session.isConnected && session.tournamentMatches?.length > 0 ? session.tournamentMatches : localTournamentM;
  const activeTournamentActive = localTournamentActive || (session.isConnected ? session.tournamentActive : false);
  const activeTournamentWinner = session.isConnected ? session.tournamentWinner  : localTournamentWinner;
  const activeHistory          = session.isConnected ? (session.matchHistory as unknown as MatchHistoryEntry[]) : localHistory;

  // Derived
  const statsList      = useMemo(() => buildPlayerStats(players, activeHistory), [players, activeHistory]);
  const statsMap       = useMemo(() => Object.fromEntries(statsList.map(s => [s.name, s])), [statsList]);
  // Persist bracket assignments to localStorage whenever they change
  useEffect(() => { saveSkilledBrackets(skilledBrackets); }, [skilledBrackets]);

  // Auto-initialize skilled state when reconnecting to a session that already had Skilled mode active.
  // handleModeChange is the normal init path, but it's never called on page reload — this fills that gap.
  useEffect(() => {
    if (activeQueueMode !== 'skilled' || skilledState !== null || players.length === 0) return;
    const defs: CourtDef[] = courtSlots.length > 0
      ? courtSlots.map(c => ({ id: c.id, name: c.name }))
      : [{ id: 'court-0', name: 'Court 1' }];
    setSkilledState(initSkilledState(players, skilledBrackets, defs, activeSittingOut));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQueueMode, players, courtSlots]);

  // Set of players that have no skill tag assigned (for the untagged notice)
  const untaggedInSkilled = useMemo(() => {
    const tagged = new Set([
      ...skilledBrackets.beginner,
      ...skilledBrackets.intermediate,
      ...skilledBrackets.advanced,
    ]);
    return new Set(players.filter(n => !tagged.has(n)));
  }, [players, skilledBrackets]);

  // Build a name→bracket map: skilled-tab assignments take priority over roster skill
  const rosterSkillMap = useMemo<Record<string, SkillBracket | undefined>>(() => {
    const base: Record<string, SkillBracket | undefined> = Object.fromEntries(roster.map(e => [e.name, e.skill]));
    (['beginner', 'intermediate', 'advanced'] as SkillBracket[]).forEach(bracket => {
      skilledBrackets[bracket].forEach(name => { base[name] = bracket; });
    });
    return base;
  }, [roster, skilledBrackets]);
  const suggestions = useMemo(() => activeTab === 'queue' ? generateSuggestions(statsList, queue) : [], [statsList, queue, activeTab]);
  const playAllSuggestion = useMemo<PlayAllSuggestion | null>(() => {
    if (activeQueueMode !== 'playall' || gameMode !== 'doubles') return null;
    return suggestNextDoublesMatch(queue, playAllRel);
  }, [activeQueueMode, gameMode, queue, playAllRel]);
  const firstFour = useMemo(() => queue.slice(0, 4), [queue]);
  const waitingForNext = useMemo(() => {
    if (courtSlots.length > 0) return waitingPlayers;
    const onCourtCount = gameMode === 'doubles' ? 4 : 2;
    const rawWaiting = queue.slice(onCourtCount).filter(p => !activeSittingOut.includes(p));
    const prioritySet = new Set(activePriorityPlayers);
    const priorityWaiting = activePriorityPlayers.filter(p => rawWaiting.includes(p));
    const restWaiting = rawWaiting.filter(p => !prioritySet.has(p));
    return [...priorityWaiting, ...restWaiting];
  }, [courtSlots.length, waitingPlayers, queue, gameMode, activeSittingOut, activePriorityPlayers]);

  // Load club roster from localStorage on mount
  useEffect(() => { setRoster(loadRoster()); }, []);

  // Side effects
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);
  useLayoutEffect(() => { document.body.classList.add('dark-mode'); }, []);
  useEffect(() => { if (gameModeFromUrl) setGameMode(gameModeFromUrl); else router.push('/'); }, [gameModeFromUrl, setGameMode, router]);
  useEffect(() => {
    if (!playAllSuggestion) return;
    const s = playAllSuggestion.reorderedQueue;
    if (queue.slice(0, 4).join(',') !== s.slice(0, 4).join(',')) setQueue(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllSuggestion]);
  useEffect(() => {
    if (activeQueueMode !== 'playall' || gameMode !== 'singles' || queue.length < 2) return;
    const result = suggestNextSinglesMatch(queue, playAllRel);
    if (!result) return;
    if (queue.slice(0, 2).join(',') !== result.reorderedQueue.slice(0, 2).join(',')) setQueue(result.reorderedQueue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllRel, activeQueueMode, gameMode]);

  // ── Handlers ─────────────────────────────────────────────

  const addTempPlayer = () => {
    const t = currentName.trim();
    if (!t) return;
    if (tempPlayers.length >= V1_RELEASE.maxPlayers) { setSetupErrorMsg(`V1 supports up to ${V1_RELEASE.maxPlayers} players`); return; }
    if (t.length > 60) { setSetupErrorMsg('Player names must be 60 characters or fewer'); return; }
    if (tempPlayers.some(name => name.toLowerCase() === t.toLowerCase())) {
      setSetupErrorMsg(`"${t}" already exists. If two players share a name, add an initial (e.g. "${t} D.") to distinguish them.`);
      return;
    }
    setSetupErrorMsg(null);
    setTempPlayers(prev => [...prev, t]); setCurrentName('');
  };
  const removeTempPlayer = (i: number) => setTempPlayers(prev => prev.filter((_, j) => j !== i));

  const addFromPaste = () => {
    const names = pasteInput.split(/[,\n]+/).map(n => n.trim()).filter(n => n.length > 0 && n.length <= 60);
    const available = V1_RELEASE.maxPlayers - tempPlayers.length;
    const seen = new Set(tempPlayers.map(name => name.toLowerCase()));
    let duplicateCount = 0;
    const fresh = names.filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        duplicateCount++;
        return false;
      }
      seen.add(key);
      return true;
    }).slice(0, available);
    if (fresh.length === 0) {
      if (duplicateCount > 0) {
        showToast('Duplicate names were skipped. Add initials (e.g. "Mike D.") to distinguish players with the same name.');
      }
      setPasteInput('');
      return;
    }
    if (duplicateCount > 0) {
      showToast(`${duplicateCount} duplicate name${duplicateCount > 1 ? 's were' : ' was'} skipped. Use initials (e.g. "Ben J.") to distinguish identical names.`);
    }
    setTempPlayers(prev => [...prev, ...fresh]);
    setPasteInput('');
  };

  const handleStartQueue = async () => {
    const minPlayers = gameMode === 'doubles' && courtCount > 1
      ? courtCount * 4
      : gameMode === 'singles' && courtCount > 1
        ? Math.max(5, courtCount * 2 + 1)
        : 5;
    if (tempPlayers.length < minPlayers) return;
    setSetupErrorMsg(null);
    const orderedPlayers = [...tempPlayers];

    // Build initial court slots for multi-court doubles mode
    let initialCourtSlots: CourtSlot[] | undefined;
    let initialQueue: string[];
    if (gameMode === 'doubles' && courtCount > 1) {
      const seeded = seedMultiCourtDoubles(orderedPlayers, courtCount, []);

      initialCourtSlots = Array.from({ length: courtCount }, (_, i) => ({
        id: `court-${i}`,
        name: `Court ${i + 1}`,
        onCourt: seeded.courts[i],
      }));
      initialQueue = seeded.waiting;
    } else if (gameMode === 'singles' && courtCount > 1) {
      // Singles multi-court: seed 2 players per court, rest go to shared queue
      initialCourtSlots = Array.from({ length: courtCount }, (_, i) => ({
        id: `court-${i}`,
        name: `Court ${i + 1}`,
        onCourt: orderedPlayers.slice(i * 2, (i + 1) * 2),
      }));
      initialQueue = orderedPlayers.slice(courtCount * 2);
    } else {
      initialCourtSlots = undefined;
      initialQueue = orderedPlayers;
    }
    let initialBracket: TournamentMatch[] = [];
    if (localQueueMode === 'tournament') {
      const shuffled = shuffleArray(orderedPlayers);
      const bracketEntrants = gameMode === 'doubles'
        ? shuffled.reduce<string[]>((acc, _, i) => {
            if (i % 2 === 0 && i + 1 < shuffled.length) acc.push(`${shuffled[i]} & ${shuffled[i + 1]}`);
            else if (i % 2 === 0) acc.push(shuffled[i]);
            return acc;
          }, [])
        : shuffled;
      initialBracket = localElimType === 'single' ? buildSingleElim(bracketEntrants) : buildDoubleElim(bracketEntrants);
    }
    const pin = V1_RELEASE.showAccessPinSetup ? (setupPin.trim().toUpperCase().slice(0, 4) || null) : null;
    const courtName = courtCount > 1 ? `${courtCount} Courts` : (setupCourtName.trim() || 'Court 1');
    const startResult = await session.startSession({
      gameMode: gameMode ?? 'singles', queueMode: V1_RELEASE.queueMode, elimType: localElimType,
      players: tempPlayers, queue: initialQueue, playAllRel: {},
      tournamentMatches: initialBracket, tournamentActive: false,
      tournamentWinner: null, isLive: true,
      accessPin: pin,
      courtName,
      lockedPartners: [],
      ...(initialCourtSlots ? { courtSlots: initialCourtSlots } : {}),
      ...(gameMode === 'singles' && courtCount === 1 ? {
        singlesEngineState: singlesFormat === 'pool'
          ? (serializePoolSinglesState(freshPoolSinglesState()) as unknown as Record<string, unknown>)
          : (serializeSinglesState(freshSinglesState(orderedPlayers)) as unknown as Record<string, unknown>),
      } : {}),
    });
    if (!startResult.ok) {
      setIsLiveLocal(false);
      setSetupErrorMsg(startResult.message);
      return;
    }

    // Enter the host UI only after Firebase has created and authenticated the room.
    resetPaddleState();
    resetSinglesState(orderedPlayers);
    resetPoolSinglesState();
    setPlayers(orderedPlayers);
    setTempPlayers([]);
    setLocalHistory([]);
    setLocalTournamentActive(localQueueMode === 'tournament');
    setLocalTournamentWinner(null);
    setLocalTournamentM(initialBracket);
    setLockedPartners([]);
    lockedPartnersRef.current = [];
    setLocalCourtSlots(initialCourtSlots ?? []);
    courtSlotsRef.current = initialCourtSlots ?? [];
    setQueue(initialQueue);
    queueRef.current = initialQueue;
    setIsLiveLocal(true);
  };

  const initTournament = useCallback((playerList: string[], type: EliminationType) => {
    const shuffled = shuffleArray(playerList);
    const entrants = gameMode === 'doubles'
      ? shuffled.reduce<string[]>((acc, _, i) => {
          if (i % 2 === 0) acc.push(i + 1 < shuffled.length ? `${shuffled[i]} & ${shuffled[i + 1]}` : shuffled[i]);
          return acc;
        }, [])
      : shuffled;
    const bracket = type === 'single' ? buildSingleElim(entrants) : buildDoubleElim(entrants);
    setTournamentMatches(bracket); setTournamentActive(true); setTournamentWinner(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode]);

  const handleTournamentMatch = (matchId: number, winner: string) => {
    const match = activeTournamentM.find(m => m.id === matchId)!;
    addHistory({ id: Date.now(), mode: 'Tournament', players: `${match.player1} vs ${match.player2 || 'Bye'}`, winner, timestamp: new Date().toLocaleTimeString() }, queue);
    const updated = activeElimType === 'single' ? recordSingleWinner(activeTournamentM, matchId, winner) : recordDoubleWinner(activeTournamentM, matchId, winner);
    setTournamentMatches(updated);
    const gfMatch = updated.find(m => m.bracket === 'GF');
    const lastWbM = activeElimType === 'single' ? (() => { const by: Record<number, TournamentMatch[]> = {}; updated.forEach(m => { (by[m.round] ??= []).push(m); }); return by[Math.max(...Object.keys(by).map(Number))]?.[0]; })() : null;
    const champion = gfMatch?.winner ?? lastWbM?.winner;
    if (champion) { setTournamentWinner(champion); setModalWinner(`${champion} is the tournament champion! 🏆`); setModalScore(undefined); setModalOpen(true); }
  };

  const handleRandomize = () => {
    if (activeQueueMode === 'tournament') { initTournament(players, activeElimType); return; }
    randomizeQueue();
    if (activeQueueMode === 'playall') resetPlayAllRelationships();
  };
  const handleElimTypeChange = (type: EliminationType) => {
    setElimType(type);
    if (activeQueueMode === 'tournament' && players.length > 0) { initTournament(players, type); setLocalHistory([]); }
  };
  const handleModeChange = (newMode: QueueMode) => {
    setQueueMode(newMode);
    if (newMode === 'tournament' && players.length > 0) initTournament(players, activeElimType);
    else if (newMode !== 'tournament') { setTournamentActive(false); setTournamentWinner(null); setTournamentMatches([]); }
    if (newMode === 'playall') resetPlayAllRelationships();
    if (newMode === 'default') { resetPaddleState(); resetSinglesState(players); }
    if (newMode === 'skilled') {
      // Build court definitions from existing court config (or default single court)
      const defs: CourtDef[] = courtSlots.length > 0
        ? courtSlots.map(c => ({ id: c.id, name: c.name }))
        : [{ id: 'court-0', name: 'Court 1' }];
      const state = initSkilledState(players, skilledBrackets, defs, activeSittingOut);
      setSkilledState(state);
      setShowSkillBrackets(false);
    }
  };

  // ── Sit-out handler ────────────────────────────────────────
  const handleToggleSitOut = (name: string) => {
    const isSittingOut = activeSittingOut.includes(name);
    if (!isSittingOut) {
      const onCourtCount = gameMode === 'doubles' ? 4 : 2;
      const isPlayerOnCourt = courtSlots.length > 0
        ? courtSlots.some(slot => slot.onCourt.includes(name))
        : queue.slice(0, onCourtCount).includes(name);
      if (isPlayerOnCourt) {
        handleMarkAbsent(name);
        return;
      }
    }
    const result = toggleSitOutTransition(
      {
        gameMode: gameMode ?? 'singles',
        singlesFormat,
        players,
        queue,
        courtSlots,
        sittingOut: activeSittingOut,
        priorityPlayers: activePriorityPlayers,
        singlesState: singlesStateRef.current,
        paddleState: paddleStateRef.current,
        poolSinglesState: poolSinglesStateRef.current,
      },
      name,
    );
    const newSittingOut = result.sittingOut;
    const newQueue = result.queue;
    const newPriorityPlayers = result.priorityPlayers ?? [];
    setLocalSittingOut(newSittingOut);
    setLocalPriorityPlayers(newPriorityPlayers);
    setQueue(newQueue);

    if (result.poolSinglesState) {
      poolSinglesStateRef.current = result.poolSinglesState;
      setPoolSinglesStateUI(result.poolSinglesState);
    }
    if (result.singlesState) {
      singlesStateRef.current = result.singlesState;
      setSinglesStateUI(result.singlesState);
    }
    if (result.paddleState) {
      paddleStateRef.current = result.paddleState;
      setPaddleStateUI(result.paddleState);
    }

    if (session.sessionId) session.syncField({ sittingOut: newSittingOut, queue: newQueue, priorityPlayers: newPriorityPlayers });

    // Recalculate rest thresholds when active player count changes in skilled mode
    if (activeQueueMode === 'skilled' && skilledState) {
      const activeCount = players.filter(p => !newSittingOut.includes(p)).length;
      setSkilledState(prev => prev ? recalculateRestEngine(prev, activeCount) : prev);
    }
  };

  // ── Undo handler ───────────────────────────────────────────
  const handleUndoLastMatch = () => {
    const snap = undoSnapshotRef.current;
    if (!snap) return;
    setQueue(snap.queue);
    queueRef.current = snap.queue;
    paddleStateRef.current = snap.paddleState;
    setPaddleStateUI(snap.paddleState);
    singlesStateRef.current = snap.singlesState;
    setSinglesStateUI(snap.singlesState);
    if (snap.poolSinglesState) {
      poolSinglesStateRef.current = snap.poolSinglesState;
      setPoolSinglesStateUI(snap.poolSinglesState);
    }
    if (snap.courtSlots) {
      setLocalCourtSlots(snap.courtSlots);
      courtSlotsRef.current = snap.courtSlots;
    }
    if (snap.priorityPlayers !== undefined) {
      setLocalPriorityPlayers(snap.priorityPlayers);
    }
    if (snap.sittingOut !== undefined) {
      setLocalSittingOut(snap.sittingOut);
    }
    // Trim local history immediately — also removes from Firestore via
    // deleteLatestHistoryEntry called inside session.undoLastMatch.
    setLocalHistory(prev => prev.slice(1));
    if (session.sessionId) {
      session.undoLastMatch({
        queue: snap.queue,
        ...(snap.courtSlots ? { courtSlots: snap.courtSlots } : {}),
        ...(snap.priorityPlayers !== undefined ? { priorityPlayers: snap.priorityPlayers } : {}),
        ...(snap.sittingOut !== undefined ? { sittingOut: snap.sittingOut } : {}),
        ...(gameMode === 'doubles'
          ? { doublesEngineState: serializePaddleState(snap.paddleState) as unknown as Record<string, unknown> }
          : {
              singlesEngineState: (snap.singlesFormat === 'pool' && snap.poolSinglesState)
                ? (serializePoolSinglesState(snap.poolSinglesState) as unknown as Record<string, unknown>)
                : (serializeSinglesState(snap.singlesState) as unknown as Record<string, unknown>),
            }),
      });
    }
    undoSnapshotRef.current = null;
    setHasUndo(false);
  };
  handleUndoLastMatchRef.current = handleUndoLastMatch;

  // ── Absent player → substitute ─────────────────────────────
  const handleMarkAbsent = (player: string) => {
    if (isSingleCourtReplaceBlocked) {
      showToast('Cannot replace player after scoring has started');
      return;
    }
    setMultiCourtSubConfirmed(false);
    setSubstituteFor(player);
  };

  const executePlayerReplacement = (absent: string, replacement?: string) => {
    if (isSingleCourtReplaceBlocked) {
      showToast('Cannot replace player after scoring has started');
      setSubstituteFor(null);
      return;
    }
    const result = replaceCalledPlayerTransition(
      {
        gameMode: gameMode ?? 'singles',
        singlesFormat,
        players,
        queue,
        courtSlots,
        sittingOut: activeSittingOut,
        priorityPlayers: activePriorityPlayers,
        singlesState: singlesStateRef.current,
        paddleState: paddleStateRef.current,
        poolSinglesState: poolSinglesStateRef.current,
      },
      absent,
      replacement,
    );
    if (!result) {
      showToast('No eligible waiting players available to substitute');
      return;
    }
    undoSnapshotRef.current = {
      queue: [...queue],
      paddleState: clonePaddleState(paddleStateRef.current),
      singlesState: cloneSinglesState(singlesStateRef.current),
      poolSinglesState: clonePoolSinglesState(poolSinglesStateRef.current),
      singlesFormat,
      courtSlots: courtSlots.map(c => ({ ...c, onCourt: [...c.onCourt] })),
      priorityPlayers: [...activePriorityPlayers],
      sittingOut: [...activeSittingOut],
    };
    setHasUndo(true);

    setQueue(result.queue);
    queueRef.current = result.queue;
    setLocalSittingOut(result.sittingOut);
    if (result.priorityPlayers !== undefined) {
      setLocalPriorityPlayers(result.priorityPlayers);
    }
    if (result.courtSlots) {
      setLocalCourtSlots(result.courtSlots);
      courtSlotsRef.current = result.courtSlots;
    }

    if (result.poolSinglesState) {
      poolSinglesStateRef.current = result.poolSinglesState;
      setPoolSinglesStateUI(result.poolSinglesState);
    }
    if (result.singlesState) {
      singlesStateRef.current = result.singlesState;
      setSinglesStateUI(result.singlesState);
    }
    if (result.paddleState) {
      paddleStateRef.current = result.paddleState;
      setPaddleStateUI(result.paddleState);
    }

    if (session.sessionId) {
      session.syncField({
        queue: result.queue,
        sittingOut: result.sittingOut,
        ...(result.priorityPlayers !== undefined ? { priorityPlayers: result.priorityPlayers } : {}),
        ...(result.courtSlots ? { courtSlots: result.courtSlots } : {}),
      });
    }
    setSubstituteFor(null);
    setMultiCourtSubConfirmed(false);
    showMatchToast({
      message: `Replaced ${absent}`,
      canUndo: true,
    });
  };

  const handleConfirmSub = (replacement?: string) => {
    if (!substituteFor) return;
    executePlayerReplacement(substituteFor, replacement);
  };


  const handleSinglesMatch = (winner: string, score?: string, courtId?: string) => {
    const currentSlots = courtSlotsRef.current.length > 0 ? courtSlotsRef.current : courtSlots;
    if (gameMode === 'singles' && courtId && currentSlots.length > 0) {
      if (processingCourtIdsRef.current.has(courtId)) return;
      processingCourtIdsRef.current.add(courtId);
      const slot = currentSlots.find(court => court.id === courtId);
      if (!slot || slot.onCourt.length !== 2 || !slot.onCourt.includes(winner)) {
        processingCourtIdsRef.current.delete(courtId);
        return;
      }

      const winningSide: 'A' | 'B' = winner === slot.onCourt[0] ? 'A' : 'B';
      const entry: MatchHistoryEntry = {
        id: Date.now(),
        mode: `Singles (${slot.name})`,
        players: `${slot.onCourt[0]} vs ${slot.onCourt[1]}`,
        winner,
        score,
        timestamp: new Date().toLocaleTimeString(),
      };
      const planned = planMultiCourtResult(
        { queue: queueRef.current, courtSlots: currentSlots, sittingOut: activeSittingOut, priorityPlayers: activePriorityPlayers },
        courtId,
        [...slot.onCourt],
        winningSide,
        'singles',
      );
      if (!planned) {
        processingCourtIdsRef.current.delete(courtId);
        return;
      }
      const previousQueue = [...queueRef.current];
      const previousSlots = currentSlots.map(court => ({ ...court, onCourt: [...court.onCourt] }));

      setQueue(planned.queue);
      queueRef.current = planned.queue;
      setLocalCourtSlots(planned.courtSlots);
      courtSlotsRef.current = planned.courtSlots;
      if (planned.priorityPlayers !== undefined) {
        setLocalPriorityPlayers(planned.priorityPlayers);
      }
      setLocalHistory(previous => [entry, ...previous]);

      if (session.sessionId) {
        void session.commitCourtResult({
          courtId,
          expectedPlayers: [...slot.onCourt],
          winningSide,
          gameMode: 'singles',
          id: entry.id,
          timestamp: entry.timestamp,
          score,
        }).then(result => {
          if (!result || result.status === 'failed') {
            setLocalHistory(previous => previous.filter(item => item.id !== entry.id));
            setQueue(previousQueue);
            queueRef.current = previousQueue;
            setLocalCourtSlots(previousSlots);
            courtSlotsRef.current = previousSlots;
            const message = result?.status === 'failed' && result.reason === 'permission'
              ? 'Firebase rejected the result. Host access may have expired; the previous match was restored.'
              : 'The result could not be saved. Check the connection and try again; the previous match was restored.';
            showToast(message);
            return;
          }
          setQueue(result.queue);
          queueRef.current = result.queue;
          setLocalCourtSlots(result.courtSlots);
          courtSlotsRef.current = result.courtSlots;
          if (result.status === 'stale') {
            setLocalHistory(previous => previous.filter(item => item.id !== entry.id));
            showToast('This court already changed. Its latest assignment has been restored.');
            return;
          }
          recordCareerResult(entry.players, entry.winner);
          setCareerStats(loadCareerStats());
          showMatchToast({
            message: `${slot.name}: ${winner} won${score ? ` (${score})` : ''}`,
            canUndo: true,
          });
        }).finally(() => processingCourtIdsRef.current.delete(courtId));
      } else {
        recordCareerResult(entry.players, entry.winner);
        setCareerStats(loadCareerStats());
        showMatchToast({
          message: `${slot.name}: ${winner} won${score ? ` (${score})` : ''}`,
          canUndo: true,
        });
        processingCourtIdsRef.current.delete(courtId);
      }
      return;
    }

    if (isProcessingMatchRef.current) return;
    isProcessingMatchRef.current = true;
    const [p1, p2] = [queue[0], queue[1]];
    const previousQueue = [...queue];
    const previousPriorityPlayers = [...activePriorityPlayers];
    const previousPaddleState = clonePaddleState(paddleStateRef.current);
    const previousSinglesState = cloneSinglesState(singlesStateRef.current);
    const previousPoolSinglesState = clonePoolSinglesState(poolSinglesStateRef.current);
    undoSnapshotRef.current = {
      queue: previousQueue,
      paddleState: previousPaddleState,
      singlesState: previousSinglesState,
      poolSinglesState: previousPoolSinglesState,
      singlesFormat,
      priorityPlayers: previousPriorityPlayers,
    };
    setHasUndo(true);
    if (activeQueueMode === 'playall') recordPlayAllSingles(p1, p2);
    let newQueue: string[];

    if (activeQueueMode === 'default' && gameMode === 'singles') {
      const activePlayers = players.filter(p => !activeSittingOut.includes(p));
      if (singlesFormat === 'pool') {
        const loser = winner === p1 ? p2 : p1;
        const skillMap = Object.fromEntries(
          Object.entries(statsMap).map(([name, stat]) => [
            name,
            (stat as PlayerStat).gamesPlayed >= 3
              ? (stat as PlayerStat).winRate
              : bracketSkillValue(rosterSkillMap[name]),
          ])
        );
        const { nextState, newQueue: poolQueue } = advancePoolSinglesState(
          poolSinglesStateRef.current,
          winner,
          loser,
          activePlayers,
          skillMap,
          activePriorityPlayers,
        );
        poolSinglesStateRef.current = nextState;
        setPoolSinglesStateUI(nextState);
        newQueue = poolQueue;
      } else {
        const { nextState, newQueue: singlesQueue } = advanceSinglesState(
          singlesStateRef.current,
          winner,
          activePlayers,
          activePriorityPlayers,
        );
        singlesStateRef.current = nextState;
        setSinglesStateUI(nextState);
        newQueue = singlesQueue;
      }
    } else {
      const rest = queue.slice(2);
      const loser = winner === p1 ? p2 : p1;
      newQueue = [loser, ...rest, winner];
    }
    const nextPriority = consumePriority(activePriorityPlayers, [p1, p2, ...newQueue.slice(0, 2)]);
    setLocalPriorityPlayers(nextPriority);
    setLocalHasScoredPoints(false);
    setQueue(newQueue);
    queueRef.current = newQueue;
    const entry: MatchHistoryEntry = {
      id: Date.now(), mode: 'Singles', players: `${p1} vs ${p2}`,
      winner, score, timestamp: new Date().toLocaleTimeString(),
    };
    setLocalHistory(current => [entry, ...current]);

    const finishSuccess = () => {
      recordCareerResult(entry.players, entry.winner);
      setCareerStats(loadCareerStats());
      showMatchToast({
        message: `${winner} won${score ? ` (${score})` : ''}`,
        canUndo: true,
      });
    };

    if (!session.sessionId) {
      finishSuccess();
      isProcessingMatchRef.current = false;
      return;
    }

    const enginePatch = activeQueueMode === 'default'
      ? {
          singlesEngineState: singlesFormat === 'pool'
            ? (serializePoolSinglesState(poolSinglesStateRef.current) as unknown as Record<string, unknown>)
            : (serializeSinglesState(singlesStateRef.current) as unknown as Record<string, unknown>),
        }
      : {};
    void session.commitMatchResult(
      { queue: newQueue, priorityPlayers: nextPriority, liveScore: null, ...enginePatch },
      entry,
    ).then(result => {
      const message = matchResultFailureMessage(result);
      if (!message) {
        finishSuccess();
        return;
      }
      setLocalHistory(current => current.filter(item => item.id !== entry.id));
      setLocalPriorityPlayers(previousPriorityPlayers);
      setQueue(previousQueue);
      queueRef.current = previousQueue;
      paddleStateRef.current = previousPaddleState;
      setPaddleStateUI(previousPaddleState);
      singlesStateRef.current = previousSinglesState;
      setSinglesStateUI(previousSinglesState);
      poolSinglesStateRef.current = previousPoolSinglesState;
      setPoolSinglesStateUI(previousPoolSinglesState);
      setHasUndo(false);
      showToast(message);
    }).finally(() => {
      isProcessingMatchRef.current = false;
    });
  };

  const handleDoublesMatch = async (a: string[], b: string[], w: 'A' | 'B', score?: string): Promise<boolean> => {
    if (isProcessingMatchRef.current) return false;
    isProcessingMatchRef.current = true;
    const previousQueue = [...queue];
    const previousPriorityPlayers = [...activePriorityPlayers];
    const previousPaddleState = clonePaddleState(paddleStateRef.current);
    const previousSinglesState = cloneSinglesState(singlesStateRef.current);
    const previousPoolSinglesState = clonePoolSinglesState(poolSinglesStateRef.current);
    // Save undo snapshot before mutating state
    undoSnapshotRef.current = {
      queue: previousQueue,
      paddleState: previousPaddleState,
      singlesState: previousSinglesState,
      poolSinglesState: previousPoolSinglesState,
      singlesFormat,
      priorityPlayers: previousPriorityPlayers,
    };
    setHasUndo(true);
    if (activeQueueMode === 'playall') recordPlayAllDoubles(a, b);
    const winnerTeam = (w === 'A' ? a : b) as [string, string];
    const loserTeam  = (w === 'A' ? b : a) as [string, string];
    const winnerNames = winnerTeam.join(' & ');
    let newQueue: string[];
    if (gameMode === 'doubles') {
      const skillMap = Object.fromEntries(
        Object.entries(statsMap).map(([name, stat]) => [
          name,
          (stat as PlayerStat).gamesPlayed >= 3
            ? (stat as PlayerStat).winRate
            : bracketSkillValue(rosterSkillMap[name]),
        ])
      );
      const activePlayers = players.filter(p => !activeSittingOut.includes(p));
      const { nextState, newQueue: paddleQueue } = advancePaddleState(
        paddleStateRef.current,
        winnerTeam,
        loserTeam,
        activePlayers,
        skillMap,
        activePriorityPlayers,
      );
      paddleStateRef.current = nextState;
      setPaddleStateUI(nextState);
      newQueue = paddleQueue;
    } else {
      const rest = queue.slice(4);
      newQueue = [...loserTeam, ...rest, ...winnerTeam];
    }
    const nextPriority = consumePriority(activePriorityPlayers, [...a, ...b, ...newQueue.slice(0, 4)]);
    setLocalPriorityPlayers(nextPriority);
    setLocalHasScoredPoints(false);
    setQueue(newQueue);
    queueRef.current = newQueue;
    const entry: MatchHistoryEntry = {
      id: Date.now(), mode: 'Doubles', players: `${a.join(' & ')} vs ${b.join(' & ')}`,
      winner: winnerNames, score, timestamp: new Date().toLocaleTimeString(),
    };
    setLocalHistory(current => [entry, ...current]);

    const finishSuccess = () => {
      recordCareerResult(entry.players, entry.winner);
      setCareerStats(loadCareerStats());
      showMatchToast({
        message: `${winnerNames} won${score ? ` (${score})` : ''}`,
        canUndo: true,
      });
    };

    try {
      if (!session.sessionId) {
        finishSuccess();
        return true;
      }

      const result = await session.commitMatchResult(
        {
          queue: newQueue,
          priorityPlayers: nextPriority,
          liveScore: null,
          doublesEngineState: serializePaddleState(paddleStateRef.current) as unknown as Record<string, unknown>,
        },
        entry,
      );
      const message = matchResultFailureMessage(result);
      if (!message) {
        finishSuccess();
        return true;
      }

      setLocalHistory(current => current.filter(item => item.id !== entry.id));
      setLocalPriorityPlayers(previousPriorityPlayers);
      setQueue(previousQueue);
      queueRef.current = previousQueue;
      paddleStateRef.current = previousPaddleState;
      setPaddleStateUI(previousPaddleState);
      singlesStateRef.current = previousSinglesState;
      setSinglesStateUI(previousSinglesState);
      poolSinglesStateRef.current = previousPoolSinglesState;
      setPoolSinglesStateUI(previousPoolSinglesState);
      setHasUndo(false);
      showToast(message);
      return false;
    } finally {
      isProcessingMatchRef.current = false;
    }
  };

  const handleCourtMatch = (courtId: string, side: 'A' | 'B', score?: string) => {
    if (processingCourtIdsRef.current.has(courtId)) return;
    processingCourtIdsRef.current.add(courtId);
    const currentSlots = courtSlotsRef.current.length > 0 ? courtSlotsRef.current : courtSlots;
    const slot = currentSlots.find(c => c.id === courtId);
    if (!slot || slot.onCourt.length < 4) { processingCourtIdsRef.current.delete(courtId); return; }

    // Save undo snapshot (includes courtSlots so multi-court undo works correctly)
    undoSnapshotRef.current = {
      queue:        [...queue],
      paddleState:  clonePaddleState(paddleStateRef.current),
      singlesState: cloneSinglesState(singlesStateRef.current),
      courtSlots:   currentSlots.map(c => ({ ...c, onCourt: [...c.onCourt] })),
      priorityPlayers: [...activePriorityPlayers],
    };
    setHasUndo(true);

    const teamA = slot.onCourt.slice(0, 2) as [string, string];
    const teamB = slot.onCourt.slice(2, 4) as [string, string];
    const winnerTeam = side === 'A' ? teamA : teamB;
    const loserTeam  = side === 'A' ? teamB : teamA;

    // Players on other courts are locked — exclude from this court's rotation
    const lockedSet = new Set(
      currentSlots.filter(c => c.id !== courtId).flatMap(c => c.onCourt)
    );
    const activePlayers = players.filter(p => !lockedSet.has(p) && !activeSittingOut.includes(p));

    const planned = planMultiCourtResult(
      {
        queue: queueRef.current,
        courtSlots: currentSlots,
        lockedPartners: (session.lockedPartners ?? []).map(([a, b]) => ({ a, b })),
        sittingOut: activeSittingOut,
        priorityPlayers: activePriorityPlayers,
      },
      courtId,
      [...slot.onCourt],
      side,
      'doubles',
    );
    if (!planned) {
      processingCourtIdsRef.current.delete(courtId);
      return;
    }
    const updatedSlots = planned.courtSlots;
    const newQueue = planned.queue;
    if (planned.priorityPlayers !== undefined) {
      setLocalPriorityPlayers(planned.priorityPlayers);
    }

    const winnerNames = winnerTeam.join(' & ');
    const entry: MatchHistoryEntry = {
      id: Date.now(),
      mode: `Doubles (${slot.name})`,
      players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}`,
      winner: winnerNames,
      score,
      timestamp: new Date().toLocaleTimeString(),
    };
    const previousQueue = [...queueRef.current];
    const previousSlots = currentSlots.map(court => ({ ...court, onCourt: [...court.onCourt] }));

    setLocalCourtSlots(updatedSlots);
    courtSlotsRef.current = updatedSlots;
    setQueue(newQueue);
    queueRef.current = newQueue;
    setLocalHistory(prev => [entry, ...prev]);

    if (session.sessionId) {
      void session.commitCourtResult({
        courtId,
        expectedPlayers: [...slot.onCourt],
        winningSide: side,
        gameMode: 'doubles',
        id: entry.id,
        timestamp: entry.timestamp,
        score,
      }).then(result => {
        if (!result || result.status === 'failed') {
          setLocalHistory(prev => prev.filter(item => item.id !== entry.id));
          setQueue(previousQueue);
          queueRef.current = previousQueue;
          setLocalCourtSlots(previousSlots);
          courtSlotsRef.current = previousSlots;
          const message = result?.status === 'failed' && result.reason === 'permission'
            ? 'Firebase rejected the result. Host access may have expired; the previous match was restored.'
            : 'The result could not be saved. Check the connection and try again; the previous match was restored.';
          showToast(message);
          return;
        }
        setQueue(result.queue);
        queueRef.current = result.queue;
        setLocalCourtSlots(result.courtSlots);
        courtSlotsRef.current = result.courtSlots;
        if (result.status === 'stale') {
          setLocalHistory(prev => prev.filter(item => item.id !== entry.id));
          showToast('This court already changed. Its latest assignment has been restored.');
          return;
        }
        recordCareerResult(entry.players, entry.winner);
        setCareerStats(loadCareerStats());
        showMatchToast({
          message: `${slot.name}: ${winnerNames} won${score ? ` (${score})` : ''}`,
          canUndo: true,
        });
      }).finally(() => processingCourtIdsRef.current.delete(courtId));
    } else {
      recordCareerResult(entry.players, entry.winner);
      setCareerStats(loadCareerStats());
      if (score) {
        showToast(`${slot.name}: ${winnerNames} win (${score})`);
      } else {
        setModalWinner(`${winnerNames} win!`);
        setModalScore(undefined);
        setModalOpen(true);
      }
      showMatchToast({
        message: `${slot.name}: ${winnerNames} won${score ? ` (${score})` : ''}`,
        canUndo: true,
      });
      processingCourtIdsRef.current.delete(courtId);
    }
  };

  const handleCourtWinClick = (courtId: string, side: 'A' | 'B') => {
    const currentSlots = courtSlotsRef.current.length > 0 ? courtSlotsRef.current : courtSlots;
    const slot = currentSlots.find(c => c.id === courtId);
    if (!slot || slot.onCourt.length < 4) return;
    if (!scorePromptEnabled) {
      handleCourtMatch(courtId, side);
      return;
    }
    const teamA = slot.onCourt.slice(0, 2);
    const teamB = slot.onCourt.slice(2, 4);
    setPendingCourtScore({
      courtId,
      courtName: slot.name,
      side,
      teamA,
      teamB,
      mode: 'doubles',
    });
  };

  const handleSinglesCourtWinClick = (courtId: string, winner: string) => {
    const currentSlots = courtSlotsRef.current.length > 0 ? courtSlotsRef.current : courtSlots;
    const slot = currentSlots.find(c => c.id === courtId);
    if (!slot || slot.onCourt.length < 2) return;
    const [p1, p2] = slot.onCourt;
    const side = winner === p1 ? 'A' : 'B';
    if (!scorePromptEnabled) {
      handleSinglesMatch(winner, undefined, courtId);
      return;
    }
    setPendingCourtScore({
      courtId,
      courtName: slot.name,
      side,
      teamA: [p1],
      teamB: [p2],
      mode: 'singles',
    });
  };

  const handleConfirmCourtScore = (score?: string) => {
    if (!pendingCourtScore) return;
    const { courtId, side, teamA, teamB, mode } = pendingCourtScore;
    setPendingCourtScore(null);
    if (mode === 'singles') {
      const winner = side === 'A' ? teamA[0] : teamB[0];
      handleSinglesMatch(winner, score, courtId);
    } else if (mode === 'skilled') {
      handleSkilledResult(courtId, side, score);
    } else {
      handleCourtMatch(courtId, side, score);
    }
  };

  // ── Mid-session player position swap ──────────────────────
  // Host can swap any two of the 4 players on a court — changes
  // who is partnered with whom, or which teams face each other.
  // onCourt[0..1] = Team A, onCourt[2..3] = Team B.
  const handleSwapPlayers = (courtId: string, newOnCourt: string[]) => {
    const updatedSlots = courtSlotsRef.current.map((s: CourtSlot) =>
      s.id === courtId ? { ...s, onCourt: newOnCourt } : s
    );
    courtSlotsRef.current = updatedSlots;
    setLocalCourtSlots(updatedSlots);
    if (session.sessionId) session.syncField({ courtSlots: updatedSlots });
    setSwapCourtId(null);
  };

  // ── Skilled mode result handler ────────────────────────────
  const handleSkilledResult = (courtId: string, side: 'A' | 'B', score?: string) => {
    if (isProcessingMatchRef.current || !skilledState) return;
    isProcessingMatchRef.current = true;

    const court = skilledState.courts.find(c => c.id === courtId);
    if (!court || court.players.length < 4) { isProcessingMatchRef.current = false; return; }

    undoSnapshotRef.current = { queue: [...queue], paddleState: clonePaddleState(paddleStateRef.current), singlesState: cloneSinglesState(singlesStateRef.current) };
    setHasUndo(true);

    const teamA      = court.players.slice(0, 2) as [string, string];
    const teamB      = court.players.slice(2, 4) as [string, string];
    const winnerTeam = side === 'A' ? teamA : teamB;
    const winnerNames = winnerTeam.join(' & ');

    const afterRotate   = rotatePlayersEngine(court.players, skilledState, skilledBrackets);
    const afterReassign = reassignCourtEngine(courtId, afterRotate, skilledBrackets);
    setSkilledState(fillIdleCourtsEngine(afterReassign));

    const entry: MatchHistoryEntry = {
      id: Date.now(), mode: `Skilled (${court.name})`,
      players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}`,
      winner: winnerNames,
      score,
      timestamp: new Date().toLocaleTimeString(),
    };
    setLocalHistory(prev => [entry, ...prev]);
    recordCareerResult(entry.players, entry.winner);
    setCareerStats(loadCareerStats());
    if (session.sessionId) void session.commitMatchResult({ queue }, entry).then(result => {
      const message = matchResultFailureMessage(result);
      if (message) showToast(message);
    });

    showMatchToast({
      message: `${court.name}: ${winnerNames} won${score ? ` (${score})` : ''}`,
      canUndo: true,
    });
    isProcessingMatchRef.current = false;
  };

  const handleSkilledWinClick = (courtId: string, side: 'A' | 'B') => {
    if (!skilledState) return;
    const court = skilledState.courts.find(c => c.id === courtId);
    if (!court || court.players.length < 4) return;
    if (!scorePromptEnabled) {
      handleSkilledResult(courtId, side);
      return;
    }
    const teamA = court.players.slice(0, 2);
    const teamB = court.players.slice(2, 4);
    setPendingCourtScore({
      courtId,
      courtName: court.name,
      side,
      teamA,
      teamB,
      mode: 'skilled',
    });
  };

  const handleAddPlayerLive = (name: string) => {
    const trimmedName = name.trim();
    if (players.some(player => player.toLowerCase() === trimmedName.toLowerCase())) { showToast(`"${trimmedName}" is already in the session`); return; }
    if (players.length >= V1_RELEASE.maxPlayers) { showToast(`V1 supports up to ${V1_RELEASE.maxPlayers} players`); return; }
    if (trimmedName.length === 0 || trimmedName.length > 60) { showToast('Player names must be 60 characters or fewer'); return; }
    const np = [...players, trimmedName], nq = [...queue, trimmedName];
    const nextPriority = [...activePriorityPlayers, trimmedName];
    setPlayers(np); setQueue(nq);
    setLocalPriorityPlayers(nextPriority);
    if (activeQueueMode === 'default' && gameMode === 'doubles') {
      const newPaddleState = addPlayerToWaiting(paddleStateRef.current, trimmedName);
      paddleStateRef.current = newPaddleState;
      setPaddleStateUI(newPaddleState);
    } else if (activeQueueMode === 'default' && gameMode === 'singles') {
      if (singlesFormat === 'pool') {
        const newPoolState = addPlayerToPoolSinglesWaiting(poolSinglesStateRef.current, trimmedName, true);
        poolSinglesStateRef.current = newPoolState;
        setPoolSinglesStateUI(newPoolState);
      } else {
        const newSinglesState = addPlayerToSinglesWaiting(singlesStateRef.current, trimmedName, true);
        singlesStateRef.current = newSinglesState;
        setSinglesStateUI(newSinglesState);
      }
    } else if (activeQueueMode === 'skilled' && skilledState) {
      const activeCount = np.filter(p => !activeSittingOut.includes(p)).length;
      setSkilledState(prev => {
        if (!prev) return prev;
        const afterAdd = addPlayerToSkilledStateEngine(trimmedName, prev, skilledBrackets);
        return recalculateRestEngine(afterAdd, activeCount);
      });
    }
    if (session.sessionId) session.syncField({ players: np, queue: nq, priorityPlayers: nextPriority });
  };

  const handleMoveWaitingPlayer = (playerName: string, direction: -1 | 1) => {
    const curIdx = waitingPlayers.indexOf(playerName);
    if (curIdx === -1) return;
    const targetIdx = curIdx + direction;
    if (targetIdx < 0 || targetIdx >= waitingPlayers.length) return;
    const otherPlayer = waitingPlayers[targetIdx];

    const isPlayerPriority = activePriorityPlayers.includes(playerName);
    const isOtherPriority = activePriorityPlayers.includes(otherPlayer);
    if (isPlayerPriority !== isOtherPriority) return;

    const qIdx1 = queue.indexOf(playerName);
    const qIdx2 = queue.indexOf(otherPlayer);
    if (qIdx1 === -1 || qIdx2 === -1) return;

    const newQueue = [...queue];
    newQueue[qIdx1] = otherPlayer;
    newQueue[qIdx2] = playerName;

    setQueue(newQueue);
    queueRef.current = newQueue;
    if (session.sessionId) session.syncField({ queue: newQueue });
  };

  const handlePartnerPairsChange = (nextPairs: [string, string][]) => {
    const playerSet = new Set(players);
    const used = new Set<string>();
    const maxPairs = getMaxPartnerPairs(players.length);
    const validPairs = nextPairs.filter(([a, b]) => {
      if (a === b || !playerSet.has(a) || !playerSet.has(b)) return false;
      if (used.has(a) || used.has(b)) return false;
      used.add(a);
      used.add(b);
      return true;
    }).slice(0, maxPairs);

    setLockedPartners(validPairs);
    lockedPartnersRef.current = validPairs;
    if (session.sessionId) {
      void session.syncField({
        lockedPartners: validPairs.map(([a, b]) => ({ a, b })),
      });
    }
  };

  const handleFullReset = () => { setPendingConfirm({ type: 'clear-history' }); };

  const handleHardReset = () => { setPendingConfirm({ type: 'hard-reset' }); };

  // Save the current court to the court group once the session is created
  useEffect(() => {
    if (!V1_RELEASE.showLegacyCourtCoordinator) return;
    if (!session.sessionId || !session.isHost) return;
    const entry: CourtEntry = {
      sessionId: session.sessionId,
      gameMode: gameMode ?? 'singles',
      name: setupCourtName.trim() || 'Court 1',
    };
    addCourtToGroup(entry);
    setCourts(loadCourtGroup());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId]);

  const handleSwitchCourt = (targetSessionId: string) => {
    if (targetSessionId === session.sessionId) return;
    const target = courts.find(c => c.sessionId === targetSessionId);
    if (!target) return;
    saveHostToStorage(target.sessionId, target.gameMode);
    window.location.reload();
  };

  const handleRemoveCourt = (targetSessionId: string) => {
    setPendingConfirm({ type: 'remove-court', sessionId: targetSessionId });
  };

  const handleAddCourt = () => { router.push('/'); };

  const handleBackHome = () => {
    if (session.isHost && session.sessionId && !session.isExpired) {
      setPendingConfirm({ type: 'back-home' });
    } else {
      router.push('/');
    }
  };

  const doConfirmedAction = async () => {
    const action = pendingConfirm;
    if (!action) return;
    if (action.type === 'clear-history') {
      setPendingConfirm(null);
      setLocalHistory([]);
      await session.clearMatchHistory();
    } else if (action.type === 'hard-reset') {
      setIsDeletingSession(true);
      try {
        await session.deleteHostedSession();
        clearCourtGroup();
        sessionStorage.clear();
        router.push('/');
      } catch (error) {
        console.error('[queue] delete session error:', error);
        showToast('Event data was not deleted. Check your connection and try again.');
      } finally {
        setIsDeletingSession(false);
        setPendingConfirm(null);
      }
    } else if (action.type === 'back-home') {
      setPendingConfirm(null);
      router.push('/');
    } else if (action.type === 'remove-court') {
      setPendingConfirm(null);
      removeCourtFromGroup(action.sessionId);
      setCourts(loadCourtGroup());
    }
  };

  // ── Roster handlers ──────────────────────────────────────

  const handleSaveToRoster = () => {
    if (tempPlayers.length === 0) return;
    mergeIntoRoster(tempPlayers);
    setRoster(loadRoster());
  };

  const handleRosterToggle = (name: string) => {
    setRosterSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleSelectAllRoster = () => {
    setRosterSelected(new Set(
      roster
        .filter(e => !tempPlayers.some(p => p.toLowerCase() === e.name.toLowerCase()))
        .map(e => e.name)
    ));
  };

  const handleAddFromRoster = () => {
    const available = V1_RELEASE.maxPlayers - tempPlayers.length;
    const existing = new Set(tempPlayers.map(name => name.toLowerCase()));
    const fresh = [...rosterSelected].filter(name => !existing.has(name.toLowerCase()) && name.length <= 60).slice(0, available);
    if (fresh.length === 0) return;
    setTempPlayers(prev => [...prev, ...fresh]);
    setRosterSelected(new Set());
  };

  const handleRemoveFromRosterUI = (name: string) => {
    removeFromRoster(name);
    setRoster(loadRoster());
    setRosterSelected(prev => { const next = new Set(prev); next.delete(name); return next; });
  };

  const handleSetRosterSkill = (name: string, skill: SkillBracket | undefined) => {
    setRosterEntrySkill(name, skill);
    setRoster(loadRoster());
  };

  // Assign a player to a bracket, moving them out of any other bracket they're in
  const handleAssignToBracket = (bracket: SkillBracket, name: string) => {
    setSkilledBrackets(prev => {
      const cleared = {
        beginner:     prev.beginner.filter(n => n !== name),
        intermediate: prev.intermediate.filter(n => n !== name),
        advanced:     prev.advanced.filter(n => n !== name),
      };
      return { ...cleared, [bracket]: [...cleared[bracket], name] };
    });
    if (skilledState) setSkilledState(prev => prev ? retagPlayerInQueue(name, bracket as SkillLevel, prev) : prev);
  };

  // Remove skill tag only — player stays in session and queue (defaults to intermediate)
  const handleUnassignFromBracket = (bracket: SkillBracket, name: string) => {
    setSkilledBrackets(prev => ({ ...prev, [bracket]: prev[bracket].filter(n => n !== name) }));
    if (skilledState) setSkilledState(prev => prev ? retagPlayerInQueue(name, 'intermediate', prev) : prev);
  };

  // Add one or more players to the session AND assign to a bracket in one atomic update
  const handleAddNewToSkilled = (bracket: SkillBracket, names: string[]) => {
    if (!names.length) return;
    const genuinelyNew = names.filter(n => n.trim() && !players.includes(n));
    if (genuinelyNew.length > 0) {
      const np = [...players, ...genuinelyNew], nq = [...queue, ...genuinelyNew];
      setPlayers(np); setQueue(nq);
      if (session.sessionId) session.syncField({ players: np, queue: nq });
    }
    setSkilledBrackets(prev => {
      const cleared = {
        beginner:     prev.beginner.filter(n => !names.includes(n)),
        intermediate: prev.intermediate.filter(n => !names.includes(n)),
        advanced:     prev.advanced.filter(n => !names.includes(n)),
      };
      const existing = cleared[bracket];
      return { ...cleared, [bracket]: [...existing, ...names.filter(n => !existing.includes(n))] };
    });
    if (skilledState) {
      setSkilledState(prev => {
        if (!prev) return prev;
        const updatedBrackets = {
          beginner:     skilledBrackets.beginner.filter(n => !names.includes(n)),
          intermediate: skilledBrackets.intermediate.filter(n => !names.includes(n)),
          advanced:     skilledBrackets.advanced.filter(n => !names.includes(n)),
        };
        const existing = updatedBrackets[bracket];
        updatedBrackets[bracket] = [...existing, ...names.filter(n => !existing.includes(n))];
        let s = prev;
        for (const name of names) {
          s = addPlayerToSkilledStateEngine(name, s, updatedBrackets);
          s = retagPlayerInQueue(name, bracket as SkillLevel, s);
        }
        return s;
      });
    }
  };

  // ── Shared fragments ──────────────────────────────────────
  const canControl = !session.sessionId || session.isHost;
  // Undo is available in multi-court mode too: handleUndoLastMatch already
  // restores courtSlots from the snapshot and syncs it through undoLastMatch,
  // so there's no correctness reason to hide the control here.
  const canUndo = canControl && hasUndo;

  const modeSelector = V1_RELEASE.showQueueModeSelector ? (
    <div className="mode-selector">
      {(['default', 'tournament', 'playall', 'skilled'] as const).map(m => (
        <button key={m} className={`mode-btn ${activeQueueMode === m ? 'active' : ''}`} onClick={() => canControl && handleModeChange(m)} disabled={!canControl}>
          {m === 'default'    && <><Swords size={12} /> Default</>}
          {m === 'tournament' && <><Trophy size={12} /> Tournament</>}
          {m === 'playall'    && <><Star   size={12} /> Play‑all</>}
          {m === 'skilled'    && <><Layers size={12} /> Skilled</>}
        </button>
      ))}
    </div>
  ) : null;
  const elimSelector = activeQueueMode === 'tournament' && (
    <div className="elim-selector">
      {(['single', 'double'] as const).map(t => (
        <button key={t} className={`elim-btn ${activeElimType === t ? 'active' : ''}`} onClick={() => canControl && handleElimTypeChange(t)}>
          {t === 'single' ? 'Single Elim' : 'Double Elim'}
        </button>
      ))}
    </div>
  );
  const uiControls = (
    <div className="ui-controls">
      <button className="control-btn" onClick={() => setShowHistory(h => !h)}>
        <History size={12} /> {showHistory ? 'Hide' : 'Show'} History
      </button>
    </div>
  );
  const tabBar = (
    <div className="tab-bar">
      <button className={`tab-btn ${activeTab === 'queue'     ? 'active' : ''}`} onClick={() => setActiveTab('queue')}><Swords size={12} /> Queue</button>
      <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}><BarChart2 size={12} /> Stats</button>
    </div>
  );
  const historyPanel = showHistory && (
    <div className="history-area">
      <h3><History size={13} /> History</h3>
      {activeHistory.length === 0
        ? <p className="muted-hint">No matches played yet.</p>
        : (
          <ul className="history-list">
            {activeHistory.map(e => (
              <li key={e.id} className="history-item">
                <div className="history-time">{e.timestamp}</div>
                <div className="history-match">
                  {e.mode?.includes('(') && (
                    <div className="history-court-tag">{e.mode.match(/\(([^)]+)\)/)?.[1]}</div>
                  )}
                  <div>{e.players}</div>
                </div>
                <div className="history-winner"><Trophy size={11} /> {e.winner}</div>
                {e.score && <div className="history-score">{e.score}</div>}
              </li>
            ))}
          </ul>
        )}
    </div>
  );

  // ── RENDER A — Setup ──────────────────────────────────────
  if (players.length === 0) {
    return (
      <SetupView
        gameMode={gameMode}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
        courtCount={courtCount}
        onCourtCountChange={setCourtCount}
        maxCourts={V1_RELEASE.maxCourts}
        showAccessPin={V1_RELEASE.showAccessPinSetup}
        showSkillTagging={V1_RELEASE.showSkillTagging}
        setupPin={setupPin}
        onPinChange={setSetupPin}
        roster={roster}
        showRoster={showRoster}
        onToggleRoster={() => setShowRoster(s => !s)}
        rosterSelected={rosterSelected}
        onRosterToggle={handleRosterToggle}
        onSelectAllRoster={handleSelectAllRoster}
        onAddFromRoster={handleAddFromRoster}
        onSaveToRoster={handleSaveToRoster}
        onRemoveFromRoster={handleRemoveFromRosterUI}
        onSetRosterSkill={handleSetRosterSkill}
        tempPlayers={tempPlayers}
        currentName={currentName}
        onCurrentNameChange={setCurrentName}
        pasteInput={pasteInput}
        onPasteInputChange={setPasteInput}
        onAddPlayer={addTempPlayer}
        onRemoveTempPlayer={removeTempPlayer}
        onAddFromPaste={addFromPaste}
        onStartQueue={handleStartQueue}
        isSaving={session.isSaving}
        onBack={() => router.push('/')}
        errorMsg={setupErrorMsg ?? undefined}
        singlesFormat={singlesFormat}
        onSinglesFormatChange={setSinglesFormat}
      />
    );
  }

  // Shared gear menu props
  const gearMenuProps = {
    sessionId: session.sessionId,
    isHost: session.isHost,
    isLive: isLiveLocal,
    canControl,
    onToggleLive: handleGoLive,
    onHardReset: handleHardReset,
    onShowGuide: () => setShowGuide(true),
    hasMultipleCourts: V1_RELEASE.showLegacyCourtCoordinator && courts.length >= 2,
    onShowCoordinator: () => setShowCoordinator(true),
    canUndo,
    onUndo: handleUndoLastMatch,
    onShowRecap: activeHistory.length > 0 ? () => setShowRecapModal(true) : undefined,
  };

  // ── RENDER B — Tournament ─────────────────────────────────
  if (activeQueueMode === 'tournament' && activeTournamentActive) {
    const pendingMatch = activeTournamentM.find(m => !m.winner && !m.isBye && m.player1 && m.player2) ?? null;
    return (
      <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
        <div className="topright-controls">
          <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          <GearMenu {...gearMenuProps} />
        </div>
        <button className="back-home" onClick={handleBackHome}><ArrowLeft size={14} /> Back</button>
        <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />
        {session.isExpired && (<div className="session-alert session-alert--expired"><WifiOff size={14} /> Session expired. <button onClick={() => router.push('/')}>Go Home</button></div>)}
        {session.isReconnecting && !session.isExpired && (<div className="session-alert session-alert--reconnecting"><Wifi size={14} /> Reconnecting…</div>)}
        {restorationWarning && (<div className="session-alert session-alert--warn">⚠ Queue state could not be restored (browser storage was corrupted). Your player list is empty — please re-enter it. <button onClick={dismissRestorationWarning}>Dismiss</button></div>)}
        {modeSelector}{elimSelector}{uiControls}{tabBar}
        {!session.isHost && session.sessionId && (<div className="viewer-banner"><Wifi size={13} /> Watching live — only the host can make changes.</div>)}
        {activeTab === 'analytics' ? (
          <AnalyticsDashboard
            stats={statsList}
            careerStats={careerStats}
            history={activeHistory}
            roomCode={session.sessionId}
            mode={gameMode ?? 'doubles'}
          />
        ) : (
          <div className="main-layout">
            <div className="queue-area">
              <h1 className="queue-title"><Trophy size={20} />{gameMode === 'singles' ? 'Singles' : 'Doubles'} Tournament</h1>
              {session.isHost && <button onClick={handleRandomize} className="randomize-btn"><Shuffle size={12} /> Reseed</button>}
              {activeTournamentWinner && <div className="champion-banner"><Trophy size={18} /> Champion: {activeTournamentWinner}</div>}
              <TournamentBracket matches={activeTournamentM} elimType={activeElimType} />
              {pendingMatch && !activeTournamentWinner && (
                <div className="match-section">
                  <h3 className="match-section-title">
                    {pendingMatch.bracket === 'GF' && <Trophy size={14} />}
                    {pendingMatch.bracket === 'L' && '🔴 Losers — '}
                    {pendingMatch.bracket === 'GF' && ' Grand Final — '}
                    {`${pendingMatch.player1} vs ${pendingMatch.player2}`}
                  </h3>
                  {gameMode === 'doubles' ? (
                    <>
                      <div className="team-display-row">
                        <div className="tourn-team-block"><span className="tourn-team-label tourn-team-label--a">Team A</span><span className="team-chip team-chip--a">{pendingMatch.player1}</span></div>
                        <span className="vs-sep">vs</span>
                        <div className="tourn-team-block"><span className="tourn-team-label tourn-team-label--b">Team B</span><span className="team-chip team-chip--b">{pendingMatch.player2}</span></div>
                      </div>
                      <ScoreBoard labelA={pendingMatch.player1!} labelB={pendingMatch.player2!} disabled={!session.isHost} onScoreChange={session.isHost ? handleScoreChange : undefined} viewerScore={!session.isHost ? (session.liveScore ?? null) : null} onWin={(side) => { if (!session.isHost) return; handleTournamentMatch(pendingMatch.id, side === 'A' ? pendingMatch.player1! : pendingMatch.player2!); }} />
                      {session.isHost && (() => {
                        const tScore = session.liveScore;
                        const tWinner = tScore && tScore.active
                          ? tScore.scoreA >= tScore.limit && tScore.scoreA > tScore.scoreB
                            ? 'A'
                            : tScore.scoreB >= tScore.limit && tScore.scoreB > tScore.scoreA
                              ? 'B'
                              : null
                          : null;
                        return (
                          <div className="winning-team">
                            <span className="winning-label">Winner:</span>
                            <button
                              onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}
                              disabled={tWinner === 'B'}
                              title={tWinner === 'B' ? `${pendingMatch.player2} won by score` : undefined}
                            >
                              <Trophy size={12} /> {pendingMatch.player1}
                            </button>
                            <button
                              onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}
                              disabled={tWinner === 'A'}
                              title={tWinner === 'A' ? `${pendingMatch.player1} won by score` : undefined}
                            >
                              <Trophy size={12} /> {pendingMatch.player2}
                            </button>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <ScoreBoard labelA={pendingMatch.player1!} labelB={pendingMatch.player2!} disabled={!session.isHost} onScoreChange={session.isHost ? handleScoreChange : undefined} viewerScore={!session.isHost ? (session.liveScore ?? null) : null} onWin={(side) => { if (!session.isHost) return; handleTournamentMatch(pendingMatch.id, side === 'A' ? pendingMatch.player1! : pendingMatch.player2!); }} />
                      {session.isHost && (() => {
                        const tScore = session.liveScore;
                        const tWinner = tScore && tScore.active
                          ? tScore.scoreA >= tScore.limit && tScore.scoreA > tScore.scoreB
                            ? 'A'
                            : tScore.scoreB >= tScore.limit && tScore.scoreB > tScore.scoreA
                              ? 'B'
                              : null
                          : null;
                        return (
                          <div className="match-buttons" style={{ marginTop: 14 }}>
                            <button
                              onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}
                              disabled={tWinner === 'B'}
                              title={tWinner === 'B' ? `${pendingMatch.player2} won by score` : undefined}
                            >
                              <Trophy size={12} /> {pendingMatch.player1}
                            </button>
                            <button
                              onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}
                              disabled={tWinner === 'A'}
                              title={tWinner === 'A' ? `${pendingMatch.player1} won by score` : undefined}
                            >
                              <Trophy size={12} /> {pendingMatch.player2}
                            </button>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
              <SmartSuggestions suggestions={suggestions} />
            </div>
            </div>
        )}
        <WinnerModal isOpen={modalOpen} winner={modalWinner} score={modalScore} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
        <CourtScoreModal
          isOpen={pendingCourtScore !== null}
          match={pendingCourtScore}
          onConfirm={handleConfirmCourtScore}
          onCancel={() => setPendingCourtScore(null)}
        />
        {swapCourtId && (() => {
          const slot = courtSlotsRef.current.find(s => s.id === swapCourtId);
          return slot ? (
            <CourtSwapModal
              courtName={slot.name}
              onCourt={slot.onCourt}
              statsMap={statsMap}
              onConfirm={(newOnCourt) => handleSwapPlayers(swapCourtId, newOnCourt)}
              onClose={() => setSwapCourtId(null)}
            />
          ) : null;
        })()}
        <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
        <RecapModal
          isOpen={showRecapModal}
          onClose={() => setShowRecapModal(false)}
          stats={statsList}
          history={activeHistory}
          roomCode={session.sessionId}
          mode={gameMode ?? 'doubles'}
          defaultVariant="host"
        />
        {V1_RELEASE.showLegacyCourtCoordinator && showCoordinator && <CoordinatorOverlay courts={courts} onClose={() => setShowCoordinator(false)} />}
        {(matchToast || toastMsg) && (
          <div
            className="toast-notification toast-notification--enhanced"
            role="alert"
            onMouseEnter={pauseToastTimer}
            onMouseLeave={resumeToastTimer}
            onTouchStart={pauseToastTimer}
            onTouchEnd={resumeToastTimer}
          >
            <div className="toast-content">
              <span className="toast-msg">{matchToast?.message ?? toastMsg}</span>
              {matchToast?.subMessage && <span className="toast-submsg">{matchToast.subMessage}</span>}
            </div>
            {matchToast?.canUndo && (
              <button
                type="button"
                className="toast-undo-btn"
                onClick={handleToastUndo}
                aria-label="Undo last match"
              >
                Undo
              </button>
            )}
            <button
              type="button"
              className="toast-dismiss"
              onClick={dismissToast}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        )}
        {pendingConfirm && (
          <div className="confirm-overlay" role="dialog" aria-modal="true">
            <div className="confirm-dialog">
              <p className="confirm-message">
                {pendingConfirm.type === 'clear-history' && 'Clear all match history? The queue and players will stay.'}
                {pendingConfirm.type === 'hard-reset' && 'Nothing will be saved after the session has ended. Except roster that was saved before starting the queue.'}
                {pendingConfirm.type === 'back-home' && 'Leave this session? The session stays active — rejoin anytime with the room code.'}
                {pendingConfirm.type === 'remove-court' && 'Remove this court from your session group?'}
              </p>
              <div className="confirm-actions">
                <button className="confirm-btn confirm-btn--cancel" onClick={() => setPendingConfirm(null)} disabled={isDeletingSession}>Cancel</button>
                <button className={`confirm-btn ${pendingConfirm.type === 'back-home' ? 'confirm-btn--warn' : 'confirm-btn--danger'}`} onClick={() => void doConfirmedAction()} disabled={isDeletingSession}>
                  {isDeletingSession ? 'Deleting…' : pendingConfirm.type === 'back-home' ? 'Leave' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── RENDER C — Default / Play-all / Skilled ──────────────
  const isSkilled = activeQueueMode === 'skilled';

    const useMobileFirst = V1_RELEASE.mobileFirstShell && !isSkilled && (gameMode ?? 'doubles') === 'doubles';
  const isMultiCourt = courtSlots.length > 0;
  const singleCourtModel = toSingleCourtViewModel({
    queue,
    suggestedTeamA: playAllSuggestion?.suggestedTeamA,
    suggestedTeamB: playAllSuggestion?.suggestedTeamB,
    liveScore: session.liveScore,
    canEdit: canControl,
  });
  const singleCourtQueueModel = toSingleCourtQueueViewModel({
    queue,
    priorityPlayers: activePriorityPlayers,
    sittingOut: activeSittingOut,
    formatEta: formatEtaLabel,
  });
  const multiCourtQueueModel = toMultiCourtQueueViewModel({
    waitingPlayers,
    priorityPlayers: activePriorityPlayers,
    sittingOut: activeSittingOut,
    formatEta: formatEtaLabel,
  });

  const handleSingleCourtSwapTeams = (newOnCourt: string[]) => {
    const newQueue = [...newOnCourt, ...queue.slice(4)];
    setQueue(newQueue);
    queueRef.current = newQueue;
    if (session.sessionId) {
      session.syncField({ queue: newQueue });
    }
  };

  const handleSingleCourtScoreAdjust = (side: 'A' | 'B', delta: number) => {
    const firstFour = queue.slice(0, 4);
    const teamA = playAllSuggestion?.suggestedTeamA && playAllSuggestion.suggestedTeamA.length === 2
      ? playAllSuggestion.suggestedTeamA
      : firstFour.slice(0, 2);
    const teamB = playAllSuggestion?.suggestedTeamB && playAllSuggestion.suggestedTeamB.length === 2
      ? playAllSuggestion.suggestedTeamB
      : firstFour.slice(2, 4);

    const prev = session.liveScore;
    const currentScoreA = prev?.scoreA ?? 0;
    const currentScoreB = prev?.scoreB ?? 0;
    const baseLimit = prev?.baseLimit ?? prev?.limit ?? 11;

    // Check if game was already won: do not allow adding points beyond the winning limit
    const alreadyWon = (currentScoreA >= baseLimit && currentScoreA - currentScoreB >= 2) ||
                       (currentScoreB >= baseLimit && currentScoreB - currentScoreA >= 2);
    if (delta > 0 && alreadyWon) {
      return;
    }

    const nextScoreA = side === 'A' ? Math.max(0, currentScoreA + delta) : currentScoreA;
    const nextScoreB = side === 'B' ? Math.max(0, currentScoreB + delta) : currentScoreB;

    const inDeuce = nextScoreA >= baseLimit - 1 && nextScoreB >= baseLimit - 1;
    const isGameWon = (nextScoreA >= baseLimit && nextScoreA - nextScoreB >= 2) ||
                      (nextScoreB >= baseLimit && nextScoreB - nextScoreA >= 2);
    const nextLimit = inDeuce ? Math.max(baseLimit, Math.min(nextScoreA, nextScoreB) + 2) : baseLimit;

    const nextLiveScore: LiveScoreState = {
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      labelA: prev?.labelA ?? teamA.join(' / '),
      labelB: prev?.labelB ?? teamB.join(' / '),
      limit: nextLimit,
      baseLimit,
      deuce: inDeuce && !isGameWon,
      active: true,
    };
    handleScoreChange(nextLiveScore);
  };

  const handleSingleCourtMatchComplete = async (winner: 'A' | 'B', scoreStr?: string): Promise<boolean> => {
    const firstFour = queue.slice(0, 4);
    const teamA = playAllSuggestion?.suggestedTeamA && playAllSuggestion.suggestedTeamA.length === 2
      ? playAllSuggestion.suggestedTeamA
      : firstFour.slice(0, 2);
    const teamB = playAllSuggestion?.suggestedTeamB && playAllSuggestion.suggestedTeamB.length === 2
      ? playAllSuggestion.suggestedTeamB
      : firstFour.slice(2, 4);
    return handleDoublesMatch(teamA, teamB, winner, scoreStr);
  };

  const handleMultiCourtWin = async (courtId: string, side: 'A' | 'B', scoreStr?: string): Promise<boolean> => {
    handleCourtMatch(courtId, side, scoreStr);
    return true;
  };

  const handleRemovePlayerFromQueue = (name: string) => {
    if (activeSittingOut.includes(name)) {
      const nextSittingOut = activeSittingOut.filter(p => p !== name);
      setLocalSittingOut(nextSittingOut);
      if (session.sessionId) session.syncField({ sittingOut: nextSittingOut });
      return;
    }
    const qIdx = queue.indexOf(name);
    if (qIdx >= 0) {
      const res = removeFromQueueTransition(
        { gameMode: gameMode ?? 'doubles', players, queue, courtSlots, sittingOut: activeSittingOut },
        qIdx,
      );
      setQueue(res.queue);
      queueRef.current = res.queue;
      if (session.sessionId) session.syncField({ queue: res.queue });
    }
  };

  return (
    <div className={useMobileFirst ? `mobile-first-root ${darkMode ? 'dark-mode' : ''}` : `queue-system game-view ${darkMode ? 'dark' : ''}`}>
      {useMobileFirst ? (
        <AppShell
          sessionId={session.sessionId}
          isHost={session.isHost}
          isConnected={session.isConnected}
          onAddPlayerLive={handleAddPlayerLive}
          scorePromptEnabled={scorePromptEnabled}
          onToggleScorePrompt={() => setScorePromptEnabled(p => !p)}
          gearMenuProps={gearMenuProps}
          onBackHome={handleBackHome}
          activeTab={activeTab === 'analytics' ? 'analytics' : 'queue'}
          onTabChange={(t) => setActiveTab(t)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(d => !d)}
          partnerPanelNode={
            gameMode === 'doubles' && courtSlots.length > 0 ? (
              <PartnerPanel
                players={players}
                playerGroups={[queue, ...courtSlots.map(court => court.onCourt)]}
                pairs={lockedPartners}
                onChange={handlePartnerPairsChange}
              />
            ) : undefined
          }
          manualQueuePanelNode={
            <ManualQueuePanel
              allPlayers={players}
              queue={queue}
              statsMap={statsMap}
              onAdd={p => {
                const nq = [...queue, p];
                setQueue(nq);
                if (session.sessionId) session.syncField({ queue: nq });
              }}
              onRemove={i => {
                const res = removeFromQueueTransition(
                  { gameMode: gameMode ?? 'doubles', players, queue, courtSlots, sittingOut: activeSittingOut },
                  i,
                );
                setQueue(res.queue);
                if (session.sessionId) session.syncField({ queue: res.queue });
              }}
            />
          }
          sitOutPanelNode={
            <SitOutPanel
              players={players}
              sittingOut={activeSittingOut}
              onToggle={handleToggleSitOut}
              onSelectPlayer={p => setSelectedPlayerAction({ player: p, zone: 'break' })}
            />
          }
          diagnosticsNode={
            courtSlots.length > 0 ? (
              <div className="diagnostics-multicourt" style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: '4px' }}>
                  Multi-Court Queue Rotation ({courtSlots.length} {courtSlots.length === 1 ? 'court' : 'courts'})
                </div>
                <div style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.5' }}>
                  <div>Courts active: {courtSlots.map(c => `${c.name} (${c.onCourt.filter(Boolean).length}/4)`).join(' • ')}</div>
                  <div>Waiting in queue: {waitingPlayers.length}</div>
                  {activePriorityPlayers.length > 0 && <div>Priority players: {activePriorityPlayers.join(', ')}</div>}
                  {activeSittingOut.length > 0 && <div>On break: {activeSittingOut.join(', ')}</div>}
                </div>
              </div>
            ) : (
              <PaddleStatusPanel paddleState={paddleStateUI} allPlayers={players} />
            )
          }
        >
          {activeTab === 'analytics' ? (
            <AnalyticsDashboard
              stats={statsList}
              history={activeHistory}
              careerStats={careerStats}
              roomCode={session.sessionId}
              mode={gameMode ?? 'doubles'}
            />
          ) : isMultiCourt ? (
            <MultiCourtScreen
              courtSlots={courtSlots}
              statsMap={statsMap}
              queue={multiCourtQueueModel}
              isHost={canControl}
              scorePromptEnabled={scorePromptEnabled}
              onWin={handleMultiCourtWin}
              onReplacePlayer={executePlayerReplacement}
              onSwapCourtPlayers={handleSwapPlayers}
              onPlayerTakeBreak={handleToggleSitOut}
              onPlayerRemove={handleRemovePlayerFromQueue}
              onReturnFromBreak={handleToggleSitOut}
              onMoveWaitingPlayer={handleMoveWaitingPlayer}
            />
          ) : (
            <SingleCourtScreen
              court={singleCourtModel}
              queue={singleCourtQueueModel}
              onMatchComplete={handleSingleCourtMatchComplete}
              onScoreAdjust={handleSingleCourtScoreAdjust}
              onReplacePlayer={executePlayerReplacement}
              onSwapTeams={handleSingleCourtSwapTeams}
              onPlayerTakeBreak={handleToggleSitOut}
              onPlayerRemove={handleRemovePlayerFromQueue}
              onReturnFromBreak={handleToggleSitOut}
              onMoveWaitingPlayer={handleMoveWaitingPlayer}
              onScoreLimitChange={(newLimit) => {
                const prev = session.liveScore;
                const nextLiveScore: LiveScoreState = {
                  scoreA: prev?.scoreA ?? 0,
                  scoreB: prev?.scoreB ?? 0,
                  labelA: prev?.labelA ?? queue.slice(0, 2).join(' / '),
                  labelB: prev?.labelB ?? queue.slice(2, 4).join(' / '),
                  limit: newLimit,
                  baseLimit: newLimit,
                  deuce: false,
                  active: true,
                };
                handleScoreChange(nextLiveScore);
              }}
              onResetScore={() => {
                const prev = session.liveScore;
                const baseLimit = prev?.baseLimit ?? prev?.limit ?? 11;
                const nextLiveScore: LiveScoreState = {
                  scoreA: 0,
                  scoreB: 0,
                  labelA: prev?.labelA ?? queue.slice(0, 2).join(' / '),
                  labelB: prev?.labelB ?? queue.slice(2, 4).join(' / '),
                  limit: baseLimit,
                  baseLimit: baseLimit,
                  deuce: false,
                  active: true,
                };
                handleScoreChange(nextLiveScore);
              }}
              isHost={canControl}
              statsMap={statsMap}
            />
          )}

          {/* History is now in the dedicated Stats -> History tab */}
          <SmartSuggestions suggestions={!isSkilled ? suggestions : []} />
        </AppShell>
      ) : (
        <>
<div className="topright-controls">
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
        <GearMenu {...gearMenuProps} />
      </div>

      <button className="back-home" onClick={handleBackHome}><ArrowLeft size={14} /> Back</button>
      <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />

      {session.isExpired && (<div className="session-alert session-alert--expired"><WifiOff size={14} /> Session expired. Your data has been cleared.{' '}<button onClick={() => router.push('/')}>Go Home</button></div>)}
      {session.isReconnecting && !session.isExpired && (<div className="session-alert session-alert--reconnecting"><Wifi size={14} /> Reconnecting to session…</div>)}
      {restorationWarning && (<div className="session-alert session-alert--warn">⚠ Queue state could not be restored (browser storage was corrupted). Your player list is empty — please re-enter it. <button onClick={dismissRestorationWarning}>Dismiss</button></div>)}

      {modeSelector}{uiControls}{tabBar}
      {!session.isHost && session.sessionId && (<div className="viewer-banner"><Wifi size={13} /> Watching live — only the host can make changes.</div>)}

      {activeTab === 'analytics' ? (
        <AnalyticsDashboard
          stats={statsList}
          careerStats={careerStats}
          skilledBrackets={isSkilled ? skilledBrackets : undefined}
          history={activeHistory}
          roomCode={session.sessionId}
          mode={gameMode ?? 'doubles'}
        />
      ) : (
        <div className="main-layout">
          <div className="queue-area">
            <h1 className="queue-title">
              {gameMode === 'singles' ? <Swords size={19} /> : <Users size={19} />}
              {gameMode === 'singles' ? 'Singles' : 'Doubles'}{isSkilled ? ' Skilled' : ''} Queue
            </h1>

            {activeQueueMode === 'default' && gameMode === 'doubles' && (
              <p className="mode-description">
                <Trophy size={11} className="mode-desc-icon" /> Advanced Paddle Queue · Winners &amp; Losers cycles · Partners rotate unless locked
              </p>
            )}
            {activeQueueMode === 'default' && gameMode === 'singles' && courtSlots.length === 0 && (
              <p className="mode-description">
                {singlesFormat === 'pool' ? (
                  <><Trophy size={11} className="mode-desc-icon" /> Pool Rotation · Winners &amp; Losers cycles · Balanced play</>
                ) : (
                  <><Trophy size={11} className="mode-desc-icon" /> King of the Court · Winner stays on · Challenger from queue</>
                )}
              </p>
            )}
            {activeQueueMode === 'default' && gameMode === 'singles' && courtSlots.length > 0 && (
              <p className="mode-description">
                <Trophy size={11} className="mode-desc-icon" /> King of the Court · Winner stays on · {courtSlots.length} courts · shared queue
              </p>
            )}
            {/* ── Skill Brackets toggle panel (Skilled mode only) ── */}
            {isSkilled && session.isHost && (
              <div className="skilled-panel-wrap">
                <button className={`skilled-panel-toggle${showSkillBrackets ? ' skilled-panel-toggle--open' : ''}`} onClick={() => setShowSkillBrackets(s => !s)}>
                  <Layers size={12} /> Skill Brackets {showSkillBrackets ? '▴' : '▾'}
                </button>
                {showSkillBrackets && (
                  <SkilledView brackets={skilledBrackets} players={players} roster={roster.map(e => e.name)} isHost={true} onAssign={handleAssignToBracket} onUnassign={handleUnassignFromBracket} onAddNew={handleAddNewToSkilled} />
                )}
              </div>
            )}

            <div className="queue-header-row">
              {session.isHost && activeQueueMode === 'playall' && (
                <button onClick={() => { randomizeQueue(); resetPlayAllRelationships(); }} className="randomize-btn"><RefreshCw size={12} /> Reset Play-All</button>
              )}
            </div>

            {canControl && (
              <div className="host-tools-bar">
                <button
                  type="button"
                  className="host-tools-toggle"
                  onClick={() => setShowHostTools(s => !s)}
                  aria-expanded={showHostTools}
                >
                  <SlidersHorizontal size={14} />
                  <span>Host Controls {showHostTools ? '▴' : '▾'}</span>
                </button>
              </div>
            )}

            {canControl && showHostTools && (
              <div className="host-tools-drawer">
                <div className="live-tools-row">
                  <AddPlayerPanel onAdd={handleAddPlayerLive} />
                  {!isSkilled && (
                    <ManualQueuePanel allPlayers={players} queue={queue} statsMap={statsMap}
                      onAdd={p => { const nq = [...queue, p]; setQueue(nq); if (session.sessionId) session.syncField({ queue: nq }); }}
                      onRemove={i => {
                        const res = removeFromQueueTransition(
                          { gameMode: gameMode ?? 'singles', players, queue, courtSlots, sittingOut: activeSittingOut },
                          i,
                        );
                        setQueue(res.queue);
                        if (session.sessionId) session.syncField({ queue: res.queue });
                      }}
                    />
                  )}
                  {!isSkilled && (
                    <SitOutPanel
                      players={players}
                      sittingOut={activeSittingOut}
                      onToggle={handleToggleSitOut}
                      onSelectPlayer={p => setSelectedPlayerAction({ player: p, zone: 'break' })}
                    />
                  )}
                  {!isSkilled && gameMode === 'doubles' && courtSlots.length > 0 && (
                    <PartnerPanel
                      players={players}
                      playerGroups={[queue, ...courtSlots.map(court => court.onCourt)]}
                      pairs={lockedPartners}
                      onChange={handlePartnerPairsChange}
                    />
                  )}
                  {courtSlots.length > 0 && (
                    <div className="score-mode-wrap">
                      <button
                        type="button"
                        className={`live-panel-toggle score-toggle-btn ${scorePromptEnabled ? 'score-toggle-btn--on' : ''}`}
                        onClick={handleToggleScorePrompt}
                        title={scorePromptEnabled ? 'Match score input is enabled — tap to record winners only' : 'Match score input is disabled — tap to enable direct score input'}
                      >
                        <Trophy size={13} />
                        <span>Match Scores: <strong>{scorePromptEnabled ? 'ON' : 'OFF'}</strong></span>
                      </button>
                      <span className="score-mode-hint">
                        {scorePromptEnabled
                          ? 'On: enter score before selecting winner'
                          : 'Off: tap winner directly'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {session.isHost && (
              <div className="diagnostics-bar">
                <button
                  type="button"
                  className="diagnostics-toggle-btn"
                  onClick={() => setShowDiagnostics(d => !d)}
                  aria-expanded={showDiagnostics}
                >
                  <SlidersHorizontal size={12} />
                  <span>Diagnostics {showDiagnostics ? '▴' : '▾'}</span>
                </button>
                {showDiagnostics && (
                  <div className="diagnostics-panel" role="region" aria-label="Engine Diagnostics">
                    <div className="diagnostics-header">Engine State (Host Only)</div>
                    {!isSkilled && activeQueueMode === 'default' && gameMode === 'doubles' && courtSlots.length === 0 && (
                      <PaddleStatusPanel paddleState={paddleStateUI} allPlayers={players} />
                    )}
                    {!isSkilled && activeQueueMode === 'default' && gameMode === 'singles' && courtSlots.length === 0 && (
                      singlesFormat === 'pool' ? (
                        <PoolSinglesStatusPanel poolState={poolSinglesStateUI} allPlayers={players} />
                      ) : (
                        <SinglesStatusPanel singlesState={singlesStateUI} allPlayers={players} />
                      )
                    )}
                    {courtSlots.length > 0 && (
                      <div className="diagnostics-multicourt" style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: '4px' }}>
                          Multi-Court Queue Rotation ({courtSlots.length} {courtSlots.length === 1 ? 'court' : 'courts'})
                        </div>
                        <div style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.5' }}>
                          <div>Courts active: {courtSlots.map(c => `${c.name} (${c.onCourt.filter(Boolean).length}/${gameMode === 'singles' ? 2 : 4})`).join(' • ')}</div>
                          <div>Waiting in queue: {waitingPlayers.length}</div>
                          {activePriorityPlayers.length > 0 && <div>Priority players: {activePriorityPlayers.join(', ')}</div>}
                          {activeSittingOut.length > 0 && <div>On break: {activeSittingOut.join(', ')}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* ═══════════════════════════════════════════════════
                SKILLED MODE LAYOUT
                ═══════════════════════════════════════════════════ */}
            {isSkilled && skilledState ? (
              <>
                {!showSkillBrackets && untaggedInSkilled.size > 0 && (
                  <div className="skilled-untagged-notice">
                    <span className="skilled-untagged-dot">?</span>
                    {[...untaggedInSkilled].join(', ')} {untaggedInSkilled.size === 1 ? 'has' : 'have'} no skill tag — treated as Intermediate.
                  </div>
                )}

                {/* Courts */}
                <div className="skilled-courts-grid">
                  {skilledState.courts.map(court => {
                    const teamA = court.players.slice(0, 2);
                    const teamB = court.players.slice(2, 4);
                    const levelLabel = court.matchLevel === 'mixed' ? 'MIXED'
                      : court.matchLevel === 'beginner' ? 'BEGINNER COURT'
                      : court.matchLevel === 'intermediate' ? 'INTERMEDIATE COURT'
                      : 'ADVANCED COURT';
                    const levelClass = court.matchLevel === 'mixed' ? 'mixed'
                      : court.matchLevel === 'beginner' ? 'beginner'
                      : court.matchLevel === 'intermediate' ? 'intermediate'
                      : 'advanced';
                    const hasMatch = court.players.length === 4;
                    const qWaiting = skilledState.skillQueue.beginner.length
                      + skilledState.skillQueue.intermediate.length
                      + skilledState.skillQueue.advanced.length;
                    const resting  = skilledState.restEnabled ? skilledState.restPool.length : 0;
                    const needed   = Math.max(0, 4 - (qWaiting + resting));
                    const idleMsg  = needed === 0
                      ? 'Filling court…'
                      : needed === 1
                        ? 'Waiting for 1 more player…'
                        : resting > 0
                          ? `Waiting for ${needed} more… (${resting} resting)`
                          : `Waiting for ${needed} more players…`;
                    return (
                      <div key={court.id} className={`skilled-court-card${hasMatch ? ` skilled-court-card--${levelClass}` : ''}`}>
                        <div className="skilled-court-header">
                          <span className="skilled-court-name">{court.name}</span>
                          {hasMatch && <span className={`skilled-level-tag skilled-level-tag--${levelClass}`}>{levelLabel}</span>}
                        </div>
                        {hasMatch ? (
                          <>
                            <div className="skilled-court-teams">
                              {[teamA, teamB].map((team, ti) => (
                                <div key={ti} className={`skilled-court-team skilled-court-team--${ti === 0 ? 'a' : 'b'}`}>
                                  <span className="skilled-team-label">Team {ti === 0 ? 'A' : 'B'}</span>
                                  {team.map(name => {
                                    const lvl = getPlayerBracketLevel(name, skilledBrackets);
                                    return (
                                      <div key={name} className="skilled-court-player">
                                        <span className={`skill-badge skill-badge--${lvl}`}>{lvl[0].toUpperCase()}</span>
                                        {name}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                            {session.isHost && (
                              <div className="skilled-court-actions">
                                <button className="skilled-win-btn skilled-win-btn--a" onClick={() => handleSkilledWinClick(court.id, 'A')}>
                                  <Trophy size={12} /> Team A wins
                                </button>
                                <button className="skilled-win-btn skilled-win-btn--b" onClick={() => handleSkilledWinClick(court.id, 'B')}>
                                  <Trophy size={12} /> Team B wins
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="skilled-court-idle">{idleMsg}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Skill-grouped waiting queue */}
                <div className="skilled-waiting-section">
                  <h3 className="pairings-label">
                    Waiting Queue ({skilledState.waitingQueue.length})
                  </h3>
                  {skilledState.waitingQueue.length === 0 ? (
                    <p className="muted-hint">All players are on a court.</p>
                  ) : (
                    <div className="skilled-queue-groups">
                      {(['beginner', 'intermediate', 'advanced'] as const).map((level, li) => {
                        const group = skilledState.skillQueue[level];
                        if (group.length === 0) return null;
                        return (
                          <div key={level} className="skilled-queue-group">
                            {li > 0 && <div className="skilled-queue-divider" />}
                            <div className={`skilled-queue-group-label skilled-queue-group-label--${level}`}>
                              <span className={`skill-badge skill-badge--${level}`}>{level[0].toUpperCase()}</span>
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </div>
                            {group.map((name, i) => (
                              <div key={name} className="skilled-queue-player">
                                <span className="skilled-queue-pos">#{i + 1}</span>
                                <span className={`skill-badge skill-badge--${level}`}>{level[0].toUpperCase()}</span>
                                <span className="skilled-queue-name">{name}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rest pool — only shown when rest is enabled and someone is resting */}
                {skilledState.restEnabled && skilledState.restPool.length > 0 && (
                  <div className="skilled-rest-section">
                    <h3 className="skilled-rest-header">
                      Resting ({skilledState.restPool.length})
                    </h3>
                    <div className="skilled-rest-list">
                      {skilledState.restPool.map(entry => (
                        <div key={entry.name} className="skilled-rest-player">
                          <span className={`skill-badge skill-badge--${entry.skillLevel}`}>
                            {entry.skillLevel[0].toUpperCase()}
                          </span>
                          <span className="skilled-rest-name">{entry.name}</span>
                          <span className="skilled-rest-cycles">
                            {entry.cyclesRemaining === 1 ? '1 game left' : `${entry.cyclesRemaining} games left`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : isSkilled ? (
              <p className="muted-hint">Initialising skilled courts… switch to another mode and back if courts don&apos;t appear.</p>
            ) : (
              /* ══════════════════════════════════════════════════
                 DEFAULT / PLAY-ALL LAYOUT (unchanged)
                 ══════════════════════════════════════════════════ */
              <>

            {/* Multi-court singles: shared queue, one player per court */}
            {gameMode === 'singles' && courtSlots.length > 0 && (
              <div className="multicourt-section">
                <h3 className="match-section-title"><Users size={14} /> Live Court Status</h3>
                <div className="courts-grid">
                  {courtSlots.map(slot => (
                    <SinglesCourtCard
                      key={slot.id}
                      slot={{
                        id:      slot.id,
                        name:    slot.name,
                        players: slot.onCourt,
                        king:    slot.onCourt[0] ?? null,
                      }}
                      statsMap={statsMap}
                      isHost={canControl}
                      onWin={handleSinglesCourtWinClick}
                      onMarkAbsent={canControl ? handleMarkAbsent : undefined}
                      onSelectPlayer={p => setSelectedPlayerAction({ player: p, zone: 'playing' })}
                    />
                  ))}
                </div>
                <div className="waiting-queue-panel">
                  <h3 className="pairings-label">Waiting Queue ({waitingPlayers.length})</h3>
                  {waitingPlayers.length === 0
                    ? <p className="muted-hint">All players are on a court.</p>
                    : (
                      <div className="waiting-players-list">
                        {waitingPlayers.map((p, i) => (
                          <div
                            key={`wait-${i}-${p}`}
                            className="waiting-player-row"
                            onClick={() => setSelectedPlayerAction({ player: p, zone: 'waiting' })}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="waiting-num">#{i + 1}</span>
                            <PlayerLabel name={p} statsMap={statsMap} />
                            {activePriorityPlayers.includes(p) && (
                              <span className="status-pill status-pill--priority">Next up</span>
                            )}
                            {formatEtaLabel(i + 1, 2, courtSlots.length > 0) && (
                              <span className="status-pill status-pill--on-deck">{formatEtaLabel(i + 1, 2, courtSlots.length > 0)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            )}

            {gameMode === 'singles' && courtSlots.length === 0 && queue.length >= 2 && (
              <div className="match-section">
                <h3 className="match-section-title"><Swords size={14} /> Current Match</h3>
                <div className="current-match-players">
                  <div
                    className="player-with-absent"
                    onClick={() => setSelectedPlayerAction({ player: queue[0], zone: 'playing' })}
                    style={{ cursor: 'pointer' }}
                  >
                    <PlayerLabel name={queue[0]} statsMap={statsMap} />
                    {canControl && (
                      <button
                        className="absent-mini-btn"
                        onClick={(e) => { e.stopPropagation(); handleMarkAbsent(queue[0]); }}
                        disabled={isSingleCourtReplaceBlocked}
                        title={isSingleCourtReplaceBlocked ? 'Cannot replace player after scoring has started' : "Can't play now"}
                        aria-label={`Can't play now: Replace ${queue[0]}`}
                        type="button"
                      >
                        <UserX size={11} />
                      </button>
                    )}
                  </div>
                  <span className="vs-sep">vs</span>
                  <div
                    className="player-with-absent"
                    onClick={() => setSelectedPlayerAction({ player: queue[1], zone: 'playing' })}
                    style={{ cursor: 'pointer' }}
                  >
                    <PlayerLabel name={queue[1]} statsMap={statsMap} />
                    {canControl && (
                      <button
                        className="absent-mini-btn"
                        onClick={(e) => { e.stopPropagation(); handleMarkAbsent(queue[1]); }}
                        disabled={isSingleCourtReplaceBlocked}
                        title={isSingleCourtReplaceBlocked ? 'Cannot replace player after scoring has started' : "Can't play now"}
                        aria-label={`Can't play now: Replace ${queue[1]}`}
                        type="button"
                      >
                        <UserX size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <ScoreBoard labelA={queue[0]} labelB={queue[1]} disabled={!canControl}
                  onScoreChange={canControl ? handleScoreChange : undefined}
                  viewerScore={!canControl ? (session.liveScore ?? null) : null}
                  persistedScore={canControl ? (session.liveScore ?? null) : null}
                  scoreReady={!session.sessionId || session.isConnected}
                  onWin={(side, sA, sB) => { if (!canControl) return; handleSinglesMatch(side === 'A' ? queue[0] : queue[1], `${sA} – ${sB}`); }} />
                {canControl && (() => {
                  const sScore = session.liveScore;
                  const sWinner = sScore && sScore.active
                    ? sScore.scoreA >= sScore.limit && sScore.scoreA > sScore.scoreB
                      ? 'A'
                      : sScore.scoreB >= sScore.limit && sScore.scoreB > sScore.scoreA
                        ? 'B'
                        : null
                    : null;
                  return (
                    <div className="match-buttons" style={{ marginTop: 14 }}>
                      <button
                        onClick={() => handleSinglesMatch(queue[0])}
                        disabled={sWinner === 'B'}
                        title={sWinner === 'B' ? `${queue[1]} won by score` : undefined}
                      >
                        <Trophy size={12} /> <PlayerLabel name={queue[0]} statsMap={statsMap} /> wins
                      </button>
                      <button
                        onClick={() => handleSinglesMatch(queue[1])}
                        disabled={sWinner === 'A'}
                        title={sWinner === 'A' ? `${queue[0]} won by score` : undefined}
                      >
                        <Trophy size={12} /> <PlayerLabel name={queue[1]} statsMap={statsMap} /> wins
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Multi-court shared-queue view */}
            {gameMode === 'doubles' && courtSlots.length > 0 ? (
              <div className="multicourt-section">
                <h3 className="match-section-title"><Users size={14} /> Live Court Status</h3>
                <div className="courts-grid">
                  {courtSlots.map(slot => (
                    <CourtCard
                      key={slot.id}
                      slot={slot}
                      statsMap={statsMap}
                      isHost={canControl}
                      onWin={handleCourtWinClick}
                      onEdit={canControl ? (id) => setSwapCourtId(id) : undefined}
                      onMarkAbsent={canControl ? handleMarkAbsent : undefined}
                      onSelectPlayer={p => setSelectedPlayerAction({ player: p, zone: 'playing' })}
                    />
                  ))}
                </div>
                <div className="waiting-queue-panel">
                  <h3 className="pairings-label">Waiting Queue ({waitingPlayers.length})</h3>
                  {waitingPlayers.length === 0
                    ? <p className="muted-hint">All players are on a court.</p>
                    : (
                      <div className="waiting-players-list">
                        {waitingPlayers.map((p, i) => (
                          <div
                            key={`wait-${i}-${p}`}
                            className="waiting-player-row"
                            onClick={() => setSelectedPlayerAction({ player: p, zone: 'waiting' })}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="waiting-num">#{i + 1}</span>
                            <PlayerLabel name={p} statsMap={statsMap} />
                            {activePriorityPlayers.includes(p) && (
                              <span className="status-pill status-pill--priority">Next up</span>
                            )}
                            {formatEtaLabel(i + 1, 4, courtSlots.length > 0) && (
                              <span className="status-pill status-pill--on-deck">{formatEtaLabel(i + 1, 4, courtSlots.length > 0)}</span>
                            )}
                            {canControl && (
                              <div className="waiting-reorder-btns" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="waiting-reorder-btn"
                                  disabled={
                                    i === 0 ||
                                    (!activePriorityPlayers.includes(p) &&
                                      activePriorityPlayers.includes(waitingPlayers[i - 1]))
                                  }
                                  onClick={() => handleMoveWaitingPlayer(p, -1)}
                                  title={
                                    !activePriorityPlayers.includes(p) &&
                                    activePriorityPlayers.includes(waitingPlayers[i - 1])
                                      ? 'Returning and new players go first.'
                                      : 'Move up in queue'
                                  }
                                  aria-label={`Move ${p} up in queue`}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="waiting-reorder-btn"
                                  disabled={
                                    i === waitingPlayers.length - 1 ||
                                    (activePriorityPlayers.includes(p) &&
                                      !activePriorityPlayers.includes(waitingPlayers[i + 1]))
                                  }
                                  onClick={() => handleMoveWaitingPlayer(p, 1)}
                                  title={
                                    activePriorityPlayers.includes(p) &&
                                    !activePriorityPlayers.includes(waitingPlayers[i + 1])
                                      ? 'Returning and new players go first.'
                                      : 'Move down in queue'
                                  }
                                  aria-label={`Move ${p} down in queue`}
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            ) : (
              <>
                {gameMode === 'doubles' && queue.length >= 4 && (
                  <DoublesMatch
                    key={`${firstFour.join('|')}::${playAllSuggestion?.suggestedTeamA?.join('|') ?? ''}::${playAllSuggestion?.suggestedTeamB?.join('|') ?? ''}`}
                    firstFour={firstFour}
                    suggestedTeamA={playAllSuggestion?.suggestedTeamA ?? null}
                    suggestedTeamB={playAllSuggestion?.suggestedTeamB ?? null}
                    playAllScore={playAllSuggestion?.score ?? null}
                    statsMap={statsMap}
                    isHost={canControl}
                    onMatch={handleDoublesMatch}
                    onScoreChange={canControl ? handleScoreChange : undefined}
                    viewerScore={!canControl ? (session.liveScore ?? null) : null}
                    persistedScore={canControl ? (session.liveScore ?? null) : null}
                    scoreReady={!session.sessionId || session.isConnected}
                    onMarkAbsent={canControl ? handleMarkAbsent : undefined}
                    replaceDisabled={isSingleCourtReplaceBlocked}
                  />
                )}
                {gameMode === 'doubles' && queue.length < 4 && <p className="muted-hint">Not enough players for a match.</p>}



                <div className="pairings-container">
                  <h3 className="pairings-label">Upcoming Matches</h3>
                  {gameMode === 'singles' && <SinglesTable queue={queue} statsMap={statsMap} />}
                  {gameMode === 'doubles' && <DoublesTable queue={queue} statsMap={statsMap} />}


                </div>
              </>
            )}
            {/* Substitute picker — appears when host marks a player absent (single-court or multi-court) */}
            {canControl && substituteFor !== null && (
              <div className="sub-picker-panel" role="region" aria-label="Replace called player">
                <div className="sub-picker-header">
                  <span className="sub-picker-label">Replace <strong>{substituteFor}</strong> with:</span>
                  <button className="sub-cancel-btn" onClick={() => { setSubstituteFor(null); setMultiCourtSubConfirmed(false); }} type="button">✕ Cancel</button>
                </div>
                {!multiCourtSubConfirmed ? (
                  <div className="sub-picker-confirm">
                    <p className="confirm-message">This match may already be underway. Replace anyway?</p>
                    <div className="confirm-actions">
                      <button className="confirm-btn confirm-btn--warn" onClick={() => setMultiCourtSubConfirmed(true)} type="button">
                        Replace anyway
                      </button>
                      <button className="confirm-btn confirm-btn--cancel" onClick={() => { setSubstituteFor(null); setMultiCourtSubConfirmed(false); }} type="button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sub-picker-options">
                    {waitingForNext.length > 0 && (
                      <button className="sub-pick-btn sub-pick-btn--auto" onClick={() => handleConfirmSub()} type="button">
                        Auto-select next eligible ({waitingForNext[0]})
                      </button>
                    )}
                    {waitingForNext.map(p => (
                      <button key={p} className="sub-pick-btn" onClick={() => handleConfirmSub(p)} type="button">
                        <PlayerLabel name={p} statsMap={statsMap} />
                      </button>
                    ))}
                    {waitingForNext.length === 0 && (
                      <span className="muted-hint">No waiting players available.</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {gameMode === 'singles' && queue.length < 2 && <p className="muted-hint">Not enough players for a match.</p>}
            </>
            )}

            <SmartSuggestions suggestions={!isSkilled ? suggestions : []} />
          </div>
          {historyPanel}
        </div>
      )}
        </>
      )}

      <WinnerModal isOpen={modalOpen} winner={modalWinner} score={modalScore} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
      <CourtScoreModal
        isOpen={pendingCourtScore !== null}
        match={pendingCourtScore}
        onConfirm={handleConfirmCourtScore}
        onCancel={() => setPendingCourtScore(null)}
      />
      {swapCourtId && (() => {
        const slot = courtSlotsRef.current.find(s => s.id === swapCourtId);
        return slot ? (
          <CourtSwapModal
            courtName={slot.name}
            onCourt={slot.onCourt}
            statsMap={statsMap}
            onConfirm={(newOnCourt) => handleSwapPlayers(swapCourtId, newOnCourt)}
            onClose={() => setSwapCourtId(null)}
          />
        ) : null;
      })()}
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      <RecapModal
        isOpen={showRecapModal}
        onClose={() => setShowRecapModal(false)}
        stats={statsList}
        history={activeHistory}
        roomCode={session.sessionId}
        mode={gameMode ?? 'doubles'}
        defaultVariant="host"
      />
      {V1_RELEASE.showLegacyCourtCoordinator && showCoordinator && <CoordinatorOverlay courts={courts} onClose={() => setShowCoordinator(false)} />}
      {(matchToast || toastMsg) && (
        <div
          className="toast-notification toast-notification--enhanced"
          role="alert"
          onMouseEnter={pauseToastTimer}
          onMouseLeave={resumeToastTimer}
          onTouchStart={pauseToastTimer}
          onTouchEnd={resumeToastTimer}
        >
          <div className="toast-content">
            <span className="toast-msg">{matchToast?.message ?? toastMsg}</span>
            {matchToast?.subMessage && <span className="toast-submsg">{matchToast.subMessage}</span>}
          </div>
          {matchToast?.canUndo && (
            <button
              type="button"
              className="toast-undo-btn"
              onClick={handleToastUndo}
              aria-label="Undo last match"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            className="toast-dismiss"
            onClick={dismissToast}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
      {pendingConfirm && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <p className="confirm-message">
              {pendingConfirm.type === 'clear-history' && 'Clear all match history? The queue and players will stay.'}
              {pendingConfirm.type === 'hard-reset' && 'Nothing will be saved after the session has ended. Except roster that was saved before starting the queue.'}
              {pendingConfirm.type === 'back-home' && 'Leave this session? The session stays active — rejoin anytime with the room code.'}
              {pendingConfirm.type === 'remove-court' && 'Remove this court from your session group?'}
            </p>
            <div className="confirm-actions">
              <button className="confirm-btn confirm-btn--cancel" onClick={() => setPendingConfirm(null)} disabled={isDeletingSession}>Cancel</button>
              <button className={`confirm-btn ${pendingConfirm.type === 'back-home' ? 'confirm-btn--warn' : 'confirm-btn--danger'}`} onClick={() => void doConfirmedAction()} disabled={isDeletingSession}>
                {isDeletingSession ? 'Deleting…' : pendingConfirm.type === 'back-home' ? 'Leave' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      <PlayerActionMenu
        player={selectedPlayerAction?.player ?? null}
        zone={selectedPlayerAction?.zone ?? 'waiting'}
        isHost={canControl}
        isPriority={selectedPlayerAction ? activePriorityPlayers.includes(selectedPlayerAction.player) : false}
        canMoveUp={(() => {
          if (!selectedPlayerAction || selectedPlayerAction.zone !== 'waiting') return false;
          const idx = waitingPlayers.indexOf(selectedPlayerAction.player);
          if (idx <= 0) return false;
          const isPrio = activePriorityPlayers.includes(selectedPlayerAction.player);
          const prevIsPrio = activePriorityPlayers.includes(waitingPlayers[idx - 1]);
          return isPrio || !prevIsPrio;
        })()}
        canMoveDown={(() => {
          if (!selectedPlayerAction || selectedPlayerAction.zone !== 'waiting') return false;
          const idx = waitingPlayers.indexOf(selectedPlayerAction.player);
          if (idx < 0 || idx >= waitingPlayers.length - 1) return false;
          const isPrio = activePriorityPlayers.includes(selectedPlayerAction.player);
          const nextIsPrio = activePriorityPlayers.includes(waitingPlayers[idx + 1]);
          return !isPrio || nextIsPrio;
        })()}
        moveUpDisabledReason={(() => {
          if (!selectedPlayerAction || selectedPlayerAction.zone !== 'waiting') return undefined;
          const idx = waitingPlayers.indexOf(selectedPlayerAction.player);
          if (idx > 0) {
            const isPrio = activePriorityPlayers.includes(selectedPlayerAction.player);
            const prevIsPrio = activePriorityPlayers.includes(waitingPlayers[idx - 1]);
            if (!isPrio && prevIsPrio) return 'Returning and new players go first.';
          }
          return undefined;
        })()}
        onClose={() => setSelectedPlayerAction(null)}
        onCantPlayNow={() => {
          if (selectedPlayerAction) {
            handleMarkAbsent(selectedPlayerAction.player);
          }
        }}
        onTakeBreak={() => {
          if (selectedPlayerAction) {
            const p = selectedPlayerAction.player;
            handleToggleSitOut(p);
            showToast(`${p} is on break. They'll be Next up when they return.`);
          }
        }}
        onBackIn={() => {
          if (selectedPlayerAction) {
            const p = selectedPlayerAction.player;
            handleToggleSitOut(p);
            showToast(`${p} is back and will play next.`);
          }
        }}
        onMoveUp={() => {
          if (selectedPlayerAction) {
            handleMoveWaitingPlayer(selectedPlayerAction.player, -1);
          }
        }}
        onMoveDown={() => {
          if (selectedPlayerAction) {
            handleMoveWaitingPlayer(selectedPlayerAction.player, 1);
          }
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// § 14  DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════
export default function QueueSystem() {
  return (
    <Suspense fallback={<div className="qs-loading">Loading…</div>}>
      <QueueSystemContent />
    </Suspense>
  );
}
