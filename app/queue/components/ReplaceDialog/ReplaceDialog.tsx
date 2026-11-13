'use client';

import React, { useState } from 'react';
import { Dialog } from '../OverlayHost/Dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetPlayer: string;
  waitingPlayers: string[];
  onConfirmReplace: (oldPlayer: string, newPlayer: string) => void;
  matchHasStarted?: boolean;
}

export function ReplaceDialog({
  isOpen,
  onClose,
  targetPlayer,
  waitingPlayers,
  onConfirmReplace,
  matchHasStarted = false,
}: Props) {
  // Pre-select "Next up" (first in queue)
  const [selectedPlayer, setSelectedPlayer] = useState<string>(
    waitingPlayers[0] ?? ''
  );

  React.useEffect(() => {
    if (isOpen && waitingPlayers.length > 0) {
      setSelectedPlayer(waitingPlayers[0]);
    }
  }, [isOpen, waitingPlayers]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!selectedPlayer) return;
    onConfirmReplace(targetPlayer, selectedPlayer);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Replace ${targetPlayer}`}
      description="The next person in line is selected. Pick anyone waiting to choose someone else."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 'var(--tap-min, 44px)',
              padding: '0 var(--sp-4, 16px)',
              borderRadius: 'var(--r-sm, 10px)',
              border: '1px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-elevated, #1a2035)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: 'var(--fs-sm, 0.9375rem)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedPlayer}
            style={{
              height: 'var(--tap-min, 44px)',
              padding: '0 var(--sp-5, 20px)',
              borderRadius: 'var(--r-sm, 10px)',
              border: 'none',
              background: 'var(--accent-primary, #5457e0)',
              color: '#ffffff',
              fontSize: 'var(--fs-sm, 0.9375rem)',
              fontWeight: 700,
              cursor: selectedPlayer ? 'pointer' : 'default',
              opacity: selectedPlayer ? 1 : 0.4,
            }}
          >
            Replace
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
        {waitingPlayers.length === 0 ? (
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--fs-sm, 0.9375rem)' }}>
            No waiting players available to replace {targetPlayer}.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-2, 8px)',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: 'var(--sp-1, 4px)',
            }}
          >
            {waitingPlayers.map((player, idx) => {
              const isSelected = selectedPlayer === player;
              const isNextUp = idx === 0;

              return (
                <button
                  key={player}
                  type="button"
                  onClick={() => setSelectedPlayer(player)}
                  style={{
                    minHeight: 'var(--tap-min, 50px)',
                    padding: 'var(--sp-2_5, 10px) var(--sp-3_5, 14px)',
                    borderRadius: 'var(--r-md, 14px)',
                    border: isSelected
                      ? '2px solid var(--accent-primary, #5457e0)'
                      : '1.5px solid var(--line-subtle, #252d47)',
                    background: 'var(--surface-bg, #0b0d17)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3, 12px)' }}>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '2px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? '#ffffff' : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#0b0d17',
                          }}
                        />
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--fs-base, 1rem)',
                        fontWeight: 700,
                        color: 'var(--text-primary, #f8fafc)',
                      }}
                    >
                      {player}
                    </span>
                  </div>

                  {isNextUp ? (
                    <span
                      style={{
                        background: 'var(--status-warn-bg, rgba(245, 158, 11, 0.15))',
                        color: 'var(--status-warn, #f59e0b)',
                        fontSize: 'var(--fs-xs, 0.8125rem)',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill, 9999px)',
                      }}
                    >
                      Next up
                    </span>
                  ) : (
                    <span
                      style={{
                        color: 'var(--text-muted, #94a3b8)',
                        fontSize: 'var(--fs-xs, 0.8125rem)',
                        fontWeight: 500,
                      }}
                    >
                      Waiting
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {matchHasStarted && (
          <p
            style={{
              margin: 'var(--sp-2, 8px) 0 0',
              fontSize: 'var(--fs-xs, 0.8125rem)',
              color: 'var(--status-warn, #f59e0b)',
              fontWeight: 600,
            }}
          >
            This match may already be underway. Replace anyway?
          </p>
        )}
      </div>
    </Dialog>
  );
}
