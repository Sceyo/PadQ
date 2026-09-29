'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { toBlob, toPng } from 'html-to-image';
import { X, Share2, Download, Copy, Check, Loader2, Crown, ListFilter } from 'lucide-react';
import type { PlayerStat, MatchHistoryEntry } from '../../lib/types';
import { RecapCard } from './RecapCard';
import './RecapModal.css';

export interface RecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStat[];
  history: MatchHistoryEntry[];
  roomCode?: string | null;
  mode?: string;
  defaultVariant?: 'host' | 'viewer';
}

export const RecapModal: React.FC<RecapModalProps> = ({
  isOpen,
  onClose,
  stats,
  history,
  roomCode,
  mode = 'Doubles',
  defaultVariant = 'host',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState<'host' | 'viewer'>(defaultVariant);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Sync defaultVariant if prop changes
  useEffect(() => {
    setVariant(defaultVariant);
  }, [defaultVariant]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const getFileName = useCallback(() => {
    const codePart = roomCode ? `-${roomCode.toUpperCase()}` : '';
    const variantPart = variant === 'host' ? '-podium' : '-standings';
    const dateStr = new Date().toISOString().slice(0, 10);
    return `padq-session${codePart}${variantPart}-${dateStr}.png`;
  }, [roomCode, variant]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || isGenerating) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 1,
        quality: 0.95,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = getFileName();
      link.href = dataUrl;
      link.click();
      showToast('Image downloaded!');
    } catch (err) {
      console.error('Download failed:', err);
      showToast('Could not generate image.');
    } finally {
      setIsGenerating(false);
    }
  }, [getFileName, isGenerating]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current || isGenerating) return;
    setIsGenerating(true);
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 1,
        quality: 0.95,
        cacheBust: true,
      });
      if (!blob) throw new Error('Blob generation failed');

      const fileName = getFileName();
      const file = new File([blob], fileName, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'PADQ Session Recap',
          text: `Check out our court session recap on PADQ! ${roomCode ? `Room ${roomCode}` : ''}`,
        });
        showToast('Shared successfully!');
      } else {
        // Fallback: trigger direct download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Downloaded image (sharing not supported on this device).');
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Share failed:', err);
        showToast('Could not share image.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [getFileName, isGenerating, roomCode]);

  const handleCopy = useCallback(async () => {
    if (!cardRef.current || isGenerating) return;
    setIsGenerating(true);
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 1,
        quality: 0.95,
        cacheBust: true,
      });
      if (!blob) throw new Error('Blob generation failed');

      if (typeof navigator !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopied(true);
        showToast('Image copied to clipboard!');
        setTimeout(() => setCopied(false), 2500);
      } else {
        showToast('Copying images is not supported in this browser.');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      showToast('Could not copy image.');
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating]);

  if (!isOpen) return null;

  return (
    <div
      className="recap-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recap-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="recap-modal-dialog">
        {/* Modal Header */}
        <div className="recap-modal-header">
          <div className="recap-modal-title-group">
            <h2 id="recap-modal-title" className="recap-modal-title">
              Shareable Session Recap
            </h2>
            <span className="recap-modal-subtitle">1080×1080 Instagram &amp; Social Square</span>
          </div>

          {/* Variant Switcher */}
          <div className="recap-variant-toggle" role="group" aria-label="Recap card format">
            <button
              type="button"
              className={`recap-variant-btn ${variant === 'host' ? 'active' : ''}`}
              onClick={() => setVariant('host')}
            >
              <Crown size={14} /> Podium Edition
            </button>
            <button
              type="button"
              className={`recap-variant-btn ${variant === 'viewer' ? 'active' : ''}`}
              onClick={() => setVariant('viewer')}
            >
              <ListFilter size={14} /> Full Standings
            </button>
          </div>

          <button
            type="button"
            className="recap-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Scaled Preview Canvas */}
        <div className="recap-preview-viewport">
          <div className="recap-preview-scaler">
            <RecapCard
              stats={stats}
              history={history}
              roomCode={roomCode}
              mode={mode}
              variant={variant}
            />
          </div>
        </div>

        {/* Off-screen unscaled 1080x1080 container for high-DPI rasterization */}
        <div className="recap-capture-container" aria-hidden="true">
          <RecapCard
            ref={cardRef}
            stats={stats}
            history={history}
            roomCode={roomCode}
            mode={mode}
            variant={variant}
          />
        </div>

        {/* Feedback notification toast */}
        {feedbackMsg && (
          <div className="recap-toast" role="status">
            {feedbackMsg}
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="recap-modal-footer">
          <button
            type="button"
            className="recap-action-btn recap-action-btn--primary"
            onClick={handleShare}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={16} className="recap-spin" /> : <Share2 size={16} />}
            <span>Share Image</span>
          </button>

          <button
            type="button"
            className="recap-action-btn recap-action-btn--secondary"
            onClick={handleDownload}
            disabled={isGenerating}
          >
            <Download size={16} />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            className="recap-action-btn recap-action-btn--secondary"
            onClick={handleCopy}
            disabled={isGenerating}
          >
            {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
