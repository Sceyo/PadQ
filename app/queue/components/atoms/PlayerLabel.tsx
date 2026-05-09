import React from 'react';
import type { PlayerStat } from '../../lib/types';
import { RankBadge } from './RankBadge';
import { StreakBadge } from './StreakBadge';

export const PlayerLabel: React.FC<{
  name: string;
  statsMap?: Record<string, PlayerStat>;
  showRank?: boolean;
}> = ({ name, statsMap, showRank = false }) => {
  const s = statsMap?.[name];
  return (
    <span className="player-label">
      {name}
      {s && <StreakBadge streak={s.streak} />}
      {s && showRank && <RankBadge rank={s.rank} />}
    </span>
  );
};
