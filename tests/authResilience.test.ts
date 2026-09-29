// @vitest-environment jsdom
// tests/authResilience.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isAuthOrFirestoreFatalError,
  triggerFatalAuthError,
  subscribeAuthResilience,
  getAuthResilienceState,
  clearStaleFirebaseAuth,
  setupGlobalAuthResilience,
} from '../lib/authResilience';

describe('authResilience', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('isAuthOrFirestoreFatalError', () => {
    it('detects auth/invalid-refresh-token', () => {
      expect(isAuthOrFirestoreFatalError({ code: 'auth/invalid-refresh-token' })).toBe(true);
      expect(isAuthOrFirestoreFatalError(new Error('FirebaseError: auth/invalid-refresh-token'))).toBe(true);
    });

    it('detects FIRESTORE INTERNAL ASSERTION FAILED with auth context', () => {
      const err = new Error(
        'FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: 3c6b) CONTEXT: {"code":"auth/invalid-refresh-token"}'
      );
      expect(isAuthOrFirestoreFatalError(err)).toBe(true);
    });

    it('detects other unrecoverable auth error codes', () => {
      expect(isAuthOrFirestoreFatalError({ code: 'auth/user-token-expired' })).toBe(true);
      expect(isAuthOrFirestoreFatalError({ code: 'auth/user-disabled' })).toBe(true);
      expect(isAuthOrFirestoreFatalError({ code: 'auth/user-not-found' })).toBe(true);
    });

    it('ignores non-fatal or operational errors', () => {
      expect(isAuthOrFirestoreFatalError(new Error('permission-denied'))).toBe(false);
      expect(isAuthOrFirestoreFatalError({ code: 'failed-precondition' })).toBe(false);
      expect(isAuthOrFirestoreFatalError(new Error('network-error'))).toBe(false);
      expect(isAuthOrFirestoreFatalError(null)).toBe(false);
      expect(isAuthOrFirestoreFatalError(undefined)).toBe(false);
    });
  });

  describe('triggerFatalAuthError & subscribeAuthResilience', () => {
    it('transitions to isFatal=true on Firestore assertion failure without looping', () => {
      const states: boolean[] = [];
      const unsub = subscribeAuthResilience((s) => {
        states.push(s.isFatal);
      });

      triggerFatalAuthError(
        new Error('FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: 3c6b)')
      );

      const latest = getAuthResilienceState();
      expect(latest.isFatal).toBe(true);
      expect(latest.message).toBe('Your session needs to refresh — tap to continue.');
      expect(latest.canRetrySilently).toBe(false);

      unsub();
    });
  });

  describe('clearStaleFirebaseAuth', () => {
    it('removes firebase:authUser keys from localStorage while preserving padq keys', async () => {
      localStorage.setItem('firebase:authUser:testApiKey:[DEFAULT]', JSON.stringify({ uid: 'old-uid' }));
      localStorage.setItem('padq_session_id', 'ROOM123');
      localStorage.setItem('padq_game_mode', 'doubles');

      await clearStaleFirebaseAuth();

      expect(localStorage.getItem('firebase:authUser:testApiKey:[DEFAULT]')).toBeNull();
      expect(localStorage.getItem('padq_session_id')).toBe('ROOM123');
      expect(localStorage.getItem('padq_game_mode')).toBe('doubles');
    });
  });

  describe('setupGlobalAuthResilience', () => {
    it('catches unhandledrejection with fatal error and triggers fatal state', () => {
      const teardown = setupGlobalAuthResilience();

      const fatalErr = new Error('FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: 3c6b)');
      const event = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(event, 'reason', { value: fatalErr });
      let prevented = false;
      event.preventDefault = () => { prevented = true; };

      window.dispatchEvent(event);

      const state = getAuthResilienceState();
      expect(state.isFatal).toBe(true);
      expect(prevented).toBe(true);

      teardown();
    });
  });
});
