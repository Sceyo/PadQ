import React from 'react';

export const SessionBar: React.FC<{
  sessionId:   string | null;
  isHost:      boolean;
  isConnected: boolean;
  isSaving:    boolean;
}> = ({ sessionId, isHost, isConnected, isSaving }) => {
  if (!sessionId) return null;
  return (
    <div className={`session-bar ${isHost ? 'session-bar--host' : 'session-bar--viewer'}`}>
      <span className={`session-dot ${isConnected ? 'session-dot--live' : 'session-dot--offline'}`} />
      <span className="session-status-text">{isSaving ? 'Saving…' : isConnected ? 'Connected' : 'Connecting…'}</span>
      <span className="session-label">Room:</span>
      <span className="session-code">{sessionId}</span>
      <span className={`session-role-badge ${!isHost ? 'session-role-badge--viewer' : ''}`}>{isHost ? 'HOST' : 'WATCHING'}</span>
    </div>
  );
};
