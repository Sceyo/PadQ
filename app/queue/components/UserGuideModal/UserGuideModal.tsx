'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const GUIDE_SECTIONS = [
  {
    title: '🚀 Starting a Session',
    body: 'Add 5–24 players, choose Singles or Doubles, then tap Start Queue. Players are queued in the order you enter them. A 4-character Room Code is generated for spectators.',
  },
  {
    title: '🏸 Paddle Queue (Default)',
    body: 'INIT — First 8 players play 2 warm-up matches:\n  Match 1: P1 & P2 vs P3 & P4\n  Match 2: P5 & P6 vs P7 & P8\nThis produces W1, W2 (winner pairs) and L1, L2 (loser pairs).\n\nWINNERS CYCLE:\n• Unplayed players waiting → W1 plays the unplayed pair; winner then faces W2\n• No unplayed → W1 vs W2 (partners swapped: [a,b]+[c,d] → [a,c] vs [b,d])\n\nLOSERS CYCLE (same structure with L1, L2)\n\nCycles alternate Winners → Losers → repeat.\nPartners always swap to avoid repeating the same teams.',
  },
  {
    title: '🔄 Queue Modes',
    body: 'Default (Advanced Paddle Queue) — structured Winners/Losers cycles with unplayed-player prioritisation.\nPlay-All — maximises variety; everyone faces everyone before repeating.\nTournament — single or double elimination bracket, auto-advances.',
  },
  {
    title: '🏆 Scoring',
    body: "Tap + / − next to each team's score. Deuce rule applies: game extends by +2 until one team leads by 2 past the limit. Score auto-resets when the next match begins.",
  },
  {
    title: '📡 Go Live & Sharing',
    body: 'Tap Go Live to allow spectators. Share via QR code, copy link, or native share sheet (WhatsApp/SMS). Viewers see the queue, score, and bracket in real time — no account needed.',
  },
  {
    title: '📊 Stats & Suggestions',
    body: 'Stats tab shows wins, losses, win rate, streak, and rank tiers (Bronze→Diamond). Smart Suggestions alert you to overused/underused players, hot streaks, and unbalanced teams.',
  },
  {
    title: '⚙️ Reset Options',
    body: 'Clear History — wipes match log only; queue and players stay.\nHard Reset — clears ALL cached data and returns to homepage.',
  },
] as const;

export const UserGuide: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState(0);

  useEffect(() => { if (isOpen) setSection(0); }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const cur = GUIDE_SECTIONS[section];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content guide-modal" onClick={e => e.stopPropagation()}>
        <div className="guide-header">
          <span className="guide-title">PADQ — User Guide</span>
          <button className="guide-close-x" onClick={onClose} title="Close"><X size={15} /></button>
        </div>
        <div className="guide-nav">
          {GUIDE_SECTIONS.map((s, i) => (
            <button key={i} className={`guide-nav-btn ${i === section ? 'active' : ''}`} onClick={() => setSection(i)}>
              {s.title.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="guide-body">
          <h3 className="guide-section-title">{cur.title}</h3>
          <p className="guide-section-body">{cur.body}</p>
        </div>
        <div className="guide-footer">
          <button className="guide-arrow" disabled={section === 0} onClick={() => setSection(s => s - 1)}>◀ Prev</button>
          <span className="guide-pager">{section + 1} / {GUIDE_SECTIONS.length}</span>
          <button className="guide-arrow" disabled={section === GUIDE_SECTIONS.length - 1} onClick={() => setSection(s => s + 1)}>Next ▶</button>
        </div>
      </div>
    </div>
  );
};
