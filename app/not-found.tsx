import Link from 'next/link';

export default function NotFound() {
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
        Page not found
      </h1>
      <p style={{ color: '#555', maxWidth: '34ch', margin: 0 }}>
        This page doesn&apos;t exist. If you were watching a live session, the
        host may have ended it.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.5rem 1.25rem',
          borderRadius: '0.375rem',
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontWeight: 600,
          textDecoration: 'none',
          fontSize: '0.9rem',
        }}
      >
        Go home
      </Link>
    </main>
  );
}
