import type { Backup } from './importer';
import type { Routine, Settings, Workout } from './types';

const CSV_HEADER = 'date,day,exercise,weight_kg,reps';

/** Full backup as pretty JSON, readable back by `parseBackup`. */
export function toBackupJson(
  workouts: Workout[],
  routines: Routine[],
  settings?: Settings,
): string {
  const backup: Backup = { version: 1, workouts, routines };
  if (settings !== undefined) backup.settings = settings;
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
