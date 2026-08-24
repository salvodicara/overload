import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyImport,
  db,
  deleteWorkout,
  getSettings,
  listRoutines,
  listWorkouts,
  saveRoutine,
  saveSettings,
  saveWorkout,
} from '../db';
import type { Routine, Workout } from '../types';

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
  await db.workouts.clear();
  await db.routines.clear();
  await db.settings.clear();
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
      days: [{ label: 'A', name: 'Upper', exercises: [] }],
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
