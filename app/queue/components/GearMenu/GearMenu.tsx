'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, RotateCcw, HelpCircle, Copy, Check,
  QrCode, LayoutGrid, Undo2, KeyRound, LogIn,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export interface GearMenuProps {
  sessionId:          string | null;
  isHost:             boolean;
  isLive:             boolean;
  canControl:         boolean;
  onToggleLive:       (live: boolean) => void;
  onHardReset:        () => void;
  onShowGuide:        () => void;
  hasMultipleCourts?: boolean;
  onShowCoordinator?: () => void;
  canUndo?:           boolean;
  onUndo?:            () => void;
  onRecoverHost?:     (token: string) => Promise<boolean>;
}

export function GearMenu({
  sessionId, isHost, isLive, canControl,
  onToggleLive, onHardReset, onShowGuide,
  hasMultipleCourts, onShowCoordinator,
  canUndo, onUndo,
  onRecoverHost,
}: GearMenuProps) {
  const [open,          setOpen]          = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [shareTab,      setShareTab]      = useState<'link' | 'qr'>('link');
  const [watchUrl,      setWatchUrl]      = useState('');
  const [showRecovery,  setShowRecovery]  = useState(false);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recovering,    setRecovering]    = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) setWatchUrl(`${window.location.origin}/watch/${sessionId}`);
  }, [sessionId]);

  useEffect(() => {
    if (!open) { setShowRecovery(false); setRecoveryToken(''); setRecoveryError(''); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown',   onKey);
    };
  }, [open]);

  const copyLink = () => {
    navigator.clipboard.writeText(watchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRecover = async () => {
    if (!onRecoverHost || !recoveryToken.trim()) return;
    setRecovering(true);
    setRecoveryError('');
    const ok = await onRecoverHost(recoveryToken.trim());
    if (!ok) {
      setRecoveryError('Invalid session key. Check and try again.');
      setRecovering(false);
    }
    // If ok === true, page.tsx triggers a reload — no need to reset state
  };

  const showLiveSection  = isHost && !!sessionId;
  const showRecoverEntry = !isHost && !!sessionId && !!onRecoverHost;

  return (
    <div className="gear-menu-wrap" ref={menuRef}>
      <button
        className={`gear-menu-trigger ${open ? 'gear-menu-trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Settings"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Settings size={17} />
      </button>

      {open && (
        <div className="gear-menu-panel" role="menu">
          {showLiveSection && (
            <div className="gear-section--live">
              <div className="gear-live-row">
                <span className="gear-live-label">
                  {isLive && <span className="go-live-dot go-live-dot--sm" />}
                  {isLive ? 'Live' : 'Go Live'}
                </span>
                <button
                  className={`gear-live-btn ${isLive ? 'gear-live-btn--on' : 'gear-live-btn--off'}`}
                  onClick={() => onToggleLive(!isLive)}
                >
                  {isLive ? 'End' : 'Start'}
                </button>
              </div>

              {isLive && (
                <div className="gear-share-panel">
                  <div className="gear-room-code-row">
                    <span className="gear-room-label">Room</span>
                    <span className="gear-room-code">{sessionId}</span>
                  </div>
                  <div className="gear-share-tabs">
                    <button
                      className={`gear-share-tab ${shareTab === 'link' ? 'active' : ''}`}
                      onClick={() => setShareTab('link')}
                    >
                      <Copy size={11} /> Link
                    </button>
                    <button
                      className={`gear-share-tab ${shareTab === 'qr' ? 'active' : ''}`}
                      onClick={() => setShareTab('qr')}
                    >
                      <QrCode size={11} /> QR
                    </button>
                  </div>
                  {shareTab === 'link' && (
                    <button className="gear-copy-btn" onClick={copyLink}>
                      {copied
                        ? <><Check size={13} /> Copied!</>
                        : <><Copy size={13} /> Copy Watch Link</>}
                    </button>
                  )}
                  {shareTab === 'qr' && watchUrl && (
                    <div className="gear-qr-wrap">
                      <QRCodeSVG
                        value={watchUrl}
                        size={150}
                        bgColor="#ffffff"
                        fgColor="#1e293b"
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="gear-divider" />

          {isHost && hasMultipleCourts && onShowCoordinator && (
            <button
              className="gear-menu-item"
              role="menuitem"
              onClick={() => { setOpen(false); onShowCoordinator(); }}
            >
              <LayoutGrid size={14} /> All Courts
            </button>
          )}

          {canUndo && onUndo && (
            <button
              className="gear-menu-item"
              role="menuitem"
              onClick={() => { setOpen(false); onUndo(); }}
            >
              <Undo2 size={14} /> Undo Last Match
            </button>
          )}

          {/* ── Viewer host-recovery section ─────────────────── */}
          {showRecoverEntry && (
            <>
              {!showRecovery ? (
                <button
                  className="gear-menu-item"
                  role="menuitem"
                  onClick={() => setShowRecovery(true)}
                >
                  <KeyRound size={14} /> Recover as Host
                </button>
              ) : (
                <div className="gear-recovery-form">
                  <p className="gear-recovery-label">
                    <KeyRound size={12} /> Enter your session key
                  </p>
                  <input
                    className="gear-recovery-input"
                    type="text"
                    placeholder="Paste session key…"
                    value={recoveryToken}
                    onChange={e => setRecoveryToken(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRecover(); }}
                    autoFocus
                  />
                  {recoveryError && (
                    <p className="gear-recovery-error">{recoveryError}</p>
                  )}
                  <div className="gear-recovery-actions">
                    <button
                      className="gear-recovery-submit"
                      onClick={handleRecover}
                      disabled={recovering || !recoveryToken.trim()}
                    >
                      <LogIn size={13} /> {recovering ? 'Checking…' : 'Recover'}
                    </button>
                    <button
                      className="gear-recovery-cancel"
                      onClick={() => { setShowRecovery(false); setRecoveryToken(''); setRecoveryError(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {canControl && (
            <button
              className="gear-menu-item gear-menu-item--danger"
              role="menuitem"
              onClick={() => { setOpen(false); onHardReset(); }}
            >
              <RotateCcw size={14} /> Hard Reset
            </button>
          )}

          <button
            className="gear-menu-item"
            role="menuitem"
            onClick={() => { setOpen(false); onShowGuide(); }}
          >
            <HelpCircle size={14} /> User Guide
          </button>
        </div>
      )}
    </div>
  );
}
