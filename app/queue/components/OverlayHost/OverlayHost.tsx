'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Toast, type ToastMessage } from './Toast';
import { Dialog, type DialogProps } from './Dialog';
import { BottomSheet, type BottomSheetProps } from './BottomSheet';

interface OverlayContextType {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  openDialog: (props: Omit<DialogProps, 'isOpen' | 'onClose'>) => void;
  closeDialog: () => void;
  openSheet: (props: Omit<BottomSheetProps, 'isOpen' | 'onClose'>) => void;
  closeSheet: () => void;
}

const OverlayContext = createContext<OverlayContextType | null>(null);

export function useOverlay(): OverlayContextType {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error('useOverlay must be used within an OverlayHost');
  }
  return ctx;
}

export function OverlayHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeDialog, setActiveDialog] = useState<Omit<DialogProps, 'isOpen' | 'onClose'> | null>(null);
  const [activeSheet, setActiveSheet] = useState<Omit<BottomSheetProps, 'isOpen' | 'onClose'> | null>(null);
  const toastIdSeq = useRef(0);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${++toastIdSeq.current}`;
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const openDialog = useCallback((props: Omit<DialogProps, 'isOpen' | 'onClose'>) => {
    // Exactly one modal/sheet open at a time rule: close any active sheet
    setActiveSheet(null);
    setActiveDialog(props);
  }, []);

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
  }, []);

  const openSheet = useCallback((props: Omit<BottomSheetProps, 'isOpen' | 'onClose'>) => {
    // Exactly one modal/sheet open at a time rule: close any active dialog
    setActiveDialog(null);
    setActiveSheet(props);
  }, []);

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
  }, []);

  return (
    <OverlayContext.Provider value={{ showToast, openDialog, closeDialog, openSheet, closeSheet }}>
      {children}

      {/* Floating Top Toasts */}
      <div
        className="overlay-toast-container"
        style={{
          position: 'fixed',
          top: 'calc(var(--safe-top, 0px) + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 'var(--z-toast, 1200)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          maxWidth: '420px',
          padding: '0 16px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>

      {/* Centered Desktop/Tablet Dialog */}
      {activeDialog && (
        <Dialog
          isOpen={true}
          onClose={closeDialog}
          {...activeDialog}
        />
      )}

      {/* Bottom Sheet for Mobile */}
      {activeSheet && (
        <BottomSheet
          isOpen={true}
          onClose={closeSheet}
          {...activeSheet}
        />
      )}
    </OverlayContext.Provider>
  );
}
