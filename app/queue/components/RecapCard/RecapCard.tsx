'use client';

import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Trophy, Flame, Swords, Zap, Award, Sparkles } from 'lucide-react';
import type { PlayerStat, MatchHistoryEntry } from '../../lib/types';
import { computeSessionRecap, formatRecapDate } from '../../lib/recapUtils';
import './RecapCard.css';

export interface RecapCardProps {
  stats: PlayerStat[];
  history: MatchHistoryEntry[];
  roomCode?: string | null;
  mode?: string;
  variant?: 'host' | 'viewer';
}

export const RecapCard = forwardRef<HTMLDivElement, RecapCardProps>(function RecapCard(
  { stats, history, roomCode, mode = 'Doubles', variant = 'host' },
  ref,
) {
  const recap = computeSessionRecap(stats, history);
  const dateStr = formatRecapDate();
  const permanentUrl = 'https://pad-q.vercel.app?utm_source=recap_card';

  return (
    <div className="recap-card-root" ref={ref} data-variant={variant}>
      {/* Background court lines & ambient glow */}
      <div className="recap-bg-glow recap-bg-glow--tl" />
      <div className="recap-bg-glow recap-bg-glow--br" />
      <div className="recap-court-grid" />

      {/* Header */}
      <header className="recap-header">
        <div className="recap-brand-group">
          <div className="recap-logo-pill">
            <span className="recap-brand-title">PAD<span className="recap-brand-accent">Q</span></span>
            <span className="recap-brand-dot" />
            <span className="recap-brand-subtitle">SESSION RECAP</span>
          </div>
          <div className="recap-mode-tag">
            <Swords size={15} />
            <span>{mode.toUpperCase()}</span>
          </div>
        </div>

        <div className="recap-meta-badges">
          {roomCode && (
            <div className="recap-room-pill">
              <span className="recap-room-dot" />
              <span className="recap-room-code">ROOM {roomCode}</span>
            </div>
          )}
          <div className="recap-date-pill">{dateStr}</div>
        </div>
      </header>

      {/* Standout HUD Metrics */}
      <div className="recap-hud-row">
        {recap.highlights.map((h) => (
          <div key={h.label} className="recap-hud-cell">
            <span className="recap-hud-label">{h.label}</span>
            <span className="recap-hud-val">{h.value}</span>
            {h.subtext && <span className="recap-hud-sub">{h.subtext}</span>}
          </div>
        ))}
      </div>

      {/* Body Content: Host Variant (Podium Edition) vs Viewer Variant (Full Standings) */}
      {variant === 'host' ? (
        <main className="recap-host-content">
          {/* Top 3 Podium Cards */}
          <div className="recap-podium-row">
            {/* 2nd Place (Silver) */}
            {recap.podium[1] && (
              <div className="recap-podium-card recap-podium-card--silver">
                <div className="recap-medal-tag recap-medal-tag--silver">
                  <Award size={16} /> #2 SILVER
                </div>
                <div className="recap-podium-name">{recap.podium[1].name}</div>
                <div className="recap-podium-stats">
                  <span className="recap-podium-score">{recap.podium[1].wins}W - {recap.podium[1].losses}L</span>
                  <span className="recap-podium-pct">{recap.podium[1].winRate}% Win</span>
                </div>
                {recap.podium[1].streak >= 2 && (
                  <div className="recap-streak-chip">
                    <Flame size={13} /> {recap.podium[1].streak} streak
                  </div>
                )}
              </div>
            )}

            {/* 1st Place (Gold Champion) */}
            {recap.podium[0] && (
              <div className="recap-podium-card recap-podium-card--gold">
                <div className="recap-gold-crown">
                  <Trophy size={26} />
                </div>
                <div className="recap-medal-tag recap-medal-tag--gold">
                  <Sparkles size={16} /> #1 CHAMPION
                </div>
                <div className="recap-podium-name recap-podium-name--champ">{recap.podium[0].name}</div>
                <div className="recap-podium-stats recap-podium-stats--champ">
                  <span className="recap-podium-score">{recap.podium[0].wins}W - {recap.podium[0].losses}L</span>
                  <span className="recap-podium-pct">{recap.podium[0].winRate}% Win</span>
                </div>
                {recap.podium[0].streak >= 2 && (
                  <div className="recap-streak-chip recap-streak-chip--champ">
                    <Flame size={14} /> {recap.podium[0].streak} WIN STREAK
                  </div>
                )}
              </div>
            )}

            {/* 3rd Place (Bronze) */}
            {recap.podium[2] && (
              <div className="recap-podium-card recap-podium-card--bronze">
                <div className="recap-medal-tag recap-medal-tag--bronze">
                  <Award size={16} /> #3 BRONZE
                </div>
                <div className="recap-podium-name">{recap.podium[2].name}</div>
                <div className="recap-podium-stats">
                  <span className="recap-podium-score">{recap.podium[2].wins}W - {recap.podium[2].losses}L</span>
                  <span className="recap-podium-pct">{recap.podium[2].winRate}% Win</span>
                </div>
                {recap.podium[2].streak >= 2 && (
                  <div className="recap-streak-chip">
                    <Flame size={13} /> {recap.podium[2].streak} streak
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Runners Up Table (Ranks 4+) */}
          {recap.runnersUp.length > 0 && (
            <div className="recap-runners-up-box">
              <div className="recap-section-title">
                <Zap size={14} /> RUNNERS UP
              </div>
              <div className="recap-runners-list">
                {recap.runnersUp.slice(0, 5).map((p, idx) => (
                  <div key={p.name} className="recap-runner-row">
                    <span className="recap-runner-rank">#{idx + 4}</span>
                    <span className="recap-runner-name">{p.name}</span>
                    <span className="recap-runner-score">{p.wins}W - {p.losses}L</span>
                    <span className="recap-runner-pct">{p.winRate}%</span>
                    {p.streak >= 2 && (
                      <span className="recap-runner-streak">🔥{p.streak}</span>
                    )}
                  </div>
                ))}
                {recap.runnersUp.length > 5 && (
                  <div className="recap-more-hint">
                    +{recap.runnersUp.length - 5} more players
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      ) : (
        /* Viewer Variant: Full Session Standings Board */
        <main className="recap-viewer-content">
          <div className="recap-viewer-table-shell">
            <div className="recap-section-title">
              <Trophy size={15} /> SESSION STANDINGS BOARD
            </div>
            <table className="recap-standings-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th>PLAYER</th>
                  <th>TIER</th>
                  <th>W-L</th>
                  <th>GP</th>
                  <th>WIN %</th>
                  <th>STREAK</th>
                </tr>
              </thead>
              <tbody>
                {recap.sortedPlayers.slice(0, 10).map((p, idx) => (
                  <tr key={p.name} className={idx < 3 ? `recap-row--top-${idx + 1}` : ''}>
                    <td className="recap-col-rank">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td className="recap-col-name">{p.name}</td>
                    <td className="recap-col-tier">{p.rank}</td>
                    <td className="recap-col-record">{p.wins}W - {p.losses}L</td>
                    <td className="recap-col-gp">{p.gamesPlayed}</td>
                    <td className="recap-col-pct">
                      <span className="recap-pct-badge">{p.winRate}%</span>
                    </td>
                    <td className="recap-col-streak">
                      {p.streak >= 2 ? <span className="recap-streak-pill">🔥{p.streak}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recap.sortedPlayers.length > 10 && (
              <div className="recap-more-hint">
                +{recap.sortedPlayers.length - 10} additional players in rotation
              </div>
            )}
          </div>
        </main>
      )}

      {/* Footer Branding & Permanent QR Watermark */}
      <footer className="recap-footer">
        <div className="recap-footer-info">
          <div className="recap-verified-badge">
            <span className="recap-shield-icon">✓</span>
            <span>VERIFIED PADQ COURT SESSION</span>
          </div>
          <div className="recap-tagline">
            Fair Live Matchmaking &amp; Court Rotations • pad-q.vercel.app
          </div>
        </div>

        <div className="recap-qr-block">
          <div className="recap-qr-frame">
            <QRCodeSVG
              value={permanentUrl}
              size={64}
              bgColor="#ffffff"
              fgColor="#090a12"
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="recap-qr-caption">
            <span>SCAN TO</span>
            <span>PLAY ON PADQ</span>
          </div>
        </div>
      </footer>
    </div>
  );
});
