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
  UserPlus,
  Link2,
  ListOrdered,
  Coffee,
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
                className={styles.iconBtn}
                onClick={() => setIsHostToolsOpen(true)}
                aria-label="Host Tools"
                title="Host Tools"
              >
                <SlidersHorizontal size={17} />
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

          {isHost && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => { setHostToolsInitialSection(undefined); setIsHostToolsOpen(true); }}
                style={{
                  minHeight: '36px',
                  padding: '6px 14px',
                  borderRadius: 'var(--r-pill, 9999px)',
                  border: '1px solid var(--line-strong, #333d5e)',
                  background: 'var(--surface-card, #131726)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                }}
              >
                <UserPlus size={13} style={{ color: 'var(--status-success, #22c55e)' }} />
                <span>Add Player</span>
              </button>

              {partnerPanelNode && (
                <button
                  type="button"
                  onClick={() => { setHostToolsInitialSection('partners'); setIsHostToolsOpen(true); }}
                  style={{
                    minHeight: '36px',
                    padding: '6px 14px',
                    borderRadius: 'var(--r-pill, 9999px)',
                    border: '1px solid var(--line-strong, #333d5e)',
                    background: 'var(--surface-card, #131726)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                  }}
                >
                  <Link2 size={13} style={{ color: 'var(--team-b-text, #60a5fa)' }} />
                  <span>Set Partners</span>
                </button>
              )}

              {manualQueuePanelNode && (
                <button
                  type="button"
                  onClick={() => { setHostToolsInitialSection('queue'); setIsHostToolsOpen(true); }}
                  style={{
                    minHeight: '36px',
                    padding: '6px 14px',
                    borderRadius: 'var(--r-pill, 9999px)',
                    border: '1px solid var(--line-strong, #333d5e)',
                    background: 'var(--surface-card, #131726)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                  }}
                >
                  <ListOrdered size={13} style={{ color: 'var(--accent-primary, #5457e0)' }} />
                  <span>Manage Queue</span>
                </button>
              )}

              {sitOutPanelNode && (
                <button
                  type="button"
                  className="sitout-toggle-btn"
                  onClick={() => { setHostToolsInitialSection('sitout'); setIsHostToolsOpen(true); }}
                  style={{
                    minHeight: '36px',
                    padding: '6px 14px',
                    borderRadius: 'var(--r-pill, 9999px)',
                    border: '1px solid var(--line-strong, #333d5e)',
                    background: 'var(--surface-card, #131726)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
                  }}
                >
                  <Coffee size={13} style={{ color: 'var(--status-warn, #f59e0b)' }} />
                  <span>Breaks{activeSittingOutCount > 0 ? ` (${activeSittingOutCount})` : ''}</span>
                </button>
              )}
            </div>
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
