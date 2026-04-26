'use client';

import { useCourt } from '../../context/CourtProvider';
import CourtView from '../CourtView'; // we'll create this as an aggregator
import styles from './CourtTabs.module.css';

export default function CourtTabs() {
  const { courts, activeCourtId, setActiveCourtId, addCourt } = useCourt();

  return (
    <div className={styles.container}>
      <nav className={styles.tabs} role="tablist">
        {courts.map((court) => (
          <button
            key={court.id}
            role="tab"
            aria-selected={court.id === activeCourtId}
            className={`${styles.tab} ${court.id === activeCourtId ? styles.active : ''}`}
            onClick={() => setActiveCourtId(court.id)}
          >
            {court.name}
          </button>
        ))}
        {courts.length < 4 && (
          <button className={styles.addBtn} onClick={() => addCourt(`Court ${courts.length + 1}`)}>
            + Add Court
          </button>
        )}
      </nav>
      <div className={styles.panel}>
        <CourtView courtId={activeCourtId} />
      </div>
    </div>
  );
}