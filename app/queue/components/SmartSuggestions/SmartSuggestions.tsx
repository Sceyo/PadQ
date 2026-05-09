import React from 'react';
import { AlertTriangle, ThumbsUp, Flame, Brain } from 'lucide-react';
import type { SmartSuggestion } from '../../lib/types';

const SUGGESTION_ICONS: Record<SmartSuggestion['type'], React.ReactNode> = {
  'overused':      <AlertTriangle size={13} />,
  'underused':     <ThumbsUp size={13} />,
  'hot-streak':    <Flame size={13} />,
  'team-balance':  <Brain size={13} />,
};
const SUGGESTION_COLORS: Record<SmartSuggestion['type'], string> = {
  'overused':     '#f59e0b',
  'underused':    '#22c55e',
  'hot-streak':   '#ef4444',
  'team-balance': '#6366f1',
};

export const SmartSuggestions: React.FC<{ suggestions: SmartSuggestion[] }> = ({ suggestions }) => {
  if (!suggestions.length) return null;
  return (
    <div className="smart-suggestions">
      <div className="smart-header"><Brain size={13} /> Smart Suggestions</div>
      {suggestions.map((s, i) => (
        <div key={`${s.type}-${i}`} className="smart-card" style={{ '--sc': SUGGESTION_COLORS[s.type] } as React.CSSProperties}>
          <span className="smart-icon">{SUGGESTION_ICONS[s.type]}</span>
          <span className="smart-message">{s.message}</span>
        </div>
      ))}
    </div>
  );
};
