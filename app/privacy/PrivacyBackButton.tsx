'use client';

import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): string | null {
  if (typeof window === 'undefined') return null;

  const from = sessionStorage.getItem('padq_privacy_from');
  if (from) return from;

  if (document.referrer && document.referrer.startsWith(window.location.origin)) {
    try {
      const refUrl = new URL(document.referrer);
      return refUrl.pathname + refUrl.search;
    } catch {
      return null;
    }
  }

  return null;
}

function getServerSnapshot(): string | null {
  return null;
}

export function PrivacyBackButton() {
  const router = useRouter();
  const returnUrl = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const backText = returnUrl?.startsWith('/queue')
    ? '← Back to Queue'
    : returnUrl?.startsWith('/watch')
      ? '← Back to Watch'
      : '← Back to PADQ';

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('padq_privacy_from');

      const isExternalReferrer =
        Boolean(document.referrer && !document.referrer.startsWith(window.location.origin));

      if (window.history.length > 1 && !isExternalReferrer) {
        router.back();
        return;
      }
    }

    if (returnUrl) {
      router.push(returnUrl);
    } else {
      router.push('/');
    }
  };

  return (
    <button
      type="button"
      className="privacy-back"
      onClick={handleBack}
      aria-label={backText.replace('← ', '')}
    >
      {backText}
    </button>
  );
}
