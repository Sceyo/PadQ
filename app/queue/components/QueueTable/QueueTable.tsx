import React from 'react';
import type { PlayerStat } from '../../lib/types';
import { PlayerLabel } from '../atoms/PlayerLabel';

export const SinglesTable: React.FC<{ queue: string[]; statsMap: Record<string, PlayerStat> }> = ({ queue, statsMap }) => {
  const pairs = [];
  for (let i = 0; i < queue.length; i += 2)
    pairs.push({ n: i / 2 + 1, p1: queue[i], p2: i + 1 < queue.length ? queue[i + 1] : 'Bye' });
  return (
    <table className="pairing-table">
      <thead><tr><th>Match</th><th>Player 1</th><th>Player 2</th></tr></thead>
      <tbody>
        {pairs.map(p => (
          <tr key={`match-${p.n}`} className={p.n === 1 ? 'next-match' : ''}>
            <td className="match-label-cell">
              {p.n === 1 ? <span className="on-court-label">▶ On Court</span> : `Upcoming Match ${p.n - 1}`}
            </td>
            <td><PlayerLabel name={p.p1} statsMap={statsMap} /></td>
            <td><PlayerLabel name={p.p2} statsMap={statsMap} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const DoublesTable: React.FC<{ queue: string[]; statsMap: Record<string, PlayerStat> }> = ({ queue, statsMap }) => {
  const matches = [];
  for (let i = 0; i < queue.length; i += 4) {
    if (i + 3 < queue.length) matches.push({ n: i / 4 + 1, a: [queue[i], queue[i + 1]], b: [queue[i + 2], queue[i + 3]] });
    else { const rem = queue.slice(i); matches.push({ n: i / 4 + 1, a: rem.slice(0, 2), b: rem.slice(2, 4) }); }
  }
  const TeamCell = ({ names }: { names: string[] }) => (
    <>{names.map((n, i) => (
      <React.Fragment key={`${i}-${n}`}>
        <PlayerLabel name={n} statsMap={statsMap} />
        {i < names.length - 1 && <span className="team-amp"> & </span>}
      </React.Fragment>
    ))}</>
  );
  return (
    <table className="pairing-table">
      <thead><tr><th>Match</th><th>Team A</th><th>Team B</th></tr></thead>
      <tbody>
        {matches.map(m => (
          <tr key={`match-${m.n}`} className={m.n === 1 ? 'next-match' : ''}>
            <td className="match-label-cell">
              {m.n === 1 ? <span className="on-court-label">▶ On Court</span> : `Upcoming Match ${m.n - 1}`}
            </td>
            <td>{m.a.length ? <TeamCell names={m.a} /> : '—'}</td>
            <td>{m.b.length ? <TeamCell names={m.b} /> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
