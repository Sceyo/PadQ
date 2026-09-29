'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  subscribeAuthResilience,
  clearStaleFirebaseAuth,
  type AuthResilienceState,
} from '@/lib/authResilience';
import './AuthResilienceBanner.css';

export function AuthResilienceBanner() {
  const [resilienceState, setResilienceState] = useState<AuthResilienceState>({
    isFatal: false,
    message: '',
    isRecovering: false,
    canRetrySilently: true,
  });
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    return subscribeAuthResilience((newState) => {
      setResilienceState(newState);
    });
  }, []);

  const handleRefresh = async () => {
    setIsReloading(true);
    try {
      await clearStaleFirebaseAuth();
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (!resilienceState.isFatal && !resilienceState.isRecovering) {
    return null;
  }

  return (
    <div
      className="auth-resilience-overlay"
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="auth-resilience-title"
      aria-describedby="auth-resilience-desc"
    >
      <div className="auth-resilience-card">
        <div className="auth-resilience-icon-wrap">
          {resilienceState.isRecovering ? (
            <RefreshCw size={26} className="auth-resilience-spin" />
          ) : (
            <AlertTriangle size={26} className="auth-resilience-alert-icon" />
          )}
        </div>

        <div className="auth-resilience-content">
          <h2 id="auth-resilience-title" className="auth-resilience-title">
            {resilienceState.isRecovering
              ? 'Reconnecting session…'
              : 'Your session needs to refresh — tap to continue'}
          </h2>
          <p id="auth-resilience-desc" className="auth-resilience-desc">
            {resilienceState.isRecovering
              ? 'Attempting silent re-authentication with Firebase…'
              : 'A connection token expired or encountered an unexpected state. Your queue and score data are preserved.'}
          </p>
        </div>

        {!resilienceState.isRecovering && (
          <button
            type="button"
            className="auth-resilience-btn"
            onClick={handleRefresh}
            disabled={isReloading}
            autoFocus
          >
            {isReloading ? (
              <>
                <RefreshCw size={15} className="auth-resilience-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Refresh Session
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
