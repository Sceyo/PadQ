import React from 'react';
import type { PoolSinglesState } from '../../lib/singlesPoolEngine';

export interface PoolSinglesStatusPanelProps {
  poolState:  PoolSinglesState;
  allPlayers: string[];
}

export const PoolSinglesStatusPanel: React.FC<PoolSinglesStatusPanelProps> = ({
  poolState,
  allPlayers,
}) => {
  const { phase, w1, l1, waitingQueue, playedThisCycle, matchIndexInPhase } = poolState;

  if (phase === 'INIT' && w1.length === 0 && l1.length === 0) return null;

  const unplayed = allPlayers.filter(p => !playedThisCycle.has(p));
  const phaseLabel =
    phase === 'INIT'    ? `⚡ Warm-up (Init Match ${matchIndexInPhase + 1})` :
    phase === 'WINNERS' ? `🏆 Winners Cycle (${w1.length} in pool)` :
                          `🔴 Losers Cycle (${l1.length} in pool)`;

  return (
    <div className="paddle-status">
      <div className="paddle-status-header">
        <span className="paddle-phase-label">{phaseLabel}</span>
        {unplayed.length > 0 && (
          <span className="paddle-waiting-badge">⏳ {unplayed.length} unplayed</span>
        )}
      </div>
      <div className="paddle-pools">
        {w1.length > 0 && (
          <div className="paddle-pool paddle-pool--w">
            <span className="paddle-pool-tag">W</span>
            <div className="paddle-pool-pairs">
              {w1.map((player, i) => (
                <span key={`pw-${i}-${player}`} className={`paddle-pair ${i < 2 && phase === 'WINNERS' ? 'paddle-pair--active' : ''}`}>
                  {player}
                </span>
              ))}
            </div>
          </div>
        )}
        {l1.length > 0 && (
          <div className="paddle-pool paddle-pool--l">
            <span className="paddle-pool-tag">L</span>
            <div className="paddle-pool-pairs">
              {l1.map((player, i) => (
                <span key={`pl-${i}-${player}`} className={`paddle-pair ${i < 2 && phase === 'LOSERS' ? 'paddle-pair--active' : ''}`}>
                  {player}
                </span>
              ))}
            </div>
          </div>
        )}
        {waitingQueue.length > 0 && (
          <div className="paddle-pool">
            <span className="paddle-pool-tag">Q</span>
            <div className="paddle-pool-pairs">
              {waitingQueue.map((player, i) => (
                <span key={`pq-${i}-${player}`} className="paddle-pair">
                  {player}
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
