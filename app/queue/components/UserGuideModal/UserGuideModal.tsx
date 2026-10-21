'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const GUIDE_SECTIONS = [
  {
    title: '🚀 Starting a Session',
    body: 'Add up to 30 players, choose Singles or Doubles and up to 3 courts, then tap Start Queue. Players are queued in the order you enter them. A 6-character Room Code is generated for spectators.',
  },
  {
    title: '🏸 Paddle Queue (Default)',
    body: 'INIT — First 8 players play 2 warm-up matches:\n  Match 1: P1 & P2 vs P3 & P4\n  Match 2: P5 & P6 vs P7 & P8\nThis produces W1, W2 (winner pairs) and L1, L2 (loser pairs).\n\nWINNERS CYCLE:\n• Unplayed players waiting → W1 plays the unplayed pair; winner then faces W2\n• No unplayed → W1 vs W2 (partners swapped: [a,b]+[c,d] → [a,c] vs [b,d])\n\nLOSERS CYCLE (same structure with L1, L2)\n\nCycles alternate Winners → Losers → repeat.\nUnlocked partners rotate to avoid immediately repeating the same team. Locked partner pairs intentionally stay together.',
  },
  {
    title: '🔄 V1 Queue Rotation',
    body: 'PAD-Q V1 uses the Default rotation: structured Winners/Losers cycles with unplayed-player prioritisation. For multi-court sessions, all courts draw from one shared waiting queue and unlocked teammates are split before their next shared rotation. Tap the pencil icon on any court card to manually adjust or swap player positions.',
  },
  {
    title: '🏆 Scoring',
    body: 'Single-court sessions support live + / − point-by-point scoring with deuce extensions until a team leads by 2. Multi-court sessions feature rapid 1-tap winner buttons, plus an optional Match Scores toggle that lets hosts directly enter final scores (e.g. 11–9) with 1-tap presets to power Point Differential (+/−).',
  },
  {
    title: '📡 Go Live & Sharing',
    body: 'Tap Go Live to allow spectators. Share via QR code, copy link, or native share sheet (WhatsApp/SMS). Viewers see the queue and Live Court Status in real time. Single-court viewers also see the score when scoring is enabled; multi-court viewers see current players and completed results.',
  },
  {
    title: '📊 Stats & Standings',
    body: 'Standings rank players by Wins, then Win %, Point Differential (+/−), and Opponent Win % (OWP matchup strength) for fair tiebreaks. Career stats track cumulative history across sessions.',
  },
  {
    title: '⚙️ Settings & Controls',
    body: '• Undo Last Match — restores previous match and queue state if recorded in error.\n• Clear History — wipes the match log while keeping on-court and queue players.\n• End & Delete Event — permanently ends the live event and removes the room. Saved roster and career stats are safely kept.\n• Privacy & Data — inspect or clear saved player data anytime.',
  },
] as const;

export const UserGuide: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState(0);

  const handleClose = useCallback(() => {
    setSection(0);
    onClose();
  }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;
  const cur = GUIDE_SECTIONS[section];
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content guide-modal" onClick={e => e.stopPropagation()}>
        <div className="guide-header">
          <span className="guide-title">PADQ — User Guide</span>
          <button className="guide-close-x" onClick={handleClose} title="Close"><X size={15} /></button>
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
