'use client';

import React, { useState } from 'react';
import { HostToolsSheet } from '../HostToolsSheet/HostToolsSheet';
import { OverlayHost } from '../OverlayHost/OverlayHost';
import styles from './AppShell.module.css';

interface Props {
  sessionId: string | null;
  isHost: boolean;
  isConnected: boolean;
  children: React.ReactNode;
  onAddPlayerLive: (name: string) => void;
  scorePromptEnabled: boolean;
  onToggleScorePrompt: () => void;
  onOpenGearMenu?: () => void;
  onBackHome?: () => void;
  activeTab?: 'queue' | 'analytics';
  onTabChange?: (tab: 'queue' | 'analytics') => void;
}

export function AppShell({
  sessionId,
  isHost,
  isConnected,
  children,
  onAddPlayerLive,
  scorePromptEnabled,
  onToggleScorePrompt,
  onOpenGearMenu,
  onBackHome,
  activeTab = 'queue',
  onTabChange,
}: Props) {
  const [isHostToolsOpen, setIsHostToolsOpen] = useState(false);

  return (
    <OverlayHost>
      <div className={styles.appShell}>
        {/* 1. Header (Strictly 52px + safe-area-inset-top) */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {onBackHome && (
              <button
                type="button"
                className={styles.backBtn}
                onClick={onBackHome}
                aria-label="Back to home"
              >
                ←
              </button>
            )}
            <span className={styles.brandTitle}>PadQ</span>

            {sessionId && (
              <div className={styles.roomPill}>
                <span className={styles.roomCode}>{sessionId}</span>
                {isHost && <span className={styles.hostBadge}>HOST</span>}
              </div>
            )}
          </div>

          <div className={styles.headerRight}>
            {/* Live Status Chip */}
            <div className={styles.statusChip}>
              <span className={`${styles.statusDot} ${isConnected ? styles.statusDotLive : styles.statusDotOffline}`} />
              <span className={styles.statusLabel}>{isConnected ? 'Live' : 'Connecting'}</span>
            </div>

            {/* Host Tools Button */}
            {isHost && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setIsHostToolsOpen(true)}
                aria-label="Host Tools"
                title="Host Tools"
              >
                🎛️
              </button>
            )}

            {/* Gear Menu Button */}
            {onOpenGearMenu && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onOpenGearMenu}
                aria-label="Settings and QR share"
                title="Settings"
              >
                ⚙️
              </button>
            )}
          </div>
        </header>

        {/* 2. Top-level Queue vs Stats Tabs (44px min touch height) */}
        {onTabChange && (
          <nav className={styles.tabNav} aria-label="Main Navigation">
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'queue' ? styles.tabBtnActive : ''}`}
              onClick={() => onTabChange('queue')}
              aria-selected={activeTab === 'queue'}
              role="tab"
            >
              ⚔️ Queue
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'analytics' ? styles.tabBtnActive : ''}`}
              onClick={() => onTabChange('analytics')}
              aria-selected={activeTab === 'analytics'}
              role="tab"
            >
              📊 Stats
            </button>
          </nav>
        )}

        {/* 3. Main Workspace */}
        <main className={styles.workspace}>
          {children}
        </main>

        {/* 4. Host Tools Sheet */}
        <HostToolsSheet
          isOpen={isHostToolsOpen}
          onClose={() => setIsHostToolsOpen(false)}
          onAddPlayer={onAddPlayerLive}
          scorePromptEnabled={scorePromptEnabled}
          onToggleScorePrompt={onToggleScorePrompt}
        />
      </div>
    </OverlayHost>
  );
}
