import React from 'react';
import type { PlayerStat } from '../../lib/types';
import { RankBadge } from './RankBadge';
import { StreakBadge } from './StreakBadge';
import { formatDisplayName } from '../../lib/nameFormatter';

export const PlayerLabel: React.FC<{
  name: string;
  statsMap?: Record<string, PlayerStat>;
  showRank?: boolean;
}> = ({ name, statsMap, showRank = false }) => {
  const s = statsMap?.[name];
  return (
    <span className="player-label" title={name}>
      {formatDisplayName(name)}
      {s && <StreakBadge streak={s.streak} />}
      {s && showRank && <RankBadge rank={s.rank} />}
    </span>
  );
};
