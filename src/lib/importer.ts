import {
  assertCollection,
  assertWorkout,
  assertRoutine,
  assertFolder,
  assertExerciseNote,
  assertMeasurement,
  assertCustomExercise,
  assertSettings,
} from './recordValidation';
import { normalizeNutritionDay, validNutritionDay } from './nutrition';
import { validateSavedMeals } from './foodDiary';
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

export type BackupV1 = {
  version: 1;
  workouts: Workout[];
  routines: Routine[];
  settings?: Settings;
};

export type BackupV2 = {
  version: 2;
  workouts: Workout[];
  routines: Routine[];
  folders: Folder[];
  notes: ExerciseNote[];
  measurements: Measurement[];
  nutrition: NutritionDay[];
  customExercises: CustomExercise[];
  settings: Settings;
};

export type Backup = BackupV1 | BackupV2;

const V2_KEYS = new Set([
  'version',
  'workouts',
  'routines',
  'folders',
  'notes',
  'measurements',
  'nutrition',
  'customExercises',
  'settings',
]);

/** Splits an incoming batch into the workouts that are new and a count of the ones already known. */
export function planImport(
  existingIds: ReadonlySet<string>,
  incoming: Workout[],
): { fresh: Workout[]; duplicates: number } {
  const fresh: Workout[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const workout of incoming) {
    if (existingIds.has(workout.id) || seen.has(workout.id)) {
      duplicates += 1;
      continue;
    }
    seen.add(workout.id);
    fresh.push(workout);
  }
  return { fresh, duplicates };
}

/** Parses a JSON backup file, throwing the i18n key `import.invalid` on any shape mismatch. */
export function parseBackup(json: string): Backup {
  try {
    return parseBackupValue(json);
  } catch {
    throw new Error('import.invalid');
  }
}

export function assertBackupRecords(backup: Backup): void {
  assertCollection(backup.workouts, assertWorkout);
  assertCollection(backup.routines, assertRoutine);
  if (backup.settings !== undefined) assertSettings(backup.settings);
  if (backup.version === 2) {
    assertCollection(backup.folders, assertFolder);
    assertCollection(backup.notes, assertExerciseNote);
    assertCollection(backup.measurements, assertMeasurement);
    assertCollection(backup.customExercises, assertCustomExercise);
    assertCollection(backup.nutrition, (value) => {
      if (!validNutritionDay(value)) throw new Error('import.invalid');
    });
  }
}

function parseBackupValue(json: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('import.invalid');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('import.invalid');
  }
  const candidate = data as Record<string, unknown>;
  if (candidate.version === 1) {
    if (!Array.isArray(candidate.workouts) || !Array.isArray(candidate.routines)) {
      throw new Error('import.invalid');
    }
    const backup: BackupV1 = {
      version: 1,
      workouts: candidate.workouts as Workout[],
      routines: candidate.routines as Routine[],
    };
    if (candidate.settings !== undefined) {
      backup.settings = candidate.settings as Settings;
      if (backup.settings.savedMeals !== undefined)
        backup.settings = {
          ...backup.settings,
          savedMeals: validateSavedMeals(backup.settings.savedMeals),
        };
    }
    assertBackupRecords(backup);
    return backup;
  }

  const settings = candidate.settings;
  const keys = Object.keys(candidate);
  if (
    candidate.version !== 2 ||
    keys.length !== V2_KEYS.size ||
    keys.some((key) => !V2_KEYS.has(key)) ||
    !Array.isArray(candidate.workouts) ||
    !Array.isArray(candidate.routines) ||
    !Array.isArray(candidate.folders) ||
    !Array.isArray(candidate.notes) ||
    !Array.isArray(candidate.measurements) ||
    !Array.isArray(candidate.nutrition) ||
    !candidate.nutrition.every(validNutritionDay) ||
    !Array.isArray(candidate.customExercises) ||
    typeof settings !== 'object' ||
    settings === null ||
    Array.isArray(settings) ||
    (settings as Record<string, unknown>).id !== 'settings'
  ) {
    throw new Error('import.invalid');
  }

  const backup = candidate as BackupV2;
  assertBackupRecords(backup);
  return {
    ...backup,
    nutrition: backup.nutrition.map(normalizeNutritionDay),
    settings: {
      ...backup.settings,
      ...(backup.settings.savedMeals === undefined
        ? {}
        : { savedMeals: validateSavedMeals(backup.settings.savedMeals) }),
    },
  };
}
