import { computeVolume } from './volume';
import { kindOf, trackingOf, type Routine, type SetLog, type Workout } from './types';
import { newOccurrenceId } from './workoutOccurrences';

export type WorkoutDraft = {
  date: string;
  startTime: string;
  durationMin: number;
  dayLabel: string;
  note: string;
  sets: SetLog[];
  exerciseNotes: NonNullable<Workout['exerciseNotes']>;
  exerciseOrder: string[];
};

export function draftFromWorkout(workout: Workout): WorkoutDraft {
  const start = new Date(workout.startTs);
  const durationSec =
    workout.durationSec ??
    (workout.endTs ? Math.max(0, Math.round((workout.endTs - workout.startTs) / 1000)) : 0);
  return {
    date: workout.date,
    startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    durationMin: Math.max(1, Math.round(durationSec / 60)),
    dayLabel: workout.dayLabel ?? '',
    note: workout.note ?? '',
    sets: structuredClone(workout.sets),
    exerciseNotes: structuredClone(workout.exerciseNotes ?? []),
    exerciseOrder: [...(workout.exerciseOrder ?? [])],
  };
}

export function validateWorkoutDraft(draft: WorkoutDraft): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.push('date');
  if (!/^\d{2}:\d{2}$/.test(draft.startTime)) errors.push('startTime');
  if (!Number.isFinite(draft.durationMin) || draft.durationMin <= 0) errors.push('duration');
  if (!draft.sets.some((set) => set.done)) errors.push('sets');
  return errors;
}

export function removeExerciseFromDraft(draft: WorkoutDraft, key: string): WorkoutDraft {
  return {
    ...draft,
    sets: draft.sets.filter((set) => (set.exerciseInstanceId ?? set.exerciseId) !== key),
    exerciseNotes: draft.exerciseNotes.filter(
      (note) => (note.exerciseInstanceId ?? note.exerciseId) !== key,
    ),
    exerciseOrder: draft.exerciseOrder.filter((instanceId) => instanceId !== key),
  };
}

export function removeSetFromDraft(draft: WorkoutDraft, index: number): WorkoutDraft {
  const target = draft.sets[index];
  if (!target) return draft;
  const key = target.exerciseInstanceId ?? target.exerciseId;
  const sets = draft.sets.filter((_, setIndex) => setIndex !== index);
  return sets.some((set) => (set.exerciseInstanceId ?? set.exerciseId) === key)
    ? { ...draft, sets }
    : removeExerciseFromDraft(draft, key);
}

export function workoutFromDraft(
  original: Workout,
  draft: WorkoutDraft,
  now = Date.now(),
): Workout {
  const startTs = new Date(`${draft.date}T${draft.startTime}:00`).getTime();
  const durationSec = Math.max(60, Math.round(draft.durationMin * 60));
  const sets = structuredClone(draft.sets);
  return {
    ...original,
    date: draft.date,
    startTs,
    endTs: startTs + durationSec * 1000,
    durationSec,
    dayLabel: draft.dayLabel.trim() || undefined,
    note: draft.note.trim() || undefined,
    sets,
    volumeKg: computeVolume(sets),
    exerciseNotes: draft.exerciseNotes.length ? structuredClone(draft.exerciseNotes) : undefined,
    exerciseOrder: draft.exerciseOrder.length ? [...draft.exerciseOrder] : undefined,
    updatedAt: now,
  };
}

export function recomputeWorkoutFacts(workouts: Workout[]): Workout[] {
  const chronological = [...workouts].sort(
    (left, right) => left.startTs - right.startTs || left.id.localeCompare(right.id),
  );
  const maxWeight = new Map<string, number>();
  const recomputed = chronological.map((workout) => {
    const sets = workout.sets.map((set) => {
      const clean = { ...set, isPr: undefined };
      if (
        !set.done ||
        kindOf(set.kind) !== 'working' ||
        trackingOf(set.tracking) !== 'weight_reps'
      ) {
        return clean;
      }
      const previous = maxWeight.get(set.exerciseId) ?? 0;
      const isPr = previous > 0 && set.weightKg > previous;
      maxWeight.set(set.exerciseId, Math.max(previous, set.weightKg));
      return isPr ? { ...clean, isPr: true } : clean;
    });
    return { ...workout, sets, volumeKg: computeVolume(sets) };
  });
  return recomputed.sort(
    (left, right) => right.startTs - left.startTs || right.id.localeCompare(left.id),
  );
}

export function routineFromWorkout(workout: Workout, name: string, folderId?: string): Routine {
  const groups = new Map<string, SetLog[]>();
  const order: string[] = [];
  for (const set of workout.sets) {
    const key = set.exerciseInstanceId ?? set.exerciseId;
    if (!groups.has(key)) order.push(key);
    groups.set(key, [...(groups.get(key) ?? []), set]);
  }
  return {
    id: crypto.randomUUID(),
    name,
    ...(folderId ? { folderId } : {}),
    exercises: order.map((key) => {
      const sets = groups.get(key)!;
      const first = sets[0];
      const working = sets.filter((set) => kindOf(set.kind) === 'working');
      const reps = working.map((set) =>
        trackingOf(set.tracking) === 'duration' ? (set.durationSec ?? 0) : set.reps,
      );
      return {
        exerciseId: first.exerciseId,
        occurrenceId: newOccurrenceId(),
        tracking: trackingOf(first.tracking),
        sets: Math.max(1, working.length),
        repMin: Math.max(1, Math.min(...reps, 8)),
        repMax: Math.max(1, Math.max(...reps, 12)),
        restSec: 90,
        startWeightKg: first.weightKg,
      };
    }),
    updatedAt: Date.now(),
  };
}
