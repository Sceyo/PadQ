'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useQueue, {
  suggestNextDoublesMatch,
  suggestNextSinglesMatch,
  PlayAllSuggestion,
} from '@/hooks/useQueue';
import './QueueSystem.css';

// Types for match history entries
interface MatchHistoryEntry {
  id: number;
  mode: string;
  players: string;
  winner: string;
  timestamp: string;
}

// Tournament match type
interface TournamentMatch {
  id: number;
  round: number;
  player1: string | null;
  player2: string | null;
  winner: string | null;
}

// ---------------------------------------------------------------------------
// Helper table components
// ---------------------------------------------------------------------------
const SinglesTable: React.FC<{ queue: string[] }> = ({ queue }) => {
  const pairs: { match: number; p1: string; p2: string }[] = [];
  for (let i = 0; i < queue.length; i += 2) {
    pairs.push({
      match: i / 2 + 1,
      p1: queue[i],
      p2: i + 1 < queue.length ? queue[i + 1] : 'Bye',
    });
  }
  return (
    <table className="pairing-table">
      <thead>
        <tr>
          <th>Match #</th>
          <th>Player 1</th>
          <th>Player 2</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((pair, idx) => (
          <tr key={idx} className={idx === 0 ? 'next-match' : ''}>
            <td>{pair.match}</td>
            <td>{pair.p1}</td>
            <td>{pair.p2}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const DoublesTable: React.FC<{ queue: string[] }> = ({ queue }) => {
  const matches: {
    match: number;
    teamA: string[];
    teamB: string[];
    incomplete?: boolean;
  }[] = [];
  for (let i = 0; i < queue.length; i += 4) {
    if (i + 3 < queue.length) {
      matches.push({
        match: i / 4 + 1,
        teamA: [queue[i], queue[i + 1]],
        teamB: [queue[i + 2], queue[i + 3]],
      });
    } else {
      const remaining = queue.slice(i);
      matches.push({
        match: i / 4 + 1,
        teamA: remaining.length > 0 ? [remaining[0]] : [],
        teamB:
          remaining.length > 2
            ? [remaining[1], remaining[2]]
            : remaining.length > 1
            ? [remaining[1]]
            : [],
        incomplete: true,
      });
    }
  }
  return (
    <table className="pairing-table">
      <thead>
        <tr>
          <th>Match #</th>
          <th>Team A</th>
          <th>Team B</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((match, idx) => (
          <tr key={idx} className={idx === 0 ? 'next-match' : ''}>
            <td>{match.match}</td>
            <td>{match.teamA.join(' & ') || '—'}</td>
            <td>{match.teamB.join(' & ') || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ---------------------------------------------------------------------------
// DoublesMatch — supports optional Play-All suggested teams
// ---------------------------------------------------------------------------
const DoublesMatch: React.FC<{
  firstFour: string[];
  suggestedTeamA?: [string, string] | null;
  suggestedTeamB?: [string, string] | null;
  playAllScore?: number | null;
  onMatch: (teamA: string[], teamB: string[], winningTeam: 'A' | 'B') => void;
}> = ({ firstFour, suggestedTeamA, suggestedTeamB, playAllScore, onMatch }) => {
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [winningTeam, setWinningTeam] = useState<'A' | 'B' | null>(null);

  // Apply suggested teams whenever the suggestion or first-four changes
  useEffect(() => {
    if (firstFour.length === 4) {
      if (suggestedTeamA && suggestedTeamB) {
        setTeamA([...suggestedTeamA]);
        setTeamB([...suggestedTeamB]);
      } else {
        setTeamA([firstFour[0], firstFour[1]]);
        setTeamB([firstFour[2], firstFour[3]]);
      }
    } else {
      setTeamA([]);
      setTeamB([]);
    }
    setWinningTeam(null);
  }, [firstFour, suggestedTeamA, suggestedTeamB]);

  const togglePlayer = (player: string) => {
    if (teamA.includes(player)) {
      setTeamA(teamA.filter(p => p !== player));
    } else if (teamB.includes(player)) {
      setTeamB(teamB.filter(p => p !== player));
    } else {
      if (teamA.length < 2) {
        setTeamA([...teamA, player]);
      } else if (teamB.length < 2) {
        setTeamB([...teamB, player]);
      } else {
        alert('Teams are full (2 players each)');
      }
    }
  };

  const handleMatch = () => {
    if (teamA.length !== 2 || teamB.length !== 2) {
      alert('Please assign all 4 players to two teams (2 each)');
      return;
    }
    if (!winningTeam) {
      alert('Select winning team');
      return;
    }
    onMatch(teamA, teamB, winningTeam);
  };

  const isPlayAllSuggested = suggestedTeamA != null && suggestedTeamB != null;

  return (
    <div className="match-section">
      <h3>Next Match: Form Teams</h3>

      {/* Play-All badge */}
      {isPlayAllSuggested && (
        <div className="playall-badge">
          <span className="playall-icon">✨</span>
          <span>
            Teams suggested for maximum novelty
            {playAllScore === 0 && ' — all new pairings!'}
            {playAllScore !== null && playAllScore !== undefined && playAllScore > 0 && (
              <span className="playall-score"> (repeat score: {playAllScore})</span>
            )}
          </span>
        </div>
      )}

      <p>Players: {firstFour.join(', ')}</p>
      <div className="team-display">
        <strong>Team A:</strong> {teamA.join(', ') || 'None'} <br />
        <strong>Team B:</strong> {teamB.join(', ') || 'None'}
      </div>
      <div className="player-buttons">
        {firstFour.map(player => {
          let btnClass = '';
          if (teamA.includes(player)) btnClass = 'player-btn-team-a';
          else if (teamB.includes(player)) btnClass = 'player-btn-team-b';
          else btnClass = 'player-btn-unassigned';

          return (
            <button
              key={player}
              onClick={() => togglePlayer(player)}
              className={btnClass}
            >
              {player}
            </button>
          );
        })}
      </div>
      <div className="winning-team">
        <label>Winning Team:</label>
        <button
          onClick={() => setWinningTeam('A')}
          className={winningTeam === 'A' ? 'selected-winner' : ''}
          disabled={teamA.length !== 2}
        >
          Team A
        </button>
        <button
          onClick={() => setWinningTeam('B')}
          className={winningTeam === 'B' ? 'selected-winner' : ''}
          disabled={teamB.length !== 2}
        >
          Team B
        </button>
      </div>
      <button onClick={handleMatch} className="match-action-btn">
        Play Match
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Winner modal
// ---------------------------------------------------------------------------
const WinnerModal: React.FC<{
  isOpen: boolean;
  winner: string;
  onClose: () => void;
  autoClose: boolean;
  setAutoClose: (val: boolean) => void;
}> = ({ isOpen, winner, onClose, autoClose, setAutoClose }) => {
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && autoClose) {
      timer = setTimeout(() => {
        onClose();
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>🎉 Match Result 🎉</h2>
        <p className="winner-name">{winner}</p>
        <div className="modal-controls">
          <label className="auto-close-toggle">
            <input
              type="checkbox"
              checked={autoClose}
              onChange={e => setAutoClose(e.target.checked)}
            />
            Auto close (3 seconds)
          </label>
          <button onClick={onClose} className="close-modal-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------
function QueueSystemContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = searchParams?.get('mode');
  const gameModeFromUrl = (mode === 'singles' || mode === 'doubles') ? mode : null;

  const {
    gameMode,
    players,
    queue,
    playAllRel,
    setGameMode,
    setPlayers,
    playSingles,
    playDoubles,
    randomizeQueue,
    setQueue,
    recordPlayAllDoubles,
    recordPlayAllSingles,
    resetPlayAllRelationships,
  } = useQueue();

  // Local UI state
  const [tempPlayers, setTempPlayers] = useState<string[]>([]);
  const [currentName, setCurrentName] = useState('');
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalWinner, setModalWinner] = useState('');
  const [autoClose, setAutoClose] = useState(false);
  const [queueMode, setQueueMode] = useState<'default' | 'tournament' | 'playall'>('default');
  const [showHistory, setShowHistory] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Tournament state
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [tournamentActive, setTournamentActive] = useState(false);
  const [tournamentWinner, setTournamentWinner] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Play-All suggestion — recomputed whenever queue or relationships change.
  //
  // For doubles: we compute the best group-of-4 + team split and, if the
  // suggestion would reorder the queue, we apply that reorder immediately so
  // that firstFourPlayers always reflects the freshest match.
  //
  // For singles: we compute the best opponent for queue[0] and reorder if
  // needed.
  // ---------------------------------------------------------------------------
  const playAllSuggestion = useMemo<PlayAllSuggestion | null>(() => {
    if (queueMode !== 'playall' || gameMode !== 'doubles') return null;
    return suggestNextDoublesMatch(queue, playAllRel);
  }, [queueMode, gameMode, queue, playAllRel]);

  // Apply doubles queue reorder when the suggestion differs from the current front
  useEffect(() => {
    if (!playAllSuggestion) return;
    const suggested = playAllSuggestion.reorderedQueue;
    // Only reorder if the front-4 actually changed
    const currentFront = queue.slice(0, 4).join(',');
    const suggestedFront = suggested.slice(0, 4).join(',');
    if (currentFront !== suggestedFront) {
      setQueue(suggested);
    }
    // We intentionally only depend on the suggestion, not `queue` directly,
    // to avoid a re-render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllSuggestion]);

  // Singles Play-All: reorder queue so the freshest opponent is at position 1
  useEffect(() => {
    if (queueMode !== 'playall' || gameMode !== 'singles' || queue.length < 2) return;
    const result = suggestNextSinglesMatch(queue, playAllRel);
    if (!result) return;
    const currentFront = queue.slice(0, 2).join(',');
    const suggestedFront = result.reorderedQueue.slice(0, 2).join(',');
    if (currentFront !== suggestedFront) {
      setQueue(result.reorderedQueue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllRel, queueMode, gameMode]);

  // Memoize first four players
  const firstFourPlayers = useMemo(() => queue.slice(0, 4), [queue]);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Set game mode from URL
  useEffect(() => {
    if (gameModeFromUrl === 'singles' || gameModeFromUrl === 'doubles') {
      setGameMode(gameModeFromUrl);
    } else {
      router.push('/');
    }
  }, [gameModeFromUrl, setGameMode, router]);

  // ---------------------------------------------------------------------------
  // Player input handlers
  // ---------------------------------------------------------------------------
  const addPlayer = () => {
    const trimmed = currentName.trim();
    if (!trimmed) return;
    if (tempPlayers.includes(trimmed)) {
      alert('Player already added');
      return;
    }
    setTempPlayers([...tempPlayers, trimmed]);
    setCurrentName('');
  };

  const removePlayer = (index: number) => {
    const updated = [...tempPlayers];
    updated.splice(index, 1);
    setTempPlayers(updated);
  };

  const handleStartQueue = () => {
    if (tempPlayers.length < 5 || tempPlayers.length > 24) {
      alert(
        `Please add ${
          tempPlayers.length < 5 ? 'at least 5' : 'no more than 24'
        } players. Currently: ${tempPlayers.length}`
      );
      return;
    }
    try {
      setPlayers(tempPlayers); // also resets playAllRel
      setTempPlayers([]);
      setMatchHistory([]);
      setTournamentActive(false);
      setTournamentWinner(null);
      setTournamentMatches([]);
      if (queueMode === 'tournament') initTournament(tempPlayers);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // ---------------------------------------------------------------------------
  // Tournament helpers (unchanged)
  // ---------------------------------------------------------------------------
  const initTournament = (playerList: string[]) => {
    const shuffled = [...playerList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const matches: TournamentMatch[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const player2 = shuffled[i + 1] || null;
      const winner = player2 === null ? shuffled[i] : null;
      matches.push({
        id: Date.now() + i,
        round: 0,
        player1: shuffled[i],
        player2,
        winner,
      });
    }
    setTournamentMatches(matches);
    setTournamentActive(true);
    setTournamentWinner(null);
  };

  const handleTournamentMatch = (match: TournamentMatch, winner: string) => {
    const updatedMatches = tournamentMatches.map(m =>
      m.id === match.id ? { ...m, winner } : m
    );
    setTournamentMatches(updatedMatches);

    const newEntry: MatchHistoryEntry = {
      id: Date.now(),
      mode: 'Tournament',
      players: `${match.player1} vs ${match.player2 || 'Bye'}`,
      winner,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMatchHistory(prev => [newEntry, ...prev]);

    const matchesByRound: { [round: number]: TournamentMatch[] } = {};
    updatedMatches.forEach(m => {
      if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
      matchesByRound[m.round].push(m);
    });

    const roundsWithUnfinished = Object.keys(matchesByRound)
      .map(Number)
      .filter(round => matchesByRound[round].some(m => !m.winner));

    if (roundsWithUnfinished.length === 0) {
      const champion = updatedMatches[updatedMatches.length - 1]?.winner;
      setTournamentWinner(champion);
      setModalWinner(`${champion} is the tournament champion! 🏆`);
      setModalOpen(true);
      return;
    }

    const currentRound = Math.min(...roundsWithUnfinished);
    const matchesInCurrentRound = matchesByRound[currentRound];
    const allFinished = matchesInCurrentRound.every(m => m.winner !== null);

    if (allFinished && matchesInCurrentRound.length > 1) {
      const winners = matchesInCurrentRound.map(m => m.winner as string);
      const nextRound = currentRound + 1;
      const newMatches: TournamentMatch[] = [];
      for (let i = 0; i < winners.length; i += 2) {
        newMatches.push({
          id: Date.now() + i,
          round: nextRound,
          player1: winners[i],
          player2: winners[i + 1] || null,
          winner: null,
        });
      }
      setTournamentMatches([...updatedMatches, ...newMatches]);
    }
  };

  const handleRandomize = () => {
    if (queueMode === 'tournament') {
      initTournament(players);
    } else {
      try {
        randomizeQueue();
        // In Play-All mode, reset relationship history on a manual reshuffle
        // so the new random order gets a fresh slate.
        if (queueMode === 'playall') resetPlayAllRelationships();
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Match handlers
  // ---------------------------------------------------------------------------
  const handleSinglesMatch = (winner: string) => {
    try {
      const p1 = queue[0];
      const p2 = queue[1];

      playSingles(winner);

      const newEntry: MatchHistoryEntry = {
        id: Date.now(),
        mode: 'Singles',
        players: `${p1} vs ${p2}`,
        winner,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMatchHistory(prev => [newEntry, ...prev]);

      // Record for Play-All AFTER updating queue state
      if (queueMode === 'playall') {
        recordPlayAllSingles(p1, p2);
      }

      setModalWinner(`${winner} wins!`);
      setModalOpen(true);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDoublesMatch = (teamA: string[], teamB: string[], winningTeam: 'A' | 'B') => {
    try {
      // Snapshot teams before state updates
      const snapshotTeamA = [...teamA];
      const snapshotTeamB = [...teamB];

      playDoubles(snapshotTeamA, snapshotTeamB, winningTeam);

      const winnerNames = winningTeam === 'A' ? snapshotTeamA.join(' & ') : snapshotTeamB.join(' & ');
      const playersStr = `${snapshotTeamA.join(' & ')} vs ${snapshotTeamB.join(' & ')}`;
      const newEntry: MatchHistoryEntry = {
        id: Date.now(),
        mode: 'Doubles',
        players: playersStr,
        winner: winnerNames,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMatchHistory(prev => [newEntry, ...prev]);

      // Record for Play-All — this triggers the suggestion to recompute
      if (queueMode === 'playall') {
        recordPlayAllDoubles(snapshotTeamA, snapshotTeamB);
      }

      setModalWinner(`${winnerNames} win!`);
      setModalOpen(true);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleModeChange = (mode: 'default' | 'tournament' | 'playall') => {
    setQueueMode(mode);
    if (mode === 'tournament') {
      initTournament(players);
    } else {
      setTournamentActive(false);
      setTournamentWinner(null);
      setTournamentMatches([]);
    }
    // When entering Play-All fresh, clear any leftover relationship data
    if (mode === 'playall') resetPlayAllRelationships();
  };

  // ---------------------------------------------------------------------------
  // Player input screen
  // ---------------------------------------------------------------------------
  if (players.length === 0) {
    return (
      <div className={`queue-system setup-page ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="back-home" onClick={() => router.push('/')}>
          ← Back to Home
        </button>
        <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue Setup</h1>
        <div className="player-input-container">
          <div className="input-group">
            <input
              type="text"
              value={currentName}
              onChange={e => setCurrentName(e.target.value)}
              placeholder="Enter player name"
              onKeyPress={e => e.key === 'Enter' && addPlayer()}
            />
            <button onClick={addPlayer} className="add-btn">
              +
            </button>
          </div>
          {tempPlayers.length > 0 && (
            <div className="players-list">
              <h3>Players ({tempPlayers.length}/24):</h3>
              <ul>
                {tempPlayers.map((player, idx) => (
                  <li key={idx}>
                    {player}
                    <button onClick={() => removePlayer(idx)} className="remove-btn">
                      ✖
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={handleStartQueue}
            className="start-btn"
            disabled={tempPlayers.length < 5}
          >
            Start Queue ({tempPlayers.length}/5 min)
          </button>
        </div>
      </div>
    );
  }

  const modeSelector = (
    <div className="mode-selector">
      <button
        className={`mode-btn ${queueMode === 'default' ? 'active' : ''}`}
        onClick={() => handleModeChange('default')}
      >
        Default
      </button>
      <button
        className={`mode-btn ${queueMode === 'tournament' ? 'active' : ''}`}
        onClick={() => handleModeChange('tournament')}
      >
        Tournament
      </button>
      <button
        className={`mode-btn ${queueMode === 'playall' ? 'active' : ''}`}
        onClick={() => handleModeChange('playall')}
      >
        Play‑all
      </button>
    </div>
  );

  const uiControls = (
    <div className="ui-controls">
      <button onClick={() => setShowHistory(!showHistory)} className="control-btn">
        {showHistory ? 'Hide' : 'Show'} History
      </button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Tournament view
  // ---------------------------------------------------------------------------
  if (queueMode === 'tournament' && tournamentActive) {
    const matchesByRound: { [round: number]: TournamentMatch[] } = {};
    tournamentMatches.forEach(m => {
      if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
      matchesByRound[m.round].push(m);
    });
    const rounds = Object.keys(matchesByRound).sort((a, b) => Number(a) - Number(b));

    return (
      <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="back-home" onClick={() => router.push('/')}>
          ← Back to Home
        </button>
        {modeSelector}
        {uiControls}
        <div className="main-layout">
          <div className="queue-area">
            <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Tournament</h1>
            <button onClick={handleRandomize} className="randomize-btn">
              🎲 Reseed
            </button>
            {tournamentWinner && (
              <h2 className="champion">🏆 Champion: {tournamentWinner} 🏆</h2>
            )}
            <div className="tournament-bracket">
              {rounds.map(round => (
                <div key={round} className="bracket-round">
                  <h3>Round {parseInt(round) + 1}</h3>
                  {matchesByRound[Number(round)].map(match => (
                    <div key={match.id} className="bracket-match">
                      <div className="match-players">
                        <span className={match.winner === match.player1 ? 'winner' : ''}>
                          {match.player1 || '—'}
                        </span>
                        vs
                        <span className={match.winner === match.player2 ? 'winner' : ''}>
                          {match.player2 || '—'}
                        </span>
                      </div>
                      {!match.winner && match.player1 && match.player2 && (
                        <div className="match-buttons">
                          <button onClick={() => handleTournamentMatch(match, match.player1!)}>
                            {match.player1} wins
                          </button>
                          <button onClick={() => handleTournamentMatch(match, match.player2!)}>
                            {match.player2} wins
                          </button>
                        </div>
                      )}
                      {match.winner && <div className="match-winner">Winner: {match.winner}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {showHistory && (
            <div className="history-area">
              <h3>Match History</h3>
              {matchHistory.length === 0 ? (
                <p>No matches played yet.</p>
              ) : (
                <ul className="history-list">
                  {matchHistory.map(entry => (
                    <li key={entry.id} className="history-item">
                      <div className="history-time">{entry.timestamp}</div>
                      <div className="history-match">{entry.players}</div>
                      <div className="history-winner">🏆 {entry.winner}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <WinnerModal
          isOpen={modalOpen}
          winner={modalWinner}
          onClose={() => setModalOpen(false)}
          autoClose={autoClose}
          setAutoClose={setAutoClose}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Regular queue view (Default + Play-All)
  // ---------------------------------------------------------------------------
  return (
    <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
      <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? '☀️' : '🌙'}
      </button>
      <button className="back-home" onClick={() => router.push('/')}>
        ← Back to Home
      </button>
      {modeSelector}
      {uiControls}
      <div className="main-layout">
        <div className="queue-area">
          <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>

          <div className="queue-header-row">
            {queueMode === 'playall' ? (
              <button onClick={() => { randomizeQueue(); resetPlayAllRelationships(); }} className="randomize-btn">
                🔄 Reset Play-All 
              </button>
            ) : (
              <button onClick={handleRandomize} className="randomize-btn">
                🎲 Randomize Queue
              </button>
            )}
          </div>

          <div className="pairings-container">
            <h3>Upcoming Matches</h3>
            {gameMode === 'singles' && <SinglesTable queue={queue} />}
            {gameMode === 'doubles' && <DoublesTable queue={queue} />}
          </div>

          {gameMode === 'singles' && queue.length >= 2 && (
            <div className="match-section">
              <h3>
                Next Match: {queue[0]} vs {queue[1]}
              </h3>
              <div className="match-buttons">
                <button onClick={() => handleSinglesMatch(queue[0])}>{queue[0]} Wins</button>
                <button onClick={() => handleSinglesMatch(queue[1])}>{queue[1]} Wins</button>
              </div>
            </div>
          )}

          {gameMode === 'doubles' && queue.length >= 4 && (
            <DoublesMatch
              firstFour={firstFourPlayers}
              suggestedTeamA={playAllSuggestion?.suggestedTeamA ?? null}
              suggestedTeamB={playAllSuggestion?.suggestedTeamB ?? null}
              playAllScore={playAllSuggestion?.score ?? null}
              onMatch={handleDoublesMatch}
            />
          )}

          {gameMode === 'singles' && queue.length < 2 && <p>Not enough players for a match.</p>}
          {gameMode === 'doubles' && queue.length < 4 && <p>Not enough players for a match.</p>}
        </div>

        {showHistory && (
          <div className="history-area">
            <h3>Match History</h3>
            {matchHistory.length === 0 ? (
              <p>No matches played yet.</p>
            ) : (
              <ul className="history-list">
                {matchHistory.map(entry => (
                  <li key={entry.id} className="history-item">
                    <div className="history-time">{entry.timestamp}</div>
                    <div className="history-match">{entry.players}</div>
                    <div className="history-winner">🏆 {entry.winner}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <WinnerModal
        isOpen={modalOpen}
        winner={modalWinner}
        onClose={() => setModalOpen(false)}
        autoClose={autoClose}
        setAutoClose={setAutoClose}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export with Suspense boundary
// ---------------------------------------------------------------------------
export default function QueueSystem() {
  return (
    <Suspense fallback={<div>Loading queue system...</div>}>
      <QueueSystemContent />
    </Suspense>
  );
}