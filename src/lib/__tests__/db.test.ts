import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import type { PromiseExtended } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEMPLATES } from '../../data/templates';
import { installTemplatePack } from '../../screens/Train';
import {
  applyImport,
  clearAllUserData,
  db,
  deleteWorkout,
  getSettings,
  listCustomExercises,
  listFolders,
  listMeasurements,
  listNotes,
  listNutrition,
  listRoutines,
  listWorkouts,
  restoreBackupCollections,
  saveRoutine,
  saveSettings,
  saveWorkout,
} from '../db';
import type { BackupV2 } from '../importer';
import { loadCatalog, registerCustomExercises, searchExercises } from '../exercises';
import type { Routine, Workout } from '../types';

const {
  pushRecordMock,
  pushRecordStrictMock,
  acquireWakeLockMock,
  releaseWakeLockMock,
  startSyncMock,
  startSyncObserverMock,
  stopSyncMock,
} = vi.hoisted(() => {
  const startSyncObserverMock = vi.fn((_uid: string) => {});
  const stopSyncMock = vi.fn(async () => {});
  return {
    pushRecordMock: vi.fn(async (_uid: string, _collection: string, _record: unknown) => {}),
    pushRecordStrictMock: vi.fn(
      async (_uid: string, _collection: string, _record: unknown) => {},
    ),
    acquireWakeLockMock: vi.fn(),
    releaseWakeLockMock: vi.fn(),
    startSyncObserverMock,
    startSyncMock: vi.fn((uid: string) => {
      startSyncObserverMock(uid);
      return { stop: stopSyncMock };
    }),
    stopSyncMock,
  };
});

vi.mock('../sync', () => ({
  deleteRecord: vi.fn(async () => {}),
  pushRecord: pushRecordMock,
  pushRecordStrict: pushRecordStrictMock,
  startSync: startSyncMock,
}));

vi.mock('../wakeLock', () => ({
  acquireWakeLock: acquireWakeLockMock,
  releaseWakeLock: releaseWakeLockMock,
}));

import { BackupCloudSyncError, useStore, type ActiveSession } from '../../state/useStore';

type RoutineSave = ReturnType<ReturnType<typeof useStore.getState>['saveRoutine']>;

const originalReload = useStore.getState().reload;
const storage = new Map<string, string>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  let settled = false;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {
    promise,
    resolve(value: T) {
      if (settled) return;
      settled = true;
      resolve(value);
    },
    reject(reason: unknown) {
      if (settled) return;
      settled = true;
      reject(reason);
    },
  };
}

function workout(id: string, date: string, startTs: number): Workout {
  return {
    id,
    date,
    startTs,
    sets: [{ exerciseId: 'bench', weightKg: 20, reps: 10, done: true }],
    volumeKg: 200,
    updatedAt: 1,
    source: 'app',
  };
}

async function login(uid: string, name: string | null = null): Promise<void> {
  storage.set('overload_uid', uid);
  useStore.getState().setUser({ uid, name });
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  storage.clear();
  pushRecordMock.mockClear();
  pushRecordStrictMock.mockReset();
  pushRecordStrictMock.mockResolvedValue(undefined);
  acquireWakeLockMock.mockClear();
  releaseWakeLockMock.mockClear();
  startSyncMock.mockClear();
  startSyncObserverMock.mockReset();
  stopSyncMock.mockReset();
  stopSyncMock.mockResolvedValue(undefined);
  useStore.setState({
    user: null,
    authState: 'signedOut',
    reload: originalReload,
    workouts: [],
    routines: [],
    folders: [],
    notes: [],
    measurements: [],
    nutrition: [],
    customExercises: [],
    settings: { id: 'settings', updatedAt: 0 },
    active: null,
    restUntil: null,
    restExerciseId: null,
    restTotalSec: null,
    pendingRoutineChanges: null,
  });
  await db.transaction(
    'rw',
    [
      db.workouts,
      db.routines,
      db.folders,
      db.notes,
      db.measurements,
      db.nutrition,
      db.customExercises,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.workouts.clear(),
        db.routines.clear(),
        db.folders.clear(),
        db.notes.clear(),
        db.measurements.clear(),
        db.nutrition.clear(),
        db.customExercises.clear(),
        db.settings.clear(),
      ]);
    },
  );
});

afterEach(async () => {
  useStore.getState().setUser(null);
  await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));
  useStore.setState({ user: null, authState: 'signedOut', reload: originalReload });
});

const COMPLETE_BACKUP: BackupV2 = {
  version: 2,
  workouts: [workout('restored', '2026-06-10', 1000)],
  routines: [{ id: 'r1', name: 'Restore', exercises: [], updatedAt: 2 }],
  folders: [{ id: 'f1', name: 'Cartella', updatedAt: 3 }],
  notes: [
    {
      id: 'bench',
      technique: 'Piedi saldi',
      entries: [{ date: '2026-06-10', text: 'Buono' }],
      updatedAt: 4,
    },
  ],
  measurements: [{ id: 'm1', date: '2026-06-10', metric: 'weight', value: 80.5, updatedAt: 5 }],
  nutrition: [
    { id: '2026-06-10', date: '2026-06-10', kcal: 2300, proteinG: 175, updatedAt: 6 },
  ],
  customExercises: [
    { id: 'custom:1', name: 'Press speciale', muscleGroup: 'shoulders', updatedAt: 7 },
  ],
  settings: {
    id: 'settings',
    unit: 'lb',
    locale: 'it',
    kcalTarget: 2400,
    proteinTarget: 180,
    weeklyGoal: 4,
    updatedAt: 8,
  },
};

describe('clearAllUserData', () => {
  it('clears every user-owned table together', async () => {
    await db.workouts.put({
      id: 'w', date: '2026-08-25', startTs: 1, sets: [], volumeKg: 0, updatedAt: 1, source: 'app',
    });
    await db.routines.put({ id: 'r', name: 'Routine', exercises: [], updatedAt: 1 });
    await db.folders.put({ id: 'f', name: 'Program', updatedAt: 1 });
    await db.notes.put({ id: 'bench', entries: [], technique: 'Brace', updatedAt: 1 });
    await db.measurements.put({ id: 'm', date: '2026-08-25', metric: 'weight', value: 80, updatedAt: 1 });
    await db.nutrition.put({ id: '2026-08-25', date: '2026-08-25', kcal: 2000, proteinG: 120, updatedAt: 1 });
    await db.customExercises.put({ id: 'custom:x', name: 'Carry', muscleGroup: 'core', updatedAt: 1 });
    await db.settings.put({ id: 'settings', locale: 'it', updatedAt: 1 });

    await clearAllUserData();

    expect(await Promise.all([
      db.workouts.count(), db.routines.count(), db.folders.count(), db.notes.count(),
      db.measurements.count(), db.nutrition.count(), db.customExercises.count(), db.settings.count(),
    ])).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('account transitions', () => {
  it('updates same-UID profile metadata after readiness without rebooting or rehydrating', async () => {
    await login('account-a', 'A first');
    const readSpy = vi.spyOn(db.routines, 'toArray');
    const clearSpy = vi.spyOn(db.routines, 'clear');

    useStore.getState().setUser({ uid: 'account-a', name: 'A latest' });

    expect(useStore.getState()).toMatchObject({
      user: { uid: 'account-a', name: 'A latest' },
      authState: 'ready',
    });
    expect(readSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(startSyncMock).toHaveBeenCalledOnce();
  });

  it('joins duplicate same-UID notifications while stop and clear are deferred', async () => {
    storage.set('overload_uid', 'account-a');
    useStore.getState().setUser({ uid: 'account-a', name: 'A' });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
    await restoreBackupCollections(COMPLETE_BACKUP);

    const stop = deferred<void>();
    stopSyncMock.mockReturnValueOnce(stop.promise);
    const clear = deferred<void>();
    const originalClear = db.workouts.clear.bind(db.workouts);
    const clearSpy = vi.spyOn(db.workouts, 'clear').mockImplementationOnce(() =>
      Dexie.waitFor(clear.promise).then(() => originalClear()) as PromiseExtended<void>,
    );

    useStore.getState().setUser({ uid: 'account-b', name: 'B first' });
    useStore.getState().setUser({ uid: 'account-b', name: 'B latest' });

    expect(useStore.getState()).toMatchObject({ user: undefined, authState: 'loading' });
    expect(storage.get('overload_uid')).toBe('account-a');
    expect(clearSpy).not.toHaveBeenCalled();
    expect(startSyncMock).toHaveBeenCalledTimes(1);

    stop.resolve();
    await vi.waitFor(() => expect(clearSpy).toHaveBeenCalledOnce());
    expect(storage.get('overload_uid')).toBe('account-a');
    expect(startSyncMock).toHaveBeenCalledTimes(1);

    clear.resolve();
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    expect(useStore.getState().user).toEqual({ uid: 'account-b', name: 'B latest' });
    expect(storage.get('overload_uid')).toBe('account-b');
    expect(startSyncMock.mock.calls.map(([uid]) => uid)).toEqual(['account-a', 'account-b']);
    expect(await Promise.all([
      db.workouts.count(), db.routines.count(), db.folders.count(), db.notes.count(),
      db.measurements.count(), db.nutrition.count(), db.customExercises.count(), db.settings.count(),
    ])).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('keeps the previous UID marker and blocks readiness when account clearing rejects', async () => {
    storage.set('overload_uid', 'account-a');
    useStore.getState().setUser({ uid: 'account-a', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
    await restoreBackupCollections(COMPLETE_BACKUP);
    vi.spyOn(db.workouts, 'clear').mockRejectedValueOnce(new Error('storage unavailable'));

    useStore.getState().setUser({ uid: 'account-b', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('error'));

    expect(useStore.getState().user).toBeUndefined();
    expect(storage.get('overload_uid')).toBe('account-a');
    expect(startSyncMock.mock.calls.map(([uid]) => uid)).toEqual(['account-a']);
    expect(await db.workouts.count()).toBe(1);
  });

  it('preserves the signed-out active snapshot, releases its wake lock, and reacquires only after same-UID readiness', async () => {
    const active: ActiveSession = {
      routineId: 'r1',
      startTs: 1,
      ex: [
        {
          exerciseId: 'bench',
          tracking: 'weight_reps',
          hintKey: 'suggest.repeat',
          sets: [
            {
              weightKg: 20,
              reps: 10,
              durationSec: null,
              kind: 'working',
              done: true,
            },
          ],
        },
      ],
    };
    storage.set('overload_uid', 'account-a');
    storage.set('overload_active', JSON.stringify(active));
    useStore.getState().setUser({ uid: 'account-a', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
    useStore.setState({
      active,
      restUntil: 10_000,
      restExerciseId: 'bench',
      restTotalSec: 90,
      pendingRoutineChanges: {
        routineId: 'r1',
        items: [{ exerciseId: 'bench', restSec: 120 }],
      },
    });

    useStore.getState().setUser(null);
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('signedOut'));

    expect(releaseWakeLockMock).toHaveBeenCalledOnce();
    expect(storage.has('overload_active')).toBe(true);
    expect(useStore.getState().active).toEqual(active);
    expect(acquireWakeLockMock).not.toHaveBeenCalled();

    useStore.getState().setUser({ uid: 'account-a', name: 'A again' });
    expect(acquireWakeLockMock).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    expect(acquireWakeLockMock).toHaveBeenCalledOnce();
    expect(useStore.getState().active).toEqual(active);
  });

  it('cancels a queued routine push when the account signs out', async () => {
    await login('account-a');
    await useStore.getState().saveRoutine({
      id: 'queued',
      name: 'Queued routine',
      exercises: [],
      updatedAt: 1,
    });

    useStore.getState().setUser(null);
    await new Promise((resolve) => setTimeout(resolve, 650));

    expect(pushRecordMock).not.toHaveBeenCalled();
  });

  it('discards a reload snapshot whose owner changes while the local read is pending', async () => {
    await login('account-a');
    const stale = workout('stale-a', '2026-08-25', 1);
    const read = deferred<Workout[]>();
    const readSpy = vi
      .spyOn(db.workouts, 'toArray')
      .mockReturnValueOnce(read.promise as PromiseExtended<Workout[]>);

    const reload = useStore.getState().reload();
    await vi.waitFor(() => expect(readSpy).toHaveBeenCalledOnce());
    useStore.getState().setUser({ uid: 'account-b', name: null });
    read.resolve([stale]);
    await reload;
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    expect(useStore.getState().user?.uid).toBe('account-b');
    expect(useStore.getState().workouts).toEqual([]);
    expect(await db.workouts.toArray()).toEqual([]);
  });

  it('fences a deferred routine write before a different account can clear and become ready', async () => {
    await login('account-a');
    const write = deferred<string>();
    const putSpy = vi
      .spyOn(db.routines, 'put')
      .mockReturnValueOnce(write.promise as PromiseExtended<string>);
    const clearSpy = vi.spyOn(db.routines, 'clear');

    const save = useStore.getState().saveRoutine({
      id: 'routine-a',
      name: 'Account A routine',
      exercises: [],
      updatedAt: 1,
    });
    try {
      await vi.waitFor(() => expect(putSpy).toHaveBeenCalledOnce());
      useStore.getState().setUser({ uid: 'account-b', name: null });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(useStore.getState().authState).toBe('loading');
      expect(clearSpy).not.toHaveBeenCalled();
    } finally {
      write.resolve('routine-a');
    }
    await expect(save).resolves.toEqual({ status: 'stale' });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    expect(useStore.getState().routines).toEqual([]);
    expect(await db.routines.toArray()).toEqual([]);
    expect(pushRecordMock).not.toHaveBeenCalledWith(
      'account-b',
      'routines',
      expect.objectContaining({ id: 'routine-a' }),
    );
  });

  it('publishes a pending routine draft so a remounted editor can preserve it', async () => {
    await login('account-a');
    const base: Routine = { id: 'routine-a', name: 'Original', exercises: [], updatedAt: 1 };
    useStore.setState({ routines: [base] });
    const write = deferred<string>();
    const putSpy = vi
      .spyOn(db.routines, 'put')
      .mockReturnValueOnce(write.promise as PromiseExtended<string>);

    const first = useStore.getState().saveRoutine({ ...base, warmup: 'Persist me' });
    let second: RoutineSave | undefined;
    try {
      await vi.waitFor(() => expect(putSpy).toHaveBeenCalledOnce());
      expect(useStore.getState().routines[0]).toMatchObject({ warmup: 'Persist me' });

      const remounted = useStore.getState().routines[0];
      second = useStore.getState().saveRoutine({ ...remounted, name: 'Renamed' });
      expect(useStore.getState().routines[0]).toMatchObject({ name: 'Renamed', warmup: 'Persist me' });

      write.resolve('routine-a');
      await expect(first).resolves.toMatchObject({ status: 'applied' });
      await expect(second).resolves.toMatchObject({ status: 'applied' });
      expect(useStore.getState().routines[0]).toMatchObject({ name: 'Renamed', warmup: 'Persist me' });
      expect(await db.routines.get('routine-a')).toMatchObject({ name: 'Renamed', warmup: 'Persist me' });
    } finally {
      write.resolve('routine-a');
      await first.catch(() => {});
      await second?.catch(() => {});
    }
  });

  it('does not roll back a newer optimistic routine after an earlier write fails', async () => {
    await login('account-a');
    const base: Routine = { id: 'routine-a', name: 'Original', exercises: [], updatedAt: 1 };
    useStore.setState({ routines: [base] });
    const write = deferred<string>();
    vi.spyOn(db.routines, 'put').mockReturnValueOnce(write.promise as PromiseExtended<string>);

    const first = useStore.getState().saveRoutine({ ...base, warmup: 'Persist me' });
    let second: RoutineSave | undefined;
    try {
      await vi.waitFor(() => expect(useStore.getState().routines[0]?.warmup).toBe('Persist me'));
      second = useStore.getState().saveRoutine({
        ...useStore.getState().routines[0],
        name: 'Renamed',
      });
      const rejected = expect(first).rejects.toThrow('disk full');
      write.reject(new Error('disk full'));
      await rejected;
      await expect(second).resolves.toMatchObject({ status: 'applied' });

      expect(useStore.getState().routines[0]).toMatchObject({ name: 'Renamed', warmup: 'Persist me' });
      expect(await db.routines.get('routine-a')).toMatchObject({ name: 'Renamed', warmup: 'Persist me' });
    } finally {
      write.reject(new Error('disk full'));
      await first.catch(() => {});
      await second?.catch(() => {});
    }
  });

  it('rolls consecutive failed routine drafts back to the durable record', async () => {
    await login('account-a');
    const base: Routine = { id: 'routine-a', name: 'Original', exercises: [], updatedAt: 1 };
    await saveRoutine(base);
    useStore.setState({ routines: [base] });
    const firstWrite = deferred<string>();
    const secondWrite = deferred<string>();
    const putSpy = vi
      .spyOn(db.routines, 'put')
      .mockReturnValueOnce(firstWrite.promise as PromiseExtended<string>)
      .mockReturnValueOnce(secondWrite.promise as PromiseExtended<string>);
    let first: RoutineSave | undefined;
    let second: RoutineSave | undefined;
    try {
      first = useStore.getState().saveRoutine({ ...base, warmup: 'Optimistic only' });
      await vi.waitFor(() => expect(putSpy).toHaveBeenCalledOnce());
      second = useStore.getState().saveRoutine({
        ...useStore.getState().routines[0],
        name: 'Also optimistic',
      });
      expect(useStore.getState().routines[0]).toMatchObject({
        name: 'Also optimistic', warmup: 'Optimistic only',
      });

      const firstRejected = expect(first).rejects.toThrow('first write failed');
      firstWrite.reject(new Error('first write failed'));
      await firstRejected;
      await vi.waitFor(() => expect(putSpy).toHaveBeenCalledTimes(2));
      const secondRejected = expect(second).rejects.toThrow('second write failed');
      secondWrite.reject(new Error('second write failed'));
      await secondRejected;

      expect(useStore.getState().routines).toEqual([base]);
      expect(await listRoutines()).toEqual([base]);
    } finally {
      firstWrite.reject(new Error('first write failed'));
      secondWrite.reject(new Error('second write failed'));
      if (first) await first.catch(() => {});
      if (second) await second.catch(() => {});
    }
  });

  it('rolls a failed later routine draft back to the first durable save', async () => {
    await login('account-a');
    const base: Routine = { id: 'routine-a', name: 'Original', exercises: [], updatedAt: 1 };
    useStore.setState({ routines: [base] });
    const firstWrite = deferred<string>();
    const secondWrite = deferred<string>();
    const originalPut = db.routines.put.bind(db.routines);
    const putSpy = vi
      .spyOn(db.routines, 'put')
      .mockImplementationOnce((routine) => (
        firstWrite.promise.then(() => originalPut(routine)) as PromiseExtended<string>
      ))
      .mockReturnValueOnce(secondWrite.promise as PromiseExtended<string>);
    let first: RoutineSave | undefined;
    let second: RoutineSave | undefined;
    try {
      first = useStore.getState().saveRoutine({ ...base, warmup: 'Durable preparation' });
      await vi.waitFor(() => expect(putSpy).toHaveBeenCalledOnce());
      firstWrite.resolve('routine-a');
      await expect(first).resolves.toMatchObject({ status: 'applied' });
      const durable = await db.routines.get('routine-a');

      second = useStore.getState().saveRoutine({
        ...useStore.getState().routines[0],
        name: 'Failed rename',
      });
      await vi.waitFor(() => expect(putSpy).toHaveBeenCalledTimes(2));
      const secondRejected = expect(second).rejects.toThrow('second write failed');
      secondWrite.reject(new Error('second write failed'));
      await secondRejected;

      expect(useStore.getState().routines).toEqual([durable]);
      expect(await listRoutines()).toEqual([durable]);
    } finally {
      firstWrite.resolve('routine-a');
      secondWrite.reject(new Error('second write failed'));
      if (first) await first.catch(() => {});
      if (second) await second.catch(() => {});
    }
  });

  it('does not restore an optimistic old-account routine after an account switch', async () => {
    await login('account-a');
    const write = deferred<string>();
    vi.spyOn(db.routines, 'put').mockReturnValueOnce(write.promise as PromiseExtended<string>);

    const save = useStore.getState().saveRoutine({
      id: 'routine-a', name: 'Account A routine', exercises: [], updatedAt: 1,
    });
    try {
      await vi.waitFor(() => expect(useStore.getState().routines[0]?.id).toBe('routine-a'));
      useStore.getState().setUser({ uid: 'account-b', name: null });
      write.reject(new Error('old account write failed'));
      await expect(save).rejects.toThrow('old account write failed');
      await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

      expect(useStore.getState().user?.uid).toBe('account-b');
      expect(useStore.getState().routines).toEqual([]);
      expect(await db.routines.toArray()).toEqual([]);
    } finally {
      write.reject(new Error('old account write failed'));
      await save.catch(() => {});
    }
  });

  it('fences deferred workout completion from the next account', async () => {
    await login('account-a');
    const routine: Routine = {
      id: 'routine-a',
      name: 'A routine',
      exercises: [{ exerciseId: 'bench', sets: 1, repMin: 5, repMax: 5, restSec: 60 }],
      updatedAt: 1,
    };
    useStore.setState({
      routines: [routine],
      active: {
        routineId: routine.id,
        startTs: 1,
        ex: [
          {
            exerciseId: 'bench',
            tracking: 'weight_reps',
            hintKey: 'suggest.repeat',
            sets: [{ weightKg: 20, reps: 5, durationSec: null, kind: 'working', done: true }],
          },
        ],
      },
    });
    const write = deferred<string>();
    const putSpy = vi
      .spyOn(db.workouts, 'put')
      .mockReturnValueOnce(write.promise as PromiseExtended<string>);
    const clearSpy = vi.spyOn(db.workouts, 'clear');

    const finish = useStore.getState().finishWorkout();
    try {
      await vi.waitFor(() => expect(putSpy).toHaveBeenCalledOnce());
      useStore.getState().setUser({ uid: 'account-b', name: null });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(useStore.getState().authState).toBe('loading');
      expect(clearSpy).not.toHaveBeenCalled();
    } finally {
      write.resolve('workout-a');
    }
    await expect(finish).resolves.toEqual({ status: 'stale' });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    expect(useStore.getState().workouts).toEqual([]);
    expect(await db.workouts.toArray()).toEqual([]);
    expect(pushRecordMock).not.toHaveBeenCalledWith(
      'account-b',
      'workouts',
      expect.anything(),
    );
  });

  it('stops an authenticated restore loop when its owner changes', async () => {
    await login('account-a');
    const firstPush = deferred<void>();
    pushRecordStrictMock.mockReturnValueOnce(firstPush.promise);

    const restore = useStore.getState().restoreBackup(COMPLETE_BACKUP);
    await vi.waitFor(() => expect(pushRecordStrictMock).toHaveBeenCalledOnce());
    useStore.getState().setUser({ uid: 'account-b', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));
    firstPush.resolve();
    await expect(restore).resolves.toEqual({ status: 'stale' });

    expect(pushRecordStrictMock).toHaveBeenCalledTimes(1);
    expect(useStore.getState().workouts).toEqual([]);
    expect(await db.workouts.toArray()).toEqual([]);
  });

  it('stops template installation when its folder write settles after the next account is ready', async () => {
    await login('account-a');
    const remote = deferred<void>();
    pushRecordMock.mockReturnValueOnce(remote.promise);

    const install = installTemplatePack(TEMPLATES[0], useStore.getState());
    await vi.waitFor(() => expect(pushRecordMock).toHaveBeenCalledOnce());
    useStore.getState().setUser({ uid: 'account-b', name: null });
    await vi.waitFor(() => expect(useStore.getState().authState).toBe('ready'));

    remote.resolve();

    await expect(install).resolves.toEqual({ status: 'stale' });
    expect(useStore.getState().folders).toEqual([]);
    expect(useStore.getState().routines).toEqual([]);
    expect(await db.folders.toArray()).toEqual([]);
    expect(await db.routines.toArray()).toEqual([]);
  });
});

describe('neutral starter data', () => {
  it('offers a neutral two-day full-body pack whose routines copy into one folder', () => {
    const fullBody = TEMPLATES.find((pack) => pack.folder.id === 'full-body-folder');

    expect(fullBody?.routines.map((routine) => routine.name)).toEqual(['Full Body A', 'Full Body B']);
    expect(fullBody?.routines.every((routine) => routine.folderId === fullBody.folder.id)).toBe(true);
    expect(fullBody?.routines.flatMap((routine) => routine.exercises)).not.toContainEqual(
      expect.objectContaining({ startWeightKg: expect.any(Number) }),
    );
  });

  it('sorts exercise search alphabetically without curated-result priority', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: 'Dumbbell_Bench_Press',
          name: 'Zulu press',
          equipment: 'dumbbell',
          primaryMuscles: ['chest'],
          secondaryMuscles: [],
          instructions: [],
          images: [],
        },
        {
          id: 'alpha-carry',
          name: 'Alpha carry',
          equipment: 'other',
          primaryMuscles: ['abdominals'],
          secondaryMuscles: [],
          instructions: [],
          images: [],
        },
      ],
    })));

    await loadCatalog();

    expect(searchExercises('', null, 'en').map((exercise) => exercise.id)).toEqual([
      'alpha-carry',
      'Dumbbell_Bench_Press',
    ]);
    vi.stubGlobal('fetch', originalFetch);
  });

  it('removes custom exercises from the in-memory catalog when the active collection is cleared', () => {
    registerCustomExercises([
      { id: 'custom:private', name: 'Private carry', muscleGroup: 'core' },
    ]);
    expect(searchExercises('Private carry', null, 'en')).toHaveLength(1);

    registerCustomExercises([]);

    expect(searchExercises('Private carry', null, 'en')).toEqual([]);
  });

  it('keeps both custom exercises searchable after two sequential creations', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    await loadCatalog();
    vi.stubGlobal('fetch', originalFetch);
    await login('account-a');

    const first = await useStore.getState().createCustomExercise('Alpha carry', 'core');
    const second = await useStore.getState().createCustomExercise('Beta carry', 'core');
    expect(first.status).toBe('applied');
    expect(second.status).toBe('applied');

    expect(
      searchExercises('carry', null, 'en')
        .map((exercise) => exercise.id)
        .filter((id) => id.startsWith('custom:')),
    ).toEqual([
      first.status === 'applied' ? first.value : '',
      second.status === 'applied' ? second.value : '',
    ]);
  });
});

describe('restoreBackupCollections', () => {
  it('restores one record into every local table without changing stored values', async () => {
    await restoreBackupCollections(COMPLETE_BACKUP);

    expect(await listWorkouts()).toEqual(COMPLETE_BACKUP.workouts);
    expect(await listRoutines()).toEqual(COMPLETE_BACKUP.routines);
    expect(await listFolders()).toEqual(COMPLETE_BACKUP.folders);
    expect(await listNotes()).toEqual(COMPLETE_BACKUP.notes);
    expect(await listMeasurements()).toEqual(COMPLETE_BACKUP.measurements);
    expect(await listNutrition()).toEqual(COMPLETE_BACKUP.nutrition);
    expect(await listCustomExercises()).toEqual(COMPLETE_BACKUP.customExercises);
    expect(await getSettings()).toEqual(COMPLETE_BACKUP.settings);
  });

  it('rolls back every table if a write in the transaction fails', async () => {
    const original = workout('original', '2026-06-01', 1);
    await saveWorkout(original);
    const invalid = {
      ...COMPLETE_BACKUP,
      workouts: [workout('must-not-survive', '2026-06-11', 2)],
      routines: [{ name: 'missing primary key', exercises: [], updatedAt: 9 }],
    } as unknown as BackupV2;

    await expect(restoreBackupCollections(invalid)).rejects.toThrow();

    expect(await listWorkouts()).toEqual([original]);
    expect(await listRoutines()).toEqual([]);
    expect(await listFolders()).toEqual([]);
    expect(await getSettings()).toEqual({ id: 'settings', updatedAt: 0 });
  });
});

describe('backup restore store action', () => {
  it('does not admit an anonymous restore before an account is ready', async () => {
    useStore.setState({ user: null, authState: 'signedOut' });

    await useStore.getState().restoreBackup(COMPLETE_BACKUP);

    expect(await listWorkouts()).toEqual([]);
    expect(useStore.getState().workouts).toEqual([]);
    expect(pushRecordStrictMock).not.toHaveBeenCalled();
  });

  it('syncs an authenticated restore one collection at a time', async () => {
    await login('u1');

    await useStore.getState().restoreBackup(COMPLETE_BACKUP);

    expect(pushRecordStrictMock.mock.calls.map(([, collection]) => collection)).toEqual([
      'workouts',
      'routines',
      'folders',
      'notes',
      'measurements',
      'nutrition',
      'customExercises',
      'settings',
    ]);
  });

  it('strictly publishes the final note record after restore creates a Technique migration', async () => {
    await login('u1');
    const existing = {
      id: 'bench',
      entries: [{ date: '2026-06-10', text: 'Same timestamp remotely' }],
      updatedAt: 20,
    };
    const backup: BackupV2 = {
      ...COMPLETE_BACKUP,
      routines: [
        {
          id: 'r1',
          name: 'Restore',
          exercises: [
            {
              exerciseId: 'bench',
              sets: 3,
              repMin: 5,
              repMax: 8,
              restSec: 90,
              note: 'Restored technique',
            },
          ],
          updatedAt: 2,
        },
      ],
      notes: [existing],
    };

    await useStore.getState().restoreBackup(backup);

    expect(pushRecordStrictMock).toHaveBeenCalledWith('u1', 'notes', {
      ...existing,
      technique: 'Restored technique',
    });
  });

  it('rejects an authenticated restore when a required cloud write fails', async () => {
    await login('u1');
    pushRecordStrictMock.mockRejectedValueOnce(new Error('permission denied'));

    const restore = useStore.getState().restoreBackup(COMPLETE_BACKUP);

    await expect(restore).rejects.toBeInstanceOf(BackupCloudSyncError);
    await expect(restore).rejects.toMatchObject({ cause: new Error('permission denied') });

    expect(await listWorkouts()).toEqual(COMPLETE_BACKUP.workouts);
  });
});

describe('workouts repository', () => {
  it('lists saved workouts newest date first, then latest startTs first', async () => {
    await saveWorkout(workout('a', '2026-06-01', 1000));
    await saveWorkout(workout('b', '2026-06-03', 2000));
    await saveWorkout(workout('c', '2026-06-01', 5000));

    const list = await listWorkouts();

    expect(list.map((w) => w.id)).toEqual(['b', 'c', 'a']);
  });

  it('round-trips a workout with its sets', async () => {
    await saveWorkout(workout('a', '2026-06-01', 1000));

    const [stored] = await listWorkouts();

    expect(stored.sets).toEqual([{ exerciseId: 'bench', weightKg: 20, reps: 10, done: true }]);
    expect(stored.volumeKg).toBe(200);
  });

  it('overwrites a workout saved twice with the same id', async () => {
    await saveWorkout(workout('a', '2026-06-01', 1000));
    await saveWorkout({ ...workout('a', '2026-06-01', 1000), volumeKg: 999 });

    const list = await listWorkouts();

    expect(list).toHaveLength(1);
    expect(list[0].volumeKg).toBe(999);
  });

  it('deletes a workout by id', async () => {
    await saveWorkout(workout('a', '2026-06-01', 1000));
    await saveWorkout(workout('b', '2026-06-02', 1000));

    await deleteWorkout('a');

    expect((await listWorkouts()).map((w) => w.id)).toEqual(['b']);
  });
});

describe('settings repository', () => {
  it('returns a default settings record when none is stored', async () => {
    expect(await getSettings()).toEqual({ id: 'settings', updatedAt: 0 });
  });

  it('merges a patch and bumps updatedAt', async () => {
    const before = Date.now();

    const saved = await saveSettings({ locale: 'it' });

    expect(saved.id).toBe('settings');
    expect(saved.locale).toBe('it');
    expect(saved.updatedAt).toBeGreaterThanOrEqual(before);
    expect(await getSettings()).toEqual(saved);
  });

  it('keeps previously patched fields when patching another field', async () => {
    await saveSettings({ locale: 'en' });
    const saved = await saveSettings({ programStartDate: '2026-06-01' });

    expect(saved.locale).toBe('en');
    expect(saved.programStartDate).toBe('2026-06-01');
  });
});

describe('routines repository', () => {
  it('saves and lists routines', async () => {
    const routine: Routine = {
      id: 'r1',
      name: 'Operazione Rientro',
      exercises: [],
      updatedAt: 5,
    };

    await saveRoutine(routine);

    expect(await listRoutines()).toEqual([routine]);
  });
});

describe('applyImport', () => {
  it('bulk inserts fresh workouts and overwrites matching ids', async () => {
    await saveWorkout(workout('a', '2026-06-01', 1000));

    await applyImport([
      { ...workout('a', '2026-06-01', 1000), volumeKg: 111, source: 'hevy' },
      workout('b', '2026-06-02', 1000),
      workout('c', '2026-06-03', 1000),
    ]);

    const list = await listWorkouts();
    expect(list.map((w) => w.id)).toEqual(['c', 'b', 'a']);
    expect(list[2].volumeKg).toBe(111);
  });

  it('is a no-op for an empty list', async () => {
    await applyImport([]);

    expect(await listWorkouts()).toEqual([]);
  });
});
