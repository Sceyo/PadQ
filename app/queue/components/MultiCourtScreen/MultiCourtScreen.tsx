'use client';

import React, { useState } from 'react';
import { CourtCard } from '../CourtCard/CourtCard';
import { QueuePanel } from '../QueuePanel/QueuePanel';
import { ConfirmBar } from '../ConfirmBar/ConfirmBar';
import { EditTeamsDialog } from '../EditTeamsDialog/EditTeamsDialog';
import { ReplaceDialog } from '../ReplaceDialog/ReplaceDialog';
import { CourtScoreModal } from '../CourtScoreModal/CourtScoreModal';
import { PlayerMenu } from '../PlayerMenu/PlayerMenu';
import { useMatchFlow } from '../../hooks/useMatchFlow';
import type { CourtSlot } from '@/lib/sessionService';
import type { PlayerStat } from '../../lib/types';
import type { QueueViewModel } from '../../lib/viewModels';

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
}: Props) {
  // Overlays state
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [selectedPlayerForMenu, setSelectedPlayerForMenu] = useState<string | null>(null);
  const [replacingPlayer, setReplacingPlayer] = useState<string | null>(null);
  const [pendingScoreMatch, setPendingScoreMatch] = useState<{
    courtId: string;
    courtName: string;
    side: 'A' | 'B';
    teamA: string[];
    teamB: string[];
  } | null>(null);

  const matchFlow = useMatchFlow({
    onSave: async (winner, score) => {
      if (!pendingScoreMatch) return false;
      return onWin(pendingScoreMatch.courtId, winner, score);
    },
  });

  const handleWinClick = (courtId: string, side: 'A' | 'B') => {
    if (!isHost) return;
    const slot = courtSlots.find(s => s.id === courtId);
    if (!slot) return;
    const teamA = slot.onCourt.slice(0, 2);
    const teamB = slot.onCourt.slice(2, 4);

    if (scorePromptEnabled) {
      setPendingScoreMatch({
        courtId,
        courtName: slot.name,
        side,
        teamA,
        teamB,
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4, 16px)',
        width: '100%',
        maxWidth: '1080px',
        margin: '0 auto',
      }}
    >
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
              onEdit={isHost ? (id) => setEditingCourtId(id) : undefined}
              onSelectPlayer={isHost ? (p) => setSelectedPlayerForMenu(p) : undefined}
            />
          ))}
        </div>
      </section>

      {/* 2. Unified Shared Queue Panel with ETAs */}
      <QueuePanel
        queue={queue}
        onSelectPlayer={(p) => isHost && setSelectedPlayerForMenu(p)}
        onReturnFromBreak={onReturnFromBreak}
      />

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
          playerName={selectedPlayerForMenu}
          onReplace={(name) => {
            setSelectedPlayerForMenu(null);
            setReplacingPlayer(name);
          }}
          onTakeBreak={(name) => {
            setSelectedPlayerForMenu(null);
            onPlayerTakeBreak(name);
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
