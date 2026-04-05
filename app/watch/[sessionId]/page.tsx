'use client';

/**
 * ═══════════════════════════════════════════════════════════
 * PADQ — Spectator / Watch Page
 * Route: /watch/[sessionId]
 * ═══════════════════════════════════════════════════════════
 *
 * READ-ONLY. Zero write access to Firebase.
 *
 * Guardrails:
 *  1. Validates the sessionId exists before rendering anything
 *  2. Redirects to home if invalid
 *  3. Subscribes ONLY to the session the host created
 *  4. Viewer can ONLY see the mode/view the host is currently on
 *     (no tab-switching, no bracket reseed, no scoring)
 *  5. All interactive elements are hidden or disabled
 *  6. hostToken is never exposed — viewers only read public fields
 * ═══════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Trophy, Flame, History, ArrowLeft, Users, Swords,
  Wifi, WifiOff, Star, Award, Shield, Zap, Check,
  BarChart2, TrendingUp, Activity, Clock, AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  subscribeToSession,
  subscribeToHistory,
  loadSession,
  SessionDoc,
  MatchHistoryEntry,
  TournamentMatch,
} from '@/lib/sessionService';
import './watch.css';

// ═══════════════════════════════════════════════════════════
// TYPES (mirrored from queue/page.tsx — kept local so this
// page is fully independent)
// ═══════════════════════════════════════════════════════════

type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

interface PlayerStat {
  name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  streak: number;
  rank: RankTier;
}

const RANK_CFG: Record<RankTier, { color: string; icon: React.ReactNode }> = {
  Bronze:   { color: '#cd7f32', icon: <Shield size={10} /> },
  Silver:   { color: '#a8a9ad', icon: <Shield size={10} /> },
  Gold:     { color: '#ffd700', icon: <Award  size={10} /> },
  Platinum: { color: '#00c8c8', icon: <Star   size={10} /> },
  Diamond:  { color: '#93c5fd', icon: <Zap    size={10} /> },
};

// ═══════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════

function calcRank(wr: number, gp: number): RankTier {
  if (gp < 3)    return 'Bronze';
  if (wr >= 80)  return 'Diamond';
  if (wr >= 65)  return 'Platinum';
  if (wr >= 50)  return 'Gold';
  if (wr >= 35)  return 'Silver';
  return 'Bronze';
}

function buildStats(players: string[], history: MatchHistoryEntry[]): PlayerStat[] {
  const wins:   Record<string, number> = {};
  const losses: Record<string, number> = {};
  const streak: Record<string, number> = {};
  for (const p of players) { wins[p] = 0; losses[p] = 0; streak[p] = 0; }

  for (const entry of [...history].reverse()) {
    const winnerNames = entry.winner.split(' & ');
    const allNames    = entry.players
      .split(' vs ').flatMap(s => s.split(' & ')).map(s => s.trim())
      .filter(n => players.includes(n));
    for (const name of allNames) {
      if (winnerNames.includes(name)) { wins[name] = (wins[name] ?? 0) + 1; streak[name] = (streak[name] ?? 0) + 1; }
      else { losses[name] = (losses[name] ?? 0) + 1; streak[name] = 0; }
    }
  }

  return players.map(name => {
    const w = wins[name] ?? 0, l = losses[name] ?? 0, gp = w + l;
    const wr = gp === 0 ? 0 : Math.round((w / gp) * 100);
    return { name, wins: w, losses: l, gamesPlayed: gp, winRate: wr, streak: streak[name] ?? 0, rank: calcRank(wr, gp) };
  });
}

// ═══════════════════════════════════════════════════════════
// SMALL UI ATOMS
// ═══════════════════════════════════════════════════════════

const RankBadge: React.FC<{ rank: RankTier }> = ({ rank }) => {
  const { color, icon } = RANK_CFG[rank];
  return <span className="w-rank-badge" style={{ '--rc': color } as React.CSSProperties}>{icon}{rank}</span>;
};

const StreakBadge: React.FC<{ streak: number }> = ({ streak }) =>
  streak < 2 ? null : <span className="w-streak-badge"><Flame size={11} />{streak}</span>;

const StatBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="w-bar-track"><div className="w-bar-fill" style={{ width: `${max === 0 ? 0 : Math.round((value / max) * 100)}%`, background: color }} /></div>
);

// ═══════════════════════════════════════════════════════════
// BRACKET DISPLAY (read-only)
// ═══════════════════════════════════════════════════════════

const BracketSection: React.FC<{
  title: string;
  matches: TournamentMatch[];
  totalRounds: number;
  bracketType: 'W' | 'L' | 'GF';
}> = ({ title, matches, totalRounds, bracketType }) => {
  const byRound: Record<number, TournamentMatch[]> = {};
  matches.forEach(m => { (byRound[m.round] ??= []).push(m); });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  const label = (r: number) => {
    if (bracketType === 'GF') return 'Grand Final';
    if (bracketType === 'W') {
      const rem = totalRounds - r;
      if (rem === 1) return 'Final'; if (rem === 2) return 'Semis'; if (rem === 3) return 'Quarters';
      return `WB Round ${r + 1}`;
    }
    if (bracketType === 'L') {
      if (r === Math.max(...rounds)) return 'LB Final';
      return r % 2 === 0 ? `LB Round ${Math.floor(r / 2) + 1}` : `LB Elim ${Math.floor(r / 2) + 1}`;
    }
    return `Round ${r + 1}`;
  };

  return (
    <div className="w-bracket-section">
      {title && <div className="w-bracket-section-title">{title}</div>}
      <div className="w-bracket-container">
        {rounds.map(r => (
          <div key={r} className="w-bracket-round">
            <div className="w-bracket-round-label">{label(r)}</div>
            <div className="w-bracket-round-matches">
              {byRound[r].sort((a, b) => a.slot - b.slot).map(m => {
                const p1Won = m.winner === m.player1, p2Won = m.winner === m.player2;
                return (
                  <div key={m.id} className={['w-bracket-match', m.winner ? 'done' : '', m.isBye ? 'bye' : '', bracketType === 'L' ? 'losers' : '', bracketType === 'GF' ? 'gf' : ''].filter(Boolean).join(' ')}>
                    <div className={['w-bracket-player', p1Won ? 'winner' : m.winner ? 'loser' : ''].filter(Boolean).join(' ')}>
                      <span>{m.player1 ?? <span className="tbd">TBD</span>}</span>
                      {p1Won && <Check size={11} />}
                    </div>
                    <div className="w-bracket-divider" />
                    <div className={['w-bracket-player', p2Won ? 'winner' : m.winner ? 'loser' : ''].filter(Boolean).join(' ')}>
                      <span>{m.isBye ? <span className="bye-label">No Player</span> : m.player2 ?? <span className="tbd">TBD</span>}</span>
                      {p2Won && <Check size={11} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SPECTATOR PAGE
// ═══════════════════════════════════════════════════════════

function WatchPageContent() {
  const params    = useParams();
  const router    = useRouter();
  const sessionId = (params?.sessionId as string ?? '').toUpperCase();

  // ── Firebase state ──────────────────────────────────────
  const [session,         setSession]         = useState<SessionDoc | null>(null);
  const [history,         setHistory]         = useState<MatchHistoryEntry[]>([]);
  const [status,          setStatus]          = useState<'loading' | 'live' | 'reconnecting' | 'error' | 'ended' | 'expired'>('loading');
  const [errorMsg,        setErrorMsg]        = useState('');
  const [showHistory,     setShowHistory]     = useState(true);

  // ── Guardrail: validate session exists before subscribing ──

  useEffect(() => {
    if (!sessionId || sessionId.length < 4) {
      setStatus('error');
      setErrorMsg('Invalid room code.');
      return;
    }

    let unsubSession: (() => void) | null  = null;
    let unsubHistory: (() => void) | null  = null;

    // First do a one-time read to confirm existence
    loadSession(sessionId).then(data => {
      if (!data) {
        setStatus('error');
        setErrorMsg(`Session "${sessionId}" not found. It may have expired or the code is wrong.`);
        return;
      }

      // Session exists — set initial state then subscribe
      setSession(data);
      setStatus('live');

      // Real-time listener — handles updates, deletion, and errors
      unsubSession = subscribeToSession(
        sessionId,
        // onChange: normal update
        (updated) => {
          setSession(updated);
          setStatus('live');
        },
        // onError: connection dropped — show reconnecting state
        (err) => {
          console.error('[Watch] snapshot error', err);
          setStatus('reconnecting');
        },
        // onDeleted: TTL fired or host hard-reset — session is gone
        () => {
          setStatus('expired');
          setSession(null);
        },
      );

      // Real-time listener for history subcollection
      unsubHistory = subscribeToHistory(sessionId, (entries) => {
        setHistory(entries);
      });
    });

    return () => {
      unsubSession?.();
      unsubHistory?.();
    };
  }, [sessionId]);

  // ── Derived ─────────────────────────────────────────────

  const stats = useMemo(
    () => session ? buildStats(session.players, history) : [],
    [session, history],
  );
  const statsMap = useMemo(
    () => Object.fromEntries(stats.map(s => [s.name, s])),
    [stats],
  );

  // ── Error / loading screens ──────────────────────────────

  if (status === 'loading') {
    return (
      <div className="watch-shell watch-shell--center">
        <Loader2 size={36} className="w-spin" />
        <p>Connecting to session <strong>{sessionId}</strong>…</p>
      </div>
    );
  }

  // Reconnecting — connection dropped, Firestore retrying automatically
  if (status === 'reconnecting') {
    return (
      <div className="watch-shell watch-shell--center">
        <Loader2 size={36} className="w-spin" />
        <p style={{ color: '#f59e0b' }}>Reconnecting to session <strong>{sessionId}</strong>…</p>
        <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>Please wait — this usually takes a few seconds.</p>
      </div>
    );
  }

  // Expired — TTL deleted the session, or host hard-reset
  if (status === 'expired') {
    return (
      <div className="watch-shell watch-shell--center">
        <AlertCircle size={40} className="w-error-icon" />
        <h2 className="w-error-title">Session Ended</h2>
        <p className="w-error-msg">
          This session has expired or been closed by the host.
          Sessions are automatically removed after 30 minutes of inactivity.
        </p>
        <button className="w-back-btn" onClick={() => router.push('/')}>
          <ArrowLeft size={14} /> Back to Home
        </button>
      </div>
    );
  }

  if (status === 'error' || status === 'ended') {
    return (
      <div className="watch-shell watch-shell--center">
        <AlertCircle size={40} className="w-error-icon" />
        <h2 className="w-error-title">{status === 'ended' ? 'Session Ended' : 'Session Not Found'}</h2>
        <p className="w-error-msg">{errorMsg || 'This session has ended or the room code is invalid.'}</p>
        <button className="w-back-btn" onClick={() => router.push('/')}>
          <ArrowLeft size={14} /> Back to Home
        </button>
      </div>
    );
  }

  if (!session) return null;

  // ── What the viewer sees — mirrors the HOST's current view ─
  // Guardrail: viewer cannot switch modes. They always see
  // exactly what queueMode + tournamentActive dictates.

  const isTournament = session.queueMode === 'tournament' && session.tournamentActive;
  const queue        = session.queue ?? [];
  const gameMode     = session.gameMode;

  // Current match detection (same logic as host)
  const pendingTournamentMatch = isTournament
    ? session.tournamentMatches?.find(m => !m.winner && !m.isBye && m.player1 && m.player2) ?? null
    : null;

  const currentSinglesMatch = !isTournament && gameMode === 'singles' && queue.length >= 2
    ? { p1: queue[0], p2: queue[1] }
    : null;

  const currentDoublesNext = !isTournament && gameMode === 'doubles' && queue.length >= 4
    ? queue.slice(0, 4)
    : null;

  // Upcoming pairs for the table — index 0 is "On Court", rest are "Upcoming Match N"
  const upcomingPairs: { label: string; left: string; right: string; isCurrent: boolean }[] = [];
  if (!isTournament) {
    const step = gameMode === 'doubles' ? 4 : 2;
    let matchNum = 1;
    for (let i = 0; i < Math.min(queue.length, step * 5); i += step) {
      const isCurrent = i === 0;
      const label = isCurrent ? '▶ On Court' : `Upcoming Match ${matchNum}`;
      if (gameMode === 'singles') {
        upcomingPairs.push({ label, left: queue[i] ?? '—', right: queue[i + 1] ?? 'Bye', isCurrent });
      } else {
        if (i + 3 < queue.length)
          upcomingPairs.push({ label, left: `${queue[i]} & ${queue[i + 1]}`, right: `${queue[i + 2]} & ${queue[i + 3]}`, isCurrent });
      }
      if (!isCurrent) matchNum++;
    }
  }

  return (
    <div className="watch-shell">
      {/* ── Top bar ── */}
      <div className="w-topbar">
        <button className="w-back-btn" onClick={() => router.push('/')}>
          <ArrowLeft size={14} /> Home
        </button>

        <div className="w-session-info">
          <span className={`w-dot ${status === 'live' ? 'w-dot--live' : 'w-dot--off'}`} />
          <span className="w-live-label">LIVE</span>
          <span className="w-room-code">{sessionId}</span>
        </div>

        <div className="w-topbar-mode">
          {gameMode === 'singles' ? <Swords size={14} /> : <Users size={14} />}
          {gameMode === 'singles' ? 'Singles' : 'Doubles'} ·{' '}
          {session.queueMode === 'tournament' ? 'Tournament' : session.queueMode === 'playall' ? 'Play-all' : 'Default'}
        </div>
      </div>

      {/* ── Viewer read-only banner ── */}
      <div className="w-viewer-banner">
        <Wifi size={13} /> You are watching live. Only the host can make changes.
      </div>

      <div className="w-body">

        {/* ══════════════════════════════════════════════════
            LIVE SCORE — shown at the TOP as the hero element
            when the host has scoring active
            ══════════════════════════════════════════════════ */}
        {session.liveScore?.active && (() => {
          const ls = session.liveScore!;
          const aWon = ls.scoreA >= ls.limit;
          const bWon = ls.scoreB >= ls.limit;
          return (
            <div className="w-live-score-hero">
              <div className="w-live-score-badge">
                <span className="w-live-dot" />
                LIVE SCORE
                {ls.deuce && <span className="w-deuce-pill">DEUCE</span>}
              </div>
              <div className="w-live-score-board">
                <div className={`w-live-side ${aWon ? 'w-live-side--winner' : ''}`}>
                  <div className="w-live-team-label">Team A</div>
                  <div className="w-live-player-name">{ls.labelA}</div>
                  <div className="w-live-score-num">{ls.scoreA}</div>
                </div>
                <div className="w-live-centre">
                  <div className="w-live-limit-badge">to {ls.limit}</div>
                  {(aWon || bWon) && <div className="w-live-gameover">Game Over!</div>}
                </div>
                <div className={`w-live-side ${bWon ? 'w-live-side--winner' : ''}`}>
                  <div className="w-live-team-label">Team B</div>
                  <div className="w-live-player-name">{ls.labelB}</div>
                  <div className="w-live-score-num">{ls.scoreB}</div>
                </div>
              </div>
            </div>
          );
        })()}
        {/* ══════════════════════════════════════════════════
            TOURNAMENT VIEW
            ══════════════════════════════════════════════════ */}
        {isTournament && (
          <div className="w-section">
            <h2 className="w-section-title">
              <Trophy size={17} /> Tournament Bracket
            </h2>

            {session.tournamentWinner && (
              <div className="w-champion">
                <Trophy size={20} /> Champion: {session.tournamentWinner}
              </div>
            )}

            {/* Bracket — same visual as host but no controls */}
            {session.elimType === 'single' ? (
              <BracketSection
                title=""
                matches={session.tournamentMatches ?? []}
                totalRounds={[...new Set((session.tournamentMatches ?? []).map(m => m.round))].length}
                bracketType="W"
              />
            ) : (
              <div className="w-bracket-de">
                {['W', 'L', 'GF'].map(bt => {
                  const filtered = (session.tournamentMatches ?? []).filter(m => m.bracket === bt);
                  if (!filtered.length) return null;
                  const wbRounds = [...new Set(filtered.filter(m => m.bracket === 'W').map(m => m.round))].length;
                  return (
                    <BracketSection
                      key={bt}
                      title={bt === 'W' ? 'Winners Bracket' : bt === 'L' ? 'Losers Bracket' : ''}
                      matches={filtered}
                      totalRounds={wbRounds}
                      bracketType={bt as 'W' | 'L' | 'GF'}
                    />
                  );
                })}
              </div>
            )}

            {/* Current tournament match */}
            {pendingTournamentMatch && !session.tournamentWinner && (
              <div className="w-current-match">
                <div className="w-current-match-label">
                  {pendingTournamentMatch.bracket === 'GF' && <Trophy size={14} />}
                  {pendingTournamentMatch.bracket === 'L' && '🔴 Losers — '}
                  {pendingTournamentMatch.bracket === 'GF' && ' Grand Final — '}
                  On Court Now
                </div>
                <div className="w-vs-row">
                  <span className="w-player-chip">
                    {pendingTournamentMatch.player1}
                    <StreakBadge streak={statsMap[pendingTournamentMatch.player1 ?? '']?.streak ?? 0} />
                  </span>
                  <span className="w-vs">VS</span>
                  <span className="w-player-chip">
                    {pendingTournamentMatch.player2}
                    <StreakBadge streak={statsMap[pendingTournamentMatch.player2 ?? '']?.streak ?? 0} />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            QUEUE VIEW (default / play-all)
            ══════════════════════════════════════════════════ */}
        {!isTournament && (
          <>
            {/* Current match */}
            {currentSinglesMatch && (
              <div className="w-section">
                <h2 className="w-section-title"><Swords size={16} /> On Court Now</h2>
                <div className="w-vs-row">
                  <span className="w-player-chip">
                    {currentSinglesMatch.p1}
                    <StreakBadge streak={statsMap[currentSinglesMatch.p1]?.streak ?? 0} />
                  </span>
                  <span className="w-vs">VS</span>
                  <span className="w-player-chip">
                    {currentSinglesMatch.p2}
                    <StreakBadge streak={statsMap[currentSinglesMatch.p2]?.streak ?? 0} />
                  </span>
                </div>
              </div>
            )}

            {currentDoublesNext && (
              <div className="w-section">
                <h2 className="w-section-title"><Users size={16} /> On Court Now</h2>
                <div className="w-vs-row">
                  <span className="w-player-chip w-player-chip--team">
                    {currentDoublesNext[0]} & {currentDoublesNext[1]}
                  </span>
                  <span className="w-vs">VS</span>
                  <span className="w-player-chip w-player-chip--team">
                    {currentDoublesNext[2]} & {currentDoublesNext[3]}
                  </span>
                </div>
              </div>
            )}

            {/* Queue / upcoming matches */}
            {upcomingPairs.length > 0 && (
              <div className="w-section">
                <h2 className="w-section-title">
                  {gameMode === 'singles' ? <Swords size={15} /> : <Users size={15} />}
                  Upcoming Matches
                </h2>
                <table className="w-table">
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>{gameMode === 'singles' ? 'Player 1' : 'Team A'}</th>
                      <th>{gameMode === 'singles' ? 'Player 2' : 'Team B'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingPairs.map((p, i) => (
                      <tr key={i} className={p.isCurrent ? 'w-next-row' : ''}>
                        <td className="w-match-label">{p.label}</td>
                        <td>{p.left}</td>
                        <td>{p.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════
            STATS — always visible
            ══════════════════════════════════════════════════ */}
        {stats.length > 0 && (
          <div className="w-section">
            <h2 className="w-section-title"><BarChart2 size={15} /> Player Stats</h2>
            <div className="w-stats-table-wrap">
              <table className="w-stats-table">
                <thead>
                  <tr>
                    <th>#</th><th>Player</th><th>Rank</th>
                    <th><TrendingUp size={11} /> W</th><th>L</th>
                    <th><Activity size={11} /> GP</th><th>Win%</th><th>🔥</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats].sort((a, b) => b.wins - a.wins).map((s, i) => (
                    <tr key={s.name}>
                      <td className="w-col-num">{i + 1}</td>
                      <td><strong>{s.name}</strong></td>
                      <td><RankBadge rank={s.rank} /></td>
                      <td className="w-col-win">{s.wins}</td>
                      <td className="w-col-loss">{s.losses}</td>
                      <td>{s.gamesPlayed}</td>
                      <td>
                        <div className="w-wr-cell">
                          <span>{s.winRate}%</span>
                          <StatBar value={s.winRate} max={100} color="#22c55e" />
                        </div>
                      </td>
                      <td>{s.streak >= 2 ? <span className="w-streak-badge"><Flame size={11} />{s.streak}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            MATCH HISTORY
            ══════════════════════════════════════════════════ */}
        <div className="w-section">
          <button
            className="w-history-toggle"
            onClick={() => setShowHistory(h => !h)}
          >
            <History size={14} /> {showHistory ? 'Hide' : 'Show'} Match History
            {history.length > 0 && <span className="w-history-count">{history.length}</span>}
          </button>

          {showHistory && (
            history.length === 0
              ? <p className="w-muted">No matches played yet.</p>
              : (
                <ul className="w-history-list">
                  {history.map(e => (
                    <li key={e.id} className="w-history-item">
                      <span className="w-h-time">{e.timestamp}</span>
                      <span className="w-h-match">{e.players}</span>
                      <span className="w-h-winner"><Trophy size={11} /> {e.winner}</span>
                      {e.score && <span className="w-h-score">{e.score}</span>}
                    </li>
                  ))}
                </ul>
              )
          )}
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="watch-shell watch-shell--center">
        <Loader2 size={32} className="w-spin" />
        <p>Loading…</p>
      </div>
    }>
      <WatchPageContent />
    </Suspense>
  );
}