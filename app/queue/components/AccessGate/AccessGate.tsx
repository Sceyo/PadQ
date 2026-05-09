'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useSessionAccess } from '@/hooks/useSessionAccess';
import AccessCodeModal from '../atoms/AccessCodeModal';

interface Props {
  sessionId: string;
  children: React.ReactNode;
}

/**
 * AccessGate — wraps watch-page content behind the PIN check.
 *
 * Renders children once access is granted. Shows a loading
 * spinner while checking, a PIN modal if one is required, or
 * null on error (the parent page handles its own error state).
 */
export default function AccessGate({ sessionId, children }: Props) {
  const { access, submitPin } = useSessionAccess(sessionId);

  if (access === 'checking') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12, color: '#9ca3af' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '0.85rem' }}>Checking access…</p>
      </div>
    );
  }

  if (access === 'needs-pin') {
    return (
      <AccessCodeModal
        open={true}
        label="This session is PIN-protected"
        placeholder="Enter 4-digit PIN"
        maxLength={4}
        onSubmit={async (pin) => {
          const ok = await submitPin(pin);
          if (!ok) throw new Error('Incorrect PIN. Please try again.');
        }}
        onClose={() => {/* PIN is mandatory — no dismiss */}}
      />
    );
  }

  // 'granted' or 'error' — for 'error', let the parent page handle it
  return <>{children}</>;
}
