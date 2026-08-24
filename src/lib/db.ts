import Dexie, { type EntityTable } from 'dexie';
import type { ExerciseNote, Folder, Routine, Settings, Workout } from './types';

export type OverloadDb = Dexie & {
  workouts: EntityTable<Workout, 'id'>;
  routines: EntityTable<Routine, 'id'>;
  folders: EntityTable<Folder, 'id'>;
  notes: EntityTable<ExerciseNote, 'id'>;
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

const SETTINGS_ID = 'settings';

export async function saveWorkout(w: Workout): Promise<void> {
  await db.workouts.put(w);
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

export async function listFolders(): Promise<Folder[]> {
  return db.folders.toArray();
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
