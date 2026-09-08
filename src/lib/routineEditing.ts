import { trackingOf, type Routine, type RoutineExercise, type TrackingType } from './types';
const bounded = (n: unknown, min: number, max: number, integer = false): boolean =>
  typeof n === 'number' &&
  Number.isFinite(n) &&
  n >= min &&
  n <= max &&
  (!integer || Number.isInteger(n));
const optionalWeight = (n: unknown): boolean => n === undefined || bounded(n, 0, 2000);
export function routineDraftValid(routine: Routine): boolean {
  return (
    Boolean(routine.name.trim()) &&
    routine.exercises.every((ex) => {
      const tracking = trackingOf(ex.tracking);
      const target = (t: { repMin: number; repMax: number | null; startWeightKg?: number }) =>
        bounded(t.repMin, 1, 86400, true) &&
        (t.repMax === null || bounded(t.repMax, t.repMin, 86400, true)) &&
        optionalWeight(t.startWeightKg);
      return (
        bounded(ex.sets, 1, 100, true) &&
        target(ex) &&
        bounded(ex.restSec, 0, 3600, true) &&
        (ex.incrementKg === undefined || bounded(ex.incrementKg, 0, 1000)) &&
        (!ex.setTargets || (ex.setTargets.length === ex.sets && ex.setTargets.every(target))) &&
        (!ex.warmupSets ||
          (ex.warmupSets.length <= 20 &&
            ex.warmupSets.every((t) =>
              tracking === 'duration'
                ? bounded(t.durationSec, 1, 86400, true)
                : bounded(t.reps, 1, 86400, true) &&
                  (tracking !== 'weight_reps' || bounded(t.weightKg, 0, 2000)),
            )))
      );
    })
  );
}
export function changeRoutineTracking(
  ex: RoutineExercise,
  tracking: TrackingType,
): RoutineExercise {
  const next = structuredClone(ex);
  next.tracking = tracking;
  next.warmupSets = next.warmupSets?.map((t) =>
    tracking === 'duration'
      ? { durationSec: t.durationSec ?? t.reps ?? 30 }
      : tracking === 'reps'
        ? { reps: t.reps ?? t.durationSec ?? 8 }
        : { weightKg: t.weightKg ?? 0, reps: t.reps ?? t.durationSec ?? 8 },
  );
  if (tracking !== 'weight_reps') {
    delete next.startWeightKg;
    delete next.incrementKg;
    next.setTargets = next.setTargets?.map(({ startWeightKg: _, ...target }) => target);
  }
  return next;
}
