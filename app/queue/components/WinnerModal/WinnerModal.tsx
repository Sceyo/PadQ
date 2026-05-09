'use client';

import React, { useEffect } from 'react';
import { Trophy, X } from 'lucide-react';

export const WinnerModal: React.FC<{
  isOpen:       boolean;
  winner:       string;
  score?:       string;
  onClose:      () => void;
  autoClose:    boolean;
  setAutoClose: (v: boolean) => void;
}> = ({ isOpen, winner, score, onClose, autoClose, setAutoClose }) => {
  useEffect(() => {
    if (!isOpen || !autoClose) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <Trophy size={42} className="modal-trophy" />
        <h2>Match Result</h2>
        <p className="winner-name">{winner}</p>
        {score && <p className="modal-score">{score}</p>}
        <div className="modal-controls">
          <label className="auto-close-toggle">
            <input type="checkbox" checked={autoClose} onChange={e => setAutoClose(e.target.checked)} />
            Auto-close (3s)
          </label>
          <button onClick={onClose} className="close-modal-btn"><X size={13} /> Close</button>
        </div>
      </div>
    </div>
  );
};
