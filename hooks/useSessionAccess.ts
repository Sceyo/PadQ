// hooks/useSessionAccess.ts
// ═══════════════════════════════════════════════════════════
// Viewer-side access control for the watch page.
//
// Access flow:
//  1. Load session once to check PIN requirement
//  2. If no PIN → 'granted'
//  3. If PIN set → check sessionStorage for a cached grant
//     (so the viewer doesn't re-enter PIN on every page refresh)
//  4. If no cached grant → 'needs-pin' (show modal)
//  5. submitPin() validates and caches the grant in sessionStorage
//
// Security note:
//  The PIN is stored in plain text in Firestore and compared client-side.
//  This is intentional for simplicity — sessions expire in 30 min,
//  Firestore rate-limits requests, and the room code itself is the
//  primary credential. The PIN is a secondary convenience gate.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { loadSession } from '@/lib/sessionService';

export type AccessState =
  | 'checking'   // initial load in progress
  | 'granted'    // viewer may see content
  | 'needs-pin'  // PIN required; show modal
  | 'error';     // session not found or invalid

const PIN_CACHE_KEY = (id: string) => `padq_pin_${id}`;

export function useSessionAccess(sessionId: string): {
  access: AccessState;
  submitPin: (pin: string) => Promise<boolean>;
} {
  const [access,   setAccess]   = useState<AccessState>('checking');
  const [pinHash,  setPinHash]  = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || sessionId.length < 4) {
      setAccess('error');
      return;
    }

    loadSession(sessionId).then(data => {
      if (!data) {
        setAccess('error');
        return;
      }

      if (!data.accessPin) {
        // Open session — no PIN gate
        setAccess('granted');
        return;
      }

      // PIN required — check for a cached sessionStorage grant
      const cached = sessionStorage.getItem(PIN_CACHE_KEY(sessionId));
      if (cached === data.accessPin) {
        setAccess('granted');
      } else {
        setPinHash(data.accessPin);
        setAccess('needs-pin');
      }
    }).catch(() => setAccess('error'));
  }, [sessionId]);

  const submitPin = async (pin: string): Promise<boolean> => {
    if (!pinHash) return true;
    const ok = pin.trim().toUpperCase() === pinHash.toUpperCase();
    if (ok) {
      sessionStorage.setItem(PIN_CACHE_KEY(sessionId), pinHash);
      setAccess('granted');
    }
    return ok;
  };

  return { access, submitPin };
}
