import { recomputeWorkoutFacts } from './workoutEditing';
import Dexie, { type EntityTable } from 'dexie';
import {
  applyDiaryMutation,
  legacyManualEntry,
  nutritionDayWithEntries,
  validateSavedMeals,
  type DiaryMutation,
  type FoodEntry,
} from './foodDiary';
import { normalizeNutritionDay } from './nutrition';
import {
  NUTRIENT_FIELDS,
  validNutrient,
  validNutritionDay,
  type NutritionPatch,
} from './nutrition';
import { assertBackupRecords, type BackupV2 } from './importer';
import { assertMeasurement, assertSettings } from './recordValidation';
import type {
  CustomExercise,
  ExerciseNote,
  Folder,
  Measurement,
  NutritionDay,
  Routine,
  Settings,
  Workout,
} from './types';

export type DeletionMarker = {
  id: string;
  collection: string;
  recordId: string;
  updatedAt: number;
};

export type OverloadDb = Dexie & {
  tombstones: EntityTable<DeletionMarker, 'id'>;
  workouts: EntityTable<Workout, 'id'>;
  routines: EntityTable<Routine, 'id'>;
  folders: EntityTable<Folder, 'id'>;
  notes: EntityTable<ExerciseNote, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
  nutrition: EntityTable<NutritionDay, 'id'>;
  customExercises: EntityTable<CustomExercise, 'id'>;
  settings: EntityTable<Settings, 'id'>;
};

export const db = new Dexie('overload') as OverloadDb;

db.version(1).stores({
  workouts: 'id, date, updatedAt',
  routines: 'id, updatedAt',
  settings: 'id',
});

db.version(2).stores({
  folders: 'id, updatedAt',
});

db.version(3).stores({
  notes: 'id, updatedAt',
});

db.version(4).stores({
  measurements: 'id, date, metric, updatedAt',
  nutrition: 'id, updatedAt',
});

db.version(5).stores({
  customExercises: 'id, updatedAt',
});

db.version(6).stores({ tombstones: 'id, collection' });

/** Persist deletion intent atomically; keep it until every device can observe it. */
async function deleteWithMarker(
  collection: 'workouts' | 'routines' | 'folders' | 'measurements',
  id: string,
): Promise<void> {
  const table = db[
    collection as keyof Pick<
      OverloadDb,
      | 'workouts'
      | 'routines'
      | 'folders'
      | 'notes'
      | 'measurements'
      | 'nutrition'
      | 'customExercises'
      | 'settings'
    >
  ] as EntityTable<{ id: string; updatedAt: number }, 'id'>;
  await db.transaction('rw', [table, db.tombstones], async () => {
    const row = await table.get(id);
    const previous = await db.tombstones.get(`${collection}/${id}`);
    await db.tombstones.put({
      id: `${collection}/${id}`,
      collection,
      recordId: id,
      updatedAt: Math.max(Date.now(), (row?.updatedAt ?? 0) + 1, (previous?.updatedAt ?? 0) + 1),
    });
    await table.delete(id);
  });
}

/** Local writes must outrank the last revision, including restored/future clocks. */
async function putLocal<T extends { id: string; updatedAt: number }>(
  collection: string,
  row: T,
): Promise<void> {
  const table = db[
    collection as keyof Pick<
      OverloadDb,
      | 'workouts'
      | 'routines'
      | 'folders'
      | 'notes'
      | 'measurements'
      | 'nutrition'
      | 'customExercises'
      | 'settings'
    >
  ] as EntityTable<{ id: string; updatedAt: number }, 'id'>;
  await db.transaction('rw', [table, db.tombstones], async () => {
    const previous = await table.get(row.id);
    const marker = await db.tombstones.get(`${collection}/${row.id}`);
    row.updatedAt = Math.max(
      Date.now(),
      row.updatedAt,
      (previous?.updatedAt ?? -1) + 1,
      (marker?.updatedAt ?? -1) + 1,
    );
    await table.put(row);
    if (marker) await db.tombstones.delete(marker.id);
  });
}

const SETTINGS_ID = 'settings';

export async function saveWorkout(w: Workout): Promise<void> {
  await putLocal('workouts', w);
}

export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  await db.transaction('rw', [db.workouts, db.tombstones], async () => {
    for (const workout of workouts) await putLocal('workouts', workout);
  });
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.transaction('rw', [db.workouts, db.tombstones], async () => {
    await deleteWithMarker('workouts', id);
    await db.workouts.bulkPut(recomputeWorkoutFacts(await db.workouts.toArray(), Date.now()));
  });
}

/** Newest first: date descending, then startTs descending within a date. */
export async function listWorkouts(): Promise<Workout[]> {
  const all = await db.workouts.toArray();
  return all.sort((a, b) => (a.date === b.date ? b.startTs - a.startTs : a.date < b.date ? 1 : -1));
}

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get(SETTINGS_ID);
  return stored ?? { id: SETTINGS_ID, updatedAt: 0 };
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  if (patch.savedMeals !== undefined)
    patch = { ...patch, savedMeals: validateSavedMeals(patch.savedMeals) };
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, id: SETTINGS_ID, updatedAt: Date.now() };
  assertSettings(next);
  await putLocal('settings', next);
  return next;
}

export async function saveRoutine(r: Routine): Promise<void> {
  await putLocal('routines', r);
}

export async function saveFolder(f: Folder): Promise<void> {
  await putLocal('folders', f);
}

export async function deleteFolder(id: string): Promise<void> {
  await deleteWithMarker('folders', id);
}

export async function deleteFolderWithRoutines(id: string, routineIds: string[]): Promise<void> {
  await db.transaction('rw', [db.folders, db.routines, db.tombstones], async () => {
    for (const routineId of routineIds) await deleteWithMarker('routines', routineId);
    await deleteWithMarker('folders', id);
  });
}

export async function listFolders(): Promise<Folder[]> {
  return db.folders.toArray();
}

/** Add a complete plan once. Existing imported/edited records are never overwritten. */
export async function importRoutinePlanRecords(
  records: import('./routinePlan').RoutinePlanRecords,
): Promise<{ alreadyImported: boolean }> {
  return db.transaction('rw', [db.folders, db.routines, db.tombstones], async () => {
    if (await db.folders.get(records.folder.id)) {
      // Cloud collections arrive separately. Fill missing children, but preserve edits.
      const existing = await db.routines.bulkGet(records.routines.map((routine) => routine.id));
      const missing = records.routines.filter((_, index) => !existing[index]);
      for (const routine of missing) await putLocal('routines', routine);
      return { alreadyImported: missing.length === 0 };
    }
    if ((await db.routines.bulkGet(records.routines.map((routine) => routine.id))).some(Boolean))
      throw new Error('import.invalid');
    await putLocal('folders', records.folder);
    for (const routine of records.routines) await putLocal('routines', routine);
    return { alreadyImported: false };
  });
}

export async function saveMeasurement(m: Measurement): Promise<void> {
  assertMeasurement(m);
  await putLocal('measurements', m);
}

export async function deleteMeasurement(id: string): Promise<void> {
  await deleteWithMarker('measurements', id);
}

export async function listMeasurements(): Promise<Measurement[]> {
  return db.measurements.orderBy('date').toArray();
}

export async function saveNutrition(date: string, patch: NutritionPatch): Promise<NutritionDay> {
  return db.transaction('rw', [db.nutrition, db.tombstones], async () => {
    const existing = await db.nutrition.get(date);
    if (existing?.entries !== undefined) {
      const manual = existing.entries.find(
        (entry) => entry.id === `manual:${date}` && entry.food.source === 'manual',
      );
      const nutrients = { ...manual?.food.nutrients };
      for (const [key, value] of Object.entries(patch)) {
        if (
          !NUTRIENT_FIELDS.includes(key as (typeof NUTRIENT_FIELDS)[number]) ||
          !validNutrient(value)
        )
          throw new Error('diet.invalid');
        if (value === null) delete nutrients[key as keyof typeof nutrients];
        else nutrients[key as keyof typeof nutrients] = value;
      }
      const snapshot = legacyManualEntry({
        id: date,
        date,
        kcal: null,
        proteinG: null,
        ...nutrients,
        updatedAt: 0,
      });
      const entries = existing.entries.filter((entry) => entry !== manual);
      if (snapshot) entries.unshift(snapshot);
      const next = nutritionDayWithEntries(date, entries, existing);
      await putLocal('nutrition', next);
      return next;
    }
    const next: NutritionDay = {
      ...existing,
      id: date,
      date,
      kcal: existing?.kcal ?? null,
      proteinG: existing?.proteinG ?? null,
      ...patch,
      updatedAt: Date.now(),
    };
    if (!validNutritionDay(next)) throw new Error('diet.invalid');
    await putLocal('nutrition', next);
    return next;
  });
}

export async function listNutrition(): Promise<NutritionDay[]> {
  return (await db.nutrition.toArray()).map(normalizeNutritionDay);
}

export async function mutateDiaryEntries(
  date: string,
  mutation: DiaryMutation,
): Promise<NutritionDay> {
  return db.transaction('rw', [db.nutrition, db.tombstones], async () => {
    const next = applyDiaryMutation(date, await db.nutrition.get(date), mutation);
    await putLocal('nutrition', next);
    return next;
  });
}

export async function importDiaryDays(
  days: { date: string; entries: FoodEntry[] }[],
): Promise<NutritionDay[]> {
  if (days.length > 366) throw new Error('diet.invalid');
  return db.transaction('rw', [db.nutrition, db.tombstones], async () => {
    const changed = new Map<string, NutritionDay>();
    for (const day of days)
      changed.set(
        day.date,
        await mutateDiaryEntries(day.date, { kind: 'add', entries: day.entries }),
      );
    return [...changed.values()];
  });
}

export async function saveCustomExercise(x: CustomExercise): Promise<void> {
  await putLocal('customExercises', x);
}

export async function listCustomExercises(): Promise<CustomExercise[]> {
  return db.customExercises.toArray();
}

export async function saveNote(n: ExerciseNote): Promise<void> {
  await putLocal('notes', n);
}

export async function listNotes(): Promise<ExerciseNote[]> {
  return db.notes.toArray();
}

export async function deleteRoutine(id: string): Promise<void> {
  await deleteWithMarker('routines', id);
}

export async function listRoutines(): Promise<Routine[]> {
  return db.routines.toArray();
}

/** Writes an already-deduplicated import batch (see `planImport`). */
export async function applyImport(fresh: Workout[]): Promise<void> {
  await db.transaction('rw', [db.workouts, db.tombstones], async () => {
    for (const workout of fresh) await putLocal('workouts', workout);
  });
}

/** Removes all data owned by the current account in one atomic transaction. */
export async function clearAllUserData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.tombstones,
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
        db.tombstones.clear(),
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
}

/** Restores a complete version 2 backup atomically across every local table. */
export async function restoreBackupCollections(backup: BackupV2): Promise<void> {
  assertBackupRecords(backup);
  backup = {
    ...backup,
    nutrition: backup.nutrition.map(normalizeNutritionDay),
    settings: {
      ...backup.settings,
      ...(backup.settings.savedMeals === undefined
        ? {}
        : { savedMeals: validateSavedMeals(backup.settings.savedMeals) }),
    },
  };
  await db.transaction(
    'rw',
    [
      db.tombstones,
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
      const restore = async (collection: string, rows: { id: string; updatedAt: number }[]) => {
        const table = db[
          collection as keyof Pick<
            OverloadDb,
            | 'workouts'
            | 'routines'
            | 'folders'
            | 'notes'
            | 'measurements'
            | 'nutrition'
            | 'customExercises'
            | 'settings'
          >
        ] as EntityTable<{ id: string; updatedAt: number }, 'id'>;
        for (const row of rows) {
          const marker = await db.tombstones.get(`${collection}/${row.id}`);
          const current = await table.get(row.id);
          const content = (value: typeof row) => JSON.stringify({ ...value, updatedAt: 0 });
          const replaces = marker || (current && content(current) !== content(row));
          const updatedAt = replaces
            ? Math.max(
                Date.now(),
                row.updatedAt,
                (current?.updatedAt ?? 0) + 1,
                (marker?.updatedAt ?? 0) + 1,
              )
            : Math.max(row.updatedAt, current?.updatedAt ?? 0);
          await table.put({ ...row, updatedAt });
          if (marker) await db.tombstones.delete(marker.id);
        }
      };
      await restore('workouts', backup.workouts);
      await restore('routines', backup.routines);
      await restore('folders', backup.folders);
      await restore('notes', backup.notes);
      await restore('measurements', backup.measurements);
      await restore('nutrition', backup.nutrition);
      await restore('customExercises', backup.customExercises);
      await restore('settings', [backup.settings]);
    },
  );
}
