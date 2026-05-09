'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, X, Copy, ExternalLink, Check } from 'lucide-react';

export const ShareButton: React.FC<{
  sessionId: string;
  isLive:    boolean;
  onToggle:  (live: boolean) => void;
}> = ({ sessionId, isLive, onToggle }) => {
  const [open,        setOpen]       = useState(false);
  const [tab,         setTab]        = useState<'share' | 'code' | 'qr'>('share');
  const [copied,      setCopied]     = useState(false);
  const [justShared,  setJustShared] = useState(false);
  const [watchUrl,    setWatchUrl]   = useState(`/watch/${sessionId}`);

  useEffect(() => { setWatchUrl(`${window.location.origin}/watch/${sessionId}`); }, [sessionId]);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleGoLive = () => { const next = !isLive; onToggle(next); if (next) setOpen(true); };
  const copyLink = () => { navigator.clipboard.writeText(watchUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: `PADQ — Watch Session ${sessionId}`, text: `Watch this live session! Room code: ${sessionId}`, url: watchUrl });
      setJustShared(true); setTimeout(() => setJustShared(false), 2000);
    } catch { /* cancelled */ }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.share-popover-wrap')) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="share-popover-wrap">
      <button
        className={`share-trigger ${isLive ? 'share-trigger--is-live' : 'share-trigger--offline'} ${open && isLive ? 'share-trigger--active' : ''}`}
        onClick={isLive ? () => setOpen(o => !o) : handleGoLive}
        title={isLive ? 'Session is live — click to manage sharing' : 'Go live so viewers can join'}
      >
        {isLive ? <><span className="go-live-dot" /> LIVE</> : <><QrCode size={13} /> Go Live</>}
      </button>

      {open && isLive && (
        <div className="share-popover">
          <div className="share-popover-header">
            <span className="share-popover-title"><span className="go-live-dot go-live-dot--sm" /> Session Live</span>
            <button className="share-popover-close" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>
          <div className="share-code-hero">
            <span className="share-code-label">Room Code</span>
            <span className="share-code-big">{sessionId}</span>
          </div>
          <div className="share-tabs">
            {canNativeShare && <button className={`share-tab ${tab === 'share' ? 'active' : ''}`} onClick={() => setTab('share')}>Share</button>}
            <button className={`share-tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>Link</button>
            <button className={`share-tab ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')}>QR</button>
          </div>
          {tab === 'share' && canNativeShare && (
            <div className="share-code-view">
              <p className="share-hint">Send via WhatsApp, SMS, or any app</p>
              <button className={`share-native-btn ${justShared ? 'share-native-btn--done' : ''}`} onClick={nativeShare}>
                {justShared ? <><Check size={15} /> Shared!</> : <><ExternalLink size={15} /> Share Link</>}
              </button>
              <p className="share-hint share-hint--sm">Viewers open the link → watch live</p>
            </div>
          )}
          {tab === 'code' && (
            <div className="share-code-view">
              <p className="share-hint">Copy the full watch link</p>
              <div className="share-url-row"><span className="share-url-text">{watchUrl}</span></div>
              <div className="share-actions">
                <button className="share-action share-action--copy" onClick={copyLink}>{copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}</button>
                <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="share-action share-action--open"><ExternalLink size={13} /> Open</a>
              </div>
            </div>
          )}
          {tab === 'qr' && (
            <div className="share-qr-view">
              <div className="share-qr-wrap"><QRCodeSVG value={watchUrl} size={180} bgColor="#ffffff" fgColor="#1e293b" level="M" includeMargin={false} /></div>
              <p className="share-hint share-hint--sm">Scan to open the watch page instantly</p>
            </div>
          )}
          <div className="share-end-row">
            <button className="share-end-btn" onClick={() => { onToggle(false); setOpen(false); }}>End Live Session</button>
          </div>
        </div>
      )}
    </div>
  );
};
