'use client';

import React, {
  useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Swords, Users, Trophy, Shuffle, History,
  Sun, Moon, ArrowLeft, Play, RotateCcw,
  Trash2, UserPlus, Star, Sparkles, RefreshCw,
  BarChart2, Wifi, WifiOff,
  Settings, HelpCircle, Copy, Check, QrCode,
  BookOpen, LayoutGrid,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import useQueue, {
  suggestNextDoublesMatch,
  suggestNextSinglesMatch,
  PlayAllSuggestion,
} from '@/hooks/useQueue';
import { useSession } from '@/hooks/useSession';
import type { LiveScoreState } from '@/lib/sessionService';
import {
  loadCourtGroup, addCourtToGroup,
  removeCourtFromGroup, loadHostFromStorage, saveHostToStorage,
  subscribeToSession,
  loadRoster, mergeIntoRoster, removeFromRoster,
  type CourtEntry, type CourtSlot, type SessionDoc,
} from '@/lib/sessionService';
import './QueueSystem.css';

// ── Lib ──────────────────────────────────────────────────────
import type {
  MatchHistoryEntry, PlayerStat, EliminationType,
  QueueMode, GameTab, TournamentMatch,
} from './lib/types';
import { buildPlayerStats, generateSuggestions, shuffleArray } from './lib/playerUtils';
import type { PaddleState, SerializablePaddleState } from './lib/doublesEngine';
import { freshPaddleState, advancePaddleState, addPlayerToWaiting, serializePaddleState, deserializePaddleState } from './lib/doublesEngine';
import type { SinglesState, SerializableSinglesState } from './lib/singleEngine';
import { freshSinglesState, advanceSinglesState, serializeSinglesState, deserializeSinglesState } from './lib/singleEngine';

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
import { AnalyticsDashboard } from './components/AnalyticsDashboard/AnalyticsDashboard';
import { AddPlayerPanel, ManualQueuePanel } from './components/LiveManagement/LiveManagement';
import { SmartSuggestions } from './components/SmartSuggestions/SmartSuggestions';
import { SessionBar } from './components/SessionBar/SessionBar';
import { CourtTabs } from './components/CourtTabs/CourtTabs';
import { CourtCard } from './components/CourtCard/CourtCard';

// ═══════════════════════════════════════════════════════════
// § 12b  GEAR / SETTINGS MENU
// ═══════════════════════════════════════════════════════════

function GearMenu({
  sessionId, isHost, isLive, canControl,
  onToggleLive, onHardReset, onShowGuide,
  hasMultipleCourts, onShowCoordinator,
}: {
  sessionId:           string | null;
  isHost:              boolean;
  isLive:              boolean;
  canControl:          boolean;
  onToggleLive:        (live: boolean) => void;
  onHardReset:         () => void;
  onShowGuide:         () => void;
  hasMultipleCourts?:  boolean;
  onShowCoordinator?:  () => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [shareTab, setShareTab] = useState<'link' | 'qr'>('link');
  const [watchUrl, setWatchUrl] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) setWatchUrl(`${window.location.origin}/watch/${sessionId}`);
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown',   onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const copyLink = () => {
    navigator.clipboard.writeText(watchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showLiveSection = isHost && !!sessionId;

  return (
    <div className="gear-menu-wrap" ref={menuRef}>
      <button
        className={`gear-menu-trigger ${open ? 'gear-menu-trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Settings"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Settings size={17} />
      </button>

      {open && (
        <div className="gear-menu-panel" role="menu">
          {showLiveSection && (
            <div className="gear-section--live">
              <div className="gear-live-row">
                <span className="gear-live-label">
                  {isLive && <span className="go-live-dot go-live-dot--sm" />}
                  {isLive ? 'Live' : 'Go Live'}
                </span>
                <button
                  className={`gear-live-btn ${isLive ? 'gear-live-btn--on' : 'gear-live-btn--off'}`}
                  onClick={() => onToggleLive(!isLive)}
                >
                  {isLive ? 'End' : 'Start'}
                </button>
              </div>

              {isLive && (
                <div className="gear-share-panel">
                  <div className="gear-room-code-row">
                    <span className="gear-room-label">Room</span>
                    <span className="gear-room-code">{sessionId}</span>
                  </div>
                  <div className="gear-share-tabs">
                    <button className={`gear-share-tab ${shareTab === 'link' ? 'active' : ''}`} onClick={() => setShareTab('link')}>
                      <Copy size={11} /> Link
                    </button>
                    <button className={`gear-share-tab ${shareTab === 'qr' ? 'active' : ''}`} onClick={() => setShareTab('qr')}>
                      <QrCode size={11} /> QR
                    </button>
                  </div>
                  {shareTab === 'link' && (
                    <button className="gear-copy-btn" onClick={copyLink}>
                      {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Watch Link</>}
                    </button>
                  )}
                  {shareTab === 'qr' && watchUrl && (
                    <div className="gear-qr-wrap">
                      <QRCodeSVG value={watchUrl} size={150} bgColor="#ffffff" fgColor="#1e293b" level="M" includeMargin={false} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="gear-divider" />

          {isHost && hasMultipleCourts && onShowCoordinator && (
            <button
              className="gear-menu-item"
              role="menuitem"
              onClick={() => { setOpen(false); onShowCoordinator(); }}
            >
              <LayoutGrid size={14} /> All Courts
            </button>
          )}

          {canControl && (
            <button
              className="gear-menu-item gear-menu-item--danger"
              role="menuitem"
              onClick={() => { setOpen(false); onHardReset(); }}
            >
              <RotateCcw size={14} /> Hard Reset
            </button>
          )}

          <button
            className="gear-menu-item"
            role="menuitem"
            onClick={() => { setOpen(false); onShowGuide(); }}
          >
            <HelpCircle size={14} /> User Guide
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// § 12c  COORDINATOR OVERLAY
// Read-only view of all active courts in the session group.
// ═══════════════════════════════════════════════════════════

function CoordinatorOverlay({
  courts,
  onClose,
}: {
  courts:  CourtEntry[];
  onClose: () => void;
}) {
  const [courtData, setCourtData] = useState<Record<string, SessionDoc | null>>({});

  useEffect(() => {
    if (courts.length === 0) return;
    const unsubs = courts.map(c =>
      subscribeToSession(
        c.sessionId,
        data => setCourtData(prev => ({ ...prev, [c.sessionId]: data })),
        ()   => {},
        ()   => setCourtData(prev => ({ ...prev, [c.sessionId]: null })),
      )
    );
    return () => unsubs.forEach(u => u());
  }, [courts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="coord-overlay"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="coord-panel">
        <div className="coord-header">
          <h2 className="coord-title"><LayoutGrid size={16} /> All Courts</h2>
          <button className="coord-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {courts.length === 0 ? (
          <p className="muted-hint">No courts in your session group.</p>
        ) : (
          <div className="coord-grid">
            {courts.map(c => {
              const data    = courtData[c.sessionId];
              const expired = data === null;
              const loading = data === undefined;
              const q       = data?.queue ?? [];
              const n       = data?.gameMode === 'doubles' ? 4 : 2;
              const current = q.slice(0, n);
              const waiting = Math.max(0, (data?.players?.length ?? 0) - n);
              const phase   = (data?.doublesEngineState as Record<string, unknown> | null)
                ?.phase as string | undefined;

              return (
                <div
                  key={c.sessionId}
                  className={[
                    'coord-card',
                    data?.isLive ? 'coord-card--live'    : '',
                    expired       ? 'coord-card--expired' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="coord-card-header">
                    <span className="coord-court-name">{c.name}</span>
                    {data?.isLive && <span className="go-live-dot go-live-dot--sm" />}
                  </div>

                  {loading && <p className="coord-status">Connecting…</p>}
                  {expired  && <p className="coord-status coord-status--expired">Session expired</p>}
                  {data && (
                    <>
                      <div className="coord-match">
                        {current.length >= 2 ? (
                          data.gameMode === 'doubles' && current.length >= 4 ? (
                            <span className="coord-teams">
                              {current.slice(0, 2).join(' & ')}
                              <span className="coord-vs"> vs </span>
                              {current.slice(2, 4).join(' & ')}
                            </span>
                          ) : (
                            <span className="coord-teams">
                              {current[0]}<span className="coord-vs"> vs </span>{current[1]}
                            </span>
                          )
                        ) : (
                          <span className="coord-no-match">No active match</span>
                        )}
                      </div>
                      <div className="coord-meta">
                        <span>{data.players?.length ?? 0} players</span>
                        {waiting > 0 && <span>{waiting} waiting</span>}
                        {phase && <span className="coord-phase">{phase}</span>}
                        {!data.isLive && <span className="coord-offline">Not live</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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
    gameMode, players, queue, playAllRel,
    setGameMode, setPlayers, playSingles, playDoubles,
    randomizeQueue, setQueue, recordPlayAllDoubles,
    recordPlayAllSingles, resetPlayAllRelationships,
  } = useQueue();

  const session = useSession();

  // Sync Firebase → local queue hook
  useEffect(() => {
    if (!session.isConnected || !session.players.length) return;
    if (session.players.join(',') !== players.join(',')) setPlayers(session.players);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.players, session.isConnected]);

  useEffect(() => {
    if (!session.isConnected || !session.queue.length || session.isSaving) return;
    if (session.queue.join(',') !== queue.join(',')) setQueue(session.queue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.queue, session.isConnected, session.isSaving]);

  // UI-only state
  const [tempPlayers,  setTempPlayers]  = useState<string[]>([]);
  const [currentName,  setCurrentName]  = useState('');
  const [pasteInput,   setPasteInput]   = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalWinner,  setModalWinner]  = useState('');
  const [modalScore,   setModalScore]   = useState<string | undefined>(undefined);
  const [autoClose,    setAutoClose]    = useState(false);
  const [showHistory,  setShowHistory]  = useState(true);
  const [darkMode,     setDarkMode]     = useState(true);
  const [activeTab,    setActiveTab]    = useState<GameTab>('queue');
  const [liveScore,    setLiveScore]    = useState<LiveScoreState | null>(null);
  const [isLiveLocal,  setIsLiveLocal]  = useState(false);
  const [showGuide,       setShowGuide]       = useState(false);
  const [showCoordinator, setShowCoordinator] = useState(false);

  // ── Roster (setup screen) ──────────────────────────────────
  const [roster,         setRoster]         = useState<string[]>([]);
  const [showRoster,     setShowRoster]     = useState(false);
  const [rosterSelected, setRosterSelected] = useState<Set<string>>(new Set());

  // ── Setup: PIN + court name ─────────────────────────────────
  const [setupPin,       setSetupPin]       = useState('');
  const [setupCourtName, setSetupCourtName] = useState('Court 1');
  const [courtCount,     setCourtCount]     = useState(1);

  // ── Multi-court shared-queue slots ──────────────────────────
  const [localCourtSlots, setLocalCourtSlots] = useState<CourtSlot[]>([]);

  // ── Legacy court group (tab switching between independent sessions) ──
  const [courts, setCourts] = useState<CourtEntry[]>(() => loadCourtGroup());

  // ── Doubles Paddle Queue state ─────────────────────────────
  const paddleStateRef                        = useRef<PaddleState>(freshPaddleState());
  const [paddleStateUI, setPaddleStateUI]     = useState<PaddleState>(freshPaddleState());

  const resetPaddleState = useCallback(() => {
    const fresh = freshPaddleState();
    paddleStateRef.current = fresh;
    setPaddleStateUI(fresh);
  }, []);

  // ── Singles King-of-the-Court state ───────────────────────
  const singlesStateRef                         = useRef<SinglesState>(freshSinglesState([]));
  const [singlesStateUI, setSinglesStateUI]     = useState<SinglesState>(freshSinglesState([]));

  const resetSinglesState = useCallback((playerList: string[]) => {
    const fresh = freshSinglesState(playerList);
    singlesStateRef.current = fresh;
    setSinglesStateUI(fresh);
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
    }
    if (session.singlesEngineState) {
      const s = deserializeSinglesState(session.singlesEngineState as unknown as SerializableSinglesState);
      singlesStateRef.current = s;
      setSinglesStateUI(s);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isHost, session.doublesEngineState, session.singlesEngineState]);

  const getPartneredQueue = useCallback((pList: string[]) => [...pList], []);

  // Sync session.isLive → local
  useEffect(() => { setIsLiveLocal(session.isLive ?? false); }, [session.isLive]);

  // Sync court slots from Firestore → local
  useEffect(() => {
    if (!session.isConnected) return;
    setLocalCourtSlots(session.courtSlots ?? []);
  }, [session.courtSlots, session.isConnected]);

  // Resolved court slots (Firestore when connected, local otherwise)
  const courtSlots = session.isConnected ? (session.courtSlots ?? []) : localCourtSlots;

  // Players not on any court (the shared waiting queue in multi-court mode)
  const waitingPlayers = useMemo(() => {
    if (courtSlots.length === 0) return [];
    const onCourtSet = new Set(courtSlots.flatMap(c => c.onCourt));
    return players.filter(p => !onCourtSet.has(p));
  }, [courtSlots, players]);

  const handleGoLive = (live: boolean) => {
    setIsLiveLocal(live);
    if (session.sessionId) session.syncField({ isLive: live });
  };

  // Debounced score writes
  const scoreWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScoreChange = (score: LiveScoreState | null) => {
    setLiveScore(score);
    if (!session.sessionId) return;
    if (scoreWriteTimer.current) clearTimeout(scoreWriteTimer.current);
    scoreWriteTimer.current = setTimeout(() => { session.syncField({ liveScore: score }); }, 300);
  };

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
    const queueToCommit = newQueue ?? queue;
    if (session.sessionId) {
      const enginePatch = gameMode === 'doubles'
        ? { doublesEngineState: serializePaddleState(paddleStateRef.current) as unknown as Record<string, unknown> }
        : activeQueueMode === 'default'
          ? { singlesEngineState: serializeSinglesState(singlesStateRef.current) as unknown as Record<string, unknown> }
          : {};
      session.commitMatchResult(
        { queue: queueToCommit, ...enginePatch },
        { id: entry.id, mode: entry.mode, players: entry.players, winner: entry.winner, score: entry.score, timestamp: entry.timestamp }
      );
    }
  };

  // Resolved active values
  const activeQueueMode        = session.isConnected ? session.queueMode         : localQueueMode;
  const activeElimType         = session.isConnected ? session.elimType          : localElimType;
  const activeTournamentM      = session.isConnected && session.tournamentMatches?.length > 0 ? session.tournamentMatches : localTournamentM;
  const activeTournamentActive = localTournamentActive || (session.isConnected ? session.tournamentActive : false);
  const activeTournamentWinner = session.isConnected ? session.tournamentWinner  : localTournamentWinner;
  const activeHistory          = session.isConnected ? (session.matchHistory as unknown as MatchHistoryEntry[]) : localHistory;

  // Derived
  const statsList = useMemo(() => buildPlayerStats(players, activeHistory), [players, activeHistory]);
  const statsMap  = useMemo(() => Object.fromEntries(statsList.map(s => [s.name, s])), [statsList]);
  const suggestions = useMemo(() => activeTab === 'queue' ? generateSuggestions(statsList, queue) : [], [statsList, queue, activeTab]);
  const playAllSuggestion = useMemo<PlayAllSuggestion | null>(() => {
    if (activeQueueMode !== 'playall' || gameMode !== 'doubles') return null;
    return suggestNextDoublesMatch(queue, playAllRel);
  }, [activeQueueMode, gameMode, queue, playAllRel]);
  const firstFour = useMemo(() => queue.slice(0, 4), [queue]);

  // Load club roster from localStorage on mount
  useEffect(() => { setRoster(loadRoster()); }, []);

  // Side effects
  useEffect(() => { document.body.classList.toggle('dark-mode', darkMode); }, [darkMode]);
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
    if (tempPlayers.includes(t)) { alert('Player already added'); return; }
    setTempPlayers(prev => [...prev, t]); setCurrentName('');
  };
  const removeTempPlayer = (i: number) => setTempPlayers(prev => prev.filter((_, j) => j !== i));

  const addFromPaste = () => {
    const names = pasteInput.split(/[,\n]+/).map(n => n.trim()).filter(n => n.length > 0);
    const fresh = names.filter(n => !tempPlayers.includes(n));
    if (fresh.length === 0) { setPasteInput(''); return; }
    setTempPlayers(prev => [...prev, ...fresh]);
    setPasteInput('');
  };

  const handleStartQueue = async () => {
    const minPlayers = gameMode === 'doubles' && courtCount > 1 ? courtCount * 4 : 5;
    if (tempPlayers.length < minPlayers) {
      alert(`Need at least ${minPlayers} players for ${courtCount} court${courtCount > 1 ? 's' : ''}. Currently: ${tempPlayers.length}`);
      return;
    }
    const orderedPlayers = getPartneredQueue(tempPlayers);
    resetPaddleState();
    resetSinglesState(tempPlayers);
    setPlayers(tempPlayers); setTempPlayers([]); setLocalHistory([]);
    setLocalTournamentActive(false); setLocalTournamentWinner(null); setLocalTournamentM([]);

    // Build initial court slots for multi-court doubles mode
    let initialCourtSlots: CourtSlot[] | undefined;
    let initialQueue: string[];
    if (gameMode === 'doubles' && courtCount > 1) {
      initialCourtSlots = Array.from({ length: courtCount }, (_, i) => ({
        id: `court-${i}`,
        name: `Court ${i + 1}`,
        onCourt: orderedPlayers.slice(i * 4, (i + 1) * 4),
      }));
      // Remaining players wait
      initialQueue = orderedPlayers.slice(courtCount * 4);
      setLocalCourtSlots(initialCourtSlots);
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
      setLocalTournamentM(initialBracket); setLocalTournamentActive(true);
    }
    const pin = setupPin.trim().toUpperCase().slice(0, 4) || null;
    const courtName = courtCount > 1 ? `${courtCount} Courts` : (setupCourtName.trim() || 'Court 1');
    await session.startSession({
      gameMode: gameMode ?? 'singles', queueMode: localQueueMode, elimType: localElimType,
      players: tempPlayers, queue: initialQueue, playAllRel: {},
      tournamentMatches: initialBracket, tournamentActive: localQueueMode === 'tournament',
      tournamentWinner: null, isLive: false,
      accessPin: pin,
      courtName,
      ...(initialCourtSlots ? { courtSlots: initialCourtSlots } : {}),
    });
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
  };

  const handleSinglesMatch = (winner: string, score?: string) => {
    const [p1, p2] = [queue[0], queue[1]];
    playSingles(winner);
    if (activeQueueMode === 'playall') recordPlayAllSingles(p1, p2);
    let newQueue: string[];
    if (activeQueueMode === 'default' && gameMode === 'singles') {
      const { nextState, newQueue: singlesQueue } = advanceSinglesState(singlesStateRef.current, winner, players);
      singlesStateRef.current = nextState;
      setSinglesStateUI(nextState);
      newQueue = singlesQueue;
    } else {
      const rest = queue.slice(2);
      const loser = winner === p1 ? p2 : p1;
      newQueue = [loser, ...rest, winner];
    }
    setQueue(newQueue);
    addHistory({ id: Date.now(), mode: 'Singles', players: `${p1} vs ${p2}`, winner, score, timestamp: new Date().toLocaleTimeString() }, newQueue);
    setModalWinner(`${winner} wins!`); setModalScore(score); setModalOpen(true);
  };

  const handleDoublesMatch = (a: string[], b: string[], w: 'A' | 'B', score?: string) => {
    playDoubles([...a], [...b], w);
    if (activeQueueMode === 'playall') recordPlayAllDoubles(a, b);
    const winnerTeam = (w === 'A' ? a : b) as [string, string];
    const loserTeam  = (w === 'A' ? b : a) as [string, string];
    const winnerNames = winnerTeam.join(' & ');
    let newQueue: string[];
    if (gameMode === 'doubles') {
      const skillMap = Object.fromEntries(
        Object.entries(statsMap).map(([name, stat]) => [name, (stat as { winRate: number }).winRate])
      );
      const { nextState, newQueue: paddleQueue } = advancePaddleState(paddleStateRef.current, winnerTeam, loserTeam, players, skillMap);
      paddleStateRef.current = nextState;
      setPaddleStateUI(nextState);
      newQueue = paddleQueue;
    } else {
      const rest = queue.slice(4);
      newQueue = [...loserTeam, ...rest, ...winnerTeam];
    }
    setQueue(newQueue);
    addHistory({ id: Date.now(), mode: 'Doubles', players: `${a.join(' & ')} vs ${b.join(' & ')}`, winner: winnerNames, score, timestamp: new Date().toLocaleTimeString() }, newQueue);
    setModalWinner(`${winnerNames} win!`); setModalScore(score); setModalOpen(true);
  };

  const handleCourtMatch = (courtId: string, side: 'A' | 'B') => {
    const currentSlots = courtSlots;
    const slot = currentSlots.find(c => c.id === courtId);
    if (!slot || slot.onCourt.length < 4) return;

    const teamA = slot.onCourt.slice(0, 2) as [string, string];
    const teamB = slot.onCourt.slice(2, 4) as [string, string];
    const winnerTeam = side === 'A' ? teamA : teamB;
    const loserTeam  = side === 'A' ? teamB : teamA;

    // Players on other courts are locked — exclude from this court's rotation
    const lockedSet = new Set(
      currentSlots.filter(c => c.id !== courtId).flatMap(c => c.onCourt)
    );
    const availablePlayers = players.filter(p => !lockedSet.has(p));

    const skillMap = Object.fromEntries(
      Object.entries(statsMap).map(([name, s]) => [name, (s as PlayerStat).winRate])
    );
    const { nextState, newQueue: engineQueue } = advancePaddleState(
      paddleStateRef.current, winnerTeam, loserTeam, availablePlayers, skillMap
    );
    paddleStateRef.current = nextState;
    setPaddleStateUI(nextState);

    // First 4 → this court's next match; remainder → shared waiting list
    const nextOnCourt  = engineQueue.slice(0, 4);
    const nextWaiting  = engineQueue.slice(4);

    const updatedSlots = currentSlots.map(c =>
      c.id === courtId ? { ...c, onCourt: nextOnCourt } : c
    );

    // Global queue = locked players on other courts + waiting list
    const lockedList = currentSlots.filter(c => c.id !== courtId).flatMap(c => c.onCourt);
    const newQueue   = [...lockedList, ...nextWaiting];

    const winnerNames = winnerTeam.join(' & ');
    const entry: MatchHistoryEntry = {
      id: Date.now(),
      mode: `Doubles (${slot.name})`,
      players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}`,
      winner: winnerNames,
      timestamp: new Date().toLocaleTimeString(),
    };

    setLocalCourtSlots(updatedSlots);
    setQueue(newQueue);
    setLocalHistory(prev => [entry, ...prev]);

    if (session.sessionId) {
      session.commitMatchResult(
        { queue: newQueue, courtSlots: updatedSlots, doublesEngineState: serializePaddleState(paddleStateRef.current) as unknown as Record<string, unknown> },
        entry
      );
    }

    setModalWinner(`${winnerNames} win!`);
    setModalScore(undefined);
    setModalOpen(true);
  };

  const handleAddPlayerLive = (name: string) => {
    if (players.includes(name)) { alert('Player already exists'); return; }
    const np = [...players, name], nq = [...queue, name];
    setPlayers(np); setQueue(nq);
    if (activeQueueMode === 'default' && gameMode === 'doubles') {
      const newPaddleState = addPlayerToWaiting(paddleStateRef.current, name);
      paddleStateRef.current = newPaddleState;
      setPaddleStateUI(newPaddleState);
    }
    if (session.sessionId) session.syncField({ players: np, queue: nq });
  };

  const handleFullReset = async () => {
    if (!confirm('Clear all match history? The queue and players will stay.')) return;
    setLocalHistory([]);
    await session.clearMatchHistory();
  };

  const handleHardReset = () => {
    if (!confirm('Hard Reset will clear ALL cached data including your session. Continue?')) return;
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
    window.location.href = '/';
  };

  // Save the current court to the court group once the session is created
  useEffect(() => {
    if (!session.sessionId || !session.isHost) return;
    const { hostToken } = loadHostFromStorage();
    if (!hostToken) return;
    const entry: CourtEntry = {
      sessionId: session.sessionId,
      hostToken,
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
    // Swap the active credentials in localStorage then reload so useSession picks them up
    saveHostToStorage(target.sessionId, target.hostToken, target.gameMode);
    window.location.reload();
  };

  const handleRemoveCourt = (targetSessionId: string) => {
    if (!confirm('Remove this court from your session group?')) return;
    removeCourtFromGroup(targetSessionId);
    setCourts(loadCourtGroup());
  };

  const handleAddCourt = () => {
    // Go home to create a new queue session; it will auto-join the court group
    router.push('/');
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

  const handleAddFromRoster = () => {
    const fresh = [...rosterSelected].filter(n => !tempPlayers.includes(n));
    if (fresh.length === 0) return;
    setTempPlayers(prev => [...prev, ...fresh]);
    setRosterSelected(new Set());
  };

  const handleRemoveFromRosterUI = (name: string) => {
    removeFromRoster(name);
    setRoster(loadRoster());
    setRosterSelected(prev => { const next = new Set(prev); next.delete(name); return next; });
  };

  // ── Shared fragments ──────────────────────────────────────
  const canControl = !session.sessionId || session.isHost;
  const modeSelector = (
    <div className="mode-selector">
      {(['default', 'tournament', 'playall'] as const).map(m => (
        <button key={m} className={`mode-btn ${activeQueueMode === m ? 'active' : ''}`} onClick={() => canControl && handleModeChange(m)} disabled={!canControl}>
          {m === 'default'    && <><Swords size={12} /> Default</>}
          {m === 'tournament' && <><Trophy size={12} /> Tournament</>}
          {m === 'playall'    && <><Star   size={12} /> Play‑all</>}
        </button>
      ))}
    </div>
  );
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
                <div className="history-match">{e.players}</div>
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
      <div className={`queue-system setup-page ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
        <div className="setup-hero">
          <div className="setup-hero-icon">{gameMode === 'singles' ? <Swords size={26} /> : <Users size={26} />}</div>
          <h1 className="app-name">{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>
          <p className="app-subtitle">Add players to get started</p>
        </div>
        <div className="player-input-container">
          {/* Court count — doubles only */}
          {gameMode === 'doubles' && (
            <div className="setup-field-row">
              <label className="setup-field-label">Number of courts</label>
              <div className="court-count-selector">
                <button
                  className="court-count-btn court-count-adj"
                  onClick={() => setCourtCount(c => Math.max(1, c - 1))}
                  type="button"
                  disabled={courtCount <= 1}
                >−</button>
                <span className="court-count-value">{courtCount}</span>
                <button
                  className="court-count-btn court-count-adj"
                  onClick={() => setCourtCount(c => Math.min(6, c + 1))}
                  type="button"
                  disabled={courtCount >= 6}
                >+</button>
              </div>
              {courtCount > 1 && (
                <span className="setup-field-hint">Needs {courtCount * 4}+ players · shared waiting queue</span>
              )}
            </div>
          )}

          

          {/* Optional access PIN */}
          <div className="setup-field-row">
            <label className="setup-field-label">Access PIN <span className="setup-field-hint">(optional, 4 chars)</span></label>
            <input
              className="setup-field-input"
              type="text"
              value={setupPin}
              onChange={e => setSetupPin(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="Leave blank for open access"
              maxLength={4}
              autoComplete="off"
            />
          </div>

          {/* ── Club Roster import ─────────────────────────────── */}
          <div className="roster-row">
            <button
              type="button"
              className={`roster-toggle-btn${showRoster ? ' roster-toggle-btn--active' : ''}`}
              onClick={() => setShowRoster(s => !s)}
            >
              <BookOpen size={13} /> From Roster ({roster.length})
            </button>
            {tempPlayers.length > 0 && (
              <button type="button" className="roster-save-btn" onClick={handleSaveToRoster}>
                <Star size={13} /> Save to Roster
              </button>
            )}
          </div>
          {showRoster && (
            roster.length === 0 ? (
              <p className="muted-hint" style={{ marginBottom: 12 }}>
                No saved players yet. Add players then click "Save to Roster".
              </p>
            ) : (
              <div className="roster-panel">
                <div className="roster-list">
                  {roster.map((name, i) => (
                    <label key={`roster-${i}-${name}`} className="roster-item">
                      <input
                        type="checkbox"
                        checked={rosterSelected.has(name)}
                        disabled={tempPlayers.includes(name)}
                        onChange={() => handleRosterToggle(name)}
                      />
                      <span className={`roster-name${tempPlayers.includes(name) ? ' roster-name--added' : ''}`}>
                        {name}
                      </span>
                      <button
                        type="button"
                        className="roster-remove-btn"
                        onClick={e => { e.preventDefault(); handleRemoveFromRosterUI(name); }}
                        title="Remove from roster"
                      >×</button>
                    </label>
                  ))}
                </div>
                <div className="roster-actions">
                  <button
                    type="button"
                    className="roster-action-btn"
                    onClick={() => setRosterSelected(new Set(roster.filter(n => !tempPlayers.includes(n))))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className={`roster-action-btn${rosterSelected.size > 0 ? ' roster-action-btn--primary' : ''}`}
                    onClick={handleAddFromRoster}
                    disabled={rosterSelected.size === 0}
                  >
                    Add Selected ({rosterSelected.size})
                  </button>
                </div>
              </div>
            )
          )}

          <div className="input-group">
            <input type="text" value={currentName} onChange={e => setCurrentName(e.target.value)} placeholder="Enter player name" onKeyDown={e => e.key === 'Enter' && addTempPlayer()} />
            <button onClick={addTempPlayer} className="add-btn"><UserPlus size={15} /></button>
          </div>
          <div className="input-group">
            <input type="text" value={pasteInput} onChange={e => setPasteInput(e.target.value)} placeholder="Paste names separated by commas…" onKeyDown={e => e.key === 'Enter' && addFromPaste()} />
            <button onClick={addFromPaste} className="add-btn add-btn--paste" title="Add all"><Users size={15} /></button>
          </div>
          {tempPlayers.length > 0 && (
            <div className="players-list">
              <h3><Users size={13} /> Players ({tempPlayers.length})</h3>
              <ul>{tempPlayers.map((p, i) => (
                <li key={i}><span className="setup-player-num">#{i + 1}</span><span>{p}</span><button onClick={() => removeTempPlayer(i)} className="remove-btn"><Trash2 size={12} /></button></li>
              ))}</ul>
            </div>
          )}
          <button
            onClick={handleStartQueue}
            className="start-btn"
            disabled={tempPlayers.length < (gameMode === 'doubles' && courtCount > 1 ? courtCount * 4 : 5) || session.isSaving}
          >
            {session.isSaving
              ? <><Wifi size={14} /> Creating session…</>
              : <><Play size={14} /> Start Queue ({tempPlayers.length}/{gameMode === 'doubles' && courtCount > 1 ? courtCount * 4 : 5} min)</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER B — Tournament ─────────────────────────────────
  if (activeQueueMode === 'tournament' && activeTournamentActive) {
    const pendingMatch = activeTournamentM.find(m => !m.winner && !m.isBye && m.player1 && m.player2) ?? null;
    return (
      <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
        <div className="topright-controls">
          <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          <GearMenu
            sessionId={session.sessionId}
            isHost={session.isHost}
            isLive={isLiveLocal}
            canControl={canControl}
            onToggleLive={handleGoLive}
            onHardReset={handleHardReset}
            onShowGuide={() => setShowGuide(true)}
            hasMultipleCourts={courts.length >= 2}
            onShowCoordinator={() => setShowCoordinator(true)}
          />
        </div>
        <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
        <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />
        {session.isExpired && (<div className="session-alert session-alert--expired"><WifiOff size={14} /> Session expired. <button onClick={() => router.push('/')}>Go Home</button></div>)}
        {session.isReconnecting && !session.isExpired && (<div className="session-alert session-alert--reconnecting"><Wifi size={14} /> Reconnecting…</div>)}
        {modeSelector}{elimSelector}{uiControls}{tabBar}
        {!session.isHost && session.sessionId && (<div className="viewer-banner"><Wifi size={13} /> Watching live — only the host can make changes.</div>)}
        {activeTab === 'analytics' ? <AnalyticsDashboard stats={statsList} /> : (
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
                      {session.isHost && (<div className="winning-team"><span className="winning-label">Winner:</span><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}><Trophy size={12} /> {pendingMatch.player1}</button><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}><Trophy size={12} /> {pendingMatch.player2}</button></div>)}
                    </>
                  ) : (
                    <>
                      <ScoreBoard labelA={pendingMatch.player1!} labelB={pendingMatch.player2!} disabled={!session.isHost} onScoreChange={session.isHost ? handleScoreChange : undefined} viewerScore={!session.isHost ? (session.liveScore ?? null) : null} onWin={(side) => { if (!session.isHost) return; handleTournamentMatch(pendingMatch.id, side === 'A' ? pendingMatch.player1! : pendingMatch.player2!); }} />
                      {session.isHost && (<div className="match-buttons" style={{ marginTop: 14 }}><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}><Trophy size={12} /> {pendingMatch.player1}</button><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}><Trophy size={12} /> {pendingMatch.player2}</button></div>)}
                    </>
                  )}
                </div>
              )}
              <SmartSuggestions suggestions={suggestions} />
            </div>
            {historyPanel}
          </div>
        )}
        <WinnerModal isOpen={modalOpen} winner={modalWinner} score={modalScore} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
        <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
        {showCoordinator && <CoordinatorOverlay courts={courts} onClose={() => setShowCoordinator(false)} />}
      </div>
    );
  }

  // ── RENDER C — Default / Play-all ─────────────────────────
  return (
    <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
      <div className="topright-controls">
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
        <GearMenu
          sessionId={session.sessionId}
          isHost={session.isHost}
          isLive={isLiveLocal}
          canControl={canControl}
          onToggleLive={handleGoLive}
          onHardReset={handleHardReset}
          onShowGuide={() => setShowGuide(true)}
          hasMultipleCourts={courts.length >= 2}
          onShowCoordinator={() => setShowCoordinator(true)}
        />
      </div>

      <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
      <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />

      {session.isExpired && (<div className="session-alert session-alert--expired"><WifiOff size={14} /> Session expired. Your data has been cleared.{' '}<button onClick={() => router.push('/')}>Go Home</button></div>)}
      {session.isReconnecting && !session.isExpired && (<div className="session-alert session-alert--reconnecting"><Wifi size={14} /> Reconnecting to session…</div>)}

      {modeSelector}{uiControls}{tabBar}
      {!session.isHost && session.sessionId && (<div className="viewer-banner"><Wifi size={13} /> Watching live — only the host can make changes.</div>)}

      {activeTab === 'analytics' ? <AnalyticsDashboard stats={statsList} /> : (
        <div className="main-layout">
          <div className="queue-area">
            <h1 className="queue-title">{gameMode === 'singles' ? <Swords size={19} /> : <Users size={19} />}{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>

            {activeQueueMode === 'default' && (
              <p className="mode-description">
                <Trophy size={11} className="mode-desc-icon" />
                Advanced Paddle Queue · Winners &amp; Losers cycles · Partners always swap
              </p>
            )}
            {activeQueueMode === 'playall' && (<p className="mode-description"><Sparkles size={11} className="mode-desc-icon" /> Every player faces everyone before repeating</p>)}

            <div className="queue-header-row">
              {session.isHost && activeQueueMode === 'playall' && (
                <button onClick={() => { randomizeQueue(); resetPlayAllRelationships(); }} className="randomize-btn"><RefreshCw size={12} /> Reset Play-All</button>
              )}
            </div>

            {session.isHost && (
              <div className="live-tools-row">
                <AddPlayerPanel onAdd={handleAddPlayerLive} />
                <ManualQueuePanel allPlayers={players} queue={queue} statsMap={statsMap}
                  onAdd={p => { const nq = [...queue, p]; setQueue(nq); if (session.sessionId) session.syncField({ queue: nq }); }}
                  onRemove={i => { const nq = queue.filter((_, j) => j !== i); setQueue(nq); if (session.sessionId) session.syncField({ queue: nq }); }}
                />
              </div>
            )}

            {activeQueueMode === 'default' && gameMode === 'doubles' && (
              <PaddleStatusPanel paddleState={paddleStateUI} allPlayers={players} />
            )}

            {activeQueueMode === 'default' && gameMode === 'singles' && (
              <SinglesStatusPanel singlesState={singlesStateUI} allPlayers={players} />
            )}

            {gameMode === 'singles' && queue.length >= 2 && (
              <div className="match-section">
                <h3 className="match-section-title"><Swords size={14} /> Current Match</h3>
                <div className="current-match-players"><PlayerLabel name={queue[0]} statsMap={statsMap} /><span className="vs-sep">vs</span><PlayerLabel name={queue[1]} statsMap={statsMap} /></div>
                <ScoreBoard labelA={queue[0]} labelB={queue[1]} disabled={!session.isHost}
                  onScoreChange={session.isHost ? handleScoreChange : undefined}
                  viewerScore={!session.isHost ? (session.liveScore ?? null) : null}
                  onWin={(side, sA, sB) => { if (!session.isHost) return; handleSinglesMatch(side === 'A' ? queue[0] : queue[1], `${sA} – ${sB}`); }} />
                {session.isHost && (<div className="match-buttons" style={{ marginTop: 14 }}><button onClick={() => handleSinglesMatch(queue[0])}><Trophy size={12} /> <PlayerLabel name={queue[0]} statsMap={statsMap} /> wins</button><button onClick={() => handleSinglesMatch(queue[1])}><Trophy size={12} /> <PlayerLabel name={queue[1]} statsMap={statsMap} /> wins</button></div>)}
              </div>
            )}
            {/* Multi-court shared-queue view */}
            {gameMode === 'doubles' && courtSlots.length > 0 ? (
              <div className="multicourt-section">
                <div className="courts-grid">
                  {courtSlots.map(slot => (
                    <CourtCard
                      key={slot.id}
                      slot={slot}
                      statsMap={statsMap}
                      isHost={session.isHost}
                      onWin={handleCourtMatch}
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
                          <div key={`wait-${i}-${p}`} className="waiting-player-row">
                            <span className="waiting-num">#{i + 1}</span>
                            <PlayerLabel name={p} statsMap={statsMap} />
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
                    firstFour={firstFour}
                    suggestedTeamA={playAllSuggestion?.suggestedTeamA ?? null}
                    suggestedTeamB={playAllSuggestion?.suggestedTeamB ?? null}
                    playAllScore={playAllSuggestion?.score ?? null}
                    statsMap={statsMap}
                    isHost={session.isHost}
                    onMatch={handleDoublesMatch}
                    onScoreChange={session.isHost ? handleScoreChange : undefined}
                    viewerScore={!session.isHost ? (session.liveScore ?? null) : null}
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
            {gameMode === 'singles' && queue.length < 2 && <p className="muted-hint">Not enough players for a match.</p>}

            <SmartSuggestions suggestions={suggestions} />
          </div>
          {historyPanel}
        </div>
      )}
      <WinnerModal isOpen={modalOpen} winner={modalWinner} score={modalScore} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      {showCoordinator && <CoordinatorOverlay courts={courts} onClose={() => setShowCoordinator(false)} />}
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
