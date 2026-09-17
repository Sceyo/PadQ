'use client'; // Error boundaries must be Client Components

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[PADQ] Unhandled render error:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
        Something went wrong
      </h1>
      <p style={{ color: '#555', maxWidth: '34ch', margin: 0 }}>
        An unexpected error occurred. Your data has not been lost — try
        refreshing or returning to the queue.
      </p>
      {error.digest && (
        <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0 }}>
          Error ID: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={retry}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            border: '1px solid #d1d5db',
            background: '#fff',
            color: '#374151',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
