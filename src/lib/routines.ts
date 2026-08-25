import type { Folder, Routine, Workout } from './types';

const compareNewest = (left: Workout, right: Workout): number =>
  right.startTs - left.startTs
  || right.updatedAt - left.updatedAt
  || right.id.localeCompare(left.id);

const belongsTo = (routine: Routine, workout: Workout): boolean =>
  workout.routineId === routine.id
  || (workout.routineId == null && workout.dayLabel === routine.name);

/** Return the most recent saved workout for a routine, if it has one. */
export function lastCompletedFor(routine: Routine, workouts: Workout[]): Workout | null {
  return workouts
    .filter((workout) => belongsTo(routine, workout))
    .sort(compareNewest)[0] ?? null;
}

/**
 * Select the routine that should be offered as the next workout.
 * Program order is the user's stored routine order; history only determines
 * which routine is current and which fallback routine is oldest.
 */
export function nextRoutine(
  routines: Routine[],
  folders: Folder[],
  workouts: Workout[],
): Routine | null {
  if (routines.length === 0) return null;

  const latestWorkout = [...workouts]
    .sort(compareNewest)
    .find((workout) => routines.some((routine) => belongsTo(routine, workout)));

  if (!latestWorkout) return routines[0];

  const current = routines.find((routine) => belongsTo(routine, latestWorkout));
  if (!current) return routines[0];

  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  if (current.folderId && knownFolderIds.has(current.folderId)) {
    const inProgram = routines.filter((routine) => routine.folderId === current.folderId);
    const currentIndex = inProgram.findIndex((routine) => routine.id === current.id);
    if (inProgram.length > 0 && currentIndex >= 0) {
      return inProgram[(currentIndex + 1) % inProgram.length];
    }
  }

  return routines.reduce((oldest, routine) => {
    const oldestCompletion = lastCompletedFor(oldest, workouts);
    const routineCompletion = lastCompletedFor(routine, workouts);
    if (!oldestCompletion) return oldest;
    if (!routineCompletion) return routine;
    return compareNewest(oldestCompletion, routineCompletion) <= 0 ? routine : oldest;
  });
}
