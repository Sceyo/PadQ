// lib/authResilience.ts
// ═══════════════════════════════════════════════════════════
// Global Auth & Firestore Resilience Manager
//
// Catches unrecoverable Firebase failures (e.g. auth/invalid-refresh-token,
// FIRESTORE INTERNAL ASSERTION FAILED) that bypass React error boundaries.
// Attempts silent recovery when possible, and falls back to a clear, actionable
// UI state ("Your session needs to refresh — tap to continue") with full page reload.
// ═══════════════════════════════════════════════════════════

import { getApps, getApp } from 'firebase/app';
import { getAuth, signOut, signInAnonymously, type Auth } from 'firebase/auth';

function getActiveAuth(): Auth | null {
  try {
    if (getApps().length > 0) {
      return getAuth(getApp());
    }
  } catch {
    /* ignore */
  }
  return null;
}

export interface AuthResilienceState {
  isFatal: boolean;
  message: string;
  isRecovering: boolean;
  canRetrySilently: boolean;
}

let currentState: AuthResilienceState = {
  isFatal: false,
  message: '',
  isRecovering: false,
  canRetrySilently: true,
};

const listeners = new Set<(state: AuthResilienceState) => void>();

function notifyListeners() {
  listeners.forEach(fn => {
    try { fn(currentState); } catch { /* ignore */ }
  });
}

/** Check if an error represents an unrecoverable Firebase Auth or Firestore assertion failure */
export function isAuthOrFirestoreFatalError(error: unknown): boolean {
  if (!error) return false;

  const msg = typeof error === 'string'
    ? error
    : (error as { message?: string })?.message || String(error);

  const code = (error as { code?: string })?.code || '';
  const contextStr = (error as { context?: unknown })?.context
    ? JSON.stringify((error as { context?: unknown }).context)
    : '';

  const combined = `${msg} ${code} ${contextStr}`.toLowerCase();

  // Known fatal auth error codes
  const fatalAuthCodes = [
    'auth/invalid-refresh-token',
    'auth/user-token-expired',
    'auth/user-disabled',
    'auth/user-not-found',
    'auth/invalid-user-token',
    'auth/token-expired',
  ];

  for (const c of fatalAuthCodes) {
    if (combined.includes(c)) return true;
  }

  // Firestore internal assertion failures (e.g. ID: 3c6b when token is rejected)
  if (
    combined.includes('internal assertion failed') ||
    combined.includes('unexpected state (id:') ||
    combined.includes('assertion failed')
  ) {
    return true;
  }

  return false;
}

let isSetup = false;

/** Remove stale Firebase Auth data from localStorage and IndexedDB so a reload starts clean */
export async function clearStaleFirebaseAuth(): Promise<void> {
  try {
    const auth = getActiveAuth();
    if (auth) {
      await signOut(auth).catch(() => {});
    }
  } catch {
    /* ignore */
  }

  if (typeof window === 'undefined') return;

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firebase:authUser')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore storage access errors */
  }

  try {
    if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    }
  } catch {
    /* ignore indexedDB access errors */
  }
}

let silentRecoveryInProgress = false;

/** Attempt silent recovery: sign out invalid session and re-authenticate anonymously */
export async function attemptSilentAuthRecovery(): Promise<boolean> {
  if (silentRecoveryInProgress) return false;
  silentRecoveryInProgress = true;

  currentState = {
    ...currentState,
    isRecovering: true,
  };
  notifyListeners();

  try {
    await clearStaleFirebaseAuth();
    const auth = getActiveAuth();
    if (!auth) {
      throw new Error('No active Firebase app');
    }
    const cred = await signInAnonymously(auth);
    silentRecoveryInProgress = false;

    if (cred.user) {
      currentState = {
        isFatal: false,
        message: '',
        isRecovering: false,
        canRetrySilently: true,
      };
      notifyListeners();
      return true;
    }
  } catch (err) {
    console.error('[authResilience] Silent auth recovery failed:', err);
  }

  silentRecoveryInProgress = false;
  currentState = {
    isFatal: true,
    message: 'Your session needs to refresh — tap to continue.',
    isRecovering: false,
    canRetrySilently: false,
  };
  notifyListeners();
  return false;
}

/** Trigger the visible unrecoverable error state and notify UI subscribers */
export function triggerFatalAuthError(error: unknown) {
  const isAssertion = typeof error === 'string'
    ? error.toLowerCase().includes('assertion failed')
    : (error as { message?: string })?.message?.toLowerCase().includes('assertion failed') ?? false;

  console.warn('[authResilience] Fatal Auth/Firestore error detected:', error);

  // If Firestore internal assertion failed, the Firestore stream is permanently wedged
  // and cannot resume in this window without a full page reload.
  if (isAssertion) {
    currentState = {
      isFatal: true,
      message: 'Your session needs to refresh — tap to continue.',
      isRecovering: false,
      canRetrySilently: false,
    };
    notifyListeners();
    // Pre-clean auth storage in background so the user's subsequent reload is clean
    void clearStaleFirebaseAuth();
    return;
  }

  // Otherwise, attempt one silent recovery
  void attemptSilentAuthRecovery().then(success => {
    if (!success) {
      currentState = {
        isFatal: true,
        message: 'Your session needs to refresh — tap to continue.',
        isRecovering: false,
        canRetrySilently: false,
      };
      notifyListeners();
    }
  });
}

/** Set up global window event listeners for unhandled rejections and errors */
export function setupGlobalAuthResilience(): () => void {
  if (typeof window === 'undefined' || isSetup) {
    return () => {};
  }
  isSetup = true;

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (isAuthOrFirestoreFatalError(reason)) {
      event.preventDefault(); // Prevent noisy uncaught rejection log
      triggerFatalAuthError(reason);
    }
  };

  const onError = (event: ErrorEvent) => {
    const err = event.error || event.message;
    if (isAuthOrFirestoreFatalError(err)) {
      triggerFatalAuthError(err);
    }
  };

  window.addEventListener('unhandledrejection', onUnhandledRejection);
  window.addEventListener('error', onError);

  return () => {
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    window.removeEventListener('error', onError);
    isSetup = false;
  };
}

export function subscribeAuthResilience(listener: (state: AuthResilienceState) => void): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthResilienceState(): AuthResilienceState {
  return currentState;
}
