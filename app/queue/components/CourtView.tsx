'use client';

import { useSession } from '@/hooks/useSession';
import { useQueue } from '@/hooks/useQueue';
import ScoreBoard from './ScoreBoard/ScoreBoard';
import QueueTable from './QueueTable/QueueTable';
import DoublesMatch from './DoublesMatch/DoublesMatch';
import WinnerModal from './WinnerModal/WinnerModal';
import SmartSuggestions from './SmartSuggestions/SmartSuggestions';
import styles from './CourtView.module.css';

interface Props {
  courtId: string;
}

export default function CourtView({ courtId }: Props) {
  const { session } = useSession();
  const { queue, nextMatch, commitResult } = useQueue(courtId); // hook filters by court

  if (!session) return <div>Loading session…</div>;

  return (
    <div className={styles.grid}>
      <ScoreBoard courtId={courtId} />
      <QueueTable
        players={queue}
        courtId={courtId}
        isHost={session.role === 'host'}
        onReorder={(/* ... */) => {}} // pass reorder handler
      />
      {nextMatch && (
        <DoublesMatch
          match={nextMatch}
          courtId={courtId}
          onScoreSubmit={(result) => commitResult(courtId, result)}
        />
      )}
      <SmartSuggestions courtId={courtId} />
      <WinnerModal /> {/* controlled by local state */}
    </div>
  );
}