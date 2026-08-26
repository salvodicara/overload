import type { ActiveSession } from './session';
import type { Routine, RoutineExercise } from './types';
import { normalizeRoutineOccurrences } from './workoutOccurrences';

export type RoutineChangeKind = 'add' | 'remove' | 'replace' | 'move' | 'sets' | 'rest';

export type RoutineSessionDiff = {
  changes: RoutineChangeKind[];
  nextRoutine: Routine;
};

function resizeTargets(rx: RoutineExercise, sets: number): RoutineExercise['setTargets'] {
  if (!rx.setTargets?.length) return rx.setTargets;
  const last = rx.setTargets.at(-1)!;
  return Array.from({ length: sets }, (_, index) =>
    structuredClone(rx.setTargets?.[index] ?? last),
  );
}

export function diffRoutineSession(routine: Routine, active: ActiveSession): RoutineSessionDiff {
  const normalized = normalizeRoutineOccurrences(routine);
  const originalById = new Map(
    normalized.exercises.map((exercise) => [exercise.occurrenceId!, exercise]),
  );
  const changes = new Set<RoutineChangeKind>();
  const retained = new Set<string>();
  const nextExercises = active.ex.map((exercise, index): RoutineExercise => {
    const identified = exercise.routineOccurrenceId
      ? originalById.get(exercise.routineOccurrenceId)
      : undefined;
    const positional = normalized.exercises[index];
    const source =
      identified ?? (positional?.exerciseId === exercise.exerciseId ? positional : undefined);
    const workingSets = Math.max(1, exercise.sets.filter((set) => set.kind === 'working').length);
    if (!source) {
      changes.add('add');
      return {
        exerciseId: exercise.exerciseId,
        occurrenceId: exercise.instanceId,
        tracking: exercise.tracking,
        sets: workingSets,
        repMin: exercise.tracking === 'duration' ? 30 : 8,
        repMax: exercise.tracking === 'duration' ? 60 : 12,
        restSec: exercise.restOverride ?? 90,
      };
    }
    retained.add(source.occurrenceId!);
    const originalIndex = normalized.exercises.findIndex(
      (item) => item.occurrenceId === source.occurrenceId,
    );
    if (originalIndex !== index) changes.add('move');
    if (source.exerciseId !== exercise.exerciseId) changes.add('replace');
    if (source.sets !== workingSets) changes.add('sets');
    const restSec = exercise.restOverride ?? source.restSec;
    if (restSec !== source.restSec) changes.add('rest');
    return {
      ...source,
      exerciseId: exercise.exerciseId,
      tracking: exercise.tracking,
      sets: workingSets,
      restSec,
      setTargets: resizeTargets(source, workingSets),
    };
  });
  if (normalized.exercises.some((exercise) => !retained.has(exercise.occurrenceId!))) {
    changes.add('remove');
  }
  return {
    changes: [...changes],
    nextRoutine: { ...normalized, exercises: nextExercises },
  };
}
