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

const CSV_HEADER = 'date,day,exercise,weight_kg,reps';

export type BackupData = {
  workouts: Workout[];
  routines: Routine[];
  folders: Folder[];
  notes: ExerciseNote[];
  measurements: Measurement[];
  nutrition: NutritionDay[];
  customExercises: CustomExercise[];
  settings: Settings;
};

/** Full backup as pretty JSON, readable back by `parseBackup`. */
export function toBackupJson(data: BackupData): string {
  const backup: BackupV2 = { version: 2, ...data };
  return JSON.stringify(backup, null, 2);
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Flat CSV of every completed set, one row per set. */
export function toCsv(workouts: Workout[], exerciseName: (id: string) => string): string {
  const lines = [CSV_HEADER];
  for (const workout of workouts) {
    for (const set of workout.sets) {
      if (!set.done) continue;
      lines.push(
        [
          csvField(workout.date),
          csvField(workout.dayLabel ?? ''),
          csvField(exerciseName(set.exerciseId)),
          String(set.weightKg),
          String(set.reps),
        ].join(','),
      );
    }
  }
  return lines.join('\n');
}
