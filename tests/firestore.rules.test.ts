import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

function sessionData(hostUid: string) {
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
    isLive: true,
    accessPin: null,
    courtName: 'Court 1',
    courtSlots: [],
    lockedPartners: [],
    sittingOut: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  };
}

suite('Firestore production rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-padq',
      firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
    });
  });

  afterAll(async () => env.cleanup());

  it('requires authentication and binds session ownership to the creator UID', async () => {
    const host = env.authenticatedContext('host-1').firestore();
    const viewer = env.authenticatedContext('viewer-1').firestore();
    const anonymous = env.unauthenticatedContext().firestore();
    const ref = doc(host, 'sessions', 'AUTH');

    await assertSucceeds(setDoc(ref, sessionData('host-1')));
    await assertSucceeds(getDoc(doc(viewer, 'sessions', 'AUTH')));
    await assertFails(getDoc(doc(anonymous, 'sessions', 'AUTH')));
    await assertFails(setDoc(doc(host, 'sessions', 'FAKE'), sessionData('another-uid')));
  });

  it('rejects non-host writes, ownership changes, unknown fields, and oversized payloads', async () => {
    const host = env.authenticatedContext('host-2').firestore();
    const attacker = env.authenticatedContext('attacker').firestore();
    const ref = doc(host, 'sessions', 'LOCK');
    await assertSucceeds(setDoc(ref, sessionData('host-2')));

    await assertFails(updateDoc(doc(attacker, 'sessions', 'LOCK'), { isLive: false }));
    await assertFails(updateDoc(ref, {
      hostUid: 'attacker', updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      injectedAdmin: true, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      players: Array.from({ length: 101 }, (_, i) => `P${i}`),
      updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
    }));
  });

  it('requires an atomic revision increment for a history entry', async () => {
    const host = env.authenticatedContext('host-3').firestore();
    const ref = doc(host, 'sessions', 'MATCH');
    await assertSucceeds(setDoc(ref, sessionData('host-3')));

    const standalone = doc(host, 'sessions', 'MATCH', 'history', 'standalone');
    await assertFails(setDoc(standalone, {
      id: 1, mode: 'Doubles', players: 'A & B vs C & D', winner: 'A & B',
      timestamp: '10:00', commandId: 'standalone', revision: 1,
    }));

    await assertSucceeds(runTransaction(host, async tx => {
      const snap = await tx.get(ref);
      expect(snap.data()?.revision).toBe(0);
      tx.update(ref, {
        queue: ['E', 'F', 'A', 'B', 'C', 'D'], revision: 1,
        updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
      });
      tx.set(doc(host, 'sessions', 'MATCH', 'history', 'command-1'), {
        id: 1, mode: 'Doubles', players: 'A & B vs C & D', winner: 'A & B',
        timestamp: '10:00', commandId: 'command-1', revision: 1,
      });
    }));
  });

  it('serializes simultaneous court results instead of losing an update', async () => {
    const host = env.authenticatedContext('host-4').firestore();
    const ref = doc(host, 'sessions', 'RACE');
    await assertSucceeds(setDoc(ref, sessionData('host-4')));

    const commit = (commandId: string) => runTransaction(host, async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.revision !== 0) throw new Error('stale-revision');
      tx.update(ref, {
        revision: 1, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
      });
      tx.set(doc(host, 'sessions', 'RACE', 'history', commandId), {
        id: commandId === 'court-a' ? 1 : 2,
        mode: 'Doubles', players: 'A & B vs C & D', winner: 'A & B',
        timestamp: '10:00', commandId, revision: 1,
      });
    });

    const outcomes = await Promise.allSettled([commit('court-a'), commit('court-b')]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await getDoc(ref)).data()?.revision).toBe(1);
    expect((await getDocs(collection(host, 'sessions', 'RACE', 'history'))).size).toBe(1);
  });

  it('allows only the host to delete history or the session', async () => {
    const host = env.authenticatedContext('host-5').firestore();
    const attacker = env.authenticatedContext('attacker-5').firestore();
    const ref = doc(host, 'sessions', 'DELETE');
    await assertSucceeds(setDoc(ref, sessionData('host-5')));
    await assertFails(deleteDoc(doc(attacker, 'sessions', 'DELETE')));
    await assertSucceeds(deleteDoc(ref));
  });
});
