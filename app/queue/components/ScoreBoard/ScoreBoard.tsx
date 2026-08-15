'use client';

import React, { useRef, useState } from 'react';
import { Plus, Minus, Check, RotateCcw, Target, Settings } from 'lucide-react';
import type { LiveScoreState } from '@/lib/sessionService';

const SCORE_PRESETS = [11, 21] as const;

type ScoreBoardProps = {
  labelA:         string;
  labelB:         string;
  onWin:          (side: 'A' | 'B', sA: number, sB: number) => void;
  disabled?:      boolean;
  onScoreChange?: (score: LiveScoreState | null) => void;
  viewerScore?:   LiveScoreState | null;
  persistedScore?: LiveScoreState | null;
  scoreReady?:    boolean;
};

const ScoreBoardReady: React.FC<ScoreBoardProps> = ({ labelA, labelB, onWin, disabled = false, onScoreChange, viewerScore, persistedScore }) => {

  const savedScore = persistedScore?.labelA === labelA && persistedScore?.labelB === labelB
    ? persistedScore
    : null;

  const [active,      setActive]      = useState(true);
  const [scoreA,      setScoreA]      = useState(savedScore?.scoreA ?? 0);
  const [scoreB,      setScoreB]      = useState(savedScore?.scoreB ?? 0);
  const [baseLimit,   setBaseLimit]   = useState(savedScore?.baseLimit ?? 11);
  const [limit,       setLimit]       = useState(savedScore?.limit ?? 11);
  const [customLimit, setCustomLimit] = useState('');
  const [showCustom,  setShowCustom]  = useState(false);
  const [finished,    setFinished]    = useState(
    Boolean(savedScore && (savedScore.scoreA >= savedScore.limit || savedScore.scoreB >= savedScore.limit))
  );
  const [inDeuce,     setInDeuce]     = useState(savedScore?.deuce ?? false);
  const [submittingResult, setSubmittingResult] = useState(false);
  const submittingResultRef = useRef(false);

  const reset = (newBase?: number) => {
    const b = newBase ?? baseLimit;
    setScoreA(0); setScoreB(0); setFinished(false); setInDeuce(false); setLimit(b);
    if (newBase !== undefined) setBaseLimit(b);
    submittingResultRef.current = false;
    setSubmittingResult(false);
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
    // At deuce, the temporary target is always one above the tied score.
    // Example: game to 11 -> 10-10 plays to 12; 11-11 then plays to 13.
    if (!inDeuce && nextA === baseLimit - 1 && nextB === baseLimit - 1) { nextLimit = baseLimit + 1; nextDeuce = true; setLimit(nextLimit); setInDeuce(true); }
    else if (inDeuce && nextA === nextLimit - 1 && nextB === nextLimit - 1) { nextLimit = nextLimit + 1; setLimit(nextLimit); }
    setScoreA(nextA); setScoreB(nextB);
    const state: LiveScoreState = { scoreA: nextA, scoreB: nextB, limit: nextLimit, baseLimit, labelA, labelB, deuce: nextDeuce, active: true };
    onScoreChange?.(state);
    if (nextA >= nextLimit || nextB >= nextLimit) setFinished(true);
  };

  const decrement = (side: 'A' | 'B') => {
    if (disabled) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A' && nextA > 0) nextA--;
    if (side === 'B' && nextB > 0) nextB--;
    let nextLimit = limit;
    let nextDeuce = inDeuce;
    if (inDeuce && !(nextA >= baseLimit - 1 && nextB >= baseLimit - 1)) {
      nextDeuce = false;
      nextLimit = baseLimit;
    }
    setScoreA(nextA); setScoreB(nextB);
    setInDeuce(nextDeuce);
    setLimit(nextLimit);
    setFinished(nextA >= nextLimit || nextB >= nextLimit);
    submittingResultRef.current = false;
    setSubmittingResult(false);
    onScoreChange?.({ scoreA: nextA, scoreB: nextB, limit: nextLimit, baseLimit, labelA, labelB, deuce: nextDeuce, active: true });
  };

  const confirmResult = () => {
    if (!finished || disabled || submittingResultRef.current) return;
    submittingResultRef.current = true;
    setSubmittingResult(true);
    onWin(scoreA >= limit ? 'A' : 'B', scoreA, scoreB);
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
              <button onClick={() => decrement('A')} disabled={scoreA === 0} className="score-btn score-btn--minus" aria-label={`Remove point from ${labelA}`}><Minus size={14} /></button>
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
              <button onClick={() => decrement('B')} disabled={scoreB === 0} className="score-btn score-btn--minus" aria-label={`Remove point from ${labelB}`}><Minus size={14} /></button>
            </div>
          </div>
        </div>
      )}
      {active && finished && (
        <div className="score-confirm-row">
          <span>Check the score. You can still use − to correct a misclick.</span>
          <button type="button" className="score-confirm-btn" onClick={confirmResult} disabled={submittingResult}>
            <Check size={14} /> {submittingResult ? 'Applying result…' : `Confirm ${scoreA >= limit ? labelA : labelB} won, ${scoreA}–${scoreB}`}
          </button>
        </div>
      )}
    </div>
  );
};

export const ScoreBoard: React.FC<ScoreBoardProps> = (props) => {
  if (props.scoreReady === false) {
    return <div className="scoreboard-wrap scoreboard-loading">Restoring saved score…</div>;
  }

  // A new pairing gets a fresh local scorer, while a remounted pairing starts
  // from its persisted Firebase score when one exists.
  return <ScoreBoardReady key={`${props.labelA}\u0000${props.labelB}`} {...props} />;
};
