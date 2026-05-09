import React from 'react';
import { Shield, Award, Star, Zap } from 'lucide-react';
import type { RankTier } from '../../lib/types';

const RANK_CFG: Record<RankTier, { color: string; icon: React.ReactNode }> = {
  Bronze:   { color: '#cd7f32', icon: <Shield size={10} /> },
  Silver:   { color: '#a8a9ad', icon: <Shield size={10} /> },
  Gold:     { color: '#ffd700', icon: <Award  size={10} /> },
  Platinum: { color: '#00c8c8', icon: <Star   size={10} /> },
  Diamond:  { color: '#93c5fd', icon: <Zap    size={10} /> },
};

export const RankBadge: React.FC<{ rank: RankTier }> = ({ rank }) => {
  const { color, icon } = RANK_CFG[rank];
  return (
    <span className="rank-badge" style={{ '--rc': color } as React.CSSProperties}>
      {icon}{rank}
    </span>
  );
};
