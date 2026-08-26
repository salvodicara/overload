import type { Routine, Workout } from './types';

export function occurrenceId(routineId: string, index: number, exerciseId: string): string {
  return `rx:${routineId}:${index}:${exerciseId}`;
}

export function newOccurrenceId(): string {
  try {
    return `rx:${crypto.randomUUID()}`;
  } catch {
    return `rx:${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function normalizeRoutineOccurrences(routine: Routine): Routine {
  return {
    ...routine,
    exercises: routine.exercises.map((exercise, index) => ({
      ...exercise,
      occurrenceId: exercise.occurrenceId ?? occurrenceId(routine.id, index, exercise.exerciseId),
    })),
  };
}

export function normalizeWorkoutOccurrences(workout: Workout): Workout {
  const order = workout.exerciseOrder ?? [];
  const byExercise = new Map<string, string[]>();
  for (const instanceId of order) {
    const exerciseId = instanceId.split(':').at(-1);
    if (!exerciseId) continue;
    byExercise.set(exerciseId, [...(byExercise.get(exerciseId) ?? []), instanceId]);
  }
  const cursor = new Map<string, number>();
  const sets = workout.sets.map((set) => {
    if (set.exerciseInstanceId) return set;
    const candidates = byExercise.get(set.exerciseId) ?? [];
    const index = cursor.get(set.exerciseId) ?? 0;
    cursor.set(set.exerciseId, index + 1);
    return candidates.length > 0
      ? { ...set, exerciseInstanceId: candidates[Math.min(index, candidates.length - 1)] }
      : set;
  });
  return { ...workout, sets };
}
