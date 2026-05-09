'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import styles from './CourtTabs.module.css';
import type { CourtEntry } from '@/lib/sessionService';

interface Props {
  courts:      CourtEntry[];
  activeCourt: string;               // sessionId of the active court
  onSwitch:    (sessionId: string) => void;
  onAdd:       () => void;
  onRemove:    (sessionId: string) => void;
  canManage:   boolean;              // only the host can add/remove courts
}

export function CourtTabs({ courts, activeCourt, onSwitch, onAdd, onRemove, canManage }: Props) {
  if (courts.length < 2 && !canManage) return null;

  return (
    <nav className={styles.tabs} role="tablist" aria-label="Courts">
      {courts.map((c, i) => {
        const isActive = c.sessionId === activeCourt;
        return (
          <div key={c.sessionId} className={`${styles.tab} ${isActive ? styles.active : ''}`}>
            <button
              role="tab"
              aria-selected={isActive}
              className={styles.tabLabel}
              onClick={() => onSwitch(c.sessionId)}
            >
              {c.name || `Court ${i + 1}`}
            </button>
            {canManage && courts.length > 1 && (
              <button
                className={styles.tabClose}
                onClick={(e) => { e.stopPropagation(); onRemove(c.sessionId); }}
                title={`Remove ${c.name || `Court ${i + 1}`}`}
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}

      {canManage && courts.length < 8 && (
        <button className={styles.addBtn} onClick={onAdd}>
          <Plus size={12} /> Court
        </button>
      )}
    </nav>
  );
}