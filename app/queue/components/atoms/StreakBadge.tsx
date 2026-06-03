import React from 'react';
import { Flame } from 'lucide-react';

export const StreakBadge: React.FC<{ streak: number; className?: string }> = ({ streak, className = 'streak-badge' }) =>
  streak < 2 ? null : <span className={className}><Flame size={11} />{streak}</span>;
