'use client';

/**
 * components/SessionQR.tsx
 * ─────────────────────────────────────────────────────────
 * Renders a QR code for the current session's watch URL.
 * Used by the host inside SessionBar.
 *
 * INSTALL:  npm install qrcode.react
 *
 * The QR encodes:  https://yourdomain.com/watch/{sessionId}
 * Viewers scan it → land on /watch/[sessionId] directly.
 * ─────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, X, ExternalLink, Copy, Check } from 'lucide-react';

interface SessionQRProps {
  sessionId: string;
}

export function SessionQR({ sessionId }: SessionQRProps) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the full watch URL
  // Works in both localhost and production
  const watchUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/watch/${sessionId}`
    : `/watch/${sessionId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(watchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Trigger button — sits inside SessionBar */}
      <button
        className="sqr-trigger"
        onClick={() => setOpen(true)}
        title="Show QR code for viewers"
      >
        <QrCode size={13} /> QR
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="sqr-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="sqr-modal">
            {/* Header */}
            <div className="sqr-header">
              <span className="sqr-title"><QrCode size={16} /> Share Session</span>
              <button className="sqr-close" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* QR code */}
            <div className="sqr-qr-wrap">
              <QRCodeSVG
                value={watchUrl}
                size={220}
                bgColor="transparent"
                fgColor="#f0f4ff"
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Room code display */}
            <div className="sqr-room-code-wrap">
              <span className="sqr-room-label">Room Code</span>
              <span className="sqr-room-code">{sessionId}</span>
            </div>

            {/* Actions */}
            <div className="sqr-actions">
              <button className="sqr-action-btn sqr-copy" onClick={copyLink}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sqr-action-btn sqr-open"
              >
                <ExternalLink size={14} /> Open Watch Page
              </a>
            </div>

            <p className="sqr-hint">
              Viewers scan this QR or visit<br />
              <code className="sqr-url">/watch/{sessionId}</code>
            </p>
          </div>
        </div>
      )}
    </>
  );
}