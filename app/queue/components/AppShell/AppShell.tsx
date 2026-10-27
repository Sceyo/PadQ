'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  SlidersHorizontal,
  Sun,
  Moon,
  Swords,
  BarChart2,
} from 'lucide-react';
import { GearMenu, type GearMenuProps } from '../GearMenu/GearMenu';
import { HostToolsSheet } from '../HostToolsSheet/HostToolsSheet';
import { SessionBar } from '../SessionBar/SessionBar';
import { OverlayHost } from '../OverlayHost/OverlayHost';
import styles from './AppShell.module.css';

interface Props {
  sessionId?: string | null;
  isHost: boolean;
  isConnected: boolean;
  isSaving?: boolean;
  isLive?: boolean;
  children: React.ReactNode;
  onAddPlayerLive: (name: string) => void;
  scorePromptEnabled: boolean;
  onToggleScorePrompt: () => void;
  gearMenuProps?: GearMenuProps;
  onBackHome?: () => void;
  activeTab?: 'queue' | 'analytics';
  onTabChange?: (tab: 'queue' | 'analytics') => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  partnerPanelNode?: React.ReactNode;
  manualQueuePanelNode?: React.ReactNode;
  sitOutPanelNode?: React.ReactNode;
  activeSittingOutCount?: number;
  diagnosticsNode?: React.ReactNode;
}

export function AppShell({
  sessionId,
  isHost,
  isConnected,
  isSaving = false,
  isLive,
  children,
  onAddPlayerLive,
  scorePromptEnabled,
  onToggleScorePrompt,
  gearMenuProps,
  onBackHome,
  activeTab = 'queue',
  onTabChange,
  darkMode = true,
  onToggleDarkMode,
  partnerPanelNode,
  manualQueuePanelNode,
  sitOutPanelNode,
  activeSittingOutCount = 0,
  diagnosticsNode,
}: Props) {
  const [isHostToolsOpen, setIsHostToolsOpen] = useState(false);
  const [hostToolsInitialSection, setHostToolsInitialSection] = useState<'partners' | 'queue' | 'sitout' | undefined>();
  const isBroadcastingLive = (isLive ?? gearMenuProps?.isLive ?? false) && Boolean(sessionId && isConnected);

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
                <ArrowLeft size={16} />
              </button>
            )}
            <div className={styles.brandTitleWrap}>
              <Image
                src="/padq-logo.png"
                alt="PadQ"
                width={88}
                height={30}
                priority
                className={styles.brandLogo}
                style={{ width: 'auto', height: '26px' }}
              />
              <span className={styles.srOnly}>PadQ</span>
            </div>
            {isBroadcastingLive && (
              <span className={styles.liveBadge} title={`Live session connected (${sessionId})`} aria-label="Live session">
                <span className={styles.liveDot} />
                <span className={styles.liveText}>LIVE</span>
              </span>
            )}
          </div>

          <div className={styles.headerRight}>
            {/* Host Tools Button */}
            {isHost && (
              <button
                type="button"
                className={`${styles.iconBtn} ${isHostToolsOpen ? styles.iconBtnActive : ''}`}
                onClick={() => setIsHostToolsOpen(true)}
                aria-label="Host Tools"
                title="Host Tools"
                style={{ position: 'relative' }}
              >
                <SlidersHorizontal size={17} />
                {activeSittingOutCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      minWidth: '16px',
                      height: '16px',
                      padding: '0 4px',
                      borderRadius: '8px',
                      background: 'var(--status-warn, #f59e0b)',
                      color: '#000000',
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    {activeSittingOutCount}
                  </span>
                )}
              </button>
            )}

            {/* Theme Toggle Button */}
            {onToggleDarkMode && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onToggleDarkMode}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            )}

            {/* Gear Menu */}
            {gearMenuProps && <GearMenu {...gearMenuProps} />}
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
            >
              <Swords size={15} />
              <span>Queue</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'analytics' ? styles.tabBtnActive : ''}`}
              onClick={() => onTabChange('analytics')}
              aria-selected={activeTab === 'analytics'}
            >
              <BarChart2 size={15} />
              <span>Stats</span>
            </button>
          </nav>
        )}

        {/* 3. Main Workspace */}
        <main className={styles.workspace}>
          {sessionId && (
            <SessionBar
              sessionId={sessionId}
              isHost={isHost}
              isConnected={isConnected}
              isSaving={isSaving}
            />
          )}

          {children}
        </main>

        {/* 4. Host Tools Sheet */}
        <HostToolsSheet
          isOpen={isHostToolsOpen}
          onClose={() => setIsHostToolsOpen(false)}
          onAddPlayer={onAddPlayerLive}
          scorePromptEnabled={scorePromptEnabled}
          onToggleScorePrompt={onToggleScorePrompt}
          partnerPanelNode={partnerPanelNode}
          manualQueuePanelNode={manualQueuePanelNode}
          sitOutPanelNode={sitOutPanelNode}
          diagnosticsNode={diagnosticsNode}
          initialSection={hostToolsInitialSection}
        />
      </div>
    </OverlayHost>
  );
}
