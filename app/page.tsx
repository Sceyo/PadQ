'use client';

/**
 * PADQ — Homepage
 * ─────────────────────────────────────────────────────────
 * • Singles / Doubles / Watch mode cards
 * • Watch button → modal with QR camera scan OR manual code
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Swords, Users, ChevronRight,
  Zap, Shield, Star, Eye, Camera, Hash,
  X, ArrowRight, Loader2,
} from 'lucide-react';
import { loadSession } from '@/lib/sessionService';
import './Homepage.css';

// ── Watch Modal ──────────────────────────────────────────

type WatchTab = 'scan' | 'code';

const WatchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const router                = useRouter();
  const [tab, setTab]         = useState<WatchTab>('scan');
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const videoRef          = useRef<HTMLVideoElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const scanIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        startQrScanning();
      }
    } catch {
      setCameraError('Camera access denied or unavailable. Use the code tab instead.');
    }
  };

  const startQrScanning = () => {
    if (!('BarcodeDetector' in window)) {
      setCameraError('QR scanning not supported in this browser. Use the code tab or scan with your phone camera app.');
      return;
    }
    // @ts-ignore
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !cameraReady) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue as string;
          const match = raw.match(/([A-Z0-9]{4,6})$/);
          if (match) { stopCamera(); handleJoin(match[1]); }
        }
      } catch { /* frame error — ignore */ }
    }, 500);
  };

  useEffect(() => {
    if (tab === 'scan') startCamera(); else stopCamera();
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { stopCamera(); onClose(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleJoin = async (rawCode?: string) => {
    const roomCode = (rawCode ?? code).trim().toUpperCase();
    if (!roomCode) { setError('Enter a room code'); return; }
    if (roomCode.length < 4) { setError('Room codes are at least 4 characters'); return; }
    setLoading(true); setError('');
    try {
      const sess = await loadSession(roomCode);
      if (!sess) { setError('Session not found. Check the code and try again.'); setLoading(false); return; }
      router.push(`/watch/${roomCode}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="watch-overlay" onClick={e => { if (e.target === e.currentTarget) { stopCamera(); onClose(); } }}>
      <div className="watch-modal">
        <div className="watch-modal-header">
          <div className="watch-modal-title"><Eye size={18} /> Watch a Session</div>
          <button className="watch-modal-close" onClick={() => { stopCamera(); onClose(); }}><X size={18} /></button>
        </div>
        <div className="watch-tabs">
          <button className={`watch-tab ${tab === 'scan' ? 'active' : ''}`} onClick={() => setTab('scan')}><Camera size={14} /> Scan QR</button>
          <button className={`watch-tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}><Hash size={14} /> Enter Code</button>
        </div>

        {tab === 'scan' && (
          <div className="watch-scan-area">
            {cameraError ? (
              <div className="watch-camera-error">
                <Camera size={32} className="watch-camera-error-icon" />
                <p>{cameraError}</p>
                <button className="watch-tab-switch-btn" onClick={() => setTab('code')}><Hash size={13} /> Enter code instead</button>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="watch-video" playsInline muted aria-label="QR code scanner" />
                <div className="watch-scan-frame">
                  <span className="scan-corner scan-corner--tl" /><span className="scan-corner scan-corner--tr" />
                  <span className="scan-corner scan-corner--bl" /><span className="scan-corner scan-corner--br" />
                  <div className="scan-line" />
                </div>
                <p className="watch-scan-hint">{cameraReady ? 'Point at a PADQ QR code' : 'Starting camera…'}</p>
              </>
            )}
          </div>
        )}

        {tab === 'code' && (
          <div className="watch-code-area">
            <p className="watch-code-hint">Ask the host for their 4-letter room code</p>
            <div className="watch-code-input-row">
              <input className="watch-code-input" value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                placeholder="e.g. AB3X" maxLength={6}
                onKeyDown={e => e.key === 'Enter' && handleJoin()} autoFocus />
              <button className="watch-join-btn" onClick={() => handleJoin()} disabled={loading || !code.trim()}>
                {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
              </button>
            </div>
            {error && <p className="watch-error">{error}</p>}
          </div>
        )}

        <p className="watch-footer">Viewers see the queue live but cannot make changes.</p>
      </div>
    </div>
  );
};

// ── Homepage ─────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [showWatch, setShowWatch] = useState(false);
  const go = (mode: 'singles' | 'doubles') => router.push(`/queue?mode=${mode}`);

  return (
    <div className="homepage">
      <span className="hp-orb hp-orb--1" />
      <span className="hp-orb hp-orb--2" />
      <span className="hp-orb hp-orb--3" />

      <div className="hp-inner">
        {/* Logo */}
        <div className="hp-brand">
          <Image
            src="/PADQ.png"
            alt="PADQ"
            width={320}
            height={320}
            loading="eager"
            priority
            className="hp-logo-img"
            style={{ width: '100%', height: 'auto', maxWidth: '320px' }}
          />
        </div>

        {/* Description */}
        <p className="hp-desc">
          Organise singles or doubles matches with a smart, fair queue system.
          Track win streaks, rank tiers, and player stats — all in one place.
        </p>

        {/* Mode cards */}
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

          <button className="hp-card hp-card--watch" onClick={() => setShowWatch(true)}>
            <span className="hp-card-icon"><Eye size={34} strokeWidth={1.7} /></span>
            <span className="hp-card-body">
              <span className="hp-card-title">Watch</span>
              <span className="hp-card-sub">Follow a live session</span>
            </span>
            <ChevronRight size={18} className="hp-card-chevron" />
          </button>
        </div>

        {/* Feature pills */}
        <div className="hp-pills">
          {[
            { icon: <Zap size={11} />,    label: 'Smart Queue'   },
            { icon: null,                  label: '🔥 Win Streaks' },
            { icon: <Shield size={11} />, label: 'Rank Tiers'    },
            { icon: <Star size={11} />,   label: 'Player Stats'  },
            { icon: null,                  label: '🏆 Tournaments' },
            { icon: <Eye size={11} />,    label: 'Live Watch'    },
          ].map(({ icon, label }) => (
            <span key={label} className="hp-pill">{icon}{label}</span>
          ))}
        </div>
      </div>

      {showWatch && <WatchModal onClose={() => setShowWatch(false)} />}
    </div>
  );
}