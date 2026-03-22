import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'queue_app';

interface QueueState {
  gameMode: 'singles' | 'doubles' | null;
  players: string[];
  queue: string[];
}

function shuffleArray(arr: string[]): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function useQueue() {
  const [state, setState] = useState<QueueState>({
    gameMode: null,
    players: [],
    queue: [],
  });

  // Load from storage
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(parsed);
      } catch (e) {
        console.error('Failed to parse stored queue state');
      }
    }
  }, []);

  // Save to storage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setGameMode = useCallback((mode: 'singles' | 'doubles') => {
    setState(prev => ({ ...prev, gameMode: mode }));
  }, []);

  const setPlayers = useCallback((newPlayers: string[]) => {
    if (newPlayers.length < 5 || newPlayers.length > 24) {
      throw new Error('Number of players must be between 5 and 24');
    }
    const shuffledQueue = shuffleArray(newPlayers);
    setState(prev => ({
      ...prev,
      players: newPlayers,
      queue: shuffledQueue,
    }));
  }, []);

  const playSingles = useCallback((winner: string) => {
    setState(prev => {
      const { queue, gameMode } = prev;
      if (gameMode !== 'singles') throw new Error('Not in singles mode');
      if (queue.length < 2) throw new Error('Not enough players for singles');
      const [player1, player2] = queue;
      if (winner !== player1 && winner !== player2) {
        throw new Error('Winner must be one of the current players');
      }
      const newQueue = queue.slice(2);
      const loser = winner === player1 ? player2 : player1;
      newQueue.unshift(loser);
      newQueue.push(winner);
      return { ...prev, queue: newQueue };
    });
  }, []);

  const playDoubles = useCallback((teamA: string[], teamB: string[], winningTeam: 'A' | 'B') => {
    setState(prev => {
      const { queue, gameMode } = prev;
      if (gameMode !== 'doubles') throw new Error('Not in doubles mode');
      if (queue.length < 4) throw new Error('Not enough players for doubles');
      const firstFour = queue.slice(0, 4);
      const allPlayers = [...teamA, ...teamB];
      if (new Set(allPlayers).size !== 4 || !allPlayers.every(p => firstFour.includes(p))) {
        throw new Error('Teams must consist of the first four players in queue');
      }
      let newQueue = queue.slice(4);
      const winners = winningTeam === 'A' ? teamA : teamB;
      const losers = winningTeam === 'A' ? teamB : teamA;
      newQueue = [...losers, ...newQueue];
      newQueue.push(...winners);
      return { ...prev, queue: newQueue };
    });
  }, []);

  const randomizeQueue = useCallback(() => {
    setState(prev => {
      const { players } = prev;
      if (players.length === 0) throw new Error('No players set');
      const shuffled = shuffleArray(players);
      return { ...prev, queue: shuffled };
    });
  }, []);

  const setQueue = useCallback((newQueue: string[]) => {
    setState(prev => ({ ...prev, queue: newQueue }));
  }, []);

  const reset = useCallback(() => {
    setState({
      gameMode: null,
      players: [],
      queue: [],
    });
  }, []);

  return {
    ...state,
    setGameMode,
    setPlayers,
    playSingles,
    playDoubles,
    randomizeQueue,
    setQueue,
    reset,
  };
}