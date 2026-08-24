import type { SetLog, Workout } from './types';

/** Sum of weight x reps over completed sets. */
export function computeVolume(sets: SetLog[]): number {
  return sets.reduce((total, s) => (s.done ? total + s.weightKg * s.reps : total), 0);
}

/** Heaviest completed set for an exercise across workouts strictly before `beforeDate`. */
export function maxWeightBefore(
  history: Workout[],
  exerciseId: string,
  beforeDate: string,
): number {
  let max = 0;
  for (const w of history) {
    if (w.date >= beforeDate) continue;
    for (const s of w.sets) {
      if (s.done && s.exerciseId === exerciseId && s.weightKg > max) max = s.weightKg;
    }
  }
  return max;
}

/** Copy of `sets` with `isPr` on completed sets heavier than the previous best (if any). */
export function flagPrs(sets: SetLog[], history: Workout[], date: string): SetLog[] {
  const maxByExercise = new Map<string, number>();
  return sets.map((s) => {
    if (!s.done) return { ...s };
    let previousMax = maxByExercise.get(s.exerciseId);
    if (previousMax === undefined) {
      previousMax = maxWeightBefore(history, s.exerciseId, date);
      maxByExercise.set(s.exerciseId, previousMax);
    }
    if (previousMax > 0 && s.weightKg > previousMax) return { ...s, isPr: true };
    return { ...s };
  });
}
