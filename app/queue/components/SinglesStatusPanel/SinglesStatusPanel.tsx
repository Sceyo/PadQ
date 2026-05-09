import React from 'react';
import type { SinglesState } from '../../lib/singleEngine';
import { SINGLES_MAX_WIN_STREAK } from '../../lib/singleEngine';

export const SinglesStatusPanel: React.FC<{
  singlesState: SinglesState;
  allPlayers:   string[];
}> = ({ singlesState, allPlayers }) => {
  const { king, winStreak, queue, playedThisCycle } = singlesState;

  if (king === null && queue.length < 2) return null;

  const streak   = king ? (winStreak[king] ?? 0) : 0;
  const unplayed = allPlayers.filter(p => !playedThisCycle.has(p));

  return (
    <div className="paddle-status">
      <div className="paddle-status-header">
        <span className="paddle-phase-label">
          {king
            ? <>👑 King: <strong>{king}</strong>{streak > 0 && <span className="paddle-waiting-badge" style={{ marginLeft: 6 }}>🔥 {streak}/{SINGLES_MAX_WIN_STREAK} wins</span>}</>
            : '⚡ Warm-up — first match'}
        </span>
        {unplayed.length > 0 && (
          <span className="paddle-waiting-badge">⏳ {unplayed.length} unplayed</span>
        )}
      </div>
      {queue.length > 0 && (
        <div className="paddle-pools">
          <div className="paddle-pool paddle-pool--w">
            <span className="paddle-pool-tag">Q</span>
            <div className="paddle-pool-pairs">
              {queue.map((p, i) => (
                <span key={`sq-${i}`} className={`paddle-pair ${i === 0 ? 'paddle-pair--active' : ''}`}>
                  {i === 0 ? '▶ ' : ''}{p}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {unplayed.length > 0 && (
        <div className="paddle-unplayed">
          <span className="paddle-unplayed-label">Next unplayed:</span>
          <span className="paddle-unplayed-names">{unplayed.join(' · ')}</span>
        </div>
      )}
    </div>
  );
};
