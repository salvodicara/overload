import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyImport,
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
import type { Routine, Workout } from '../types';

const { pushRecordMock, pushRecordStrictMock } = vi.hoisted(() => ({
  pushRecordMock: vi.fn(async (_uid: string, _collection: string, _record: unknown) => {}),
  pushRecordStrictMock: vi.fn(
    async (_uid: string, _collection: string, _record: unknown) => {},
  ),
}));

vi.mock('../sync', () => ({
  deleteRecord: vi.fn(async () => {}),
  pushRecord: pushRecordMock,
  pushRecordStrict: pushRecordStrictMock,
  startSync: vi.fn(() => () => {}),
}));

import { BackupCloudSyncError, useStore } from '../../state/useStore';

const originalReload = useStore.getState().reload;

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

beforeEach(async () => {
  pushRecordMock.mockClear();
  pushRecordStrictMock.mockReset();
  pushRecordStrictMock.mockResolvedValue(undefined);
  useStore.setState({ user: null, reload: originalReload });
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

afterEach(() => {
  useStore.setState({ user: null, reload: originalReload });
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
  it('restores all collections, reloads once, and never syncs an anonymous import', async () => {
    const reload = vi.fn(originalReload);
    useStore.setState({ user: null, reload });

    await useStore.getState().restoreBackup(COMPLETE_BACKUP);

    expect(reload).toHaveBeenCalledOnce();
    expect(useStore.getState()).toMatchObject({
      workouts: COMPLETE_BACKUP.workouts,
      routines: COMPLETE_BACKUP.routines,
      folders: COMPLETE_BACKUP.folders,
      notes: COMPLETE_BACKUP.notes,
      measurements: COMPLETE_BACKUP.measurements,
      nutrition: COMPLETE_BACKUP.nutrition,
      customExercises: COMPLETE_BACKUP.customExercises,
      settings: COMPLETE_BACKUP.settings,
    });
    expect(pushRecordStrictMock).not.toHaveBeenCalled();
  });

  it('syncs an authenticated restore one collection at a time', async () => {
    useStore.setState({ user: { uid: 'u1', name: null }, reload: vi.fn(originalReload) });

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

  it('rejects an authenticated restore when a required cloud write fails', async () => {
    const reload = vi.fn(originalReload);
    useStore.setState({ user: { uid: 'u1', name: null }, reload });
    pushRecordStrictMock.mockRejectedValueOnce(new Error('permission denied'));

    const restore = useStore.getState().restoreBackup(COMPLETE_BACKUP);

    await expect(restore).rejects.toBeInstanceOf(BackupCloudSyncError);
    await expect(restore).rejects.toMatchObject({ cause: new Error('permission denied') });

    expect(reload).toHaveBeenCalledOnce();
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
