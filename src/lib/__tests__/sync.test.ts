import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromiseExtended } from 'dexie';
import { db } from '../db';
import { diffForSync, pushRecord, pushRecordStrict, startSync, type Synced } from '../sync';

const { collectionMock, getDocsMock, setDocMock, transactionGetMock } = vi.hoisted(() => ({
  collectionMock: vi.fn((_fs: unknown, _scope: string, _uid: string, name: string) => ({ name })),
  getDocsMock: vi.fn(),
  setDocMock: vi.fn(async (_ref: unknown, _row: unknown) => {}),
  transactionGetMock: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  doc: vi.fn(() => ({ path: 'record' })),
  getDocs: getDocsMock,
  getFirestore: vi.fn(() => ({ name: 'firestore' })),
  setDoc: setDocMock,
  runTransaction: async (_fs: unknown, action: (tx: any) => Promise<void>) => {
    const writes: Promise<unknown>[] = [];
    await action({
      get: transactionGetMock,
      set: (ref: unknown, row: unknown) => {
        writes.push(setDocMock(ref, row));
      },
    });
    await Promise.all(writes);
  },
}));

const rec = (id: string, updatedAt: number): Synced => ({ id, updatedAt });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const snapshot = (rows: Synced[]) => ({
  docs: rows.map((row) => ({ data: () => row })),
});

beforeEach(async () => {
  transactionGetMock.mockReset();
  transactionGetMock.mockResolvedValue({ exists: () => false });
  collectionMock.mockClear();
  getDocsMock.mockReset();
  getDocsMock.mockResolvedValue(snapshot([]));
  setDocMock.mockReset();
  setDocMock.mockResolvedValue(undefined);
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startSync lifecycle', () => {
  it('disposes without waiting for a non-settling remote read and suppresses its late continuation', async () => {
    const remote = deferred<ReturnType<typeof snapshot>>();
    getDocsMock.mockReturnValueOnce(remote.promise);
    await db.workouts.put({
      id: 'local-a',
      date: '2026-08-25',
      startTs: 1,
      sets: [],
      volumeKg: 0,
      updatedAt: 1,
      source: 'app',
    });
    const onState = vi.fn();
    const onPulled = vi.fn();
    const controller = startSync('account-a', onState, onPulled);
    await vi.waitFor(() => expect(getDocsMock).toHaveBeenCalledOnce());

    let stopped = false;
    const stopping = controller.stop().then(() => {
      stopped = true;
    });
    await vi.waitFor(() => expect(stopped).toBe(true));

    remote.resolve(snapshot([rec('remote-a', 2)]));
    await stopping;
    await Promise.resolve();
    await Promise.resolve();

    expect(await db.workouts.toArray()).toEqual([expect.objectContaining({ id: 'local-a' })]);
    expect(setDocMock).not.toHaveBeenCalled();
    expect(onPulled).not.toHaveBeenCalled();
    expect(onState.mock.calls.map(([state]) => state)).toEqual(['pending']);
  });

  it('waits for a local write that entered before disposal', async () => {
    const localWrite = deferred<string>();
    const bulkPut = vi
      .spyOn(db.workouts, 'bulkPut')
      .mockReturnValueOnce(localWrite.promise as PromiseExtended<string>);
    getDocsMock.mockResolvedValueOnce(snapshot([rec('remote-a', 2)]));
    const controller = startSync('account-a');
    await vi.waitFor(() => expect(bulkPut).toHaveBeenCalledOnce());

    let stopped = false;
    const stopping = controller.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(stopped).toBe(false);

    localWrite.resolve('remote-a');
    await stopping;
    expect(stopped).toBe(true);
  });

  it('disposes without waiting for an already-issued remote write', async () => {
    const remoteWrite = deferred<void>();
    setDocMock.mockReturnValueOnce(remoteWrite.promise);
    await db.workouts.put({
      id: 'local-a',
      date: '2026-08-25',
      startTs: 1,
      sets: [],
      volumeKg: 0,
      updatedAt: 1,
      source: 'app',
    });
    const onState = vi.fn();
    const controller = startSync('account-a', onState);
    await vi.waitFor(() => expect(setDocMock).toHaveBeenCalledOnce());

    let stopped = false;
    const stopping = controller.stop().then(() => {
      stopped = true;
    });
    await vi.waitFor(() => expect(stopped).toBe(true));

    remoteWrite.resolve();
    await stopping;
    await Promise.resolve();
    expect(onState.mock.calls.map(([state]) => state)).toEqual(['pending']);
  });

  it('coalesces repeated run requests into one follow-up sync', async () => {
    const first = deferred<ReturnType<typeof snapshot>>();
    getDocsMock.mockReturnValueOnce(first.promise);
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget() as EventTarget & { visibilityState: string };
    documentTarget.visibilityState = 'visible';
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);
    vi.stubGlobal('navigator', { onLine: true });

    const controller = startSync('account-a');
    await vi.waitFor(() => expect(getDocsMock).toHaveBeenCalledOnce());
    windowTarget.dispatchEvent(new Event('online'));
    windowTarget.dispatchEvent(new Event('online'));
    first.resolve(snapshot([]));

    await vi.waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(16));
    await controller.stop();

    expect(getDocsMock).toHaveBeenCalledTimes(16);
  });
});

describe('diffForSync', () => {
  it('pushes the local record when it is newer', () => {
    const { push, pull } = diffForSync([rec('a', 20)], [rec('a', 10)]);

    expect(push).toEqual([rec('a', 20)]);
    expect(pull).toEqual([]);
  });

  it('pulls the remote record when it is newer', () => {
    const { push, pull } = diffForSync([rec('a', 10)], [rec('a', 20)]);

    expect(push).toEqual([]);
    expect(pull).toEqual([rec('a', 20)]);
  });

  it('pushes records that exist only locally', () => {
    const { push, pull } = diffForSync([rec('a', 1), rec('b', 2)], []);

    expect(push).toEqual([rec('a', 1), rec('b', 2)]);
    expect(pull).toEqual([]);
  });

  it('pulls records that exist only remotely', () => {
    const { push, pull } = diffForSync([], [rec('a', 1), rec('b', 2)]);

    expect(push).toEqual([]);
    expect(pull).toEqual([rec('a', 1), rec('b', 2)]);
  });

  it('does nothing when timestamps are equal', () => {
    const { push, pull } = diffForSync([rec('a', 7)], [rec('a', 7)]);

    expect(push).toEqual([]);
    expect(pull).toEqual([]);
  });

  it('returns empty results for empty inputs', () => {
    expect(diffForSync([], [])).toEqual({ push: [], pull: [] });
  });

  it('handles disjoint and overlapping ids in one pass', () => {
    const local = [rec('same', 5), rec('newerLocal', 9), rec('onlyLocal', 1), rec('olderLocal', 2)];
    const remote = [
      rec('same', 5),
      rec('newerLocal', 3),
      rec('onlyRemote', 4),
      rec('olderLocal', 8),
    ];

    const { push, pull } = diffForSync(local, remote);

    expect(push).toEqual([rec('newerLocal', 9), rec('onlyLocal', 1)]);
    expect(pull).toEqual([rec('olderLocal', 8), rec('onlyRemote', 4)]);
  });

  it('preserves the full record shape of typed inputs', () => {
    type Row = Synced & { name: string };
    const local: Row[] = [{ id: 'a', updatedAt: 2, name: 'local' }];
    const remote: Row[] = [{ id: 'a', updatedAt: 1, name: 'remote' }];

    const { push } = diffForSync(local, remote);

    expect(push[0].name).toBe('local');
  });
});

describe('record push failure contracts', () => {
  it('rejects a strict push when Firestore rejects the write', async () => {
    setDocMock.mockRejectedValueOnce(new Error('permission denied'));

    await expect(pushRecordStrict('u1', 'workouts', rec('a', 1))).rejects.toThrow(
      'permission denied',
    );
  });

  it('keeps the existing push helper best-effort when Firestore rejects', async () => {
    setDocMock.mockRejectedValueOnce(new Error('offline'));

    await expect(pushRecord('u1', 'workouts', rec('a', 1))).resolves.toBeUndefined();
  });
});

describe('offline-first deletion and concurrent edits', () => {
  it('does not resurrect a locally deleted workout from the remote copy', async () => {
    const { deleteWorkout } = await import('../db');
    const workout = {
      id: 'gone',
      date: '2026-09-08',
      startTs: 1,
      sets: [],
      volumeKg: 0,
      updatedAt: 1,
      source: 'app' as const,
    };
    await db.workouts.put(workout);
    await deleteWorkout(workout.id);
    getDocsMock.mockResolvedValueOnce(snapshot([workout]));
    const onState = vi.fn();
    const controller = startSync('u', onState);
    await vi.waitFor(() => expect(onState).toHaveBeenLastCalledWith('synced'));
    expect(await db.workouts.get('gone')).toBeUndefined();
    expect(
      setDocMock.mock.calls.some(
        (call: any[]) => call[1]?.id === 'gone' && call[1]?.deleted === true,
      ),
    ).toBe(true);
    await controller.stop();
  });
  it('applies a remote deletion instead of pushing an older local record back', async () => {
    await db.workouts.put({
      id: 'gone',
      date: '2026-09-08',
      startTs: 1,
      sets: [],
      volumeKg: 0,
      updatedAt: 1,
      source: 'app',
    });
    getDocsMock.mockResolvedValueOnce(
      snapshot([{ id: 'gone', updatedAt: 2, deleted: true } as Synced]),
    );
    const onState = vi.fn();
    const controller = startSync('u', onState);
    await vi.waitFor(() => expect(onState).toHaveBeenLastCalledWith('synced'));
    expect(await db.workouts.get('gone')).toBeUndefined();
    await controller.stop();
  });
  it('rechecks local edits made while the remote read was pending', async () => {
    const workout = {
      id: 'edited',
      date: '2026-09-08',
      startTs: 1,
      sets: [],
      volumeKg: 0,
      updatedAt: 1,
      source: 'app' as const,
    };
    await db.workouts.put(workout);
    const remote = deferred<ReturnType<typeof snapshot>>();
    getDocsMock.mockReturnValueOnce(remote.promise);
    const onState = vi.fn();
    const controller = startSync('u', onState);
    await vi.waitFor(() => expect(getDocsMock).toHaveBeenCalledOnce());
    await db.workouts.put({ ...workout, updatedAt: 3, note: 'new local note' });
    remote.resolve(snapshot([{ ...workout, updatedAt: 2 }]));
    await vi.waitFor(() => expect(onState).toHaveBeenLastCalledWith('synced'));
    expect((await db.workouts.get('edited'))?.note).toBe('new local note');
    await controller.stop();
  });
  it('ordinary local-first saves do not await a network acknowledgement', async () => {
    setDocMock.mockReturnValueOnce(new Promise(() => {}));
    let resolved = false;
    void pushRecord('u', 'workouts', rec('pending', 1)).then(() => {
      resolved = true;
    });
    await vi.waitFor(() => expect(resolved).toBe(true));
  });
});

it('does not let an older queued push overwrite a newer remote deletion', async () => {
  transactionGetMock.mockResolvedValue({
    exists: () => true,
    data: () => ({ id: 'a', updatedAt: 30, deleted: true }),
  });
  await pushRecordStrict('u', 'workouts', rec('a', 20));
  expect(setDocMock).not.toHaveBeenCalled();
});
it('restoring a deleted record creates a revision newer than its deletion', async () => {
  const { deleteWorkout, restoreBackupCollections } = await import('../db');
  const workout = {
    id: 'restore',
    date: '2026-09-08',
    startTs: 1,
    sets: [],
    volumeKg: 0,
    updatedAt: 1,
    source: 'app' as const,
  };
  await db.workouts.put(workout);
  await deleteWorkout(workout.id);
  const marker = await db.tombstones.get('workouts/restore');
  await restoreBackupCollections({
    version: 2,
    exportedAt: new Date().toISOString(),
    workouts: [workout],
    routines: [],
    folders: [],
    notes: [],
    measurements: [],
    nutrition: [],
    customExercises: [],
    settings: {
      id: 'settings',
      updatedAt: 0,
      restDefaultSec: 90,
      progression: { mode: 'double', incrementKg: 2.5 },
    },
  } as any);
  expect((await db.workouts.get('restore'))!.updatedAt).toBeGreaterThan(marker!.updatedAt);
  expect(await db.tombstones.get('workouts/restore')).toBeUndefined();
});

it('ordinary edits outrank a future revision and same-millisecond earlier saves', async () => {
  const { saveRoutine, saveSettings, saveNutrition } = await import('../db');
  const future = Date.now() + 86400000;
  const r = { id: 'future', name: 'Before', exercises: [], updatedAt: future };
  await db.routines.put(r);
  await saveRoutine({ ...r, name: 'After', updatedAt: 1 });
  const first = (await db.routines.get(r.id))!;
  expect(first.updatedAt).toBeGreaterThan(future);
  await saveRoutine({ ...first, name: 'Newest', updatedAt: 1 });
  expect((await db.routines.get(r.id))!.updatedAt).toBeGreaterThan(first.updatedAt);
  await db.settings.put({ id: 'settings', updatedAt: future });
  expect((await saveSettings({ unit: 'lb' })).updatedAt).toBeGreaterThan(future);
  await db.nutrition.put({
    id: '2026-09-08',
    date: '2026-09-08',
    kcal: 100,
    proteinG: 10,
    updatedAt: future,
  });
  expect((await saveNutrition('2026-09-08', { kcal: 200 })).updatedAt).toBeGreaterThan(future);
});

it('reports a strict restore blocked by a newer remote record instead of claiming success', async () => {
  transactionGetMock.mockResolvedValue({
    exists: () => true,
    data: () => ({ id: 'a', updatedAt: 30, deleted: true }),
  });
  await expect(pushRecordStrict('u', 'workouts', rec('a', 20), true)).rejects.toThrow(
    'newer cloud revision',
  );
  expect(setDocMock).not.toHaveBeenCalled();
});
