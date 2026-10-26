'use client';

import React, { useState } from 'react';
import { CourtCard } from '../CourtCard/CourtCard';
import { QueuePanel } from '../QueuePanel/QueuePanel';

import { EditTeamsDialog } from '../EditTeamsDialog/EditTeamsDialog';
import { ReplaceDialog } from '../ReplaceDialog/ReplaceDialog';
import { CourtScoreModal } from '../CourtScoreModal/CourtScoreModal';
import { PlayerMenu } from '../PlayerMenu/PlayerMenu';

import type { CourtSlot } from '@/lib/sessionService';
import type { PlayerStat } from '../../lib/types';
import type { QueueViewModel } from '../../lib/viewModels';
import styles from './MultiCourtScreen.module.css';

interface Props {
  courtSlots: CourtSlot[];
  statsMap: Record<string, PlayerStat>;
  queue: QueueViewModel;
  isHost: boolean;
  scorePromptEnabled: boolean;
  onWin: (courtId: string, side: 'A' | 'B', score?: string) => Promise<boolean>;
  onReplacePlayer: (target: string, replacement: string) => void;
  onSwapCourtPlayers: (courtId: string, newOnCourt: string[]) => void;
  onPlayerTakeBreak: (name: string) => void;
  onPlayerRemove: (name: string) => void;
  onReturnFromBreak: (name: string) => void;
  onMoveWaitingPlayer?: (name: string, direction: -1 | 1) => void;
  gameMode?: 'singles' | 'doubles';
}

export function MultiCourtScreen({
  courtSlots,
  statsMap,
  queue,
  isHost,
  scorePromptEnabled,
  onWin,
  onReplacePlayer,
  onSwapCourtPlayers,
  onPlayerTakeBreak,
  onPlayerRemove,
  onReturnFromBreak,
  onMoveWaitingPlayer,
  gameMode = 'doubles',
}: Props) {
  // Overlays state
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [selectedPlayerForMenu, setSelectedPlayerForMenu] = useState<{
    name: string;
    zone: 'playing' | 'waiting' | 'break';
  } | null>(null);
  const [replacingPlayer, setReplacingPlayer] = useState<string | null>(null);
  const [pendingScoreMatch, setPendingScoreMatch] = useState<{
    courtId: string;
    courtName: string;
    side: 'A' | 'B';
    teamA: string[];
    teamB: string[];
    mode?: 'singles' | 'doubles' | 'skilled';
  } | null>(null);

  const isSingles = gameMode === 'singles';

  const handleWinClick = (courtId: string, side: 'A' | 'B') => {
    if (!isHost) return;
    const slot = courtSlots.find(s => s.id === courtId);
    if (!slot) return;
    const teamA = slot.onCourt.slice(0, isSingles ? 1 : 2);
    const teamB = slot.onCourt.slice(isSingles ? 1 : 2, isSingles ? 2 : 4);

    if (scorePromptEnabled) {
      setPendingScoreMatch({
        courtId,
        courtName: slot.name,
        side,
        teamA,
        teamB,
        mode: gameMode ?? 'doubles',
      });
    } else {
      onWin(courtId, side, undefined);
    }
  };

  const editingSlot = courtSlots.find(s => s.id === editingCourtId);

  const waitingCandidateNames = queue.waiting.map(w => w.name);
  const allWaitingNames = [
    ...queue.nextUp.map(n => n.name),
    ...waitingCandidateNames.filter(name => !queue.nextUp.some(n => n.name === name)),
  ];

  // Compute move up / move down eligibility
  const waitingQueueNames = [
    ...queue.nextUp.map(n => n.name),
    ...queue.waiting.map(w => w.name),
  ];
  const selectedIndex = selectedPlayerForMenu && selectedPlayerForMenu.zone === 'waiting'
    ? waitingQueueNames.indexOf(selectedPlayerForMenu.name)
    : -1;
  const canMoveUp = selectedIndex > 0;
  const canMoveDown = selectedIndex >= 0 && selectedIndex < waitingQueueNames.length - 1;

  return (
    <div className={styles.container}>
      <div className={styles.courtsSection}>
        {/* 1. Live Court Status Cards Grid */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3, 12px)' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--fs-sm, 0.9375rem)',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary, #cbd5e1)',
            }}
          >
            Live Court Status ({courtSlots.length} {courtSlots.length === 1 ? 'Court' : 'Courts'})
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: courtSlots.length > 1 ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr',
              gap: 'var(--sp-3_5, 14px)',
            }}
          >
            {courtSlots.map((slot) => (
              <CourtCard
                key={slot.id}
                slot={slot}
                statsMap={statsMap}
                isHost={isHost}
                onWin={handleWinClick}
                onEdit={isHost && !isSingles ? (id) => setEditingCourtId(id) : undefined}
                onSelectPlayer={isHost ? (p) => setSelectedPlayerForMenu({ name: p, zone: 'playing' }) : undefined}
                gameMode={gameMode}
              />
            ))}
          </div>
        </section>
      </div>

      <div className={styles.queueSection}>
        {/* 2. Unified Shared Queue Panel with ETAs */}
        <QueuePanel
          queue={queue}
          onSelectPlayer={(name, zone) => isHost && setSelectedPlayerForMenu({ name, zone: zone ?? 'waiting' })}
          onReturnFromBreak={onReturnFromBreak}
          statsMap={statsMap}
        />
      </div>

      {/* 3. Floating Score Modal when scorePromptEnabled */}
      {pendingScoreMatch && (
        <CourtScoreModal
          isOpen={true}
          match={pendingScoreMatch}
          onConfirm={(score) => {
            const m = pendingScoreMatch;
            setPendingScoreMatch(null);
            onWin(m.courtId, m.side, score);
          }}
          onCancel={() => setPendingScoreMatch(null)}
        />
      )}

      {/* 4. Edit Teams Dialog */}
      {editingSlot && (
        <EditTeamsDialog
          isOpen={true}
          onClose={() => setEditingCourtId(null)}
          courtName={editingSlot.name}
          onCourt={editingSlot.onCourt}
          onConfirm={(newOnCourt) => {
            onSwapCourtPlayers(editingSlot.id, newOnCourt);
            setEditingCourtId(null);
          }}
        />
      )}

      {/* 5. Player Action Menu */}
      {selectedPlayerForMenu && (
        <PlayerMenu
          isOpen={true}
          onClose={() => setSelectedPlayerForMenu(null)}
          playerName={selectedPlayerForMenu.name}
          zone={selectedPlayerForMenu.zone}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveWaitingPlayer ? (name) => onMoveWaitingPlayer(name, -1) : undefined}
          onMoveDown={onMoveWaitingPlayer ? (name) => onMoveWaitingPlayer(name, 1) : undefined}
          onReplace={(name) => {
            setSelectedPlayerForMenu(null);
            setReplacingPlayer(name);
          }}
          onTakeBreak={(name) => {
            setSelectedPlayerForMenu(null);
            onPlayerTakeBreak(name);
          }}
          onBackIn={(name) => {
            setSelectedPlayerForMenu(null);
            onReturnFromBreak(name);
          }}
          onRemove={(name) => {
            setSelectedPlayerForMenu(null);
            onPlayerRemove(name);
          }}
        />
      )}

      {/* 6. Replace Dialog */}
      {replacingPlayer && (
        <ReplaceDialog
          isOpen={true}
          onClose={() => setReplacingPlayer(null)}
          targetPlayer={replacingPlayer}
          waitingPlayers={allWaitingNames}
          onConfirmReplace={onReplacePlayer}
        />
      )}
    </div>
  );
}
