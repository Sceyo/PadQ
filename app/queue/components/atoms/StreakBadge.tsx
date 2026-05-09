import React from 'react';
import { Flame } from 'lucide-react';

export const StreakBadge: React.FC<{ streak: number }> = ({ streak }) =>
  streak < 2 ? null : <span className="streak-badge"><Flame size={11} />{streak}</span>;
