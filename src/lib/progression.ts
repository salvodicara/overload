import { kindOf, type RoutineExercise, type Workout } from './types';

export type Suggestion = { weights: number[]; hintKey: string };

const DEFAULT_INCREMENT_KG = 2.5;

/** Most recent workout (date, then startTs) holding at least one completed set of the exercise. */
function lastWorkoutWith(history: Workout[], exerciseId: string): Workout | null {
  let best: Workout | null = null;
  for (const w of history) {
    if (
      !w.sets.some((s) => s.done && kindOf(s.kind) === 'working' && s.exerciseId === exerciseId)
    ) {
      continue;
    }
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
export function suggest(rx: RoutineExercise, history: Workout[]): Suggestion {
  const startWeights = new Array<number>(rx.sets).fill(rx.startWeightKg ?? 0);
  const last = lastWorkoutWith(history, rx.exerciseId);
  if (!last) return { weights: startWeights, hintKey: 'suggest.start' };

  const lastSets = last.sets.filter(
    (s) => s.done && kindOf(s.kind) === 'working' && s.exerciseId === rx.exerciseId,
  );
  const lastWeights = fitToSets(
    lastSets.map((s) => s.weightKg),
    rx.sets,
  );

  const repMax = rx.repMax;
  const closedTopOfRange =
    repMax !== null && lastSets.filter((s) => s.reps >= repMax).length >= rx.sets;
  if (closedTopOfRange) {
    const increment = rx.incrementKg ?? DEFAULT_INCREMENT_KG;
    return { weights: lastWeights.map((w) => w + increment), hintKey: 'suggest.increase' };
  }

  return { weights: lastWeights, hintKey: 'suggest.repeat' };
}
