import type { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyControls } from './PrivacyControls';
import './privacy.css';

export const metadata: Metadata = {
  title: 'Privacy & Data Retention',
  description: 'How PADQ stores, shares, and deletes event and player data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-shell">
        <Link className="privacy-back" href="/">← Back to PADQ</Link>
        <h1>Privacy &amp; Data Retention</h1>
        <p className="privacy-lead">PADQ V1 is a free, online-first court queue. This page explains what it stores and what a host or player can delete.</p>

        <section className="privacy-card">
          <h2>Event data in Firebase</h2>
          <p>A live room contains player-entered names, queue order, court assignments, scores, match history, and calculated performance. Anyone with the six-character room code may view that event while it is live.</p>
          <p>The anonymous host account owns the event. The host can permanently remove the room and its match history with <strong>End &amp; Delete Event</strong>. Leaving the page does not delete the event.</p>
        </section>

        <section className="privacy-card">
          <h2>Retention and free-tier limits</h2>
          <p>PADQ does not promise automatic expiry in V1. Hosts should delete completed or abandoned events. Firebase Spark and Vercel Hobby have capped free allowances; if a quota is exhausted, live updates may stop until service is available again.</p>
        </section>

        <section className="privacy-card">
          <h2>Accounts and tracking</h2>
          <p>PADQ uses Firebase Anonymous Authentication to protect host actions. V1 does not ask for an email address, phone number, payment information, or advertising profile. Operational providers may still process connection information needed to deliver the site and Firebase service.</p>
        </section>

        <PrivacyControls />

        <section className="privacy-card">
          <h2>Questions or deletion problems</h2>
          <p>If event deletion fails, stop using the room and report it through the <a href="https://github.com/Sceyo/PadQ/issues" target="_blank" rel="noreferrer">PADQ public issue tracker</a> before sharing the room again. Do not include private player information in a report.</p>
        </section>
      </div>
    </main>
  );
}
