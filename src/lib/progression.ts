import { kindOf, type RoutineExercise, type Workout } from './types';

export type Suggestion = { weights: number[]; hintKey: string };

const DEFAULT_INCREMENT_KG = 2.5;

/** Most recent workout holding the exercise, preferring the current routine when it has history. */
function lastWorkoutWith(
  history: Workout[],
  exerciseId: string,
  routineId?: string,
): Workout | null {
  const matching = history.filter((workout) =>
    workout.sets.some(
      (set) => set.done && kindOf(set.kind) === 'working' && set.exerciseId === exerciseId,
    ),
  );
  const sameRoutine = routineId
    ? matching.filter((workout) => workout.routineId === routineId)
    : [];
  const candidates = sameRoutine.length > 0 ? sameRoutine : matching;
  let best: Workout | null = null;
  for (const w of candidates) {
    if (best === null || w.date > best.date || (w.date === best.date && w.startTs > best.startTs)) {
      best = w;
    }
  }
  return best;
}

/** Stretches or trims `weights` to exactly `count` entries, repeating the last one. */
function fitToSets(weights: number[], count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(weights[Math.min(i, weights.length - 1)]);
  }
  return out;
}

/** Next-session weights per set plus the i18n key explaining why. */
export function suggest(rx: RoutineExercise, history: Workout[], routineId?: string): Suggestion {
  const targets = rx.setTargets?.length
    ? rx.setTargets
    : Array.from({ length: rx.sets }, () => ({
        repMin: rx.repMin,
        repMax: rx.repMax,
        startWeightKg: rx.startWeightKg,
      }));
  const startWeights = targets.map((target) => target.startWeightKg ?? rx.startWeightKg ?? 0);
  const last = lastWorkoutWith(history, rx.exerciseId, routineId);
  if (!last) return { weights: startWeights, hintKey: 'suggest.start' };

  const lastSets = last.sets.filter(
    (s) => s.done && kindOf(s.kind) === 'working' && s.exerciseId === rx.exerciseId,
  );
  const lastWeights = fitToSets(
    lastSets.map((s) => s.weightKg),
    targets.length,
  );

  if (rx.setTargets?.length) {
    const increment = rx.incrementKg ?? DEFAULT_INCREMENT_KG;
    const weights = lastWeights.map((weight, index) => {
      const target = targets[index];
      const previous = lastSets[index];
      return target.repMax !== null && previous && previous.reps >= target.repMax
        ? weight + increment
        : weight;
    });
    return {
      weights,
      hintKey: weights.some((weight, index) => weight > lastWeights[index])
        ? 'suggest.increase'
        : 'suggest.repeat',
    };
  }

  const repMax = rx.repMax;
  const closedTopOfRange =
    repMax !== null && lastSets.filter((s) => s.reps >= repMax).length >= targets.length;
  if (closedTopOfRange) {
    const increment = rx.incrementKg ?? DEFAULT_INCREMENT_KG;
    return { weights: lastWeights.map((w) => w + increment), hintKey: 'suggest.increase' };
  }

  return { weights: lastWeights, hintKey: 'suggest.repeat' };
}
