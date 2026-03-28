'use client';

/**
 * PADQ — Homepage
 * ─────────────────────────────────────────────────────────
 * Entry point. Lets the user pick Singles or Doubles mode
 * then navigates to /queue?mode=singles|doubles
 */

import { useRouter } from 'next/navigation';
import { Swords, Users, ChevronRight, Disc2, Zap, Shield, Star } from 'lucide-react';
import './Homepage.css';

export default function HomePage() {
  const router = useRouter();

  const go = (mode: 'singles' | 'doubles') => router.push(`/queue?mode=${mode}`);

  return (
    <div className="homepage">
      {/* Ambient background orbs */}
      <span className="hp-orb hp-orb--1" />
      <span className="hp-orb hp-orb--2" />
      <span className="hp-orb hp-orb--3" />

      <div className="hp-inner">
        {/* ── Brand ── */}
        <div className="hp-brand">
          <div className="hp-logo-wrap">
            <Disc2 size={30} strokeWidth={2.5} />
          </div>
          <h1 className="hp-title">PADQ</h1>
          <p className="hp-tagline">Paddle Queue</p>
        </div>

        {/* ── Description ── */}
        <p className="hp-desc">
          Organise singles or doubles matches with a smart, fair queue system.
          Track win streaks, rank tiers, and player stats — all in one place.
        </p>

        {/* ── Mode cards ── */}
        <div className="hp-cards">
          <button className="hp-card hp-card--singles" onClick={() => go('singles')}>
            <span className="hp-card-icon"><Swords size={34} strokeWidth={1.7} /></span>
            <span className="hp-card-body">
              <span className="hp-card-title">Singles</span>
              <span className="hp-card-sub">1v1 head‑to‑head</span>
            </span>
            <ChevronRight size={18} className="hp-card-chevron" />
          </button>

          <button className="hp-card hp-card--doubles" onClick={() => go('doubles')}>
            <span className="hp-card-icon"><Users size={34} strokeWidth={1.7} /></span>
            <span className="hp-card-body">
              <span className="hp-card-title">Doubles</span>
              <span className="hp-card-sub">2v2 team battles</span>
            </span>
            <ChevronRight size={18} className="hp-card-chevron" />
          </button>
        </div>

        {/* ── Feature pills ── */}
        <div className="hp-pills">
          {[
            { icon: <Zap size={11} />,    label: 'Smart Queue'      },
            { icon: null,                  label: '🔥 Win Streaks'  },
            { icon: <Shield size={11} />, label: 'Rank Tiers'       },
            { icon: <Star size={11} />,   label: 'Player Stats'     },
            { icon: null,                  label: '🏆 Tournaments'  },
          ].map(({ icon, label }) => (
            <span key={label} className="hp-pill">
              {icon}{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}