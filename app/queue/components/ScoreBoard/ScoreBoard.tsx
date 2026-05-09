'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus, Check, RotateCcw, Target, Settings } from 'lucide-react';
import type { LiveScoreState } from '@/lib/sessionService';

const SCORE_PRESETS = [11, 21] as const;

export const ScoreBoard: React.FC<{
  labelA:         string;
  labelB:         string;
  onWin:          (side: 'A' | 'B', sA: number, sB: number) => void;
  disabled?:      boolean;
  onScoreChange?: (score: LiveScoreState | null) => void;
  viewerScore?:   LiveScoreState | null;
}> = ({ labelA, labelB, onWin, disabled = false, onScoreChange, viewerScore }) => {

  const [active,      setActive]      = useState(true);
  const [scoreA,      setScoreA]      = useState(0);
  const [scoreB,      setScoreB]      = useState(0);
  const [baseLimit,   setBaseLimit]   = useState(11);
  const [limit,       setLimit]       = useState(21);
  const [customLimit, setCustomLimit] = useState('');
  const [showCustom,  setShowCustom]  = useState(false);
  const [finished,    setFinished]    = useState(false);
  const [inDeuce,     setInDeuce]     = useState(false);

  useEffect(() => {
    setScoreA(0); setScoreB(0); setFinished(false); setInDeuce(false); setLimit(baseLimit);
    if (active) onScoreChange?.({ scoreA: 0, scoreB: 0, limit: baseLimit, baseLimit, labelA, labelB, deuce: false, active: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelA, labelB]);

  const reset = (newBase?: number) => {
    const b = newBase ?? baseLimit;
    setScoreA(0); setScoreB(0); setFinished(false); setInDeuce(false); setLimit(b);
    if (newBase !== undefined) setBaseLimit(b);
    onScoreChange?.({ scoreA: 0, scoreB: 0, limit: b, baseLimit: b, labelA, labelB, deuce: false, active });
  };

  const toggleActive = () => {
    if (active) { reset(); onScoreChange?.(null); } else { onScoreChange?.({ scoreA: 0, scoreB: 0, limit, baseLimit, labelA, labelB, deuce: false, active: true }); }
    setActive(a => !a);
  };

  const increment = (side: 'A' | 'B') => {
    if (finished || disabled) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A') nextA++; else nextB++;
    let nextLimit = limit, nextDeuce = inDeuce;
    if (!inDeuce && nextA === baseLimit - 1 && nextB === baseLimit - 1) { nextLimit = baseLimit + 2; nextDeuce = true; setLimit(nextLimit); setInDeuce(true); }
    else if (inDeuce && nextA === nextLimit - 1 && nextB === nextLimit - 1) { nextLimit = nextLimit + 2; setLimit(nextLimit); }
    setScoreA(nextA); setScoreB(nextB);
    const state: LiveScoreState = { scoreA: nextA, scoreB: nextB, limit: nextLimit, baseLimit, labelA, labelB, deuce: nextDeuce, active: true };
    onScoreChange?.(state);
    if (nextA >= nextLimit) { setFinished(true); onScoreChange?.({ ...state, active: false }); onWin('A', nextA, nextB); }
    else if (nextB >= nextLimit) { setFinished(true); onScoreChange?.({ ...state, active: false }); onWin('B', nextA, nextB); }
  };

  const decrement = (side: 'A' | 'B') => {
    if (finished || disabled) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A' && nextA > 0) nextA--;
    if (side === 'B' && nextB > 0) nextB--;
    setScoreA(nextA); setScoreB(nextB);
    if (inDeuce && !(nextA >= baseLimit - 1 && nextB >= baseLimit - 1)) { setInDeuce(false); setLimit(baseLimit); }
    onScoreChange?.({ scoreA: nextA, scoreB: nextB, limit, baseLimit, labelA, labelB, deuce: inDeuce, active: true });
  };

  const applyCustomLimit = () => {
    const v = parseInt(customLimit, 10);
    if (!isNaN(v) && v > 1) { reset(v); setShowCustom(false); setCustomLimit(''); }
  };

  if (disabled && viewerScore?.active) {
    const vs = viewerScore;
    const aWon = vs.scoreA >= vs.limit, bWon = vs.scoreB >= vs.limit;
    return (
      <div className="scoreboard-wrap scoreboard-wrap--viewer">
        <div className="scoreboard-viewer-label"><Target size={12} /> Live Score{vs.deuce && <span className="deuce-badge">DEUCE</span>}</div>
        <div className="scoreboard scoreboard--viewer">
          <div className={`score-side score-side--a ${aWon ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--a">Team A</div>
            <div className="score-player-name">{vs.labelA}</div>
            <div className="score-display">{vs.scoreA}</div>
          </div>
          <div className="score-centre"><span className="score-limit-badge">to {vs.limit}</span>{(aWon || bWon) && <div className="score-finished-label">Game Over!</div>}</div>
          <div className={`score-side score-side--b ${bWon ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--b">Team B</div>
            <div className="score-player-name">{vs.labelB}</div>
            <div className="score-display">{vs.scoreB}</div>
          </div>
        </div>
      </div>
    );
  }
  if (disabled) return null;

  return (
    <div className="scoreboard-wrap">
      <div className="scoreboard-toolbar">
        <button className={`scoreboard-toggle ${active ? 'scoreboard-toggle--on' : ''}`} onClick={toggleActive}><Target size={13} />{active ? 'Scoring ON' : 'Enable Scoring'}</button>
        {active && (
          <div className="score-limit-row">
            <span className="score-limit-label"><Settings size={11} /> Limit:</span>
            {SCORE_PRESETS.map(p => (<button key={p} className={`score-preset-btn ${baseLimit === p && !showCustom ? 'active' : ''}`} onClick={() => { reset(p); setShowCustom(false); }}>{p}</button>))}
            <button className={`score-preset-btn ${showCustom ? 'active' : ''}`} onClick={() => setShowCustom(s => !s)}>Custom</button>
            {showCustom && (<span className="score-custom-wrap"><input type="number" className="score-custom-input" value={customLimit} onChange={e => setCustomLimit(e.target.value)} placeholder="e.g. 15" min={2} onKeyDown={e => e.key === 'Enter' && applyCustomLimit()} /><button className="score-custom-ok" onClick={applyCustomLimit}><Check size={12} /></button></span>)}
            <button className="score-reset-btn" onClick={() => reset()} title="Reset scores"><RotateCcw size={12} /></button>
          </div>
        )}
      </div>
      {active && (
        <div className={`scoreboard ${finished ? 'scoreboard--finished' : ''} ${inDeuce ? 'scoreboard--deuce' : ''}`}>
          <div className={`score-side score-side--a ${scoreA >= limit ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--a">Team A</div>
            <div className="score-player-name">{labelA}</div>
            <div className="score-display">{scoreA}</div>
            <div className="score-btns">
              <button onClick={() => increment('A')} disabled={finished} className="score-btn score-btn--plus"><Plus size={16} /></button>
              <button onClick={() => decrement('A')} disabled={finished || scoreA === 0} className="score-btn score-btn--minus"><Minus size={14} /></button>
            </div>
          </div>
          <div className="score-centre">
            <span className="score-limit-badge">to {limit}</span>
            {inDeuce && !finished && <div className="deuce-badge">DEUCE</div>}
            {finished && <div className="score-finished-label">Game Over!</div>}
          </div>
          <div className={`score-side score-side--b ${scoreB >= limit ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--b">Team B</div>
            <div className="score-player-name">{labelB}</div>
            <div className="score-display">{scoreB}</div>
            <div className="score-btns">
              <button onClick={() => increment('B')} disabled={finished} className="score-btn score-btn--plus"><Plus size={16} /></button>
              <button onClick={() => decrement('B')} disabled={finished || scoreB === 0} className="score-btn score-btn--minus"><Minus size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
