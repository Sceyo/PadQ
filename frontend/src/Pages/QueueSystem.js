import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../CSS/QueueSystem.css';

const API_URL = '';

function QueueSystem() {
  const { mode: gameMode } = useParams(); // 'singles' or 'doubles'
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentName, setCurrentName] = useState('');
  const [tempPlayers, setTempPlayers] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [recentPairs, setRecentPairs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalWinner, setModalWinner] = useState('');
  const [autoClose, setAutoClose] = useState(false);

  // Mode selection: 'default', 'tournament', 'playall'
  const [queueMode, setQueueMode] = useState('default');

  // UI toggles
  const [showHistory, setShowHistory] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Tournament state
  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [tournamentActive, setTournamentActive] = useState(false);
  const [tournamentWinner, setTournamentWinner] = useState(null);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  useEffect(() => {
    const setMode = async () => {
      try {
        await axios.post(`${API_URL}/mode`, { mode: gameMode });
      } catch (err) {
        alert('Error setting mode');
      }
    };
    if (gameMode) setMode();
  }, [gameMode]);

  const fetchQueue = async () => {
    try {
      const res = await axios.get(`${API_URL}/queue`);
      setQueue(res.data.queue);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (players.length > 0 && queueMode !== 'tournament') fetchQueue();
  }, [players, queueMode]);

  // Player input handlers
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

  const removePlayer = (index) => {
    const updated = [...tempPlayers];
    updated.splice(index, 1);
    setTempPlayers(updated);
  };

  const handleStartQueue = async () => {
    if (tempPlayers.length < 5 || tempPlayers.length > 24) {
      alert(`Please add ${tempPlayers.length < 5 ? 'at least 5' : 'no more than 24'} players. Currently: ${tempPlayers.length}`);
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/players`, { players: tempPlayers });
      setPlayers(res.data.players);
      setQueue(res.data.queue);
      setTempPlayers([]);
      setMatchHistory([]);
      setRecentPairs([]);
      setTournamentActive(false);
      setTournamentWinner(null);
      setTournamentMatches([]);
      if (queueMode === 'tournament') initTournament(res.data.players);
    } catch (err) {
      alert(err.response?.data?.error || 'Error setting players');
    }
  };

  const initTournament = (playerList) => {
    const shuffled = [...playerList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push({
        id: Date.now() + i,
        round: 0,
        player1: shuffled[i],
        player2: shuffled[i + 1] || null,
        winner: null,
      });
    }
    setTournamentMatches(matches);
    setTournamentActive(true);
    setTournamentWinner(null);
  };

  const handleTournamentMatch = (match, winner) => {
    const updatedMatches = tournamentMatches.map(m =>
      m.id === match.id ? { ...m, winner } : m
    );
    setTournamentMatches(updatedMatches);

    const newEntry = {
      id: Date.now(),
      mode: 'Tournament',
      players: `${match.player1} vs ${match.player2 || 'Bye'}`,
      winner: winner,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMatchHistory(prev => [newEntry, ...prev]);

    const remainingMatches = updatedMatches.filter(m => !m.winner);
    if (remainingMatches.length === 0) {
      const champion = updatedMatches[updatedMatches.length - 1]?.winner;
      setTournamentWinner(champion);
      setModalWinner(`${champion} is the tournament champion! 🏆`);
      setModalOpen(true);
      return;
    }

    const matchesByRound = {};
    updatedMatches.forEach(m => {
      if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
      matchesByRound[m.round].push(m);
    });
    const currentRound = Math.max(...Object.keys(matchesByRound).map(Number));
    const winners = matchesByRound[currentRound]
      .filter(m => m.winner)
      .map(m => m.winner);
    if (winners.length > 1) {
      const nextRound = currentRound + 1;
      const newMatches = [];
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

  const handleRandomize = async () => {
    if (queueMode === 'tournament') {
      initTournament(players);
    } else {
      try {
        const res = await axios.post(`${API_URL}/randomize`);
        setQueue(res.data.queue);
        if (queueMode === 'playall') setRecentPairs([]);
      } catch (err) {
        alert(err.response?.data?.error);
      }
    }
  };

  const enforcePlayAll = (currentQueue) => {
    if (queueMode !== 'playall' || currentQueue.length < 2) return currentQueue;
    const nextPair = [currentQueue[0], currentQueue[1]];
    const pairKey = nextPair.sort().join('|');
    if (recentPairs.includes(pairKey)) {
      let newQueue = [...currentQueue];
      const second = newQueue[1];
      newQueue.splice(1, 1);
      const randomIndex = Math.floor(Math.random() * (newQueue.length - 1)) + 2;
      newQueue.splice(randomIndex, 0, second);
      return newQueue;
    }
    return currentQueue;
  };

  const handleSinglesMatch = async (winner) => {
    try {
      const res = await axios.post(`${API_URL}/match/singles`, { winner });
      let updatedQueue = res.data.queue;
      if (queueMode === 'playall') updatedQueue = enforcePlayAll(updatedQueue);
      setQueue(updatedQueue);

      const newEntry = {
        id: Date.now(),
        mode: gameMode === 'singles' ? 'Singles' : 'Doubles',
        players: `${queue[0]} vs ${queue[1]}`,
        winner: winner,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMatchHistory(prev => [newEntry, ...prev]);

      if (queueMode === 'playall') {
        const pairKey = [queue[0], queue[1]].sort().join('|');
        setRecentPairs(prev => [...prev, pairKey]);
      }

      setModalWinner(`${winner} wins!`);
      setModalOpen(true);
    } catch (err) {
      alert(err.response?.data?.error);
    }
  };

  const handleDoublesMatch = async (teamA, teamB, winningTeam) => {
    try {
      const res = await axios.post(`${API_URL}/match/doubles`, {
        teamA,
        teamB,
        winningTeam,
      });
      let updatedQueue = res.data.queue;
      if (queueMode === 'playall') updatedQueue = enforcePlayAll(updatedQueue);
      setQueue(updatedQueue);

      const winnerNames = winningTeam === 'A' ? teamA.join(' & ') : teamB.join(' & ');
      const playersStr = `${teamA.join(' & ')} vs ${teamB.join(' & ')}`;
      const newEntry = {
        id: Date.now(),
        mode: 'Doubles',
        players: playersStr,
        winner: winnerNames,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMatchHistory(prev => [newEntry, ...prev]);

      if (queueMode === 'playall') {
        const allPlayers = [...teamA, ...teamB].sort().join('|');
        setRecentPairs(prev => [...prev, allPlayers]);
      }

      setModalWinner(`${winnerNames} win!`);
      setModalOpen(true);
    } catch (err) {
      alert(err.response?.data?.error);
    }
  };

  const handleModeChange = (mode) => {
    setQueueMode(mode);
    if (mode === 'tournament') {
      initTournament(players);
    } else {
      fetchQueue();
      setTournamentActive(false);
      setTournamentWinner(null);
      setTournamentMatches([]);
    }
  };

  // Player input screen
  if (players.length === 0) {
    return (
      <div className={`queue-system setup-page ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="back-home" onClick={() => navigate('/')}>← Back to Home</button>
        <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue Setup</h1>
        <div className="player-input-container">
          <div className="input-group">
            <input
              type="text"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              placeholder="Enter player name"
              onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
            />
            <button onClick={addPlayer} className="add-btn">+</button>
          </div>
          {tempPlayers.length > 0 && (
            <div className="players-list">
              <h3>Players ({tempPlayers.length}/24):</h3>
              <ul>
                {tempPlayers.map((player, idx) => (
                  <li key={idx}>
                    {player}
                    <button onClick={() => removePlayer(idx)} className="remove-btn">✖</button>
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

  // Mode selector as buttons
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

  // UI control buttons (now only for history)
  const uiControls = (
    <div className="ui-controls">
      <button onClick={() => setShowHistory(!showHistory)} className="control-btn">
        {showHistory ? 'Hide' : 'Show'} History
      </button>
    </div>
  );

  // Tournament view
  if (queueMode === 'tournament' && tournamentActive) {
    const matchesByRound = {};
    tournamentMatches.forEach(m => {
      if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
      matchesByRound[m.round].push(m);
    });
    const rounds = Object.keys(matchesByRound).sort((a,b) => a-b);

    return (
      <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="back-home" onClick={() => navigate('/')}>← Back to Home</button>
        {modeSelector}
        {uiControls}
        <div className="main-layout">
          <div className="queue-area">
            <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Tournament</h1>
            <button onClick={handleRandomize} className="randomize-btn">🎲 Reseed</button>
            {tournamentWinner && <h2 className="champion">🏆 Champion: {tournamentWinner} 🏆</h2>}
            <div className="tournament-bracket">
              {rounds.map(round => (
                <div key={round} className="bracket-round">
                  <h3>Round {parseInt(round)+1}</h3>
                  {matchesByRound[round].map(match => (
                    <div key={match.id} className="bracket-match">
                      <div className="match-players">
                        <span className={match.winner === match.player1 ? 'winner' : ''}>{match.player1 || '—'}</span>
                        vs
                        <span className={match.winner === match.player2 ? 'winner' : ''}>{match.player2 || '—'}</span>
                      </div>
                      {!match.winner && match.player1 && match.player2 && (
                        <div className="match-buttons">
                          <button onClick={() => handleTournamentMatch(match, match.player1)}>{match.player1} wins</button>
                          <button onClick={() => handleTournamentMatch(match, match.player2)}>{match.player2} wins</button>
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
              {matchHistory.length === 0 ? <p>No matches played yet.</p> : (
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

  // Regular queue view
  return (
    <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
      <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? '☀️' : '🌙'}
      </button>
      <button className="back-home" onClick={() => navigate('/')}>← Back to Home</button>
      {modeSelector}
      {uiControls}
      <div className="main-layout">
        <div className="queue-area">
          <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>
          <button onClick={handleRandomize} className="randomize-btn">🎲 Randomize Queue</button>
          <div className="pairings-container">
            <h3>Upcoming Matches</h3>
            {gameMode === 'singles' && <SinglesTable queue={queue} />}
            {gameMode === 'doubles' && <DoublesTable queue={queue} />}
          </div>
          {gameMode === 'singles' && queue.length >= 2 && (
            <div className="match-section">
              <h3>Next Match: {queue[0]} vs {queue[1]}</h3>
              <div className="match-buttons">
                <button onClick={() => handleSinglesMatch(queue[0])}>{queue[0]} Wins</button>
                <button onClick={() => handleSinglesMatch(queue[1])}>{queue[1]} Wins</button>
              </div>
            </div>
          )}
          {gameMode === 'doubles' && queue.length >= 4 && (
            <div className="match-section">
              <h3>Next Match: Form Teams</h3>
              <DoublesMatch firstFour={queue.slice(0, 4)} onMatch={handleDoublesMatch} />
            </div>
          )}
          {gameMode === 'singles' && queue.length < 2 && <p>Not enough players for a match.</p>}
          {gameMode === 'doubles' && queue.length < 4 && <p>Not enough players for a match.</p>}
        </div>
        {showHistory && (
          <div className="history-area">
            <h3>Match History</h3>
            {matchHistory.length === 0 ? <p>No matches played yet.</p> : (
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

// ----- Supporting Components (unchanged) -----

function SinglesTable({ queue }) {
  const pairs = [];
  for (let i = 0; i < queue.length; i += 2) {
    if (i + 1 < queue.length) {
      pairs.push({ match: i/2 + 1, p1: queue[i], p2: queue[i+1] });
    } else {
      pairs.push({ match: i/2 + 1, p1: queue[i], p2: 'Bye' });
    }
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
}

function DoublesTable({ queue }) {
  const matches = [];
  for (let i = 0; i < queue.length; i += 4) {
    if (i + 3 < queue.length) {
      matches.push({
        match: i/4 + 1,
        teamA: [queue[i], queue[i+1]],
        teamB: [queue[i+2], queue[i+3]]
      });
    } else {
      const remaining = queue.slice(i);
      matches.push({
        match: i/4 + 1,
        teamA: remaining.length > 0 ? [remaining[0]] : [],
        teamB: remaining.length > 2 ? [remaining[1], remaining[2]] : (remaining.length > 1 ? [remaining[1]] : []),
        incomplete: true
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
}

function DoublesMatch({ firstFour, onMatch }) {
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [winningTeam, setWinningTeam] = useState(null);

  useEffect(() => {
    if (firstFour.length === 4) {
      setTeamA([firstFour[0], firstFour[1]]);
      setTeamB([firstFour[2], firstFour[3]]);
    } else {
      setTeamA([]);
      setTeamB([]);
    }
    setWinningTeam(null);
  }, [firstFour]);

  const togglePlayer = (player) => {
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

  return (
    <div className="match-section">
      <h3>Next Match: Form Teams</h3>
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
      <button onClick={handleMatch} className="match-action-btn">Play Match</button>
    </div>
  );
}

function WinnerModal({ isOpen, winner, onClose, autoClose, setAutoClose }) {
  useEffect(() => {
    let timer;
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>🎉 Match Result 🎉</h2>
        <p className="winner-name">{winner}</p>
        <div className="modal-controls">
          <label className="auto-close-toggle">
            <input
              type="checkbox"
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
            />
            Auto close (3 seconds)
          </label>
          <button onClick={onClose} className="close-modal-btn">Close</button>
        </div>
      </div>
    </div>
  );
}

export default QueueSystem;