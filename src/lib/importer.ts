import type { Routine, Settings, Workout } from './types';

export type Backup = {
  version: 1;
  workouts: Workout[];
  routines: Routine[];
  settings?: Settings;
};

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
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('import.invalid');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('import.invalid');
  }
  const candidate = data as Partial<Backup>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.workouts) ||
    !Array.isArray(candidate.routines)
  ) {
    throw new Error('import.invalid');
  }
  const backup: Backup = {
    version: 1,
    workouts: candidate.workouts,
    routines: candidate.routines,
  };
  if (candidate.settings !== undefined) backup.settings = candidate.settings;
  return backup;
}
