import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diffForSync, pushRecord, pushRecordStrict, type Synced } from '../sync';

const { setDocMock } = vi.hoisted(() => ({
  setDocMock: vi.fn(async () => {}),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'record' })),
  getFirestore: vi.fn(() => ({ name: 'firestore' })),
  setDoc: setDocMock,
}));

const rec = (id: string, updatedAt: number): Synced => ({ id, updatedAt });

beforeEach(() => {
  setDocMock.mockReset();
  setDocMock.mockResolvedValue(undefined);
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
