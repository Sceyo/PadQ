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
import Link from 'next/link';
import {
  Swords, Users, ChevronRight,
  Zap, Shield, Star, Eye, Camera, Hash,
  X, ArrowRight, Loader2,
} from 'lucide-react';
import { loadSession } from '@/lib/sessionService';
import { ROOM_CODE_LENGTH } from '@/lib/roomCode';
import './Homepage.css';

// ── Watch Modal ──────────────────────────────────────────

type WatchTab = 'scan' | 'code';

const WatchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const router                = useRouter();
  const [tab, setTab]         = useState<WatchTab>('code');
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const videoRef          = useRef<HTMLVideoElement>(null);
  const modalRef          = useRef<HTMLDivElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const scanIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraReadyRef    = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    cameraReadyRef.current = false;
    setCameraReady(false);
    setCameraStarted(false);
  };

  const startCamera = async () => {
    setCameraError('');
    if (!('BarcodeDetector' in window)) {
      setCameraError('QR scanning is not supported in this browser. Enter the room code or scan the host QR with your phone camera app.');
      return;
    }
    setCameraStarted(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        cameraReadyRef.current = true;
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
    // @ts-expect-error BarcodeDetector is not yet included in every TypeScript DOM lib.
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !cameraReadyRef.current) return;
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
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stopCamera(); onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      stopCamera();
      previouslyFocused?.focus();
    };
    // stopCamera intentionally belongs to this mounted dialog instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const handleJoin = async (rawCode?: string) => {
    const roomCode = (rawCode ?? code).trim().toUpperCase();
    if (!roomCode) { setError('Enter a room code'); return; }
    if (roomCode.length < 4 || roomCode.length > ROOM_CODE_LENGTH) { setError('Enter a valid room code'); return; }
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
      <div className="watch-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="watch-modal-title">
        <div className="watch-modal-header">
          <div className="watch-modal-title" id="watch-modal-title"><Eye size={18} /> Watch a Session</div>
          <button className="watch-modal-close" aria-label="Close watch dialog" onClick={() => { stopCamera(); onClose(); }}><X size={18} /></button>
        </div>
        <div className="watch-tabs">
          <button className={`watch-tab ${tab === 'scan' ? 'active' : ''}`} onClick={() => setTab('scan')} aria-pressed={tab === 'scan'}><Camera size={14} /> Scan QR</button>
          <button className={`watch-tab ${tab === 'code' ? 'active' : ''}`} onClick={() => { stopCamera(); setTab('code'); }} aria-pressed={tab === 'code'}><Hash size={14} /> Enter Code</button>
        </div>

        {tab === 'scan' && (
          <div className="watch-scan-area">
            {cameraError ? (
              <div className="watch-camera-error">
                <Camera size={32} className="watch-camera-error-icon" />
                <p>{cameraError}</p>
                <button className="watch-tab-switch-btn" onClick={() => setTab('code')}><Hash size={13} /> Enter code instead</button>
              </div>
            ) : !cameraStarted ? (
              <div className="watch-camera-consent">
                <Camera size={32} className="watch-camera-error-icon" />
                <p>PADQ will use your camera only while this scanner is open.</p>
                <button className="watch-camera-start-btn" onClick={() => void startCamera()}>
                  <Camera size={14} /> Start QR scanner
                </button>
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
            <p className="watch-code-hint">Ask the host for their 6-character room code</p>
            <div className="watch-code-input-row">
              <input className="watch-code-input" value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                placeholder="e.g. 7K3MQR" maxLength={ROOM_CODE_LENGTH}
                onKeyDown={e => e.key === 'Enter' && handleJoin()} autoFocus />
              <button className="watch-join-btn" aria-label="Join room" onClick={() => handleJoin()} disabled={loading || !code.trim()}>
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
            width={520}
            height={520}
            loading="eager"
            priority
            unoptimized
            className="hp-logo-img"
            style={{ width: "100%", height: "auto" }}
          />
        </div>

        <h1 className="hp-sr-only">PADQ fair live pickleball and padel queues</h1>

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
            { icon: null,                  label: '🏟️ Multi-Court' },
            { icon: <Eye size={11} />,    label: 'Live Watch'    },
          ].map(({ icon, label }) => (
            <span key={label} className="hp-pill">{icon}{label}</span>
          ))}
        </div>

        <div className="hp-footer-links">
          <Link href="/privacy">Privacy &amp; Data Retention</Link>
        </div>
      </div>

      {showWatch && <WatchModal onClose={() => setShowWatch(false)} />}
    </div>
  );
}
