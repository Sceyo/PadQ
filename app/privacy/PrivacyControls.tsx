'use client';

import { useState } from 'react';
import { clearSavedPlayerData } from '@/lib/sessionService';

export function PrivacyControls() {
  const [confirmed, setConfirmed] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const clearData = () => {
    clearSavedPlayerData();
    setConfirmed(false);
    setDeleted(true);
  };

  return (
    <section className="privacy-card" aria-labelledby="device-data-heading">
      <h2 id="device-data-heading">Saved player data on this device</h2>
      <p>PADQ may keep a roster, career totals, and skill labels in this browser so a host can reuse them between events. This information is not needed to watch a room.</p>
      {!confirmed ? (
        <button className="privacy-danger-button" type="button" onClick={() => { setConfirmed(true); setDeleted(false); }}>
          Delete saved player data
        </button>
      ) : (
        <div className="privacy-confirm" role="group" aria-label="Confirm deletion of saved player data">
          <p>This removes the saved roster, career statistics, and skill labels from this browser. It does not delete an active event.</p>
          <div>
            <button className="privacy-danger-button" type="button" onClick={clearData}>Delete from this device</button>
            <button className="privacy-secondary-button" type="button" onClick={() => setConfirmed(false)}>Cancel</button>
          </div>
        </div>
      )}
      {deleted && <p className="privacy-success" role="status">Saved player data was deleted from this device.</p>}
    </section>
  );
}
