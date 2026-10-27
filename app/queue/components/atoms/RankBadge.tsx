import React from 'react';
import { Shield, Award, Star, Zap } from 'lucide-react';
import type { RankTier } from '../../lib/types';

const RANK_CFG: Record<RankTier, { color: string; colorLight: string; icon: React.ReactNode }> = {
  Bronze:   { color: '#cd7f32', colorLight: '#92400e', icon: <Shield size={10} /> },
  Silver:   { color: '#a8a9ad', colorLight: '#475569', icon: <Shield size={10} /> },
  Gold:     { color: '#fbbf24', colorLight: '#b45309', icon: <Award  size={10} /> },
  Platinum: { color: '#00c8c8', colorLight: '#0e7490', icon: <Star   size={10} /> },
  Diamond:  { color: '#93c5fd', colorLight: '#1d4ed8', icon: <Zap    size={10} /> },
};

export const RankBadge: React.FC<{ rank: RankTier; className?: string }> = ({ rank, className = 'rank-badge' }) => {
  const { color, colorLight, icon } = RANK_CFG[rank];
  return (
    <span
      className={className}
      style={{
        '--rc': color,
        '--rc-light': colorLight,
      } as React.CSSProperties}
    >
      {icon}{rank}
    </span>
  );
};
