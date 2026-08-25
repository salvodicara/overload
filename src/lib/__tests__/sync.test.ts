import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromiseExtended } from 'dexie';
import { db } from '../db';
import { diffForSync, pushRecord, pushRecordStrict, startSync, type Synced } from '../sync';

const { collectionMock, getDocsMock, setDocMock } = vi.hoisted(() => ({
  collectionMock: vi.fn((_fs: unknown, _scope: string, _uid: string, name: string) => ({ name })),
  getDocsMock: vi.fn(),
  setDocMock: vi.fn(async () => {}),
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  doc: vi.fn(() => ({ path: 'record' })),
  getDocs: getDocsMock,
  getFirestore: vi.fn(() => ({ name: 'firestore' })),
  setDoc: setDocMock,
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

    expect(await db.workouts.toArray()).toEqual([
      expect.objectContaining({ id: 'local-a' }),
    ]);
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
