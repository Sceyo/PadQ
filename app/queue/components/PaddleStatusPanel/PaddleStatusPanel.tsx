import React from 'react';
import type { PaddleState } from '../../lib/doublesEngine';

export const PaddleStatusPanel: React.FC<{
  paddleState: PaddleState;
  allPlayers:  string[];
}> = ({ paddleState, allPlayers }) => {
  const { phase, winnersPool: winners, losersPool: losers, playedThisCycle } = paddleState;

  if (phase === 'INIT' && winners.length === 0 && losers.length === 0) return null;

  const unplayed = allPlayers.filter(p => !playedThisCycle.has(p));
  const phaseLabel =
    phase === 'INIT'    ? '⚡ Warm-up (2 init matches)' :
    phase === 'WINNERS' ? '🏆 Winners Cycle' :
                          '🔴 Losers Cycle';

  return (
    <div className="paddle-status">
      <div className="paddle-status-header">
        <span className="paddle-phase-label">{phaseLabel}</span>
        {unplayed.length > 0 && (
          <span className="paddle-waiting-badge">⏳ {unplayed.length} waiting</span>
        )}
      </div>
      <div className="paddle-pools">
        {winners.length > 0 && (
          <div className="paddle-pool paddle-pool--w">
            <span className="paddle-pool-tag">W</span>
            <div className="paddle-pool-pairs">
              {winners.map((pair, i) => (
                <span key={`w-${i}`} className={`paddle-pair ${i === 0 ? 'paddle-pair--active' : ''}`}>
                  {pair.join(' & ')}
                </span>
              ))}
            </div>
          </div>
        )}
        {losers.length > 0 && (
          <div className="paddle-pool paddle-pool--l">
            <span className="paddle-pool-tag">L</span>
            <div className="paddle-pool-pairs">
              {losers.map((pair, i) => (
                <span key={`l-${i}`} className={`paddle-pair ${i === 0 ? 'paddle-pair--active' : ''}`}>
                  {pair.join(' & ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {unplayed.length > 0 && (
        <div className="paddle-unplayed">
          <span className="paddle-unplayed-label">Next unplayed:</span>
          <span className="paddle-unplayed-names">{unplayed.join(' · ')}</span>
        </div>
      )}
    </div>
  );
};
