import { kindOf, trackingOf, type SetLog, type TrackingType, type Workout } from './types';
import { displayWeight, type WeightUnit } from './units';

/** Local-time YYYY-MM-DD (the 'sv' locale formats exactly this way). */
export function todayISO(): string {
  return new Date().toLocaleDateString('sv');
}

export function fmtDate(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', opts);
}

function latestWorkoutWith(
  workouts: Workout[],
  exerciseId: string,
  routineId?: string,
): Workout | null {
  const matching = workouts.filter((workout) =>
    workout.sets.some(
      (set) => set.exerciseId === exerciseId && set.done && kindOf(set.kind) === 'working',
    ),
  );
  const sameRoutine = routineId
    ? matching.filter((workout) => workout.routineId === routineId)
    : [];
  let latest: Workout | null = null;
  for (const w of sameRoutine.length > 0 ? sameRoutine : matching) {
    if (
      latest === null ||
      w.date > latest.date ||
      (w.date === latest.date && w.startTs > latest.startTs)
    ) {
      latest = w;
    }
  }
  return latest;
}

/** Most recent completed working sets of an exercise, kept in their saved order. */
export function previousSets(
  workouts: Workout[],
  exerciseId: string,
  routineId?: string,
): SetLog[] {
  return (
    latestWorkoutWith(workouts, exerciseId, routineId)?.sets.filter(
      (s) => s.exerciseId === exerciseId && s.done && kindOf(s.kind) === 'working',
    ) ?? []
  );
}

export function formatPreviousSet(
  set: SetLog,
  tracking: TrackingType | undefined,
  unit: WeightUnit,
): string {
  const mode = trackingOf(tracking ?? set.tracking);
  if (mode === 'duration') return `${set.durationSec ?? 0}s`;
  if (mode === 'reps') return String(set.reps);
  return `${displayWeight(set.weightKg, unit)} × ${set.reps}`;
}
