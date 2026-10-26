'use client';

import React, { useEffect, useRef, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  type?: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
  undoAction?: () => void;
  undoLabel?: string;
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const remainingTimeRef = useRef(toast.duration ?? 4000);
  const startTimeRef = useRef(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, remainingTimeRef.current);
  }, [onDismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      remainingTimeRef.current -= Date.now() - startTimeRef.current;
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success' || !toast.type;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onTouchStart={pauseTimer}
      onTouchEnd={startTimer}
      style={{
        pointerEvents: 'auto',
        background: isError ? 'var(--status-danger, #ef4444)' : 'var(--surface-elevated, #1a2035)',
        color: isError ? '#ffffff' : 'var(--text-primary, #f8fafc)',
        border: isError ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--line-subtle, #252d47)',
        borderRadius: 'var(--r-pill, 9999px)',
        padding: '10px 18px',
        boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.45))',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: 'var(--fs-sm, 0.9375rem)',
        fontWeight: 600,
        maxWidth: '100%',
        minHeight: '44px',
        boxSizing: 'border-box',
      }}
    >
      {isSuccess && <span style={{ color: 'var(--status-success, #22c55e)' }}>●</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {toast.message}
      </span>
      {toast.undoAction && (
        <button
          type="button"
          onClick={() => {
            toast.undoAction?.();
            onDismiss();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            borderRadius: 'var(--r-pill, 9999px)',
            color: 'inherit',
            fontSize: 'var(--fs-xs, 0.8125rem)',
            fontWeight: 700,
            padding: '4px 10px',
            cursor: 'pointer',
            minHeight: '32px',
            lineHeight: 1,
          }}
        >
          {toast.undoLabel ?? 'Undo'}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          opacity: 0.7,
          cursor: 'pointer',
          padding: '4px',
          fontSize: '1.1rem',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '24px',
          minHeight: '24px',
        }}
      >
        ×
      </button>
    </div>
  );
}
