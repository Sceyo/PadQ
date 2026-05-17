'use client';

import React, { useState, useEffect } from 'react';
import { LayoutGrid } from 'lucide-react';
import {
  subscribeToSession,
  type CourtEntry,
  type SessionDoc,
} from '@/lib/sessionService';

export function CoordinatorOverlay({
  courts,
  onClose,
}: {
  courts:  CourtEntry[];
  onClose: () => void;
}) {
  const [courtData, setCourtData] = useState<Record<string, SessionDoc | null>>({});

  useEffect(() => {
    if (courts.length === 0) return;
    const unsubs = courts.map(c =>
      subscribeToSession(
        c.sessionId,
        data => setCourtData(prev => ({ ...prev, [c.sessionId]: data })),
        ()   => {},
        ()   => setCourtData(prev => ({ ...prev, [c.sessionId]: null })),
      )
    );
    return () => unsubs.forEach(u => u());
  }, [courts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="coord-overlay"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="coord-panel">
        <div className="coord-header">
          <h2 className="coord-title"><LayoutGrid size={16} /> All Courts</h2>
          <button className="coord-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {courts.length === 0 ? (
          <p className="muted-hint">No courts in your session group.</p>
        ) : (
          <div className="coord-grid">
            {courts.map(c => {
              const data    = courtData[c.sessionId];
              const expired = data === null;
              const loading = data === undefined;
              const q       = data?.queue ?? [];
              const n       = data?.gameMode === 'doubles' ? 4 : 2;
              const current = q.slice(0, n);
              const waiting = Math.max(0, (data?.players?.length ?? 0) - n);
              const phase   = (data?.doublesEngineState as Record<string, unknown> | null)
                ?.phase as string | undefined;

              return (
                <div
                  key={c.sessionId}
                  className={[
                    'coord-card',
                    data?.isLive ? 'coord-card--live'    : '',
                    expired       ? 'coord-card--expired' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="coord-card-header">
                    <span className="coord-court-name">{c.name}</span>
                    {data?.isLive && <span className="go-live-dot go-live-dot--sm" />}
                  </div>

                  {loading && <p className="coord-status">Connecting…</p>}
                  {expired  && <p className="coord-status coord-status--expired">Session expired</p>}
                  {data && (
                    <>
                      <div className="coord-match">
                        {current.length >= 2 ? (
                          data.gameMode === 'doubles' && current.length >= 4 ? (
                            <span className="coord-teams">
                              {current.slice(0, 2).join(' & ')}
                              <span className="coord-vs"> vs </span>
                              {current.slice(2, 4).join(' & ')}
                            </span>
                          ) : (
                            <span className="coord-teams">
                              {current[0]}<span className="coord-vs"> vs </span>{current[1]}
                            </span>
                          )
                        ) : (
                          <span className="coord-no-match">No active match</span>
                        )}
                      </div>
                      <div className="coord-meta">
                        <span>{data.players?.length ?? 0} players</span>
                        {waiting > 0 && <span>{waiting} waiting</span>}
                        {phase && <span className="coord-phase">{phase}</span>}
                        {!data.isLive && <span className="coord-offline">Not live</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
