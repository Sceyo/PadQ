'use client';

import React, { useEffect, useRef } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string; // e.g. 60dvh or 85dvh
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxHeight = '85dvh',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Body scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus into bottom sheet container
    sheetRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElement.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.75)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        zIndex: 'var(--z-dialog, 1100)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-describedby={description ? 'sheet-description' : undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-modal, #16192b)',
          borderTop: '1px solid var(--line-subtle, #252d47)',
          borderTopLeftRadius: 'var(--r-xl, 22px)',
          borderTopRightRadius: 'var(--r-xl, 22px)',
          boxShadow: 'var(--shadow-lg, 0 -8px 32px rgba(0,0,0,0.65))',
          width: '100%',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + 8px)',
        }}
      >
        {/* Drag handle visual affordance */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '8px',
            paddingBottom: '4px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--line-strong, #333d5e)',
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: '8px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--line-subtle, #252d47)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id="sheet-title"
              style={{
                margin: 0,
                fontSize: 'var(--fs-lg, 1.25rem)',
                fontWeight: 700,
                color: 'var(--text-primary, #f8fafc)',
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                id="sheet-description"
                style={{
                  margin: '4px 0 0',
                  fontSize: 'var(--fs-xs, 0.8125rem)',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sheet"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--r-sm, 10px)',
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--line-subtle, #252d47)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
