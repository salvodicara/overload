import Dexie, { type EntityTable } from 'dexie';
import type { BackupV2 } from './importer';
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

export type OverloadDb = Dexie & {
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

const SETTINGS_ID = 'settings';

export async function saveWorkout(w: Workout): Promise<void> {
  await db.workouts.put(w);
}

export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    await db.workouts.bulkPut(workouts);
  });
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.workouts.delete(id);
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
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, id: SETTINGS_ID, updatedAt: Date.now() };
  await db.settings.put(next);
  return next;
}

export async function saveRoutine(r: Routine): Promise<void> {
  await db.routines.put(r);
}

export async function saveFolder(f: Folder): Promise<void> {
  await db.folders.put(f);
}

export async function deleteFolder(id: string): Promise<void> {
  await db.folders.delete(id);
}

export async function deleteFolderWithRoutines(id: string, routineIds: string[]): Promise<void> {
  await db.transaction('rw', [db.folders, db.routines], async () => {
    await db.routines.bulkDelete(routineIds);
    await db.folders.delete(id);
  });
}

export async function listFolders(): Promise<Folder[]> {
  return db.folders.toArray();
}

export async function saveMeasurement(m: Measurement): Promise<void> {
  await db.measurements.put(m);
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.measurements.delete(id);
}

export async function listMeasurements(): Promise<Measurement[]> {
  return db.measurements.orderBy('date').toArray();
}

export async function saveNutrition(n: NutritionDay): Promise<void> {
  await db.nutrition.put(n);
}

export async function listNutrition(): Promise<NutritionDay[]> {
  return db.nutrition.toArray();
}

export async function saveCustomExercise(x: CustomExercise): Promise<void> {
  await db.customExercises.put(x);
}

export async function listCustomExercises(): Promise<CustomExercise[]> {
  return db.customExercises.toArray();
}

export async function saveNote(n: ExerciseNote): Promise<void> {
  await db.notes.put(n);
}

export async function listNotes(): Promise<ExerciseNote[]> {
  return db.notes.toArray();
}

export async function deleteRoutine(id: string): Promise<void> {
  await db.routines.delete(id);
}

export async function listRoutines(): Promise<Routine[]> {
  return db.routines.toArray();
}

/** Writes an already-deduplicated import batch (see `planImport`). */
export async function applyImport(fresh: Workout[]): Promise<void> {
  await db.workouts.bulkPut(fresh);
}

/** Removes all data owned by the current account in one atomic transaction. */
export async function clearAllUserData(): Promise<void> {
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
}

/** Restores a complete version 2 backup atomically across every local table. */
export async function restoreBackupCollections(backup: BackupV2): Promise<void> {
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
      await db.workouts.bulkPut(backup.workouts);
      await db.routines.bulkPut(backup.routines);
      await db.folders.bulkPut(backup.folders);
      await db.notes.bulkPut(backup.notes);
      await db.measurements.bulkPut(backup.measurements);
      await db.nutrition.bulkPut(backup.nutrition);
      await db.customExercises.bulkPut(backup.customExercises);
      await db.settings.bulkPut([backup.settings]);
    },
  );
}
