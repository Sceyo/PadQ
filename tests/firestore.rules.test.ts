import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const suite = emulatorAvailable ? describe : describe.skip;
const UUID_A = '11111111-1111-4111-8111-111111111111';

function sessionData(hostUid: string, overrides: Record<string, unknown> = {}) {
  return {
    hostUid,
    revision: 0,
    gameMode: 'doubles',
    queueMode: 'default',
    elimType: 'single',
    players: ['A', 'B', 'C', 'D', 'E', 'F'],
    queue: ['A', 'B', 'C', 'D', 'E', 'F'],
    playAllRel: {},
    tournamentMatches: [],
    tournamentActive: false,
    tournamentWinner: null,
    isLive: false,
    accessPin: null,
    courtName: 'Court 1',
    courtSlots: [],
    lockedPartners: [],
    sittingOut: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    ...overrides,
  };
}

function historyData(commandId = UUID_A, revision = 1) {
  return {
    id: 1,
    mode: 'Doubles',
    players: 'A & B vs C & D',
    winner: 'A & B',
    timestamp: '10:00',
    commandId,
    revision,
  };
}

suite('Firestore V1 production rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-padq',
      firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
    });
  });

  beforeEach(async () => env.clearFirestore());
  afterAll(async () => env.cleanup());

  it('allows a known-room get but denies unauthenticated access and session listing', async () => {
    const host = env.authenticatedContext('host-1').firestore();
    const viewer = env.authenticatedContext('viewer-1').firestore();
    const anonymous = env.unauthenticatedContext().firestore();
    const ref = doc(host, 'sessions', 'A2THQ7');

    await assertSucceeds(setDoc(ref, sessionData('host-1')));
    await assertSucceeds(getDoc(doc(viewer, 'sessions', 'A2THQ7')));
    await assertFails(getDoc(doc(anonymous, 'sessions', 'A2THQ7')));
    await assertFails(getDocs(collection(viewer, 'sessions')));
  });

  it('binds ownership to the creator and requires a production-format room ID', async () => {
    const host = env.authenticatedContext('host-2').firestore();
    await assertFails(setDoc(doc(host, 'sessions', 'B2FAK7'), sessionData('another-uid')));
    await assertFails(setDoc(doc(host, 'sessions', 'AB3X'), sessionData('host-2')));
    await assertFails(setDoc(doc(host, 'sessions', 'O0I1AA'), sessionData('host-2')));
    await assertSucceeds(setDoc(doc(host, 'sessions', 'B2SAFE'), sessionData('host-2')));
  });

  it('rejects non-host writes, ownership changes, schema pollution and timestamp manipulation', async () => {
    const host = env.authenticatedContext('host-3').firestore();
    const attacker = env.authenticatedContext('attacker').firestore();
    const ref = doc(host, 'sessions', 'C3LCK7');
    await assertSucceeds(setDoc(ref, sessionData('host-3')));

    await assertFails(updateDoc(doc(attacker, 'sessions', 'C3LCK7'), { isLive: true }));
    await assertFails(updateDoc(doc(attacker, 'sessions', 'C3LCK7'), {
      courtSlots: [{ id: 'court-0', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] }],
    }));
    await assertFails(updateDoc(ref, {
      hostUid: 'attacker', updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      injectedAdmin: true, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      createdAt: new Date(0), updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
    }));
  });

  it('seals deferred modes, tournament data, PINs and more than three courts', async () => {
    const host = env.authenticatedContext('host-4').firestore();
    const ref = doc(host, 'sessions', 'D4VN7E');
    await assertSucceeds(setDoc(ref, sessionData('host-4')));

    for (const patch of [
      { queueMode: 'tournament' },
      { queueMode: 'playall', playAllRel: { A: 1 } },
      { queueMode: 'skilled' },
      { tournamentActive: true },
      { accessPin: '1234' },
      { courtSlots: [0, 1, 2, 3].map(i => ({ id: `court-${i}`, name: `Court ${i + 1}`, onCourt: [] })) },
    ]) {
      await assertFails(updateDoc(ref, {
        ...patch, revision: 1, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
      }));
    }
  });

  it('accepts a valid 30-player waiting roster', async () => {
    const host = env.authenticatedContext('host-5a').firestore();
    const players = Array.from({ length: 30 }, (_, i) => `Player ${i + 1}`);
    await assertSucceeds(setDoc(doc(host, 'sessions', 'E5WAT7'), sessionData('host-5a', {
      players,
      queue: players,
    })));
  });

  it('accepts three populated courts before the roster reaches 30 players', async () => {
    const host = env.authenticatedContext('host-5c').firestore();
    const players = Array.from({ length: 16 }, (_, i) => `Player ${i + 1}`);
    const courts = [0, 1, 2].map(i => ({
      id: `court-${i}`,
      name: `Court ${i + 1}`,
      onCourt: players.slice(i * 4, i * 4 + 4),
    }));
    await assertSucceeds(setDoc(doc(host, 'sessions', 'E5CRTS'), sessionData('host-5c', {
      players,
      queue: players.slice(12),
      courtSlots: courts,
    })));
  });

  it('accepts a valid 30-player, three-court session with locked partners', async () => {
    const host = env.authenticatedContext('host-5').firestore();
    const players = Array.from({ length: 30 }, (_, i) => `Player ${i + 1}`);
    const courts = [0, 1, 2].map(i => ({
      id: `court-${i}`,
      name: `Court ${i + 1}`,
      onCourt: players.slice(i * 4, i * 4 + 4),
    }));
    await assertSucceeds(setDoc(doc(host, 'sessions', 'E5BASE'), sessionData('host-5', {
      players,
      queue: players.slice(12),
      courtName: '3 Courts',
      courtSlots: courts,
    })));
    await assertSucceeds(setDoc(doc(host, 'sessions', 'E5REAL'), sessionData('host-5', {
      players,
      queue: players.slice(12),
      courtName: '3 Courts',
      courtSlots: courts,
      lockedPartners: Array.from({ length: 15 }, (_, i) => ({
        a: players[i * 2],
        b: players[i * 2 + 1],
      })),
    })));
  });

  it('rejects assigning one player to two courts', async () => {
    const host = env.authenticatedContext('host-5b').firestore();
    await assertFails(setDoc(doc(host, 'sessions', 'E5DUPL'), sessionData('host-5b', {
      players: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      queue: [],
      courtSlots: [
        { id: 'court-0', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] },
        { id: 'court-1', name: 'Court 2', onCourt: ['A', 'E', 'F', 'G'] },
      ],
    })));
  });

  it('rejects oversized player lists', async () => {
    const host = env.authenticatedContext('host-6').firestore();
    await assertFails(setDoc(doc(host, 'sessions', 'F6VER7'), sessionData('host-6', {
      players: Array.from({ length: 31 }, (_, i) => `P${i}`),
      queue: Array.from({ length: 31 }, (_, i) => `P${i}`),
    })));
  });

  it('rejects a session with a required field removed', async () => {
    const host = env.authenticatedContext('host-6b').firestore();
    const invalid = sessionData('host-6b') as Record<string, unknown>;
    delete invalid.queue;
    await assertFails(setDoc(doc(host, 'sessions', 'F6MISS'), invalid));
  });

  it('rejects malformed court, partner limits, score and engine payloads', async () => {
    const host = env.authenticatedContext('host-7').firestore();
    await assertFails(setDoc(doc(host, 'sessions', 'G7CRT7'), sessionData('host-7', {
      courtSlots: [{ id: 'court-0', name: 'Court 1', onCourt: ['A', 'B', 'C'] }],
    })));
    await assertFails(setDoc(doc(host, 'sessions', 'G7PAR7'), sessionData('host-7', {
      lockedPartners: Array.from({ length: 4 }, (_, i) => ({ a: `A${i}`, b: `B${i}` })),
    })));
    await assertFails(setDoc(doc(host, 'sessions', 'G7SNGL'), sessionData('host-7', {
      gameMode: 'singles',
      lockedPartners: [{ a: 'A', b: 'B' }],
    })));
    await assertFails(setDoc(doc(host, 'sessions', 'G7SCR7'), sessionData('host-7', {
      liveScore: { scoreA: 999, scoreB: 0, labelA: 'A', labelB: 'B', limit: 11, baseLimit: 11, deuce: false, active: true },
    })));
    await assertFails(setDoc(doc(host, 'sessions', 'G7ENGN'), sessionData('host-7', {
      doublesEngineState: { phase: 'HACKED' },
    })));
  });

  it('commits a result for three populated courts with an active partner pair', async () => {
    const host = env.authenticatedContext('host-7b').firestore();
    const ref = doc(host, 'sessions', 'G7MTCH');
    const players = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
    const courts = [0, 1, 2].map(i => ({
      id: `court-${i}`,
      name: `Court ${i + 1}`,
      onCourt: players.slice(i * 4, i * 4 + 4),
    }));
    const doublesEngineState = {
      phase: 'INIT',
      matchIndexInPhase: 0,
      matchCount: 0,
      w1: [],
      l1: [],
      waitingQueue: [],
      playedThisCycle: [],
      recentPairs: [],
      recentMatches: [],
      lastPlayedMap: {},
      winnersPool: [],
      losersPool: [],
    };
    await assertSucceeds(setDoc(ref, sessionData('host-7b', {
      players,
      queue: [],
      courtName: '3 Courts',
      courtSlots: courts,
      lockedPartners: [{ a: 'P1', b: 'P2' }],
    })));

    await assertSucceeds(runTransaction(host, async tx => {
      await tx.get(ref);
      tx.update(ref, {
        queue: [],
        courtSlots: courts,
        doublesEngineState,
        revision: 1,
        updatedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });
      tx.set(
        doc(host, 'sessions', 'G7MTCH', 'history', UUID_A),
        historyData(UUID_A, 1),
      );
    }));
  });

  it('requires an atomic revision increment for an immutable history entry', async () => {
    const host = env.authenticatedContext('host-8').firestore();
    const viewer = env.authenticatedContext('viewer-8').firestore();
    const ref = doc(host, 'sessions', 'H8MTCH');
    await assertSucceeds(setDoc(ref, sessionData('host-8')));

    await assertFails(setDoc(doc(host, 'sessions', 'H8MTCH', 'history', UUID_A), historyData()));

    await assertSucceeds(runTransaction(host, async tx => {
      const snap = await tx.get(ref);
      expect(snap.data()?.revision).toBe(0);
      tx.update(ref, {
        queue: ['E', 'F', 'A', 'B', 'C', 'D'], revision: 1,
        updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
      });
      tx.set(doc(host, 'sessions', 'H8MTCH', 'history', UUID_A), historyData());
    }));

    await assertSucceeds(getDocs(collection(viewer, 'sessions', 'H8MTCH', 'history')));
    await assertFails(updateDoc(doc(host, 'sessions', 'H8MTCH', 'history', UUID_A), { winner: 'C & D' }));
  });

  it('denies orphan history access and non-host history writes', async () => {
    const host = env.authenticatedContext('host-9').firestore();
    const attacker = env.authenticatedContext('attacker-9').firestore();
    await assertFails(getDocs(collection(attacker, 'sessions', 'J9NONE', 'history')));

    const ref = doc(host, 'sessions', 'J9HST7');
    await assertSucceeds(setDoc(ref, sessionData('host-9')));
    await assertFails(setDoc(
      doc(attacker, 'sessions', 'J9HST7', 'history', UUID_A),
      historyData(),
    ));
  });

  it('serializes simultaneous court results instead of losing an update', async () => {
    const host = env.authenticatedContext('host-a').firestore();
    const ref = doc(host, 'sessions', 'KARTCE');
    await assertSucceeds(setDoc(ref, sessionData('host-a')));

    const commit = (commandId: string, id: number) => runTransaction(host, async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.revision !== 0) throw new Error('stale-revision');
      tx.update(ref, { revision: 1, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp() });
      tx.set(doc(host, 'sessions', 'KARTCE', 'history', commandId), { ...historyData(commandId, 1), id });
    });

    const UUID_B = '22222222-2222-4222-8222-222222222222';
    const outcomes = await Promise.allSettled([commit(UUID_A, 1), commit(UUID_B, 2)]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await getDoc(ref)).data()?.revision).toBe(1);
    expect((await getDocs(collection(host, 'sessions', 'KARTCE', 'history'))).size).toBe(1);
  });

  it('allows only the host to delete history or the session', async () => {
    const host = env.authenticatedContext('host-b').firestore();
    const attacker = env.authenticatedContext('attacker-b').firestore();
    const ref = doc(host, 'sessions', 'LDELET');
    await assertSucceeds(setDoc(ref, sessionData('host-b')));
    await assertFails(deleteDoc(doc(attacker, 'sessions', 'LDELET')));
    await assertSucceeds(deleteDoc(ref));
  });
});
