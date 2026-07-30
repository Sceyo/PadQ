import type { CourtSlot } from '@/lib/sessionService';

type GameMode = 'singles' | 'doubles';

interface Props {
  courtSlots: CourtSlot[];
  gameMode: GameMode;
  queue: string[];
  selectedCourtId: string;
  onSelectCourt: (courtId: string) => void;
}

export function resolveSelectedCourt(courtSlots: CourtSlot[], selectedCourtId: string) {
  return courtSlots.find(court => court.id === selectedCourtId) ?? courtSlots[0] ?? null;
}

export function getNextPlayers(queue: string[], gameMode: GameMode) {
  return queue.slice(0, gameMode === 'doubles' ? 4 : 2);
}

export function LiveCourtStatus({
  courtSlots,
  gameMode,
  queue,
  selectedCourtId,
  onSelectCourt,
}: Props) {
  const selectedCourt = resolveSelectedCourt(courtSlots, selectedCourtId);
  const playersNeeded = gameMode === 'doubles' ? 4 : 2;
  const hasMatch = (selectedCourt?.onCourt.length ?? 0) >= playersNeeded;
  const onCourt = new Set(courtSlots.flatMap(court => court.onCourt));
  const waitingQueue = queue.filter(player => !onCourt.has(player));
  const nextPlayers = getNextPlayers(waitingQueue, gameMode);

  if (!selectedCourt) {
    return <p className="w-muted">Courts are not assigned yet.</p>;
  }

  const teamA = selectedCourt.onCourt.slice(0, gameMode === 'doubles' ? 2 : 1);
  const teamB = selectedCourt.onCourt.slice(gameMode === 'doubles' ? 2 : 1, playersNeeded);

  return (
    <>
      <div className="w-court-tabs" role="tablist" aria-label="Choose a court to follow">
        {courtSlots.map(court => {
          const selected = court.id === selectedCourt.id;
          const courtReady = court.onCourt.length >= playersNeeded;
          return (
            <button
              key={court.id}
              id={`court-tab-${court.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`court-panel-${court.id}`}
              className={`w-court-tab ${selected ? 'w-court-tab--active' : ''}`}
              onClick={() => onSelectCourt(court.id)}
            >
              <span>{court.name}</span>
              <small>{courtReady ? 'Playing' : 'Waiting'}</small>
            </button>
          );
        })}
      </div>

      <div
        id={`court-panel-${selectedCourt.id}`}
        role="tabpanel"
        aria-labelledby={`court-tab-${selectedCourt.id}`}
        className="w-court-focus"
      >
        <div className="w-court-focus-header">
          <div>
            <span className="w-court-focus-kicker">Following</span>
            <h3>{selectedCourt.name}</h3>
          </div>
          <span className={`w-court-state ${hasMatch ? 'w-court-state--playing' : ''}`}>
            {hasMatch ? 'Playing now' : 'Awaiting players'}
          </span>
        </div>

        {hasMatch ? (
          <div className="w-vs-row">
            <span className="w-player-chip w-player-chip--team">{teamA.join(' & ')}</span>
            <span className="w-vs">VS</span>
            <span className="w-player-chip w-player-chip--team">{teamB.join(' & ')}</span>
          </div>
        ) : (
          <p className="w-muted">The host will assign the next available players here.</p>
        )}
      </div>

      <div className="w-next-up">
        <div>
          <span className="w-court-focus-kicker">Next in queue</span>
          <p>Assignment is confirmed when the next court becomes available.</p>
        </div>
        {nextPlayers.length > 0 ? (
          <div className="w-queue-chips">
            {nextPlayers.map((player, index) => (
              <span key={`${index}-${player}`} className="w-queue-chip">
                <span className="w-queue-num">#{index + 1}</span> {player}
              </span>
            ))}
            {waitingQueue.length > nextPlayers.length && (
              <span className="w-queue-more">+{waitingQueue.length - nextPlayers.length} waiting</span>
            )}
          </div>
        ) : (
          <span className="w-muted">All active players are assigned.</span>
        )}
      </div>
    </>
  );
}
