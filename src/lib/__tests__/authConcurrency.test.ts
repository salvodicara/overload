import 'fake-indexeddb/auto';
import type { PromiseExtended } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocsMock, setDocMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  setDocMock: vi.fn(async () => undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_fs: unknown, _scope: string, uid: string, name: string) => ({ uid, name })),
  doc: vi.fn(() => ({ path: 'record' })),
  getDocs: getDocsMock,
  getFirestore: vi.fn(() => ({ name: 'firestore' })),
  setDoc: setDocMock,
}));

vi.mock('../wakeLock', () => ({
  acquireWakeLock: vi.fn(),
  releaseWakeLock: vi.fn(),
}));

import { db } from '../db';
import { useStore } from '../../state/useStore';

const storage = new Map<string, string>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const snapshot = (rows: Record<string, unknown>[]) => ({
  docs: rows.map((row) => ({ data: () => row })),
});

describe('auth transition with production sync cancellation', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    storage.clear();
    getDocsMock.mockReset();
    setDocMock.mockClear();
    await db.delete();
    await db.open();
    useStore.setState({
      user: null,
      authState: 'signedOut',
      workouts: [],
      routines: [],
      folders: [],
      notes: [],
      measurements: [],
      nutrition: [],
      customExercises: [],
      settings: { id: 'settings', updatedAt: 0 },
      syncState: 'offline',
      active: null,
      restUntil: null,
      restExerciseId: null,
      restTotalSec: null,
      pendingRoutineChanges: null,
    });
  });

  afterEach(async () => {
    useStore.getState().setUser(null);
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
    vi.unstubAllGlobals();
  });

  it('reaches signed-out and next-account readiness while the old getDocs never settles', async () => {
    const oldRemote = deferred<ReturnType<typeof snapshot>>();
    const nextRemote = deferred<ReturnType<typeof snapshot>>();
    getDocsMock.mockReturnValueOnce(oldRemote.promise).mockReturnValue(nextRemote.promise);
    storage.set('overload_uid', 'account-a');
    await db.workouts.put({
      id: 'local-a',
      date: '2026-08-25',
      startTs: 1,
      sets: [],
      volumeKg: 0,
      updatedAt: 1,
      source: 'app',
    });

    useStore.getState().setUser({ uid: 'account-a', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
    await vi.waitFor(() => expect(getDocsMock).toHaveBeenCalledOnce());

    useStore.getState().setUser(null);
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
    useStore.getState().setUser({ uid: 'account-b', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    oldRemote.resolve(snapshot([{
      id: 'remote-a',
      date: '2026-08-25',
      startTs: 2,
      sets: [],
      volumeKg: 0,
      updatedAt: 2,
      source: 'app',
    }]));
    await Promise.resolve();
    await Promise.resolve();

    expect(useStore.getState().user?.uid).toBe('account-b');
    expect(useStore.getState().workouts).toEqual([]);
    expect(await db.workouts.toArray()).toEqual([]);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('waits for an entered local pull before clearing for the next account', async () => {
    const localWrite = deferred<string>();
    const nextRemote = deferred<ReturnType<typeof snapshot>>();
    getDocsMock
      .mockResolvedValueOnce(snapshot([{
        id: 'remote-a',
        date: '2026-08-25',
        startTs: 2,
        sets: [],
        volumeKg: 0,
        updatedAt: 2,
        source: 'app',
      }]))
      .mockReturnValue(nextRemote.promise);
    const bulkPut = vi
      .spyOn(db.workouts, 'bulkPut')
      .mockReturnValueOnce(localWrite.promise as PromiseExtended<string>);
    const clear = vi.spyOn(db.workouts, 'clear');
    storage.set('overload_uid', 'account-a');

    useStore.getState().setUser({ uid: 'account-a', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
    await vi.waitFor(() => expect(bulkPut).toHaveBeenCalledOnce());

    useStore.getState().setUser({ uid: 'account-b', name: null });
    await Promise.resolve();
    await Promise.resolve();
    expect(useStore.getState().authState).toBe('loading');
    expect(clear).not.toHaveBeenCalled();

    localWrite.resolve('remote-a');
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    expect(clear).toHaveBeenCalledOnce();
    expect(useStore.getState().user?.uid).toBe('account-b');
    expect(await db.workouts.toArray()).toEqual([]);
  });
});
